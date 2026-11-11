import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, closePool } from "../../db/pool";
import type { AuthContext } from "../auth/auth.types";
import { createPatronageRepository } from "./patronage.repository";
import { loadPatronageSources } from "./patronage-sources";

// Every fixture and write, including simulated cash records, is rolled back.
// No payment gateway or external service is called.
test("configured rate MySQL lifecycle preserves both rates, checks funding and retains historical proportional calculations", { skip: process.env.PATRONAGE_LOCAL_SQL_TEST !== "1" }, async () => {
  const pool = getPool();
  const connection = await pool.getConnection();
  const prefix = `SURPLUS-${randomUUID().slice(0, 8)}`;
  const [before] = await pool.query("SELECT COUNT(*) AS periods, (SELECT COUNT(*) FROM patronage_allocations) AS allocations, (SELECT COALESCE(SUM(refund_amount),0) FROM patronage_allocations) AS refunds FROM patronage_periods");
  try {
    await connection.beginTransaction();
    const [users] = await connection.query<RowDataPacket[]>("SELECT user_id FROM users LIMIT 1");
    assert.ok(users[0], "An existing test actor is required");
    const actor = String(users[0].user_id);
    const auth: AuthContext = { user: { id: actor, displayName: "Surplus test", email: "test@example.test", username: null, role: "chairman" }, sessionId: "test", tokenHash: "test" };
    const [usedYears] = await connection.query<RowDataPacket[]>("SELECT YEAR(period_start) AS year FROM patronage_periods UNION SELECT YEAR(completed_at) AS year FROM rental_bookings");
    const year = Array.from({ length: 30 }, (_, index) => 1980 + index).find((candidate) => !usedYears.some((row) => Number(row.year) === candidate));
    assert.ok(year, "An unused historical fixture year is required");
    const startDate = `${year}-01-01`, endDate = `${year}-12-31`;
    assert.deepEqual(await loadPatronageSources(connection, startDate, endDate), []);
    const [asset] = await connection.execute<ResultSetHeader>("INSERT INTO rental_assets (asset_code,asset_name,asset_type,created_by) VALUES (?,?,'Equipment',?)", [prefix, "Surplus fixture equipment", actor]);
    const bookings: string[] = [];
    for (const [index, amount] of [1000, 20000, 979000].entries()) {
      const [member] = await connection.execute<ResultSetHeader>("INSERT INTO member_profiles(member_code,full_name,membership_type,approval_status,official_member_status,true_member_since) VALUES (?,?,'True Member','Approved','Active',?)", [`${prefix}-${index}`, `Surplus fixture ${index}`, startDate]);
      const [payment] = await connection.execute<ResultSetHeader>("INSERT INTO payment_references(member_id,reference_number,payment_purpose,amount,validation_status,validated_at,validated_by) VALUES (?,?,'Rental',?,'Validated',?,?)", [member.insertId, `${prefix}-PAY-${index}`, amount, `${year}-08-20 00:00:00`, actor]);
      const [booking] = await connection.execute<ResultSetHeader>("INSERT INTO rental_bookings(booking_number,rental_asset_id,member_id,start_datetime,end_datetime,completed_at,booking_status,payment_status,total_amount,payment_reference_id,recorded_by) VALUES (?,?,?,?,?,?,'Completed','Paid',?,?,?)", [`${prefix}-RNT-${index}`, asset.insertId, member.insertId, `${year}-07-01 08:00:00`, `${year}-08-20 11:00:00`, `${year}-08-20 11:00:00`, amount, payment.insertId, actor]);
      bookings.push(String(booking.insertId));
    }
    await connection.execute("INSERT INTO system_settings(setting_group,setting_key,setting_value,value_type,description,is_public,effective_date,updated_by) VALUES('patronage','patronage.allocation_rate','30','Number','Rollback-only policy fixture',0,CURRENT_DATE(),?) ON DUPLICATE KEY UPDATE setting_value='30'", [actor]);
    await connection.execute("INSERT INTO system_settings(setting_group,setting_key,setting_value,value_type,description,is_public,effective_date,updated_by) VALUES('patronage','patronage.member_refund_rate','3','Number','Rollback-only member rate fixture',0,CURRENT_DATE(),?) ON DUPLICATE KEY UPDATE setting_value='3'", [actor]);
    const adapter = { execute: connection.execute.bind(connection), getConnection: async () => ({ execute: connection.execute.bind(connection), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }) } as unknown as Pool;
    const repository = createPatronageRepository(adapter);
    const input = { name: prefix, startDate, endDate, netSurplus: 250000, statutoryReserves: 50000 };
    await assert.rejects(repository.createPeriod({ ...input, refundPool: 900 }, auth), /refund pool must match/);
    const period = await repository.createPeriod(input, auth);
    assert.equal(period.policyVersion, "RentalConfiguredAnnual");
    assert.equal(period.refundPool, 60000);
    assert.equal(period.refundRate, 3);
    assert.equal(period.netSurplus, 250000);
    assert.equal(period.statutoryReserves, 50000);
    await connection.execute("UPDATE system_settings SET setting_value='40' WHERE setting_key='patronage.allocation_rate'");
    await connection.execute("UPDATE system_settings SET setting_value='4' WHERE setting_key='patronage.member_refund_rate'");
    const calculated = await repository.recalculate(period.id, auth);
    assert.equal(calculated.allocationRate, 30, "Saved periods must not adopt a later global rate");
    assert.equal(calculated.allocatedRefund, 30000);
    assert.equal(calculated.refundPool, 60000, "Recalculation must preserve the funding pool when refunds leave a remainder");
    assert.equal(calculated.refundRate, 3, "Saved periods must not adopt a later member rate");
    let overview = await repository.overview(period.id);
    assert.deepEqual(overview.allocations.map((row) => row.refundAmount).sort((a, b) => a - b), [30, 600, 29370]);
    await connection.execute("UPDATE rental_bookings SET total_amount=19000 WHERE rental_booking_id=?", [bookings[1]]);
    await assert.rejects(repository.finalize(period.id, auth), /Recalculate the yearly refunds/);
    await connection.execute("UPDATE rental_bookings SET total_amount=20000 WHERE rental_booking_id=?", [bookings[1]]);
    const finalized = await repository.finalize(period.id, auth);
    assert.equal(finalized.status, "Finalized");
    overview = await repository.overview(period.id);
    const vince = overview.allocations.find((row) => row.rentalPatronage === 1000)!;
    assert.equal(vince.availableRefund, 30);
    await connection.execute("UPDATE rental_bookings SET total_amount=900 WHERE rental_booking_id=?", [bookings[0]]);
    await assert.rejects(repository.markPaid(vince.id, null, auth), /review this refund/);
    await connection.execute("UPDATE rental_bookings SET total_amount=1000 WHERE rental_booking_id=?", [bookings[0]]);
    const paid = await repository.markPaid(vince.id, null, auth);
    assert.equal(paid.paymentStatus, "Paid");
    assert.equal(paid.refundAmount, 30);
    await assert.rejects(repository.markPaid(vince.id, null, auth), /already recorded as paid/);
    await assert.rejects(repository.createPeriod({ ...input, name: `${prefix}-duplicate` }, auth), /overlaps/);
    await assert.rejects(connection.execute("INSERT INTO patronage_periods(period_name,period_start,period_end,refund_pool,created_by,calculation_policy) VALUES (?,?,?,?,?,'Rental3PercentAnnual')", [`${prefix}-duplicate-sql`, startDate, endDate, 30, actor]), (error: unknown) => error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY");

    // A cent-sized pool can leave zero-cent allocations. Those are not unpaid cash.
    const nextYear = Array.from({ length: 30 }, (_, index) => year + 1 + index).find((candidate) => !usedYears.some((row) => Number(row.year) === candidate));
    assert.ok(nextYear);
    await connection.execute("UPDATE rental_bookings SET start_datetime=?, end_datetime=?, completed_at=? WHERE rental_booking_id IN (?,?,?)", [`${nextYear}-07-01 08:00:00`, `${nextYear}-08-20 11:00:00`, `${nextYear}-08-20 11:00:00`, ...bookings]);
    const tiny = await repository.createPeriod({ name: `${prefix}-cent`, startDate: `${nextYear}-01-01`, endDate: `${nextYear}-12-31`, netSurplus: 0.03, statutoryReserves: 0 }, auth);
    assert.equal(tiny.refundPool, 0.01);
    await repository.recalculate(tiny.id, auth);
    await assert.rejects(repository.finalize(tiny.id, auth), /Member refunds exceed the allocated pool/);
    assert.equal((await repository.overview(tiny.id)).selectedPeriod?.status, "Draft");
    // Explicit fixture conversion exercises the preserved, older proportional policy.
    await connection.execute("UPDATE patronage_periods SET calculation_policy='RentalSurplusAnnual' WHERE patronage_period_id=?", [tiny.id]);
    await repository.recalculate(tiny.id, auth);
    await repository.finalize(tiny.id, auth);
    const tinyOverview = await repository.overview(tiny.id);
    assert.equal(tinyOverview.allocations.filter((row) => row.refundAmount === 0).length, 2);
    await repository.markPaid(tinyOverview.allocations.find((row) => row.refundAmount === 0.01)!.id, null, auth);
    assert.equal((await repository.overview(tiny.id)).selectedPeriod?.status, "Paid");
  } finally {
    await connection.rollback();
    connection.release();
    const [after] = await pool.query("SELECT COUNT(*) AS periods, (SELECT COUNT(*) FROM patronage_allocations) AS allocations, (SELECT COALESCE(SUM(refund_amount),0) FROM patronage_allocations) AS refunds FROM patronage_periods");
    assert.deepEqual(after, before);
    await closePool();
  }
});
