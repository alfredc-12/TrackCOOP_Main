import { expect, test, type BrowserContext } from "@playwright/test";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";

const api = "http://127.0.0.1:3218";
async function database() {
  const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  const [rows] = await db.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) { await db.end(); throw new Error("Refusing unverified database"); }
  return db;
}
async function login(context: BrowserContext) {
  expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" } })).status()).toBe(200);
}
async function member(db: Connection) {
  const code = `PAY-${randomUUID().slice(0, 8)}`;
  await db.execute("INSERT INTO member_profiles(member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Payment Member','Rice','Associate','Approved','Active','2026-01-01','2026-01-02 00:00:00')", [code]);
  const [rows] = await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?", [code]);
  return String(rows[0].member_id);
}
async function createReference(context: BrowserContext, memberId: string, amount: number, proofFilePath?: string) {
  const ref = `SYN-${randomUUID()}`;
  const response = await context.request.post(`${api}/api/payment-references`, { data: { memberId, payerName: "Synthetic Member", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: ref, paymentPurpose: "Share Capital", relatedEntityType: "member_profile", relatedEntityId: memberId, amount, ...(proofFilePath ? { proofFilePath } : {}) } });
  expect(response.status()).toBe(201);
  return String((await response.json()).data.id);
}
async function counts(db: Connection, id: string) {
  const [rows] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital, (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial, (SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [id,id,id]);
  return { capital: Number(rows[0].capital), financial: Number(rows[0].financial), receipts: Number(rows[0].receipts) };
}
test.beforeAll(async () => { const db = await database(); await db.end(); });

test("P21 P22 manual proof review and duplicate validation do not duplicate postings", async ({ context }) => {
  const db = await database();
  try {
    await login(context); const memberId = await member(db);
    const title = `Proof ${randomUUID()}`, bytes = Buffer.from("%PDF-1.4\n% synthetic proof\n%%EOF\n");
    const upload = await context.request.post(`${api}/api/documents`, { multipart: { title, category: "FINANCIAL", documentType: "Financial Document", accessLevel: "BOOKKEEPER_ONLY", file: { name: "proof.pdf", mimeType: "application/pdf", buffer: bytes } } });
    expect(upload.status()).toBe(201);
    const [docs] = await db.execute<RowDataPacket[]>("SELECT file_path FROM documents WHERE title=?", [title]);
    const id = await createReference(context, memberId, 100, String(docs[0].file_path));
    const proof = await context.request.get(`${api}/api/payment-references/${id}/proof`);
    expect(proof.status()).toBe(200); expect(await proof.body()).toEqual(bytes);
    expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
    const result = await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} });
    expect(result.status()).toBe(200);
    const [rows] = await db.execute<RowDataPacket[]>("SELECT validation_status,validation_source,amount FROM payment_references WHERE payment_reference_id=?", [id]);
    expect(rows[0]).toMatchObject({ validation_status: "Validated", validation_source: "Manual Bookkeeper" }); expect(Number(rows[0].amount)).toBe(100);
    expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
    expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(400);
    expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
  } finally { await db.end(); }
});

test("P23 pending and rejected payments do not create financial receipts", async ({ context }) => {
  const db = await database();
  try {
    await login(context); const memberId = await member(db); const id = await createReference(context, memberId, 123);
    expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
    expect((await context.request.post(`${api}/api/payment-references/${id}/reject`, { data: { reason: "Synthetic proof rejected" } })).status()).toBe(200);
    expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(409);
    const [rows] = await db.execute<RowDataPacket[]>("SELECT validation_status FROM payment_references WHERE payment_reference_id=?", [id]);
    expect(rows[0].validation_status).toBe("Rejected"); expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  } finally { await db.end(); }
});

test("P15 share capital accepts maximum and rejects a cent above without posting", async ({ context }) => {
  const db = await database();
  try {
    await login(context); const memberId = await member(db);
    for (const amount of [14999.99, 0.01]) {
      const id = await createReference(context, memberId, amount);
      expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(200);
      expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
    }
    const over = await createReference(context, memberId, 0.01);
    expect((await context.request.post(`${api}/api/payment-references/${over}/validate`, { data: {} })).status()).toBe(409);
    expect(await counts(db, over)).toEqual({ capital: 0, financial: 0, receipts: 0 });
    const [rows] = await db.execute<RowDataPacket[]>("SELECT SUM(amount) AS total FROM share_capital_payments WHERE member_id=? AND payment_status='Validated'", [memberId]);
    expect(Number(rows[0].total)).toBe(15000);
  } finally { await db.end(); }
});

test("P14 membership fee and initial capital accept only the required amounts", async ({ browser, context, request }) => {
  const db = await database();
  const memberContext = await browser.newContext();
  const chairman = await browser.newContext();
  try {
    await login(context);
    expect((await memberContext.request.post(`${api}/api/auth/login`, { data: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" } })).status()).toBe(200);
    expect((await chairman.request.post(`${api}/api/auth/login`, { data: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" } })).status()).toBe(200);
    for (const [requestedMembershipType, purpose, amount] of [["Associate", "Associate Membership Fee", 200], ["True Member", "Share Capital", 1500]] as const) {
      const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Payment${token}`;
      const applicant = { requestedMembershipType, firstName, lastName: "Fixture", email: `payment-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
      const submission = await request.post(`${api}/api/membership-applications/public`, { data: applicant });
      expect(submission.status()).toBe(201);
      const code = (await submission.json()).data.applicationCode;
      const [apps] = await db.execute<RowDataPacket[]>("SELECT membership_application_id,membership_fee_amount,initial_share_capital_amount,target_share_capital_amount FROM membership_applications WHERE application_code=?", [code]);
      expect(Number(apps[0].membership_fee_amount)).toBe(200); expect(Number(apps[0].initial_share_capital_amount)).toBe(1500); expect(Number(apps[0].target_share_capital_amount)).toBe(3000);
      const applicationId = String(apps[0].membership_application_id);
      const review=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/start-review`,{data:{}}); expect(review.status(),await review.text()).toBe(200);
      const [signature]=await db.execute<RowDataPacket[]>("SELECT membership_application_requirement_id FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type='Signed Application'",[applicationId]);
      const requirementUrl=`${api}/api/membership-application-requirements/${signature[0].membership_application_requirement_id}`;
      expect((await chairman.request.patch(requirementUrl,{data:{requirementStatus:"Verified"}})).status()).toBe(409);
      const document=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/documents`,{multipart:{documentType:"Signed Application",document:{name:"synthetic-application.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\n% synthetic signed application\n%%EOF\n")}}});
      expect(document.status(),await document.text()).toBe(201);
      const verified=await chairman.request.patch(requirementUrl,{data:{requirementStatus:"Verified",documentId:String((await document.json()).data.id),remarks:"Synthetic signed application reviewed"}});
      expect(verified.status(),await verified.text()).toBe(200);
      const paymentStage=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/approve-for-payment`,{data:{}});expect(paymentStage.status(),await paymentStage.text()).toBe(200);
      const make = (value: number, paymentPurpose: string = purpose) => context.request.post(`${api}/api/payment-references`, { data: { payerName: "Synthetic Applicant", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: `SYN-${randomUUID()}`, paymentPurpose, relatedEntityType: "membership_application", relatedEntityId: applicationId, amount: value } });
      const invalidReference=await context.request.post(`${api}/api/payment-references`, { data: { payerName:"Synthetic Applicant",provider:"Synthetic Cash",paymentChannel:"Cash",referenceNumber:"",paymentPurpose:purpose,relatedEntityType:"membership_application",relatedEntityId:applicationId,amount } });
      expect(invalidReference.status()).toBe(400);
      expect((await make(amount - 0.01)).status()).toBe(422);
      expect((await make(amount + 0.01)).status()).toBe(422);
      const exact = await make(amount);
      expect(exact.status()).toBe(201);
      const mainId=String((await exact.json()).data.id);
      expect(await counts(db,mainId)).toEqual({capital:0,financial:0,receipts:0});
      expect((await make(amount)).status()).toBe(409);
      expect((await memberContext.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(403);
      expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(200);
      expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(400);
      // Before conversion the initial capital lives in the application capital events,
      // not in a member-owned share_capital_payments row.
      expect(await counts(db,mainId)).toEqual({capital:0,financial:1,receipts:1});
      if (purpose === "Share Capital") {
        const [events]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(e.amount) AS amount FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[applicationId]);
        expect(Number(events[0].n)).toBe(1); expect(Number(events[0].amount)).toBe(1500);
      }
      if (requestedMembershipType === "True Member") {
        // The persisted policy includes a separate fee, and settlement requires it.
        const fee=await make(200, "Associate Membership Fee"); expect(fee.status()).toBe(201);
        const feeId=String((await fee.json()).data.id);
        expect(await counts(db,feeId)).toEqual({capital:0,financial:0,receipts:0});
        expect((await context.request.post(`${api}/api/payment-references/${feeId}/validate`,{data:{}})).status()).toBe(200);
        expect(await counts(db,feeId)).toEqual({capital:0,financial:1,receipts:1});
        expect((await make(200,"Associate Membership Fee")).status()).toBe(409);
        const [requirements]=await db.execute<RowDataPacket[]>("SELECT requirement_type,requirement_status FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type IN ('Associate Membership Fee','Initial Share Capital')",[applicationId]);
        expect(requirements).toHaveLength(2); expect(requirements.every(r=>r.requirement_status==='Verified')).toBe(true);
        const approval={approveTrueMembership:false,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Verified application and payments",createMemberPortalAccount:false};
        const approved=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/approve`,{data:approval}); expect(approved.status(),await approved.text()).toBe(200);
      }
    }
  } finally { await chairman.close(); await memberContext.close(); await db.end(); }
});

test("P13 approval classifies prepared True applications at capital boundaries", async ({ browser, request }) => {
  const db=await database(), chairman=await browser.newContext();
  try {
    expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
    for(const amount of [1499.99,1500,2999.99,3000]) {
      const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Class${token}`;
      const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`class-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
      const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
      const code=(await submitted.json()).data.applicationCode;
      const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const id=String(apps[0].membership_application_id);
      await db.execute("UPDATE membership_applications SET application_status='Payment Confirmed' WHERE membership_application_id=?",[id]);
      await db.execute("UPDATE membership_application_requirements SET requirement_status='Waived' WHERE membership_application_id=? AND requirement_type IN ('Signed Application','Associate Membership Fee','Initial Share Capital')",[id]);
      await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,validation_source) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,?,'Validated','Manual Bookkeeper')",[`CLASS-${token}`,id,amount]);
      const approve=(approveTrueMembership:boolean)=>chairman.request.post(`${api}/api/membership-applications/${id}/approve`,{data:{approveTrueMembership,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Synthetic classification fixture",createMemberPortalAccount:false}});
      if(amount<1500) { const rejected=await approve(false); expect(rejected.status(),`initial ${amount}`).toBe(409); continue; }
      if(amount===2999.99) { const rejected=await approve(true); expect(rejected.status(),`true threshold ${amount}`).toBe(409); }
      const response=await approve(amount>=3000); expect(response.status(),`approval ${amount}`).toBe(200);
      const [rows]=await db.execute<RowDataPacket[]>("SELECT a.application_status,m.membership_type,m.official_member_status FROM membership_applications a JOIN member_profiles m ON m.member_id=a.converted_member_id WHERE a.membership_application_id=?",[id]);
      expect(rows[0]).toMatchObject({application_status:"Approved",membership_type:amount>=3000?"True Member":"Associate",official_member_status:"Active"});
    }
  } finally { await chairman.close(); await db.end(); }
});

test("P16 application capital history and progress reflect validated and pending installments", async ({ browser, request }) => {
  const db=await database(), bookkeeper=await browser.newContext(), chairman=await browser.newContext();
  try {
    await login(bookkeeper);
    expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
    const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Progress${token}`;
    const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`progress-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
    const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
    const code=(await submitted.json()).data.applicationCode;
    const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const appId=String(apps[0].membership_application_id);
    await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",[appId]);
    const progress=async()=>{const r=await chairman.request.get(`${api}/api/membership-applications/${appId}/capital-progress`);expect(r.status()).toBe(200);return (await r.json()).data.capital;};
    const first=await bookkeeper.request.post(`${api}/api/payment-references`,{data:{payerName:"Synthetic Applicant",provider:"Synthetic Cash",paymentChannel:"Cash",referenceNumber:`INIT-${token}`,paymentPurpose:"Share Capital",relatedEntityType:"membership_application",relatedEntityId:appId,amount:1500}}); expect(first.status()).toBe(201);
    const firstId=String((await first.json()).data.id);
    expect((await progress()).pending).toBe(1500);
    expect((await bookkeeper.request.post(`${api}/api/payment-references/${firstId}/validate`,{data:{}})).status()).toBe(200);
    const initial=await progress(); expect(initial.validated).toBe(1500); expect(initial.remaining).toBe(1500); expect(initial.status).toBe("In Progress");
    // Move only this synthetic case into the past to exercise the applicable overdue status, then restore its original six-month dates.
    await db.execute("UPDATE membership_capital_cases SET started_on=DATE_SUB(CURDATE(),INTERVAL 7 MONTH),deadline=DATE_SUB(CURDATE(),INTERVAL 1 MONTH) WHERE membership_application_id=?",[appId]);
    expect((await progress()).status).toBe("Overdue");
    await db.execute("UPDATE membership_capital_cases SET started_on=CURDATE(),deadline=DATE_ADD(CURDATE(),INTERVAL 6 MONTH) WHERE membership_application_id=?",[appId]);
    await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,1500,'Pending')",[`NEXT-${token}`,appId]);
    const [second]=await db.execute<RowDataPacket[]>("SELECT payment_reference_id FROM payment_references WHERE reference_number=?",[`NEXT-${token}`]);
    expect((await progress()).pending).toBe(1500);
    expect((await bookkeeper.request.post(`${api}/api/payment-references/${second[0].payment_reference_id}/validate`,{data:{}})).status()).toBe(200);
    const complete=await progress(); expect(complete.validated).toBe(3000); expect(complete.remaining).toBe(0); expect(complete.status).toBe("Completed");
    const [history]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(amount) AS total FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[appId]);
    expect(Number(history[0].n)).toBe(2); expect(Number(history[0].total)).toBe(3000);
    const [deadline]=await db.execute<RowDataPacket[]>("SELECT DATE_FORMAT(deadline,'%Y-%m-%d') AS actual,DATE_FORMAT(DATE_ADD(started_on,INTERVAL 6 MONTH),'%Y-%m-%d') AS expected FROM membership_capital_cases WHERE membership_application_id=?",[appId]);
    expect(deadline[0].actual).toBe(deadline[0].expected);
  } finally {await bookkeeper.close();await chairman.close();await db.end();}
});
