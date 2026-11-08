# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-payments.spec.ts >> P14 membership fee and initial capital accept only the required amounts
- Location: tests\e2e\evidence-payments.spec.ts:85:5

# Error details

```
Error: {"success":false,"message":"Start the application review before verifying, rejecting, or waiving requirements","errors":[{"code":"MEMBERSHIP_REVIEW_NOT_STARTED","message":"Start the application review before verifying, rejecting, or waiving requirements"}]}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 409
```

# Test source

```ts
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
  88  |   const chairman = await browser.newContext();
  89  |   try {
  90  |     await login(context);
  91  |     expect((await memberContext.request.post(`${api}/api/auth/login`, { data: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" } })).status()).toBe(200);
  92  |     expect((await chairman.request.post(`${api}/api/auth/login`, { data: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" } })).status()).toBe(200);
  93  |     for (const [requestedMembershipType, purpose, amount] of [["Associate", "Associate Membership Fee", 200], ["True Member", "Share Capital", 1500]] as const) {
  94  |       const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Payment${token}`;
  95  |       const applicant = { requestedMembershipType, firstName, lastName: "Fixture", email: `payment-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  96  |       const submission = await request.post(`${api}/api/membership-applications/public`, { data: applicant });
  97  |       expect(submission.status()).toBe(201);
  98  |       const code = (await submission.json()).data.applicationCode;
  99  |       const [apps] = await db.execute<RowDataPacket[]>("SELECT membership_application_id,membership_fee_amount,initial_share_capital_amount,target_share_capital_amount FROM membership_applications WHERE application_code=?", [code]);
  100 |       expect(Number(apps[0].membership_fee_amount)).toBe(200); expect(Number(apps[0].initial_share_capital_amount)).toBe(1500); expect(Number(apps[0].target_share_capital_amount)).toBe(3000);
  101 |       const applicationId = String(apps[0].membership_application_id);
  102 |       await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",[applicationId]);
  103 |       const make = (value: number, paymentPurpose: string = purpose) => context.request.post(`${api}/api/payment-references`, { data: { payerName: "Synthetic Applicant", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: `SYN-${randomUUID()}`, paymentPurpose, relatedEntityType: "membership_application", relatedEntityId: applicationId, amount: value } });
  104 |       expect((await make(amount - 0.01)).status()).toBe(422);
  105 |       expect((await make(amount + 0.01)).status()).toBe(422);
  106 |       const exact = await make(amount);
  107 |       expect(exact.status()).toBe(201);
  108 |       const mainId=String((await exact.json()).data.id);
  109 |       expect(await counts(db,mainId)).toEqual({capital:0,financial:0,receipts:0});
  110 |       expect((await make(amount)).status()).toBe(409);
  111 |       expect((await memberContext.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(403);
  112 |       expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(200);
  113 |       expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(400);
  114 |       // Before conversion the initial capital lives in the application capital events,
  115 |       // not in a member-owned share_capital_payments row.
  116 |       expect(await counts(db,mainId)).toEqual({capital:0,financial:1,receipts:1});
  117 |       if (purpose === "Share Capital") {
  118 |         const [events]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(e.amount) AS amount FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[applicationId]);
  119 |         expect(Number(events[0].n)).toBe(1); expect(Number(events[0].amount)).toBe(1500);
  120 |       }
  121 |       if (requestedMembershipType === "True Member") {
  122 |         // The persisted policy includes a separate fee, and settlement requires it.
  123 |         const fee=await make(200, "Associate Membership Fee"); expect(fee.status()).toBe(201);
  124 |         const feeId=String((await fee.json()).data.id);
  125 |         expect(await counts(db,feeId)).toEqual({capital:0,financial:0,receipts:0});
  126 |         expect((await context.request.post(`${api}/api/payment-references/${feeId}/validate`,{data:{}})).status()).toBe(200);
  127 |         expect(await counts(db,feeId)).toEqual({capital:0,financial:1,receipts:1});
  128 |         expect((await make(200,"Associate Membership Fee")).status()).toBe(409);
  129 |         const [requirements]=await db.execute<RowDataPacket[]>("SELECT requirement_type,requirement_status FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type IN ('Associate Membership Fee','Initial Share Capital')",[applicationId]);
  130 |         expect(requirements).toHaveLength(2); expect(requirements.every(r=>r.requirement_status==='Verified')).toBe(true);
  131 |         const approval={approveTrueMembership:false,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Verified application and payments",createMemberPortalAccount:false};
  132 |         expect((await chairman.request.post(`${api}/api/membership-applications/${applicationId}/approve`,{data:approval})).status()).toBe(409);
  133 |         const [signature]=await db.execute<RowDataPacket[]>("SELECT membership_application_requirement_id FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type='Signed Application'",[applicationId]);
  134 |         const verified=await chairman.request.patch(`${api}/api/membership-application-requirements/${signature[0].membership_application_requirement_id}`,{data:{requirementStatus:"Verified",remarks:"Synthetic signed application reviewed"}});
> 135 |         expect(verified.status(),await verified.text()).toBe(200);
      |                                                         ^ Error: {"success":false,"message":"Start the application review before verifying, rejecting, or waiving requirements","errors":[{"code":"MEMBERSHIP_REVIEW_NOT_STARTED","message":"Start the application review before verifying, rejecting, or waiving requirements"}]}
  136 |         const approved=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/approve`,{data:approval}); expect(approved.status(),await approved.text()).toBe(200);
  137 |       }
  138 |     }
  139 |   } finally { await chairman.close(); await memberContext.close(); await db.end(); }
  140 | });
  141 | 
  142 | test("P13 approval classifies prepared True applications at capital boundaries", async ({ browser, request }) => {
  143 |   const db=await database(), chairman=await browser.newContext();
  144 |   try {
  145 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
  146 |     for(const amount of [1499.99,1500,2999.99,3000]) {
  147 |       const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Class${token}`;
  148 |       const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`class-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  149 |       const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  150 |       const code=(await submitted.json()).data.applicationCode;
  151 |       const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const id=String(apps[0].membership_application_id);
  152 |       await db.execute("UPDATE membership_applications SET application_status='Payment Confirmed' WHERE membership_application_id=?",[id]);
  153 |       await db.execute("UPDATE membership_application_requirements SET requirement_status='Waived' WHERE membership_application_id=? AND requirement_type IN ('Signed Application','Associate Membership Fee','Initial Share Capital')",[id]);
  154 |       await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,validation_source) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,?,'Validated','Manual Bookkeeper')",[`CLASS-${token}`,id,amount]);
  155 |       const approve=(approveTrueMembership:boolean)=>chairman.request.post(`${api}/api/membership-applications/${id}/approve`,{data:{approveTrueMembership,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Synthetic classification fixture",createMemberPortalAccount:false}});
  156 |       if(amount<1500) { const rejected=await approve(false); expect(rejected.status(),`initial ${amount}`).toBe(409); continue; }
  157 |       if(amount===2999.99) { const rejected=await approve(true); expect(rejected.status(),`true threshold ${amount}`).toBe(409); }
  158 |       const response=await approve(amount>=3000); expect(response.status(),`approval ${amount}`).toBe(200);
  159 |       const [rows]=await db.execute<RowDataPacket[]>("SELECT a.application_status,m.membership_type,m.official_member_status FROM membership_applications a JOIN member_profiles m ON m.member_id=a.converted_member_id WHERE a.membership_application_id=?",[id]);
  160 |       expect(rows[0]).toMatchObject({application_status:"Approved",membership_type:amount>=3000?"True Member":"Associate",official_member_status:"Active"});
  161 |     }
  162 |   } finally { await chairman.close(); await db.end(); }
  163 | });
  164 | 
  165 | test("P16 application capital history and progress reflect validated and pending installments", async ({ browser, request }) => {
  166 |   const db=await database(), bookkeeper=await browser.newContext(), chairman=await browser.newContext();
  167 |   try {
  168 |     await login(bookkeeper);
  169 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
  170 |     const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Progress${token}`;
  171 |     const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`progress-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  172 |     const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  173 |     const code=(await submitted.json()).data.applicationCode;
  174 |     const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const appId=String(apps[0].membership_application_id);
  175 |     await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",[appId]);
  176 |     const progress=async()=>{const r=await chairman.request.get(`${api}/api/membership-applications/${appId}/capital-progress`);expect(r.status()).toBe(200);return (await r.json()).data.capital;};
  177 |     const first=await bookkeeper.request.post(`${api}/api/payment-references`,{data:{payerName:"Synthetic Applicant",provider:"Synthetic Cash",paymentChannel:"Cash",referenceNumber:`INIT-${token}`,paymentPurpose:"Share Capital",relatedEntityType:"membership_application",relatedEntityId:appId,amount:1500}}); expect(first.status()).toBe(201);
  178 |     const firstId=String((await first.json()).data.id);
  179 |     expect((await progress()).pending).toBe(1500);
  180 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${firstId}/validate`,{data:{}})).status()).toBe(200);
  181 |     const initial=await progress(); expect(initial.validated).toBe(1500); expect(initial.remaining).toBe(1500); expect(initial.status).toBe("In Progress");
  182 |     // Move only this synthetic case into the past to exercise the applicable overdue status, then restore its original six-month dates.
  183 |     await db.execute("UPDATE membership_capital_cases SET started_on=DATE_SUB(CURDATE(),INTERVAL 7 MONTH),deadline=DATE_SUB(CURDATE(),INTERVAL 1 MONTH) WHERE membership_application_id=?",[appId]);
  184 |     expect((await progress()).status).toBe("Overdue");
  185 |     await db.execute("UPDATE membership_capital_cases SET started_on=CURDATE(),deadline=DATE_ADD(CURDATE(),INTERVAL 6 MONTH) WHERE membership_application_id=?",[appId]);
  186 |     await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,1500,'Pending')",[`NEXT-${token}`,appId]);
  187 |     const [second]=await db.execute<RowDataPacket[]>("SELECT payment_reference_id FROM payment_references WHERE reference_number=?",[`NEXT-${token}`]);
  188 |     expect((await progress()).pending).toBe(1500);
  189 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${second[0].payment_reference_id}/validate`,{data:{}})).status()).toBe(200);
  190 |     const complete=await progress(); expect(complete.validated).toBe(3000); expect(complete.remaining).toBe(0); expect(complete.status).toBe("Completed");
  191 |     const [history]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(amount) AS total FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[appId]);
  192 |     expect(Number(history[0].n)).toBe(2); expect(Number(history[0].total)).toBe(3000);
  193 |     const [deadline]=await db.execute<RowDataPacket[]>("SELECT DATE_FORMAT(deadline,'%Y-%m-%d') AS actual,DATE_FORMAT(DATE_ADD(started_on,INTERVAL 6 MONTH),'%Y-%m-%d') AS expected FROM membership_capital_cases WHERE membership_application_id=?",[appId]);
  194 |     expect(deadline[0].actual).toBe(deadline[0].expected);
  195 |   } finally {await bookkeeper.close();await chairman.close();await db.end();}
  196 | });
  197 | 
```