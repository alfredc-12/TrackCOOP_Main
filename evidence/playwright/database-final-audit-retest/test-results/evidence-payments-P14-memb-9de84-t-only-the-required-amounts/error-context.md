# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-payments.spec.ts >> P14 membership fee and initial capital accept only the required amounts
- Location: tests\e2e\evidence-payments.spec.ts:85:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Test source

```ts
  5   | const api = "http://127.0.0.1:3218";
  6   | async function database() {
  7   |   const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  8   |   const [rows] = await db.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  9   |   const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  10  |   if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) { await db.end(); throw new Error("Refusing unverified database"); }
  11  |   return db;
  12  | }
  13  | async function login(context: BrowserContext) {
  14  |   expect((await context.request.post(`${api}/api/auth/login`, { data: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" } })).status()).toBe(200);
  15  | }
  16  | async function member(db: Connection) {
  17  |   const code = `PAY-${randomUUID().slice(0, 8)}`;
  18  |   await db.execute("INSERT INTO member_profiles(member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic Payment Member','Rice','Associate','Approved','Active','2026-01-01','2026-01-02 00:00:00')", [code]);
  19  |   const [rows] = await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?", [code]);
  20  |   return String(rows[0].member_id);
  21  | }
  22  | async function createReference(context: BrowserContext, memberId: string, amount: number, proofFilePath?: string) {
  23  |   const ref = `SYN-${randomUUID()}`;
  24  |   const response = await context.request.post(`${api}/api/payment-references`, { data: { memberId, payerName: "Synthetic Member", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: ref, paymentPurpose: "Share Capital", relatedEntityType: "member_profile", relatedEntityId: memberId, amount, ...(proofFilePath ? { proofFilePath } : {}) } });
  25  |   expect(response.status()).toBe(201);
  26  |   return String((await response.json()).data.id);
  27  | }
  28  | async function counts(db: Connection, id: string) {
  29  |   const [rows] = await db.execute<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM share_capital_payments WHERE payment_reference_id=?) AS capital, (SELECT COUNT(*) FROM financial_records WHERE payment_reference_id=?) AS financial, (SELECT COUNT(*) FROM payment_receipts WHERE payment_reference_id=?) AS receipts", [id,id,id]);
  30  |   return { capital: Number(rows[0].capital), financial: Number(rows[0].financial), receipts: Number(rows[0].receipts) };
  31  | }
  32  | test.beforeAll(async () => { const db = await database(); await db.end(); });
  33  | 
  34  | test("P21 P22 manual proof review and duplicate validation do not duplicate postings", async ({ context }) => {
  35  |   const db = await database();
  36  |   try {
  37  |     await login(context); const memberId = await member(db);
  38  |     const title = `Proof ${randomUUID()}`, bytes = Buffer.from("%PDF-1.4\n% synthetic proof\n%%EOF\n");
  39  |     const upload = await context.request.post(`${api}/api/documents`, { multipart: { title, category: "FINANCIAL", documentType: "Financial Document", accessLevel: "BOOKKEEPER_ONLY", file: { name: "proof.pdf", mimeType: "application/pdf", buffer: bytes } } });
  40  |     expect(upload.status()).toBe(201);
  41  |     const [docs] = await db.execute<RowDataPacket[]>("SELECT file_path FROM documents WHERE title=?", [title]);
  42  |     const id = await createReference(context, memberId, 100, String(docs[0].file_path));
  43  |     const proof = await context.request.get(`${api}/api/payment-references/${id}/proof`);
  44  |     expect(proof.status()).toBe(200); expect(await proof.body()).toEqual(bytes);
  45  |     expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  46  |     const result = await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} });
  47  |     expect(result.status()).toBe(200);
  48  |     const [rows] = await db.execute<RowDataPacket[]>("SELECT validation_status,validation_source,amount FROM payment_references WHERE payment_reference_id=?", [id]);
  49  |     expect(rows[0]).toMatchObject({ validation_status: "Validated", validation_source: "Manual Bookkeeper" }); expect(Number(rows[0].amount)).toBe(100);
  50  |     expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
  51  |     expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(400);
  52  |     expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
  53  |   } finally { await db.end(); }
  54  | });
  55  | 
  56  | test("P23 pending and rejected payments do not create financial receipts", async ({ context }) => {
  57  |   const db = await database();
  58  |   try {
  59  |     await login(context); const memberId = await member(db); const id = await createReference(context, memberId, 123);
  60  |     expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  61  |     expect((await context.request.post(`${api}/api/payment-references/${id}/reject`, { data: { reason: "Synthetic proof rejected" } })).status()).toBe(200);
  62  |     expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(409);
  63  |     const [rows] = await db.execute<RowDataPacket[]>("SELECT validation_status FROM payment_references WHERE payment_reference_id=?", [id]);
  64  |     expect(rows[0].validation_status).toBe("Rejected"); expect(await counts(db, id)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  65  |   } finally { await db.end(); }
  66  | });
  67  | 
  68  | test("P15 share capital accepts maximum and rejects a cent above without posting", async ({ context }) => {
  69  |   const db = await database();
  70  |   try {
  71  |     await login(context); const memberId = await member(db);
  72  |     for (const amount of [14999.99, 0.01]) {
  73  |       const id = await createReference(context, memberId, amount);
  74  |       expect((await context.request.post(`${api}/api/payment-references/${id}/validate`, { data: {} })).status()).toBe(200);
  75  |       expect(await counts(db, id)).toEqual({ capital: 1, financial: 1, receipts: 1 });
  76  |     }
  77  |     const over = await createReference(context, memberId, 0.01);
  78  |     expect((await context.request.post(`${api}/api/payment-references/${over}/validate`, { data: {} })).status()).toBe(409);
  79  |     expect(await counts(db, over)).toEqual({ capital: 0, financial: 0, receipts: 0 });
  80  |     const [rows] = await db.execute<RowDataPacket[]>("SELECT SUM(amount) AS total FROM share_capital_payments WHERE member_id=? AND payment_status='Validated'", [memberId]);
  81  |     expect(Number(rows[0].total)).toBe(15000);
  82  |   } finally { await db.end(); }
  83  | });
  84  | 
  85  | test("P14 membership fee and initial capital accept only the required amounts", async ({ context, request }) => {
  86  |   const db = await database();
  87  |   try {
  88  |     await login(context);
  89  |     for (const [requestedMembershipType, purpose, amount] of [["Associate", "Associate Membership Fee", 200], ["True Member", "Share Capital", 1500]] as const) {
  90  |       const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Payment${token}`;
  91  |       const applicant = { requestedMembershipType, firstName, lastName: "Fixture", email: `payment-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  92  |       const submission = await request.post(`${api}/api/membership-applications/public`, { data: applicant });
  93  |       expect(submission.status()).toBe(201);
  94  |       const code = (await submission.json()).data.applicationCode;
  95  |       const [apps] = await db.execute<RowDataPacket[]>("SELECT membership_application_id,membership_fee_amount,initial_share_capital_amount,target_share_capital_amount FROM membership_applications WHERE application_code=?", [code]);
  96  |       expect(Number(apps[0].membership_fee_amount)).toBe(200); expect(Number(apps[0].initial_share_capital_amount)).toBe(1500); expect(Number(apps[0].target_share_capital_amount)).toBe(3000);
  97  |       const applicationId = String(apps[0].membership_application_id);
  98  |       const make = (value: number, paymentPurpose: string = purpose) => context.request.post(`${api}/api/payment-references`, { data: { payerName: "Synthetic Applicant", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: `SYN-${randomUUID()}`, paymentPurpose, relatedEntityType: "membership_application", relatedEntityId: applicationId, amount: value } });
  99  |       expect((await make(amount - 0.01)).status()).toBe(422);
  100 |       expect((await make(amount + 0.01)).status()).toBe(422);
  101 |       const exact = await make(amount);
  102 |       expect(exact.status()).toBe(201);
  103 |       if (requestedMembershipType === "True Member") {
  104 |         // The persisted policy includes a separate fee, and settlement requires it.
> 105 |         expect((await make(200, "Associate Membership Fee")).status()).toBe(201);
      |                                                                        ^ Error: expect(received).toBe(expected) // Object.is equality
  106 |       }
  107 |     }
  108 |   } finally { await db.end(); }
  109 | });
  110 | 
  111 | test("P13 approval classifies prepared True applications at capital boundaries", async ({ browser, request }) => {
  112 |   const db=await database(), chairman=await browser.newContext();
  113 |   try {
  114 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
  115 |     for(const amount of [1499.99,1500,2999.99,3000]) {
  116 |       const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Class${token}`;
  117 |       const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`class-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  118 |       const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  119 |       const code=(await submitted.json()).data.applicationCode;
  120 |       const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const id=String(apps[0].membership_application_id);
  121 |       await db.execute("UPDATE membership_applications SET application_status='Payment Confirmed' WHERE membership_application_id=?",[id]);
  122 |       await db.execute("UPDATE membership_application_requirements SET requirement_status='Waived' WHERE membership_application_id=? AND requirement_type IN ('Signed Application','Associate Membership Fee','Initial Share Capital')",[id]);
  123 |       await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,validation_source) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,?,'Validated','Manual Bookkeeper')",[`CLASS-${token}`,id,amount]);
  124 |       const approve=(approveTrueMembership:boolean)=>chairman.request.post(`${api}/api/membership-applications/${id}/approve`,{data:{approveTrueMembership,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Synthetic classification fixture",createMemberPortalAccount:false}});
  125 |       if(amount<1500) { const rejected=await approve(false); expect(rejected.status(),`initial ${amount}`).toBe(409); continue; }
  126 |       if(amount===2999.99) { const rejected=await approve(true); expect(rejected.status(),`true threshold ${amount}`).toBe(409); }
  127 |       const response=await approve(amount>=3000); expect(response.status(),`approval ${amount}`).toBe(200);
  128 |       const [rows]=await db.execute<RowDataPacket[]>("SELECT a.application_status,m.membership_type,m.official_member_status FROM membership_applications a JOIN member_profiles m ON m.member_id=a.converted_member_id WHERE a.membership_application_id=?",[id]);
  129 |       expect(rows[0]).toMatchObject({application_status:"Approved",membership_type:amount>=3000?"True Member":"Associate",official_member_status:"Active"});
  130 |     }
  131 |   } finally { await chairman.close(); await db.end(); }
  132 | });
  133 | 
  134 | test("P16 application capital history and progress reflect validated and pending installments", async ({ browser, request }) => {
  135 |   const db=await database(), bookkeeper=await browser.newContext(), chairman=await browser.newContext();
  136 |   try {
  137 |     await login(bookkeeper);
  138 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
  139 |     const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Progress${token}`;
  140 |     const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`progress-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  141 |     const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  142 |     const code=(await submitted.json()).data.applicationCode;
  143 |     const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const appId=String(apps[0].membership_application_id);
  144 |     await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",[appId]);
  145 |     const progress=async()=>{const r=await chairman.request.get(`${api}/api/membership-applications/${appId}/capital-progress`);expect(r.status()).toBe(200);return (await r.json()).data.capital;};
  146 |     const first=await bookkeeper.request.post(`${api}/api/payment-references`,{data:{payerName:"Synthetic Applicant",provider:"Synthetic Cash",paymentChannel:"Cash",referenceNumber:`INIT-${token}`,paymentPurpose:"Share Capital",relatedEntityType:"membership_application",relatedEntityId:appId,amount:1500}}); expect(first.status()).toBe(201);
  147 |     const firstId=String((await first.json()).data.id);
  148 |     expect((await progress()).pending).toBe(1500);
  149 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${firstId}/validate`,{data:{}})).status()).toBe(200);
  150 |     const initial=await progress(); expect(initial.validated).toBe(1500); expect(initial.remaining).toBe(1500); expect(initial.status).toBe("In Progress");
  151 |     await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,1500,'Pending')",[`NEXT-${token}`,appId]);
  152 |     const [second]=await db.execute<RowDataPacket[]>("SELECT payment_reference_id FROM payment_references WHERE reference_number=?",[`NEXT-${token}`]);
  153 |     expect((await progress()).pending).toBe(1500);
  154 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${second[0].payment_reference_id}/validate`,{data:{}})).status()).toBe(200);
  155 |     const complete=await progress(); expect(complete.validated).toBe(3000); expect(complete.remaining).toBe(0); expect(complete.status).toBe("Completed");
  156 |     const [history]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(amount) AS total FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[appId]);
  157 |     expect(Number(history[0].n)).toBe(2); expect(Number(history[0].total)).toBe(3000);
  158 |     const [deadline]=await db.execute<RowDataPacket[]>("SELECT DATE_FORMAT(deadline,'%Y-%m-%d') AS actual,DATE_FORMAT(DATE_ADD(started_on,INTERVAL 6 MONTH),'%Y-%m-%d') AS expected FROM membership_capital_cases WHERE membership_application_id=?",[appId]);
  159 |     expect(deadline[0].actual).toBe(deadline[0].expected);
  160 |   } finally {await bookkeeper.close();await chairman.close();await db.end();}
  161 | });
  162 | 
```