# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P11 Chairman approves a prepared synthetic associate application
- Location: tests\e2e\evidence-database.spec.ts:462:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 429
```

# Test source

```ts
  368 |       const title = `Synthetic P38 ${access} ${randomUUID()}`;
  369 |       const upload = await chairman.request.post(`${api}/api/documents`, { multipart: { title, category: "OTHER", documentType: "Other", accessLevel: access, file: { name: "fixture.pdf", mimeType: "application/pdf", buffer: bytes } } });
  370 |       expect(upload.status()).toBe(201);
  371 |       const [rows] = await db.execute<RowDataPacket[]>("SELECT document_id FROM documents WHERE title=?", [title]);
  372 |       const id = rows[0].document_id;
  373 |       if (access === "MEMBER_ONLY") await db.execute("UPDATE documents SET member_id=? WHERE document_id=?", [owners[0].member_id, id]);
  374 |       for (const [index, context] of [chairman, bookkeeper, member, visitor].entries()) {
  375 |         const response = await context.request.get(`${api}/api/documents/${id}/file?action=download`);
  376 |         expect(response.status(), `${access} actor ${index}`).toBe(expected[index]);
  377 |         if (response.status() === 200) expect(await response.body()).toEqual(bytes);
  378 |       }
  379 |     }
  380 |   } finally { await chairman.close(); await bookkeeper.close(); await member.close(); await visitor.close(); await db.end(); }
  381 | });
  382 | 
  383 | test("P39 announcements appear only to their intended audiences", async ({ browser }) => {
  384 |   const db = await database();
  385 |   const chairman = await browser.newContext();
  386 |   const member = await browser.newContext();
  387 |   const other = await browser.newContext();
  388 |   const visitor = await browser.newContext();
  389 |   try {
  390 |     await login(chairman, "chairman"); await login(member, "member"); await login(other, "associate");
  391 |     const [users] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='maria.member'");
  392 |     const tag = `P39-${randomUUID().slice(0, 8)}`;
  393 |     for (const [suffix, audience, recipients] of [["Public", "Public", []], ["Members", "All Members", []], ["Target", "Selected Users", [String(users[0].user_id)]]] as const) {
  394 |       const response = await chairman.request.post(`${api}/api/announcements`, { data: { title: `${tag}-${suffix}`, message: "Synthetic notice", audienceType: audience, recipientUserIds: recipients, announcementStatus: "Published" } });
  395 |       expect(response.status()).toBe(201);
  396 |     }
  397 |     const get = async (context: BrowserContext) => {
  398 |       const response = await context.request.get(`${api}/api/announcements?search=${tag}`);
  399 |       expect(response.status()).toBe(200);
  400 |       return JSON.stringify(await response.json());
  401 |     };
  402 |     const publicList = await get(visitor), ownList = await get(member), otherList = await get(other);
  403 |     expect(publicList).toContain(`${tag}-Public`);
  404 |     expect(publicList).not.toContain(`${tag}-Members`);
  405 |     expect(publicList).not.toContain(`${tag}-Target`);
  406 |     expect(ownList).toContain(`${tag}-Public`);
  407 |     expect(ownList).toContain(`${tag}-Members`);
  408 |     expect(ownList).toContain(`${tag}-Target`);
  409 |     expect(otherList).toContain(`${tag}-Members`);
  410 |     expect(otherList).not.toContain(`${tag}-Target`);
  411 |   } finally { await chairman.close(); await member.close(); await other.close(); await visitor.close(); await db.end(); }
  412 | });
  413 | 
  414 | test("P18 P42 referral associates applicant and produces a member notification", async ({ context, request }) => {
  415 |   const db = await database();
  416 |   try {
  417 |     const token = randomUUID().replaceAll("-", "").slice(0, 8);
  418 |     const firstName = `Synthetic${token}`;
  419 |     const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_profiles WHERE approval_status='Approved'");
  420 |     const data = { firstName, lastName: "Referral", email: `referral-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", referralCode: "REF-NFFAC-SEED-0001", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Referral`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  421 |     const submitted = await request.post(`${api}/api/membership-applications/public`, { data });
  422 |     expect(submitted.status()).toBe(201);
  423 |     const code = (await submitted.json()).data.applicationCode;
  424 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT r.referral_status,mp.member_code FROM member_referrals r JOIN member_profiles mp ON mp.member_id=r.referrer_member_id JOIN membership_applications a ON a.membership_application_id=r.membership_application_id WHERE a.application_code=?", [code]);
  425 |     expect(rows).toHaveLength(1);
  426 |     expect(rows[0]).toMatchObject({ referral_status: "Pending", member_code: "NFFAC-SEED-0001" });
  427 |     const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_profiles WHERE approval_status='Approved'");
  428 |     expect(after[0].n).toBe(before[0].n);
  429 |     const [notices] = await db.execute<RowDataPacket[]>("SELECT n.notification_id FROM notifications n JOIN users u ON u.user_id=n.user_id WHERE u.username='maria.member' AND n.message LIKE ?", [`%${code}%`]);
  430 |     expect(notices).toHaveLength(1);
  431 |     await login(context, "member");
  432 |     const visible = await context.request.get(`${api}/api/notifications?search=${code}`);
  433 |     expect(visible.status()).toBe(200);
  434 |     expect(JSON.stringify(await visible.json())).toContain(code);
  435 |     expect((await context.request.patch(`${api}/api/notifications/${notices[0].notification_id}/read`)).status()).toBe(200);
  436 |     const [read] = await db.execute<RowDataPacket[]>("SELECT is_read FROM notifications WHERE notification_id=?", [notices[0].notification_id]);
  437 |     expect(Number(read[0].is_read)).toBe(1);
  438 |   } finally { await db.end(); }
  439 | });
  440 | 
  441 | test("P17 a member in two sectors contributes once to membership total", async ({ context }) => {
  442 |   const db = await database();
  443 |   try {
  444 |     await login(context, "chairman");
  445 |     const endpoint = `${api}/api/chairman/member-analytics`;
  446 |     const beforeResponse = await context.request.get(endpoint);
  447 |     expect(beforeResponse.status()).toBe(200);
  448 |     const before = (await beforeResponse.json()).data.kpis.total;
  449 |     const code = `P17-${randomUUID().slice(0, 8)}`;
  450 |     await db.execute("INSERT INTO member_profiles(member_code,full_name,barangay,sector,membership_type,approval_status,official_member_status,application_date,approved_at) VALUES(?,'Synthetic multi-sector member','Lumbangan','Rice','Associate','Approved','Active','2026-01-01','2026-01-02 00:00:00')", [code]);
  451 |     const [members] = await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE member_code=?", [code]);
  452 |     const id = members[0].member_id;
  453 |     await db.execute("INSERT INTO member_sectors(member_id,sector_id) SELECT ?,sector_id FROM cooperative_sectors WHERE sector_name IN ('Rice','Corn')", [id]);
  454 |     const [links] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_sectors WHERE member_id=?", [id]);
  455 |     expect(Number(links[0].n)).toBe(2);
  456 |     const afterResponse = await context.request.get(endpoint);
  457 |     expect(afterResponse.status()).toBe(200);
  458 |     expect((await afterResponse.json()).data.kpis.total).toBe(before + 1);
  459 |   } finally { await db.end(); }
  460 | });
  461 | 
  462 | test("P11 Chairman approves a prepared synthetic associate application", async ({ context, request }) => {
  463 |   const db = await database();
  464 |   try {
  465 |     const token = randomUUID().replaceAll("-", "").slice(0, 8), firstName = `Approval${token}`;
  466 |     const data = { firstName, lastName: "Fixture", email: `approval-${token}@example.invalid`, contactNumber: `9${String(parseInt(token, 16) % 1000000000).padStart(9, "0")}`, dateOfBirth: "1991-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: `${firstName} Fixture`, signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  467 |     const submitted = await request.post(`${api}/api/membership-applications/public`, { data });
> 468 |     expect(submitted.status()).toBe(201);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  469 |     const code = (await submitted.json()).data.applicationCode;
  470 |     const [applications] = await db.execute<RowDataPacket[]>("SELECT membership_application_id FROM membership_applications WHERE application_code=?", [code]);
  471 |     const id = applications[0].membership_application_id;
  472 |     // Prepare an eligible test-only application with explicitly waived requirements.
  473 |     await db.execute("UPDATE membership_applications SET application_status='Payment Confirmed' WHERE membership_application_id=?", [id]);
  474 |     await db.execute("UPDATE membership_application_requirements SET requirement_status='Waived' WHERE membership_application_id=? AND requirement_type IN ('Signed Application','Associate Membership Fee')", [id]);
  475 |     await login(context, "chairman");
  476 |     const approved = await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: { boardMeetingDate: "2026-10-01", secretaryName: "Synthetic Secretary", decisionReason: "Synthetic approval test", createMemberPortalAccount: false } });
  477 |     expect(approved.status()).toBe(200);
  478 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT a.application_status,a.converted_member_id,m.full_name,m.membership_type,m.official_member_status FROM membership_applications a JOIN member_profiles m ON m.member_id=a.converted_member_id WHERE a.membership_application_id=?", [id]);
  479 |     expect(rows).toHaveLength(1);
  480 |     expect(rows[0]).toMatchObject({ application_status: "Approved", full_name: `${firstName} Fixture`, membership_type: "Associate", official_member_status: "Active" });
  481 |   } finally { await db.end(); }
  482 | });
  483 | 
  484 | test("P27 Bookkeeper edits a category while Chairman cannot edit it", async ({ browser }) => {
  485 |   const db = await database();
  486 |   const bookkeeper = await browser.newContext();
  487 |   const chairman = await browser.newContext();
  488 |   try {
  489 |     await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  490 |     const code = `P27_${randomUUID().slice(0, 8).toUpperCase()}`;
  491 |     const initialName = `Synthetic category ${code}`;
  492 |     const updatedName = `Synthetic updated ${code}`;
  493 |     const created = await bookkeeper.request.post(`${api}/api/financial-categories`, { data: { categoryCode: code, categoryName: initialName, categoryType: "Expense", isActive: true } });
  494 |     expect(created.status()).toBe(201);
  495 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT financial_category_id FROM financial_categories WHERE category_code=?", [code]);
  496 |     const id = rows[0].financial_category_id;
  497 |     expect((await chairman.request.patch(`${api}/api/financial-categories/${id}`, { data: { categoryName: "Forbidden" } })).status()).toBe(403);
  498 |     expect((await bookkeeper.request.patch(`${api}/api/financial-categories/${id}`, { data: { categoryName: updatedName } })).status()).toBe(200);
  499 |     const [after] = await db.execute<RowDataPacket[]>("SELECT category_name,category_type FROM financial_categories WHERE financial_category_id=?", [id]);
  500 |     expect(after[0]).toMatchObject({ category_name: updatedName, category_type: "Expense" });
  501 |   } finally { await bookkeeper.close(); await chairman.close(); await db.end(); }
  502 | });
  503 | 
```