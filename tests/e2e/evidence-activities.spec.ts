import { expect, test } from "@playwright/test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";

const api="http://127.0.0.1:3218";
test("P40 P41 scheduled event and recorded attendance drive member analytics with audit and permissions", async ({ browser, page, context }) => {
  const db=await mysql.createConnection({host:"127.0.0.1",port:33327,user:"root",database:"trackcoop_evidence_synthetic"});
  const member=await browser.newContext(), bookkeeper=await browser.newContext();
  try {
    const [identity]=await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
    const dir=String(identity[0].dir).replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
    if(Number(identity[0].port)!==33327||identity[0].db!=="trackcoop_evidence_synthetic"||!dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
    for(const [ctx,identifier,password] of [[context,"chairman.test@trackcoop.local","ChairmanTest123!"],[member,"maria.member@trackcoop.local","MemberTest123!"],[bookkeeper,"bookkeeper.test@trackcoop.local","BookkeeperTest123!"]] as const) expect((await ctx.request.post(`${api}/api/auth/login`,{data:{identifier,password}})).status()).toBe(200);
    const token=randomUUID().slice(0,8),code=`EVENT-${token}`, title=`Synthetic assembly ${token}`;
    await db.execute("INSERT INTO member_profiles(member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,?,'Rice','Associate','Approved','Active','2025-01-01','2025-01-02')",[code,`Event Member ${token}`]);
    const [members]=await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?",[code]); const memberId=String(members[0].member_id);
    const payload={title,date:"2026-10-31",time:"10:30",location:"Synthetic hall",details:"Assembly",qualifies:true};
    expect((await member.request.post(`${api}/api/activities`,{data:payload})).status()).toBe(403);
    expect((await bookkeeper.request.post(`${api}/api/activities`,{data:payload})).status()).toBe(403);
    expect((await context.request.post(`${api}/api/activities`,{data:{...payload,title:""}})).status()).toBe(400);
    await page.goto("/portal/chairman/activities"); await expect(page.getByRole("heading",{name:"Events and Attendance"})).toBeVisible();
    await page.getByLabel("Event title").fill(title); await page.getByLabel("Date",{exact:true}).fill(payload.date); await page.getByLabel("Time",{exact:true}).fill(payload.time); await page.getByLabel("Location").fill(payload.location); await page.getByLabel("Details").fill(payload.details);
    await page.getByRole("button",{name:"Schedule event"}).click(); await expect(page.getByRole("status")).toContainText("Event scheduled");
    const [events]=await db.execute<RowDataPacket[]>("SELECT activity_id FROM cooperative_activities WHERE activity_name=?",[title]); expect(events).toHaveLength(1); const eventId=String(events[0].activity_id);
    expect((await member.request.get(`${api}/api/activities/${eventId}`)).status()).toBe(403);
    expect((await member.request.patch(`${api}/api/activities/${eventId}`,{data:payload})).status()).toBe(403);
    await page.getByRole("button",{name:"Edit",exact:true}).first().click();
    await page.getByLabel("Location").fill("Updated hall"); await page.getByRole("button",{name:"Save changes"}).click();
    await expect(page.getByRole("status")).toContainText("Event updated");
    await page.getByRole("button",{name:"View attendance"}).first().click(); await expect(page.getByText("Updated hall").first()).toBeVisible();
    await page.screenshot({path:`evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN}/screenshots/P40-events.png`,fullPage:true});
    await page.getByLabel("Find approved member").fill(code); await page.getByRole("button",{name:"Search members"}).click();
    const select=page.getByRole("combobox",{name:"Member"}); await select.fill(code); await page.getByRole("option",{name:new RegExp(code)}).click();
    await page.getByRole("button",{name:"Record attendance"}).click(); await expect(page.getByRole("status")).toContainText("Attendance recorded"); await expect(page.getByText(new RegExp(`Event Member ${token}`))).toBeVisible();
    await page.screenshot({path:`evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN}/screenshots/P40-attendance.png`,fullPage:true});
    for(const width of [768,390]) { await page.setViewportSize({width,height:844}); await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); }
    expect((await context.request.post(`${api}/api/activities/${eventId}/attendance`,{data:{memberId}})).status()).toBe(409);
    expect((await member.request.post(`${api}/api/activities/${eventId}/attendance`,{data:{memberId}})).status()).toBe(403);
    const detail=await context.request.get(`${api}/api/activities/${eventId}`); const data=(await detail.json()).data; expect(data.attendance).toHaveLength(1); expect(data.attendance[0]).toMatchObject({memberId,status:"Participated"});
    const participationId=data.attendance[0].id;
    const input={memberId,basisPeriodEnd:"2026-10-31"}; const preview=await context.request.post(`${api}/api/member-indicators/workspace/preview`,{data:input}); expect(preview.status()).toBe(200);
    const calc=await context.request.post(`${api}/api/member-indicators/workspace/recalculate`,{data:{...input,confirmed:true,previewFingerprint:(await preview.json()).data.previewFingerprint}});expect(calc.status()).toBe(200);
    const [scores]=await db.execute<RowDataPacket[]>("SELECT recency_days,frequency_count FROM member_status_indicators WHERE member_id=? ORDER BY indicator_id DESC LIMIT 1",[memberId]); expect(Number(scores[0].recency_days)).toBe(0); expect(Number(scores[0].frequency_count)).toBe(1);
    expect((await bookkeeper.request.patch(`${api}/api/activities/${eventId}/attendance/${participationId}`,{data:{status:"Voided",reason:"Recorded by mistake"}})).status()).toBe(200);
    const [record]=await db.execute<RowDataPacket[]>("SELECT participation_status FROM member_activity_participation WHERE participation_id=?",[participationId]); expect(record[0].participation_status).toBe("Voided");
    const [audit]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_table='member_activity_participation' AND record_id=? AND action='attendance.corrected'",[participationId]);expect(Number(audit[0].n)).toBe(1);
    const afterVoid=await context.request.post(`${api}/api/member-indicators/workspace/preview`,{data:input});expect(afterVoid.status()).toBe(200);
    const recalc=await context.request.post(`${api}/api/member-indicators/workspace/recalculate`,{data:{...input,confirmed:true,previewFingerprint:(await afterVoid.json()).data.previewFingerprint}});expect(recalc.status()).toBe(200);
    const [corrected]=await db.execute<RowDataPacket[]>("SELECT frequency_count FROM member_status_indicators WHERE member_id=? ORDER BY indicator_id DESC LIMIT 1",[memberId]);expect(Number(corrected[0].frequency_count)).toBe(0);
    expect((await context.request.post(`${api}/api/activities/${eventId}/cancel`)).status()).toBe(200);
    const [cancelled]=await db.execute<RowDataPacket[]>("SELECT activity_status,is_rfm_qualifying FROM cooperative_activities WHERE activity_id=?",[eventId]);expect(cancelled[0].activity_status).toBe("Cancelled");expect(Number(cancelled[0].is_rfm_qualifying)).toBe(0);
    const [status]=await db.execute<RowDataPacket[]>("SELECT official_member_status FROM member_profiles WHERE member_id=?",[memberId]);expect(status[0].official_member_status).toBe("Active");
  } finally {await db.end();await member.close();await bookkeeper.close();}
});
