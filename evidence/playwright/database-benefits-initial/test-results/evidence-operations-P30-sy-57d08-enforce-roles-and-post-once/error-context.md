# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-operations.spec.ts >> P30 synthetic dividend withdrawal and patronage-capital transfer enforce roles and post once
- Location: tests\e2e\evidence-operations.spec.ts:103:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Test source

```ts
  40  |     const [paid] = await db.execute<RowDataPacket[]>("SELECT sale_status,payment_status,total_amount FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  41  |     expect(paid[0]).toMatchObject({ sale_status: "Paid", payment_status: "Paid" }); expect(Number(paid[0].total_amount)).toBe(226.5);
  42  |     const [financial] = await db.execute<RowDataPacket[]>("SELECT amount,record_type,source_module FROM financial_records WHERE payment_reference_id=?", [referenceId]);
  43  |     expect(financial).toHaveLength(1); expect(financial[0]).toMatchObject({ record_type: "Income", source_module: "POS" }); expect(Number(financial[0].amount)).toBe(226.5);
  44  |     const [stock] = await db.execute<RowDataPacket[]>("SELECT SUM(quantity_change) AS n FROM inventory_movements WHERE product_id=?", [productId]); expect(Number(stock[0].n)).toBe(17);
  45  |     expect((await chairman.request.put(`${api}/api/pos/orders/${saleId}/complete`, { data: { note: "Synthetic pickup" } })).status()).toBe(200);
  46  |     const [completed] = await db.execute<RowDataPacket[]>("SELECT sale_status,fulfilled_at FROM pos_sales WHERE pos_sale_id=?", [saleId]);
  47  |     expect(completed[0].sale_status).toBe("Completed"); expect(completed[0].fulfilled_at).toBeTruthy();
  48  |   } finally { await member.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  49  | });
  50  | 
  51  | test("P31 P32 P35 rental inquiry, review, payment and schedule persist once", async ({ browser }) => {
  52  |   const db = await database(), visitor = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  53  |   try {
  54  |     await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  55  |     const code = `E2E-RNT-${randomUUID().slice(0, 8).toUpperCase()}`;
  56  |     await db.execute("INSERT INTO rental_assets(asset_code,asset_name,asset_type,category,description,rate_amount,rate_unit,deposit_amount,asset_status,public_visibility,created_by) SELECT ?,'Synthetic Rental Pump',asset_type,category,description,1000,'Per Day',0,'Available',1,created_by FROM rental_assets WHERE asset_code='RNT-PUMP-001'", [code]);
  57  |     const draft = { clientRequestId: randomUUID(), fullName: "Synthetic Visitor", requesterType: "Public or Non-member", contactNumber: "09171112222", email: "rental@example.invalid", completeAddress: "Synthetic address Nasugbu", barangay: "Lumbangan", municipality: "Nasugbu", serviceId: code, intendedUse: "Synthetic farm work", preferredDate: "2031-06-03", preferredEndDate: "2031-06-03", preferredStartTime: "08:00", preferredEndTime: "12:00", requestDescription: "Synthetic farm work request", notes: "", validIdType: "Passport", attachmentName: "", membershipProofName: "", dataPrivacyConsent: true, accuracyConfirmation: true, contactConsent: true, preferredPaymentMethod: "Cash" };
  58  |     const submission = () => visitor.request.post(`${api}/api/rental/inquiries/public`, { multipart: { draft: JSON.stringify(draft), validId: { name: "synthetic-id.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% synthetic id\n%%EOF\n") } } });
  59  |     const first = await submission(); expect(first.status(), await first.text()).toBe(201); const inquiry = await first.json();
  60  |     const repeat = await submission(); expect(repeat.status()).toBe(201); expect((await repeat.json()).rentalId).toBe(inquiry.rentalId);
  61  |     const rentalId = String(inquiry.rentalId);
  62  |     expect(inquiry.status).toBe("Under Review"); expect(inquiry.preferredDate).toBe(draft.preferredDate);
  63  |     const [bookings] = await db.execute<RowDataPacket[]>("SELECT rb.rental_booking_id,rb.booking_status,rb.total_amount FROM rental_bookings rb JOIN rental_assets a ON a.rental_asset_id=rb.rental_asset_id WHERE a.asset_code=?", [code]);
  64  |     expect(bookings).toHaveLength(1); expect(bookings[0].booking_status).toBe("Pending");
  65  |     for (const decision of ["Approved for Scheduling"]) {
  66  |       const review = await chairman.request.post(`${api}/api/rental/inquiries/${rentalId}/review`, { data: { decision, publicNote: "Synthetic review decision for testing." } });
  67  |       expect(review.status()).toBe(200);
  68  |     }
  69  |     const [approved] = await db.execute<RowDataPacket[]>("SELECT booking_status,total_amount FROM rental_bookings WHERE rental_booking_id=?", [bookings[0].rental_booking_id]);
  70  |     expect(approved[0].booking_status).toBe("Approved"); expect(Number(approved[0].total_amount)).toBe(1000);
  71  |     const payment = await bookkeeper.request.post(`${api}/api/rental/payments`, { data: { rentalId, requesterName: draft.fullName, equipmentName: "Synthetic Rental Pump", scheduleDate: draft.preferredDate, amount: 1000, paymentDate: "2026-11-08", paymentMethod: "Cash", status: "Paid", recordedBy: "Test Bookkeeper" } });
  72  |     expect(payment.status()).toBe(201);
  73  |     const paymentId = String((await payment.json()).paymentId);
  74  |     for (let replay = 0; replay < 2; replay++) {
  75  |       const result = await bookkeeper.request.post(`${api}/api/rental/payments/${paymentId}/validate`, { data: { status: "Paid", note: "Synthetic duplicate validation" } });
  76  |       expect(result.status()).toBe(200);
  77  |     }
  78  |     const [finance] = await db.execute<RowDataPacket[]>("SELECT amount,source_module,record_type FROM financial_records WHERE source_module='Rental' AND source_record_id=? AND record_type='Income'", [bookings[0].rental_booking_id]);
  79  |     expect(finance).toHaveLength(1); expect(Number(finance[0].amount)).toBe(1000);
  80  |     const schedule = await chairman.request.post(`${api}/api/rental/schedules`, { data: { rentalId, inquiryId: rentalId, serviceId: code, equipmentName: "Synthetic Rental Pump", requesterName: draft.fullName, requesterType: draft.requesterType, date: draft.preferredDate, endDate: draft.preferredEndDate, startTime: draft.preferredStartTime, endTime: draft.preferredEndTime, assignedOperator: `Synthetic Operator ${code}`, serviceLocation: draft.completeAddress, barangay: draft.barangay, preparationMinutes: 0, travelMinutes: 0, bufferMinutes: 0, status: "Confirmed", paymentStatus: "Paid" } });
  81  |     expect(schedule.status(), await schedule.text()).toBe(201);
  82  |     const [after] = await db.execute<RowDataPacket[]>("SELECT booking_status,payment_status FROM rental_bookings WHERE rental_booking_id=?", [bookings[0].rental_booking_id]);
  83  |     expect(after[0]).toMatchObject({ booking_status: "Scheduled", payment_status: "Paid" });
  84  |     const [stillOne] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM financial_records WHERE source_module='Rental' AND source_record_id=? AND record_type='Income'", [bookings[0].rental_booking_id]);
  85  |     expect(Number(stillOne[0].n)).toBe(1);
  86  |   } finally { await visitor.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  87  | });
  88  | 
  89  | test("P30 restricted allocation and payout operations reject unauthorized roles", async ({ browser }) => {
  90  |   const db = await database(), member = await browser.newContext(), bookkeeper = await browser.newContext(), chairman = await browser.newContext();
  91  |   try {
  92  |     await login(member, "member"); await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  93  |     const [before] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records) AS records, (SELECT COUNT(*) FROM patronage_allocations) AS allocations");
  94  |     expect((await member.request.post(`${api}/api/dividends/declarations`, { data: {} })).status()).toBe(403);
  95  |     expect((await bookkeeper.request.post(`${api}/api/dividends/declarations/1/approve`, { data: {} })).status()).toBe(403);
  96  |     expect((await chairman.request.post(`${api}/api/dividends/withdrawals/1/complete`, { data: {} })).status()).toBe(403);
  97  |     expect((await member.request.post(`${api}/api/patronage/periods/1/finalize`, { data: {} })).status()).toBe(403);
  98  |     const [after] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM financial_records) AS records, (SELECT COUNT(*) FROM patronage_allocations) AS allocations");
  99  |     expect(after[0]).toEqual(before[0]);
  100 |   } finally { await member.close(); await bookkeeper.close(); await chairman.close(); await db.end(); }
  101 | });
  102 | 
  103 | test("P30 synthetic dividend withdrawal and patronage-capital transfer enforce roles and post once", async ({ browser }) => {
  104 |   const db=await database(), member=await browser.newContext(), bookkeeper=await browser.newContext(), chairman=await browser.newContext(), other=await browser.newContext();
  105 |   try {
  106 |     await login(bookkeeper,"bookkeeper"); await login(chairman,"chairman"); await login(other,"member");
  107 |     const token=randomUUID().replaceAll("-","").slice(0,8), username=`benefit-${token}`, email=`${username}@example.invalid`, password="SyntheticBenefit123!";
  108 |     const [roles]=await db.query<RowDataPacket[]>("SELECT role_id FROM roles WHERE role_slug='member'");
  109 |     const [staff]=await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='chairman.test'");
  110 |     await db.execute("INSERT INTO users(role_id,username,email,password_hash,display_name,account_status) VALUES(?,?,?,?,?,'Active')",[roles[0].role_id,username,email,await hash(password,10),"Synthetic Benefit Member"]);
  111 |     const [users]=await db.execute<RowDataPacket[]>("SELECT user_id FROM users WHERE username=?",[username]); const userId=String(users[0].user_id);
  112 |     await db.execute("INSERT INTO member_profiles(user_id,member_code,full_name,sector,membership_type,approval_status,official_member_status,application_date,approved_at,true_member_since) VALUES(?,?,'Synthetic Benefit Member','Rice','True Member','Approved','Active','2000-01-01','2000-01-02','2000-01-02')",[userId,`BEN-${token}`]);
  113 |     const [members]=await db.execute<RowDataPacket[]>("SELECT member_id FROM member_profiles WHERE user_id=?",[userId]);const memberId=String(members[0].member_id);
  114 |     expect((await member.request.post(`${api}/api/auth/login`,{data:{identifier:email,password}})).status()).toBe(200);
  115 |     await db.execute("INSERT INTO dividend_declarations(declaration_name,coverage_start,coverage_end,available_at,total_declared_amount,calculation_method,declaration_status,created_by) VALUES(?,'2020-01-01','2020-12-31','2021-01-01',100,'Synthetic','Draft',?)",[`Synthetic declaration ${token}`,staff[0].user_id]);
  116 |     const [decls]=await db.execute<RowDataPacket[]>("SELECT dividend_declaration_id FROM dividend_declarations WHERE declaration_name=?",[`Synthetic declaration ${token}`]); const declarationId=String(decls[0].dividend_declaration_id);
  117 |     await db.execute("INSERT INTO member_dividends(dividend_declaration_id,member_id,dividend_amount,dividend_status,available_at) VALUES(?,?,100,'Pending','2021-01-01')",[declarationId,memberId]);
  118 |     const [dividends]=await db.execute<RowDataPacket[]>("SELECT member_dividend_id FROM member_dividends WHERE dividend_declaration_id=? AND member_id=?",[declarationId,memberId]); const dividendId=String(dividends[0].member_dividend_id);
  119 |     expect((await bookkeeper.request.post(`${api}/api/dividends/declarations/${declarationId}/approve`,{data:{}})).status()).toBe(403);
  120 |     expect((await chairman.request.post(`${api}/api/dividends/declarations/${declarationId}/approve`,{data:{}})).status()).toBe(200);
  121 |     expect((await chairman.request.post(`${api}/api/dividends/declarations/${declarationId}/publish`,{data:{}})).status()).toBe(200);
  122 |     expect((await other.request.post(`${api}/api/members/me/dividends/${dividendId}/request-withdrawal`,{data:{withdrawalMethod:"Cash"}})).status()).toBe(404);
  123 |     expect((await member.request.post(`${api}/api/members/me/dividends/${dividendId}/request-withdrawal`,{data:{withdrawalMethod:"Cash"}})).status()).toBe(200);
  124 |     expect((await member.request.post(`${api}/api/members/me/dividends/${dividendId}/request-withdrawal`,{data:{withdrawalMethod:"Cash"}})).status()).toBe(409);
  125 |     expect((await chairman.request.post(`${api}/api/dividends/withdrawals/${dividendId}/complete`,{data:{}})).status()).toBe(403);
  126 |     expect((await bookkeeper.request.post(`${api}/api/dividends/withdrawals/${dividendId}/complete`,{data:{referenceNumber:`TEST-${token}`}})).status()).toBe(200);
  127 |     expect((await bookkeeper.request.post(`${api}/api/dividends/withdrawals/${dividendId}/complete`,{data:{referenceNumber:`TEST-${token}`}})).status()).toBe(409);
  128 |     const [withdrawn]=await db.execute<RowDataPacket[]>("SELECT dividend_status FROM member_dividends WHERE member_dividend_id=?",[dividendId]);expect(withdrawn[0].dividend_status).toBe("Withdrawn");
  129 |     const [withdrawalFinance]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM financial_records WHERE record_number=?",[`DIV-WD-${dividendId}`]);expect(Number(withdrawalFinance[0].n)).toBe(1);
  130 |     const [years]=await db.query<RowDataPacket[]>("SELECT annual_year FROM patronage_periods WHERE annual_year IS NOT NULL");const used=new Set(years.map(x=>Number(x.annual_year)));const year=Array.from({length:20},(_,i)=>2001+i).find(y=>!used.has(y));if(!year)throw new Error("No unused synthetic period year");
  131 |     const [assets]=await db.query<RowDataPacket[]>("SELECT rental_asset_id FROM rental_assets WHERE asset_code='RNT-PUMP-001'");
  132 |     await db.execute("INSERT INTO rental_bookings(booking_number,rental_asset_id,member_id,requester_name,start_datetime,end_datetime,booking_status,total_amount,payment_status,recorded_by,completed_at) VALUES(?,?,?,'Synthetic Benefit Member',?,?,'Completed',1000,'Paid',?,?)",[`BEN-RENT-${token}`,assets[0].rental_asset_id,memberId,`${year}-06-01 08:00:00`,`${year}-06-01 12:00:00`,staff[0].user_id,`${year}-06-01 12:00:00`]);
  133 |     const [bookings]=await db.execute<RowDataPacket[]>("SELECT rental_booking_id FROM rental_bookings WHERE booking_number=?",[`BEN-RENT-${token}`]); const bookingId=String(bookings[0].rental_booking_id);
  134 |     await db.execute("INSERT INTO payment_references(member_id,provider,payment_channel,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,validated_at) VALUES(?,'Synthetic Cash','Cash',?,'Rental','rental_bookings',?,1000,'Validated',?)",[memberId,`BEN-PAY-${token}`,bookingId,`${year}-06-01 03:00:00`]);
  135 |     const [refs]=await db.execute<RowDataPacket[]>("SELECT payment_reference_id FROM payment_references WHERE reference_number=?",[`BEN-PAY-${token}`]); await db.execute("UPDATE rental_bookings SET payment_reference_id=? WHERE rental_booking_id=?",[refs[0].payment_reference_id,bookingId]);
  136 |     await db.execute("INSERT INTO patronage_periods(period_name,period_start,period_end,refund_pool,calculation_policy,refund_rate,period_status,created_by) VALUES(?,?,?,30,'Rental3PercentAnnual',3,'Finalized',?)",[`Synthetic period ${token}`,`${year}-01-01`,`${year}-12-31`,staff[0].user_id]);
  137 |     const [periods]=await db.execute<RowDataPacket[]>("SELECT patronage_period_id FROM patronage_periods WHERE period_name=?",[`Synthetic period ${token}`]);
  138 |     await db.execute("INSERT INTO patronage_allocations(patronage_period_id,member_id,rental_patronage,total_patronage,refund_amount,payment_status) VALUES(?,?,1000,1000,30,'Pending')",[periods[0].patronage_period_id,memberId]);
  139 |     const [allocations]=await db.execute<RowDataPacket[]>("SELECT patronage_allocation_id FROM patronage_allocations WHERE patronage_period_id=? AND member_id=?",[periods[0].patronage_period_id,memberId]);
> 140 |     const transfer=await member.request.post(`${api}/api/members/me/patronage-capital`,{data:{allocationId:String(allocations[0].patronage_allocation_id),amount:30,requestKey:randomUUID()}});expect(transfer.status()).toBe(201);
      |                                                                                                                                                                                                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  141 |     const transferId=String((await transfer.json()).data.id);
  142 |     expect((await chairman.request.post(`${api}/api/patronage/capital-transfers/${transferId}/decision`,{data:{decision:"Approve"}})).status()).toBe(403);
  143 |     expect((await bookkeeper.request.post(`${api}/api/patronage/capital-transfers/${transferId}/decision`,{data:{decision:"Approve"}})).status()).toBe(200);
  144 |     expect((await bookkeeper.request.post(`${api}/api/patronage/capital-transfers/${transferId}/decision`,{data:{decision:"Approve"}})).status()).toBe(200);
  145 |     const [posted]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n,SUM(amount) AS amount FROM share_capital_transactions WHERE source_type='patronage_capital_transfer' AND source_id=?",[transferId]);expect(Number(posted[0].n)).toBe(1);expect(Number(posted[0].amount)).toBe(30);
  146 |   } finally {await member.close();await bookkeeper.close();await chairman.close();await other.close();await db.end();}
  147 | });
  148 | 
```