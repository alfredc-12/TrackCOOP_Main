# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-payments.spec.ts >> P13 approval classifies prepared True applications at capital boundaries
- Location: tests\e2e\evidence-payments.spec.ts:146:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
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
  102 |       const review=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/start-review`,{data:{}}); expect(review.status(),await review.text()).toBe(200);
  103 |       const [signature]=await db.execute<RowDataPacket[]>("SELECT membership_application_requirement_id FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type='Signed Application'",[applicationId]);
  104 |       const requirementUrl=`${api}/api/membership-application-requirements/${signature[0].membership_application_requirement_id}`;
  105 |       expect((await chairman.request.patch(requirementUrl,{data:{requirementStatus:"Verified"}})).status()).toBe(409);
  106 |       const document=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/documents`,{multipart:{documentType:"Signed Application",document:{name:"synthetic-application.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\n% synthetic signed application\n%%EOF\n")}}});
  107 |       expect(document.status(),await document.text()).toBe(201);
  108 |       const verified=await chairman.request.patch(requirementUrl,{data:{requirementStatus:"Verified",documentId:String((await document.json()).data.id),remarks:"Synthetic signed application reviewed"}});
  109 |       expect(verified.status(),await verified.text()).toBe(200);
  110 |       const paymentStage=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/approve-for-payment`,{data:{}});expect(paymentStage.status(),await paymentStage.text()).toBe(200);
  111 |       const make = (value: number, paymentPurpose: string = purpose) => context.request.post(`${api}/api/payment-references`, { data: { payerName: "Synthetic Applicant", provider: "Synthetic Cash", paymentChannel: "Cash", referenceNumber: `SYN-${randomUUID()}`, paymentPurpose, relatedEntityType: "membership_application", relatedEntityId: applicationId, amount: value } });
  112 |       expect((await make(amount - 0.01)).status()).toBe(422);
  113 |       expect((await make(amount + 0.01)).status()).toBe(422);
  114 |       const exact = await make(amount);
  115 |       expect(exact.status()).toBe(201);
  116 |       const mainId=String((await exact.json()).data.id);
  117 |       expect(await counts(db,mainId)).toEqual({capital:0,financial:0,receipts:0});
  118 |       expect((await make(amount)).status()).toBe(409);
  119 |       expect((await memberContext.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(403);
  120 |       expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(200);
  121 |       expect((await context.request.post(`${api}/api/payment-references/${mainId}/validate`,{data:{}})).status()).toBe(400);
  122 |       // Before conversion the initial capital lives in the application capital events,
  123 |       // not in a member-owned share_capital_payments row.
  124 |       expect(await counts(db,mainId)).toEqual({capital:0,financial:1,receipts:1});
  125 |       if (purpose === "Share Capital") {
  126 |         const [events]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(e.amount) AS amount FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[applicationId]);
  127 |         expect(Number(events[0].n)).toBe(1); expect(Number(events[0].amount)).toBe(1500);
  128 |       }
  129 |       if (requestedMembershipType === "True Member") {
  130 |         // The persisted policy includes a separate fee, and settlement requires it.
  131 |         const fee=await make(200, "Associate Membership Fee"); expect(fee.status()).toBe(201);
  132 |         const feeId=String((await fee.json()).data.id);
  133 |         expect(await counts(db,feeId)).toEqual({capital:0,financial:0,receipts:0});
  134 |         expect((await context.request.post(`${api}/api/payment-references/${feeId}/validate`,{data:{}})).status()).toBe(200);
  135 |         expect(await counts(db,feeId)).toEqual({capital:0,financial:1,receipts:1});
  136 |         expect((await make(200,"Associate Membership Fee")).status()).toBe(409);
  137 |         const [requirements]=await db.execute<RowDataPacket[]>("SELECT requirement_type,requirement_status FROM membership_application_requirements WHERE membership_application_id=? AND requirement_type IN ('Associate Membership Fee','Initial Share Capital')",[applicationId]);
  138 |         expect(requirements).toHaveLength(2); expect(requirements.every(r=>r.requirement_status==='Verified')).toBe(true);
  139 |         const approval={approveTrueMembership:false,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Verified application and payments",createMemberPortalAccount:false};
  140 |         const approved=await chairman.request.post(`${api}/api/membership-applications/${applicationId}/approve`,{data:approval}); expect(approved.status(),await approved.text()).toBe(200);
  141 |       }
  142 |     }
  143 |   } finally { await chairman.close(); await memberContext.close(); await db.end(); }
  144 | });
  145 | 
  146 | test("P13 approval classifies prepared True applications at capital boundaries", async ({ browser, request }) => {
  147 |   const db=await database(), chairman=await browser.newContext();
  148 |   try {
> 149 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
      |                                                                                                                                                             ^ Error: expect(received).toBe(expected) // Object.is equality
  150 |     for(const amount of [1499.99,1500,2999.99,3000]) {
  151 |       const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Class${token}`;
  152 |       const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`class-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  153 |       const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  154 |       const code=(await submitted.json()).data.applicationCode;
  155 |       const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const id=String(apps[0].membership_application_id);
  156 |       await db.execute("UPDATE membership_applications SET application_status='Payment Confirmed' WHERE membership_application_id=?",[id]);
  157 |       await db.execute("UPDATE membership_application_requirements SET requirement_status='Waived' WHERE membership_application_id=? AND requirement_type IN ('Signed Application','Associate Membership Fee','Initial Share Capital')",[id]);
  158 |       await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,validation_source) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,?,'Validated','Manual Bookkeeper')",[`CLASS-${token}`,id,amount]);
  159 |       const approve=(approveTrueMembership:boolean)=>chairman.request.post(`${api}/api/membership-applications/${id}/approve`,{data:{approveTrueMembership,boardMeetingDate:"2026-10-01",secretaryName:"Synthetic Secretary",decisionReason:"Synthetic classification fixture",createMemberPortalAccount:false}});
  160 |       if(amount<1500) { const rejected=await approve(false); expect(rejected.status(),`initial ${amount}`).toBe(409); continue; }
  161 |       if(amount===2999.99) { const rejected=await approve(true); expect(rejected.status(),`true threshold ${amount}`).toBe(409); }
  162 |       const response=await approve(amount>=3000); expect(response.status(),`approval ${amount}`).toBe(200);
  163 |       const [rows]=await db.execute<RowDataPacket[]>("SELECT a.application_status,m.membership_type,m.official_member_status FROM membership_applications a JOIN member_profiles m ON m.member_id=a.converted_member_id WHERE a.membership_application_id=?",[id]);
  164 |       expect(rows[0]).toMatchObject({application_status:"Approved",membership_type:amount>=3000?"True Member":"Associate",official_member_status:"Active"});
  165 |     }
  166 |   } finally { await chairman.close(); await db.end(); }
  167 | });
  168 | 
  169 | test("P16 application capital history and progress reflect validated and pending installments", async ({ browser, request }) => {
  170 |   const db=await database(), bookkeeper=await browser.newContext(), chairman=await browser.newContext();
  171 |   try {
  172 |     await login(bookkeeper);
  173 |     expect((await chairman.request.post(`${api}/api/auth/login`,{data:{identifier:"chairman.test@trackcoop.local",password:"ChairmanTest123!"}})).status()).toBe(200);
  174 |     const token=randomUUID().replaceAll("-","").slice(0,8),firstName=`Progress${token}`;
  175 |     const data={requestedMembershipType:"True Member",firstName,lastName:"Fixture",email:`progress-${token}@example.invalid`,contactNumber:`9${String(parseInt(token,16)%1000000000).padStart(9,"0")}`,dateOfBirth:"1991-01-02",currentAddress:"Synthetic address",barangay:"Lumbangan",municipality:"Nasugbu",province:"Batangas",sector:"Rice",fatherName:"Synthetic Father",motherName:"Synthetic Mother",occupation:"Farmer",orientationCommitmentAccepted:true,membershipFeeCommitmentAccepted:true,shareSubscriptionCommitmentAccepted:true,bylawsAgreementAccepted:true,privacyConsentAccepted:true,applicantSignatureName:`${firstName} Fixture`,signedAt:"2026-01-01",signedPlace:"Nasugbu"};
  176 |     const submitted=await request.post(`${api}/api/membership-applications/public`,{data}); expect(submitted.status()).toBe(201);
  177 |     const code=(await submitted.json()).data.applicationCode;
  178 |     const [apps]=await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?",[code]); const appId=String(apps[0].membership_application_id);
  179 |     await db.execute("UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",[appId]);
  180 |     const progress=async()=>{const r=await chairman.request.get(`${api}/api/membership-applications/${appId}/capital-progress`);expect(r.status()).toBe(200);return (await r.json()).data.capital;};
  181 |     const first=await bookkeeper.request.post(`${api}/api/payment-references`,{data:{payerName:"Synthetic Applicant",provider:"Synthetic Cash",paymentChannel:"Cash",referenceNumber:`INIT-${token}`,paymentPurpose:"Share Capital",relatedEntityType:"membership_application",relatedEntityId:appId,amount:1500}}); expect(first.status()).toBe(201);
  182 |     const firstId=String((await first.json()).data.id);
  183 |     expect((await progress()).pending).toBe(1500);
  184 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${firstId}/validate`,{data:{}})).status()).toBe(200);
  185 |     const initial=await progress(); expect(initial.validated).toBe(1500); expect(initial.remaining).toBe(1500); expect(initial.status).toBe("In Progress");
  186 |     // Move only this synthetic case into the past to exercise the applicable overdue status, then restore its original six-month dates.
  187 |     await db.execute("UPDATE membership_capital_cases SET started_on=DATE_SUB(CURDATE(),INTERVAL 7 MONTH),deadline=DATE_SUB(CURDATE(),INTERVAL 1 MONTH) WHERE membership_application_id=?",[appId]);
  188 |     expect((await progress()).status).toBe("Overdue");
  189 |     await db.execute("UPDATE membership_capital_cases SET started_on=CURDATE(),deadline=DATE_ADD(CURDATE(),INTERVAL 6 MONTH) WHERE membership_application_id=?",[appId]);
  190 |     await db.execute("INSERT INTO payment_references(provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status) VALUES('Synthetic Cash','Cash',?,'Share Capital','membership_application',?,1500,'Pending')",[`NEXT-${token}`,appId]);
  191 |     const [second]=await db.execute<RowDataPacket[]>("SELECT payment_reference_id FROM payment_references WHERE reference_number=?",[`NEXT-${token}`]);
  192 |     expect((await progress()).pending).toBe(1500);
  193 |     expect((await bookkeeper.request.post(`${api}/api/payment-references/${second[0].payment_reference_id}/validate`,{data:{}})).status()).toBe(200);
  194 |     const complete=await progress(); expect(complete.validated).toBe(3000); expect(complete.remaining).toBe(0); expect(complete.status).toBe("Completed");
  195 |     const [history]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(amount) AS total FROM membership_capital_events e JOIN membership_capital_cases c ON c.capital_case_id=e.capital_case_id WHERE c.membership_application_id=?",[appId]);
  196 |     expect(Number(history[0].n)).toBe(2); expect(Number(history[0].total)).toBe(3000);
  197 |     const [deadline]=await db.execute<RowDataPacket[]>("SELECT DATE_FORMAT(deadline,'%Y-%m-%d') AS actual,DATE_FORMAT(DATE_ADD(started_on,INTERVAL 6 MONTH),'%Y-%m-%d') AS expected FROM membership_capital_cases WHERE membership_application_id=?",[appId]);
  198 |     expect(deadline[0].actual).toBe(deadline[0].expected);
  199 |   } finally {await bookkeeper.close();await chairman.close();await db.end();}
  200 | });
  201 | 
```