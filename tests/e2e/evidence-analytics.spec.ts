import { expect, test } from "@playwright/test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
const api = "http://127.0.0.1:3218";
async function database() {
  const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  const [rows] = await db.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) { await db.end(); throw new Error("Refusing unverified database"); }
  return db;
}
test.beforeAll(async () => { const db = await database(); await db.end(); });

test("P45 validated capital boundaries persist into RFM scores and ignore pending payments", async ({ context }) => {
  const db=await database();
  try {
    expect((await context.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
    for(const [amount,score] of [[0,1],[0.01,2],[1499.99,2],[1500,3],[2999.99,3],[3000,4],[14999.99,4],[15000,5]] as const) {
      const code=`CAP-${randomUUID().slice(0,8)}`;
      await db.execute("INSERT INTO member_profiles(member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Capital Boundary','Rice','Associate','Approved','Active','2025-01-01','2025-01-02')",[code]);
      const [members]=await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?",[code]); const memberId=String(members[0].member_id);
      if(amount) await db.execute("INSERT INTO share_capital_payments(member_id,amount,payment_date,payment_status) VALUES(?,?,?,'Validated')",[memberId,amount,"2026-01-01"]);
      await db.execute("INSERT INTO share_capital_payments(member_id,amount,payment_date,payment_status) VALUES(?,15000,?,'Pending')",[memberId,"2026-01-01"]);
      const input={memberId,basisPeriodEnd:"2026-10-31"}; const preview=await context.request.post(`${api}/api/member-indicators/workspace/preview`,{data:input});expect(preview.status(),String(amount)).toBe(200);
      const commit=await context.request.post(`${api}/api/member-indicators/workspace/recalculate`,{data:{...input,confirmed:true,previewFingerprint:(await preview.json()).data.previewFingerprint}});expect(commit.status(),String(amount)).toBe(200);
      const [rows]=await db.execute<RowDataPacket[]>("SELECT i.contribution_score,i.validated_share_capital,i.total_score,i.recency_score,i.frequency_score,m.official_member_status FROM member_status_indicators i JOIN member_profiles m ON m.member_id=i.member_id WHERE i.member_id=? ORDER BY i.indicator_id DESC LIMIT 1",[memberId]);
      expect(Number(rows[0].contribution_score),String(amount)).toBe(score);expect(Number(rows[0].validated_share_capital)).toBe(amount);
      expect(Number(rows[0].total_score)).toBe(Number(rows[0].recency_score)+Number(rows[0].frequency_score)+score);expect(rows[0].official_member_status).toBe("Active");
    }
  } finally {await db.end();}
});

test("P41 P43 P44 qualifying attendance drives the correct member's rolling scores", async ({ context }) => {
  const db = await database();
  try {
    expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" } })).status()).toBe(200);
    const code = `RFM-${randomUUID().slice(0, 8)}`;
    await db.execute("INSERT INTO member_profiles(member_code,full_name,barangay,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Attendance Member','Lumbangan','Rice','Associate','Approved','Active','2025-01-01','2025-01-02 00:00:00')", [code]);
    const [members] = await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?", [code]); const memberId = String(members[0].member_id);
    const [result] = await db.execute<import("mysql2").ResultSetHeader>("INSERT INTO cooperative_activities(activity_code,activity_name,activity_date,is_rfm_qualifying) VALUES(?,'Synthetic Assembly','2026-10-01',1)", [code]);
    const activityId = result.insertId;
    for (const [date,status] of [["2025-10-31","Participated"],["2026-10-01","Participated"],["2026-10-31","Participated"],["2026-10-25","Absent"]]) {
      await db.execute("INSERT INTO member_activity_participation(member_id,activity_id,participation_date,participation_status) VALUES(?,?,?,?)", [memberId,activityId,date,status]);
    }
    const input = { memberId, basisPeriodEnd: "2026-10-31" };
    const preview = await context.request.post(`${api}/api/member-indicators/workspace/preview`, { data: input }); expect(preview.status()).toBe(200);
    const commit = await context.request.post(`${api}/api/member-indicators/workspace/recalculate`, { data: { ...input, confirmed: true, previewFingerprint: (await preview.json()).data.previewFingerprint } }); expect(commit.status()).toBe(200);
    const [rows] = await db.execute<RowDataPacket[]>("SELECT recency_days,frequency_count,recency_score,frequency_score,basis_summary FROM member_status_indicators WHERE member_id=? ORDER BY indicator_id DESC LIMIT 1", [memberId]);
    expect(rows).toHaveLength(1); expect(Number(rows[0].recency_days)).toBe(0); expect(Number(rows[0].frequency_count)).toBe(3); expect(Number(rows[0].recency_score)).toBe(5); expect(Number(rows[0].frequency_score)).toBe(3);
    const metadata = typeof rows[0].basis_summary === "string" ? JSON.parse(rows[0].basis_summary) : rows[0].basis_summary;
    expect(metadata.evidence.participation.filter((p: { qualifies: boolean }) => p.qualifies)).toHaveLength(3);
    expect(metadata.evidence.participation.filter((p: { qualifies: boolean }) => !p.qualifies)).toHaveLength(1);
    expect(metadata.evidence.participation.every((p: { activityId: string }) => p.activityId === String(activityId))).toBe(true);
  } finally { await db.end(); }
});

test("P28 P29 filtered finance dashboard and Excel reflect controlled ledger data", async ({ context }) => {
  const db = await database();
  try {
    expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" } })).status()).toBe(200);
    const tag = `EX-${randomUUID().slice(0,8)}`;
    const [users] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
    const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES')");
    for (const [suffix,type,category,amount,date] of [["IN","Income","OTHER_INCOME",5000,"2020-04-13"],["EXP","Expense","OFFICE_SUPPLIES",1700,"2020-04-13"],["OUT","Expense","OFFICE_SUPPLIES",900,"2020-04-14"]] as const) {
      await db.execute("INSERT INTO financial_records(record_number,financial_category_id,recorded_by,approved_by,record_type,source_module,amount,record_date,record_status) VALUES(?,?,?,?,?,'Manual',?,?,'Active')", [`${tag}-${suffix}`,cats.find(c=>c.category_code===category)!.financial_category_id,users[0].user_id,users[0].user_id,type,amount,date]);
    }
    const q = new URLSearchParams({ period:"custom",start:"2020-04-13",end:"2020-04-13",compare:"none",reference:tag });
    const report = await context.request.get(`${api}/api/chairman/financial-analytics?${q}`); expect(report.status()).toBe(200);
    expect((await report.json()).data.overview).toMatchObject({ income:5000, expenses:1700, net:3300, recordCount:2 });
    const exportResponse = await context.request.get(`${api}/api/chairman/financial-analytics/export?${q}`); expect(exportResponse.status()).toBe(200);
    const zip = await JSZip.loadAsync(await exportResponse.body());
    const sheet = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(sheet).toContain("Recorded Operating Income"); expect(sheet).toContain("5000"); expect(sheet).toContain("1700"); expect(sheet).toContain("3300");
    const records = new URLSearchParams({period:"custom",startDate:"2020-04-13",endDate:"2020-04-13",compare:"none",kind:"records",format:"xlsx",search:tag,view:"posted"});
    const detail = await context.request.get(`${api}/api/financial-overview/expenses/export?${records}`);
    expect(detail.status()).toBe(200);
    const detailZip = await JSZip.loadAsync(await detail.body());
    const xml = await detailZip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(xml).toContain(`${tag}-EXP`); expect(xml).toContain("1700"); expect(xml).not.toContain(`${tag}-OUT`);
    const allRows = new URLSearchParams({period:"custom",startDate:"2020-04-13",endDate:"2020-04-13",compare:"none",format:"xlsx",search:tag,view:"posted"});
    const fullExport = await context.request.get(`${api}/api/financial-overview/export?${allRows}`); expect(fullExport.status()).toBe(200);
    const workbook = await JSZip.loadAsync(await fullExport.body());
    const sheets = await Promise.all(Object.keys(workbook.files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)).map(name=>workbook.file(name)!.async("string")));
    const transactionSheet = sheets.find(sheet=>sheet.includes(`${tag}-IN`) && sheet.includes(`${tag}-EXP`));
    expect(transactionSheet).toBeTruthy();
    for(const value of ["2020-04-13","Income","Expense","Manual","5000","1700"]) expect(transactionSheet).toContain(value);
    expect(transactionSheet).not.toContain(`${tag}-OUT`);
  } finally { await db.end(); }
});

test("P49 member analytics agrees with isolated barangay and approval cohorts", async ({ context }) => {
  const db = await database();
  try {
    expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" } })).status()).toBe(200);
    const prefix = `ANA-${randomUUID().slice(0,8)}`, barangay = `Synthetic ${randomUUID().slice(0,8)}`;
    for (const [i,sector,date] of [[1,"Rice","2025-01-10"],[2,"Corn","2025-02-10"],[3,"Rice","2026-01-10"]] as const) {
      await db.execute("INSERT INTO member_profiles(member_code,full_name,barangay,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?, 'Synthetic Analytics Member',?,?,'Associate','Approved','Active',?,?)", [`${prefix}-${i}`,barangay,sector,date,`${date} 04:00:00`]);
    }
    const q = new URLSearchParams({start:"2025-01-01",end:"2026-10-31",asOf:"2026-10-31",barangays:barangay});
    const response = await context.request.get(`${api}/api/chairman/member-analytics?${q}`); expect(response.status()).toBe(200);
    const report = (await response.json()).data;
    expect(report.kpis.total).toBe(3); expect(report.kpis.newApprovals).toBe(3);
    expect(report.sectors.find((x:{name:string})=>x.name==="Rice").count).toBe(2);
    expect(report.sectors.find((x:{name:string})=>x.name==="Corn").count).toBe(1);
    expect(report.geography.find((x:{barangay:string})=>x.barangay===barangay).totalMembers).toBe(3);
    expect(report.growth.find((x:{month:string})=>x.month==="2025-01").newMembers).toBe(1);
    expect(report.growth.find((x:{month:string})=>x.month==="2025-02").newMembers).toBe(1);
    expect(report.growth.find((x:{month:string})=>x.month==="2026-01").newMembers).toBe(1);
    expect(report.recruitment.monthly.find((x:{month:string})=>x.month==="2026-01").count).toBe(1);
  } finally { await db.end(); }
});

test("P43 P44 recency and frequency thresholds from persisted attendance at a fixed basis", async ({ context }) => {
  const db = await database();
  try {
    test.setTimeout(90_000);
    expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" } })).status()).toBe(200);
    const basis = "2026-10-31", prefix = `BOUND-${randomUUID().slice(0,8)}`;
    const date = (days: number) => new Date(Date.parse(`${basis}T00:00:00Z`)-days*86400000).toISOString().slice(0,10);
    const cases: Array<{name:string;days:number[];recency:number;frequency:number}> = [
      ...[[0,5],[30,5],[31,4],[90,4],[91,3],[180,3],[181,2],[365,2],[366,1]].map(([d,score])=>({name:`R${d}`,days:[d],recency:score,frequency:d<=365?2:1})),
      ...[[0,1],[1,2],[2,2],[3,3],[5,3],[6,4],[11,4],[12,5]].map(([n,score])=>({name:`F${n}`,days:Array.from({length:n},(_,i)=>i+1),recency:n?5:1,frequency:score})),
    ];
    for (const item of cases) {
      const code = `${prefix}-${item.name}`;
      await db.execute("INSERT INTO member_profiles(member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Boundary Member','Rice','Associate','Approved','Active','2025-01-01','2025-01-02 00:00:00')",[code]);
      const [members] = await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?",[code]); const id=String(members[0].member_id);
      for (const [index,days] of item.days.entries()) {
        const [activity]=await db.execute<import("mysql2").ResultSetHeader>("INSERT INTO cooperative_activities(activity_code,activity_name,activity_date,is_rfm_qualifying) VALUES(?,'Synthetic Attendance',?,1)",[`${code}-${index}`,date(days)]);
        await db.execute("INSERT INTO member_activity_participation(member_id,activity_id,participation_date,participation_status) VALUES(?,?,?,'Participated')",[id,activity.insertId,date(days)]);
      }
      const input={memberId:id,basisPeriodEnd:basis};
      const preview=await context.request.post(`${api}/api/member-indicators/workspace/preview`,{data:input}); expect(preview.status(),item.name).toBe(200);
      const commit=await context.request.post(`${api}/api/member-indicators/workspace/recalculate`,{data:{...input,confirmed:true,previewFingerprint:(await preview.json()).data.previewFingerprint}}); expect(commit.status(),item.name).toBe(200);
      const [scores]=await db.execute<RowDataPacket[]>("SELECT recency_score,frequency_score,recency_days,frequency_count FROM member_status_indicators WHERE member_id=? ORDER BY indicator_id DESC LIMIT 1",[id]);
      expect(Number(scores[0].recency_score),item.name).toBe(item.recency); expect(Number(scores[0].frequency_score),item.name).toBe(item.frequency);
      expect(Number(scores[0].frequency_count),item.name).toBe(item.days.filter(d=>d<=365).length);
    }
  } finally { await db.end(); }
});

test("P46 P47 persisted combined bands and inactivity override", async ({ context }) => {
  const db = await database();
  try {
    test.setTimeout(90_000);
    expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" } })).status()).toBe(200);
    const basis="2026-10-31", prefix=`BANDS-${randomUUID().slice(0,8)}`;
    const date=(days:number)=>new Date(Date.parse(`${basis}T00:00:00Z`)-days*86400000).toISOString().slice(0,10);
    const cases = [
      {name:"three",days:[],capital:0,total:3,label:"Inactive",safeguard:true},
      {name:"six",days:[365],capital:1,total:6,label:"Inactive",safeguard:false},
      {name:"seven",days:[365],capital:1500,total:7,label:"Needs Monitoring",safeguard:false},
      {name:"eleven",days:[100,101,102],capital:15000,total:11,label:"Needs Monitoring",safeguard:false},
      {name:"twelve",days:[31,32,33],capital:15000,total:12,label:"Active",safeguard:false},
      {name:"fifteen",days:Array.from({length:12},(_,i)=>i+1),capital:15000,total:15,label:"Active",safeguard:false},
      {name:"override-none",days:[],capital:15000,total:7,label:"Inactive",safeguard:true},
      {name:"override-old",days:[366],capital:15000,total:7,label:"Inactive",safeguard:true},
    ];
    for (const item of cases) {
      const code=`${prefix}-${item.name}`;
      await db.execute("INSERT INTO member_profiles(member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Band Member','Rice','Associate','Approved','Active','2025-01-01','2025-01-02 00:00:00')",[code]);
      const [members]=await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?",[code]); const id=String(members[0].member_id);
      if(item.capital) await db.execute("INSERT INTO share_capital_payments(member_id,amount,payment_date,payment_status) VALUES(?,?,?,'Validated')",[id,item.capital,"2026-01-01"]);
      for(const [index,days] of item.days.entries()) {
        const [activity]=await db.execute<import("mysql2").ResultSetHeader>("INSERT INTO cooperative_activities(activity_code,activity_name,activity_date,is_rfm_qualifying) VALUES(?,'Synthetic Attendance',?,1)",[`${code}-${index}`,date(days)]);
        await db.execute("INSERT INTO member_activity_participation(member_id,activity_id,participation_date,participation_status) VALUES(?,?,?,'Participated')",[id,activity.insertId,date(days)]);
      }
      const input={memberId:id,basisPeriodEnd:basis};
      const preview=await context.request.post(`${api}/api/member-indicators/workspace/preview`,{data:input}); expect(preview.status(),item.name).toBe(200);
      const commit=await context.request.post(`${api}/api/member-indicators/workspace/recalculate`,{data:{...input,confirmed:true,previewFingerprint:(await preview.json()).data.previewFingerprint}}); expect(commit.status(),item.name).toBe(200);
      const [scores]=await db.execute<RowDataPacket[]>("SELECT total_score,status_label,basis_summary FROM member_status_indicators WHERE member_id=? ORDER BY indicator_id DESC LIMIT 1",[id]);
      expect(Number(scores[0].total_score),item.name).toBe(item.total); expect(scores[0].status_label,item.name).toBe(item.label);
      const metadata=typeof scores[0].basis_summary==="string"?JSON.parse(scores[0].basis_summary):scores[0].basis_summary;
      expect(metadata.scoring.safeguardApplied,item.name).toBe(item.safeguard);
    }
  } finally { await db.end(); }
});

test("P50 financial and membership analytics react only to their own fixtures", async ({ context }) => {
  const db=await database();
  try {
    expect((await context.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
    const tag=`SEP-${randomUUID().slice(0,8)}`,barangay=`Synthetic ${randomUUID().slice(0,8)}`;
    const [staff]=await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
    const [category]=await db.query<RowDataPacket[]>("SELECT financial_category_id FROM financial_categories WHERE category_code='OTHER_INCOME'");
    const addMember=(suffix:string)=>db.execute("INSERT INTO member_profiles(member_code,full_name,barangay,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Separation Member',?,'Rice','Associate','Approved','Active','2025-01-01','2025-01-02 00:00:00')",[`${tag}-${suffix}`,barangay]);
    const addIncome=(suffix:string,amount:number)=>db.execute("INSERT INTO financial_records(record_number,financial_category_id,recorded_by,approved_by,record_type,source_module,amount,record_date,record_status) VALUES(?,?,?,?,'Income','Manual',?,'2020-04-20','Active')",[`${tag}-${suffix}`,category[0].financial_category_id,staff[0].user_id,staff[0].user_id,amount]);
    await addMember("M1"); await addIncome("F1",5000);
    const mq=new URLSearchParams({start:"2025-01-01",end:"2026-10-31",asOf:"2026-10-31",barangays:barangay});
    const fq=new URLSearchParams({period:"custom",start:"2020-04-20",end:"2020-04-20",compare:"none",reference:tag});
    const read=async()=>{
      const [m,f]=await Promise.all([context.request.get(`${api}/api/chairman/member-analytics?${mq}`),context.request.get(`${api}/api/chairman/financial-analytics?${fq}`)]);
      expect(m.status()).toBe(200); expect(f.status()).toBe(200);
      return { members:(await m.json()).data.kpis.total, income:(await f.json()).data.overview.income };
    };
    expect(await read()).toEqual({members:1,income:5000});
    await addIncome("F2",1000); expect(await read()).toEqual({members:1,income:6000});
    await addMember("M2"); expect(await read()).toEqual({members:2,income:6000});
  } finally { await db.end(); }
});
