# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-payments.spec.ts >> P14 membership fee and initial capital accept only the required amounts
- Location: tests\e2e\evidence-payments.spec.ts:85:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
-   "capital": 1,
+   "capital": 0,
    "financial": 1,
    "receipts": 1,
  }
```

# Test source

```ts
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
  85  | test("P14 membership fee and initial capital accept only the required amounts", async ({ browser, context, request }) => {
  86  |   const db = await database();
  87  |   const memberContext = await browser.newContext();
  88  |   try {
  89  |     await login(context);
  90  |     expect((await memberContext.request.post(`${api}/api/auth/login`, { data: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" } })).status()).toBe(200);
  91  |     for (const [requestedMembershipType, purpose, amount] of [["Associate", "Associate Membership Fee", 200], ["True Member", "Share Capital", 1500]] as const) {
  92  |       const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Payment${token}`;
  93  |       const applicant = { requestedMembershipType, firstName, lastName: "Fixture", email: `payment-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  94  |       const submission = await request.post(`${api}/api/membership-applications/public`, { data: applicant });
  95  |       expect(submission.status()).toBe(201);
  96  |       const code = (await submission.json()).data.applicationCode;
  97  |       const [apps] = await db.execute<RowDataPacket[]>("SELECT membership_application_id,membership_fee_amount,initial_share_capital_amount,target_share_capital_amount FROM membership_applications WHERE application_code=?", [code]);
  98  |       expect(Number(apps[0].membership_fee_amount)).toBe(200); expect(Number(apps[0].initial_share_capital_amount)).toBe(1500); expect(Number(apps[0].target_share_capital_amount)).toBe(3000);
  99  |       const applicationId = String(apps[0].membership_application_id);
  100 |       await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",[applicationId]);
  101 |       const make = (value: number, paymentPurpose: string = purpose) => context.request.post(`${api}/api/payment-references`, { data: { payerName: "Synthetic Applicant", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: `SYN-${randomUUID()}`, paymentPurpose, relatedEntityType: "membership_application", relatedEntityId: applicationId, amount: value } });
  102 |       expect((await make(amount - 0.01)).status()).toBe(422);
  103 |       expect((await make(amount + 0.01)).status()).toBe(422);
  104 |       const exact = await make(amount);
  105 |       expect(exact.status()).toBe(201);
  106 |       const mainId=String((await exact.json()).data.id);
  107 |       expect(await counts(db,mainId)).toEqual({capital:0,financial:0,receipts:0});
  108 |       expect((await make(amount)).status()).toBe(409);
  109 |       expect((await memberContext.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(403);
  110 |       expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(200);
  111 |       expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(400);
> 112 |       expect(await counts(db,mainId)).toEqual({capital:purpose === "Share Capital" ? 1 : 0,financial:1,receipts:1});
      |                                       ^ Error: expect(received).toEqual(expected) // deep equality
  113 |       if (requestedMembershipType === "True Member") {
  114 |         // The persisted policy includes a separate fee, and settlement requires it.
  115 |         const fee=await make(200, "Associate Membership Fee"); expect(fee.status()).toBe(201);
  116 |         const feeId=String((await fee.json()).data.id);
  117 |         expect(await counts(db,feeId)).toEqual({capital:0,financial:0,receipts:0});
  118 |         expect((await context.request.post(`${api}/api/payment-references/${feeId}/validate`,{data:{}})).status()).toBe(200);
  119 |         expect(await counts(db,feeId)).toEqual({capital:0,financial:1,receipts:1});
  120 |         expect((await make(200,"Associate Membership Fee")).status()).toBe(409);
  121 |         const [requirements]=await db.execute<RowDataPacket[]>("SELECT requirement_type,requirement_status FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type IN ('Associate Membership Fee','Initial Share Capital')",[applicationId]);
  122 |         expect(requirements).toHaveLength(2); expect(requirements.every(r=>r.requirement_status==='Verified')).toBe(true);
  123 |       }
  124 |     }
  125 |   } finally { await memberContext.close(); await db.end(); }
  126 | });
  127 | 
  128 | test("P13 approval classifies prepared True applications at capital boundaries", async ({ browser, request }) => {
  129 |   const db=await database(), chairman=await browser.newContext();
  130 |   try {
  131 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
  132 |     for(const amount of [1499.99,1500,2999.99,3000]) {
  133 |       const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Class${token}`;
  134 |       const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`class-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  135 |       const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  136 |       const code=(await submitted.json()).data.applicationCode;
  137 |       const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const id=String(apps[0].membership_application_id);
  138 |       await db.execute("UPDATE membership_applications SET application_status='Payment Confirmed' WHERE membership_application_id=?",[id]);
  139 |       await db.execute("UPDATE membership_application_requirements SET requirement_status='Waived' WHERE membership_application_id=? AND requirement_type IN ('Signed Application','Associate Membership Fee','Initial Share Capital')",[id]);
  140 |       await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,validation_source) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,?,'Validated','Manual Bookkeeper')",[`CLASS-${token}`,id,amount]);
  141 |       const approve=(approveTrueMembership:boolean)=>chairman.request.post(`${api}/api/membership-applications/${id}/approve`,{data:{approveTrueMembership,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Synthetic classification fixture",createMemberPortalAccount:false}});
  142 |       if(amount<1500) { const rejected=await approve(false); expect(rejected.status(),`initial ${amount}`).toBe(409); continue; }
  143 |       if(amount===2999.99) { const rejected=await approve(true); expect(rejected.status(),`true threshold ${amount}`).toBe(409); }
  144 |       const response=await approve(amount>=3000); expect(response.status(),`approval ${amount}`).toBe(200);
  145 |       const [rows]=await db.execute<RowDataPacket[]>("SELECT a.application_status,m.membership_type,m.official_member_status FROM membership_applications a JOIN member_profiles m ON m.member_id=a.converted_member_id WHERE a.membership_application_id=?",[id]);
  146 |       expect(rows[0]).toMatchObject({application_status:"Approved",membership_type:amount>=3000?"True Member":"Associate",official_member_status:"Active"});
  147 |     }
  148 |   } finally { await chairman.close(); await db.end(); }
  149 | });
  150 | 
  151 | test("P16 application capital history and progress reflect validated and pending installments", async ({ browser, request }) => {
  152 |   const db=await database(), bookkeeper=await browser.newContext(), chairman=await browser.newContext();
  153 |   try {
  154 |     await login(bookkeeper);
  155 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
  156 |     const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Progress${token}`;
  157 |     const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`progress-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  158 |     const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  159 |     const code=(await submitted.json()).data.applicationCode;
  160 |     const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const appId=String(apps[0].membership_application_id);
  161 |     await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",[appId]);
  162 |     const progress=async()=>{const r=await chairman.request.get(`${api}/api/membership-applications/${appId}/capital-progress`);expect(r.status()).toBe(200);return (await r.json()).data.capital;};
  163 |     const first=await bookkeeper.request.post(`${api}/api/payment-references`,{data:{payerName:"Synthetic Applicant",provider:"Synthetic Cash",paymentChannel:"Cash",referenceNumber:`INIT-${token}`,paymentPurpose:"Share Capital",relatedEntityType:"membership_application",relatedEntityId:appId,amount:1500}}); expect(first.status()).toBe(201);
  164 |     const firstId=String((await first.json()).data.id);
  165 |     expect((await progress()).pending).toBe(1500);
  166 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${firstId}/validate`,{data:{}})).status()).toBe(200);
  167 |     const initial=await progress(); expect(initial.validated).toBe(1500); expect(initial.remaining).toBe(1500); expect(initial.status).toBe("In Progress");
  168 |     // Move only this synthetic case into the past to exercise the applicable overdue status, then restore its original six-month dates.
  169 |     await db.execute("UPDATE membership_capital_cases SET started_on=DATE_SUB(CURDATE(),INTERVAL 7 MONTH),deadline=DATE_SUB(CURDATE(),INTERVAL 1 MONTH) WHERE membership_application_id=?",[appId]);
  170 |     expect((await progress()).status).toBe("Overdue");
  171 |     await db.execute("UPDATE membership_capital_cases SET started_on=CURDATE(),deadline=DATE_ADD(CURDATE(),INTERVAL 6 MONTH) WHERE membership_application_id=?",[appId]);
  172 |     await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,1500,'Pending')",[`NEXT-${token}`,appId]);
  173 |     const [second]=await db.execute<RowDataPacket[]>("SELECT payment_reference_id FROM payment_references WHERE reference_number=?",[`NEXT-${token}`]);
  174 |     expect((await progress()).pending).toBe(1500);
  175 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${second[0].payment_reference_id}/validate`,{data:{}})).status()).toBe(200);
  176 |     const complete=await progress(); expect(complete.validated).toBe(3000); expect(complete.remaining).toBe(0); expect(complete.status).toBe("Completed");
  177 |     const [history]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(amount) AS total FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[appId]);
  178 |     expect(Number(history[0].n)).toBe(2); expect(Number(history[0].total)).toBe(3000);
  179 |     const [deadline]=await db.execute<RowDataPacket[]>("SELECT DATE_FORMAT(deadline,'%Y-%m-%d') AS actual,DATE_FORMAT(DATE_ADD(started_on,INTERVAL 6 MONTH),'%Y-%m-%d') AS expected FROM membership_capital_cases WHERE membership_application_id=?",[appId]);
  180 |     expect(deadline[0].actual).toBe(deadline[0].expected);
  181 |   } finally {await bookkeeper.close();await chairman.close();await db.end();}
  182 | });
  183 | 
```