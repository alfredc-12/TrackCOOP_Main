import assert from "node:assert/strict";
import test from "node:test";
import { getPool, closePool } from "../../db/pool";
import { loadPatronageSources, assertRefundSourcesUnchanged } from "./patronage-sources";
import { calculatePatronageAllocations } from "./patronage-calculator";

// Temporary tables shadow these names on this connection only. No real member,
// rental, refund or payment row is changed. Opt in when local MySQL is available.
test("annual rental sources enforce membership dates, payments, refunds and equipment scope in MySQL", { skip: process.env.PATRONAGE_LOCAL_SQL_TEST !== "1" }, async () => {
  const connection = await getPool().getConnection();
  const tables = ["patronage_allocations", "patronage_periods", "rental_bookings", "payment_references", "rental_assets", "member_profiles"];
  try {
    await connection.query("CREATE TEMPORARY TABLE member_profiles(member_id INT PRIMARY KEY, member_code VARCHAR(40), full_name VARCHAR(80), membership_type VARCHAR(30), true_member_since DATE NULL, approval_status VARCHAR(30), official_member_status VARCHAR(30))");
    await connection.query("CREATE TEMPORARY TABLE rental_assets(rental_asset_id INT PRIMARY KEY, asset_type VARCHAR(30))");
    await connection.query("CREATE TEMPORARY TABLE payment_references(payment_reference_id INT PRIMARY KEY, payment_purpose VARCHAR(30), validation_status VARCHAR(30), amount DECIMAL(14,2), gateway_status VARCHAR(40), validated_at DATETIME NULL, paid_at DATETIME NULL)");
    await connection.query("CREATE TEMPORARY TABLE rental_bookings(rental_booking_id INT PRIMARY KEY, member_id INT, rental_asset_id INT, payment_reference_id INT, start_datetime DATETIME, end_datetime DATETIME, completed_at DATETIME, booking_status VARCHAR(30), payment_status VARCHAR(30), total_amount DECIMAL(14,2))");
    await connection.query("CREATE TEMPORARY TABLE patronage_periods(patronage_period_id INT PRIMARY KEY, period_start DATE, period_end DATE)");
    await connection.query("CREATE TEMPORARY TABLE patronage_allocations(patronage_allocation_id INT PRIMARY KEY, patronage_period_id INT, member_id INT, rental_patronage DECIMAL(14,2), refund_amount DECIMAL(14,2))");
    await connection.query("INSERT INTO member_profiles VALUES (1,'T1','True','True Member','2025-07-01','Approved','Active'),(2,'A1','Associate','Associate',NULL,'Approved','Active'),(3,'T2','Missing date','True Member',NULL,'Approved','Active'),(4,'T3','Inactive','True Member','2025-01-01','Approved','Inactive')");
    await connection.query("INSERT INTO rental_assets VALUES (1,'Equipment'),(2,'Facility')");
    const cases: Array<Record<string, string | number | null>> = [
      {}, { start: "2025-06-30" }, { member: 2 }, { member: 3 }, { member: 4 },
      { booking: "Cancelled" }, { booking: "Scheduled" }, { payment: "Partially Paid" },
      { paidAmount: 500 }, { payment: "Refunded" }, { validation: "Reversed" },
      { gateway: "refunded" }, { gateway: "partially_refunded" },
      { paid: "2026-01-01" }, { completed: "2026-01-01" }, { asset: 2 },
    ];
    for (const [index, item] of cases.entries()) {
      const id = index + 1;
      await connection.execute("INSERT INTO payment_references VALUES (?,'Rental',?,?,?, ?,NULL)", [id, item.validation ?? "Validated", item.paidAmount ?? 10000, item.gateway ?? null, item.paid ?? "2025-08-20"]);
      await connection.execute("INSERT INTO rental_bookings VALUES (?,?,?,?,?,'2025-08-20',?,?,?,10000)", [id, item.member ?? 1, item.asset ?? 1, id, item.start ?? "2025-07-01", item.completed ?? "2025-08-20", item.booking ?? "Completed", item.payment ?? "Paid"]);
    }
    const sources = await loadPatronageSources(connection, "2025-01-01", "2025-12-31");
    assert.equal(sources.length, 1);
    assert.equal(sources[0].purchasePatronage, 0);
    assert.equal(sources[0].rentalPatronage, 10000);
    assert.equal(calculatePatronageAllocations(sources)[0].refundAmount, 300);
    assert.deepEqual(await loadPatronageSources(connection, "2025-01-01", "2025-12-31", "2"), []);
    await connection.query("INSERT INTO patronage_periods VALUES (1,'2025-01-01','2025-12-31')");
    await connection.query("INSERT INTO patronage_allocations VALUES (1,1,1,10000,300)");
    await assert.doesNotReject(assertRefundSourcesUnchanged(connection, "1"));
    await connection.query("UPDATE payment_references SET validation_status='Reversed' WHERE payment_reference_id=1");
    await assert.rejects(assertRefundSourcesUnchanged(connection, "1"), /review this refund/);
  } finally {
    for (const table of tables) await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
    connection.release();
    await closePool();
  }
});
