import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";
import type { AuthContext } from "../modules/auth/auth.types";
import { calculatePatronageAllocations } from "../modules/patronage/patronage-calculator";
import { createPatronageRepository } from "../modules/patronage/patronage.repository";
import { loadPatronageSources } from "../modules/patronage/patronage-sources";
import { rentalRefund, surplusRefundPool } from "../modules/patronage/patronage-policy";
import { buildPatronageHistory, HISTORY_MARKER, HISTORY_PREFIX, money, shiftDate, type DemoAsset, type DemoMember } from "./patronage-demo-data";

// Default is read-only. Apply writes synthetic local demo history, never real payments.
// No app services, gateways, emails, cash payouts or capital postings are invoked.
const mode = process.argv[2] ?? "--dry-run";
assert.ok(["--dry-run", "--apply", "--verify"].includes(mode), "Use --dry-run, --apply or --verify");
const reportDir = path.resolve("scratch/patronage-history");
const manifestFile = path.join(reportDir, "manifest.json");
const backupDir = path.resolve("../database-backups");
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const planHash = (bookings: ReturnType<typeof buildPatronageHistory>) => hash(bookings.map((b) => ({ number: b.number, memberId: b.member.member_id, assetId: b.asset.rental_asset_id, date: b.date, end: b.end, estimate: b.estimate, expense: b.expense })));
const json = (value: unknown) => JSON.stringify(value);
type Annual = { year: number; members: number; bookings: number; rentals: number; demoExpenses: number; netSurplus: number; statutoryReserves: number; refundPool: number; memberRefunds: number; unallocated: number };

async function insert(connection: PoolConnection, table: string, columns: string[], rows: unknown[][]) {
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    await connection.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ?`, [batch]);
  }
}

async function baseline(connection: PoolConnection) {
  const snapshots: Record<string, RowDataPacket[]> = {};
  for (const [table, id] of Object.entries({ rental_bookings: "rental_booking_id", payment_references: "payment_reference_id", financial_records: "financial_record_id", share_capital_accounts: "share_capital_account_id", share_capital_payments: "share_payment_id", share_capital_transactions: "share_capital_transaction_id", patronage_periods: "patronage_period_id", patronage_allocations: "patronage_allocation_id" })) {
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ${table} ORDER BY ${id}`);
    snapshots[table] = rows;
  }
  return snapshots;
}

async function assertPreserved(connection: PoolConnection, snapshots: Record<string, RowDataPacket[]>) {
  const current = await baseline(connection);
  const ids: Record<string, string> = { rental_bookings: "rental_booking_id", payment_references: "payment_reference_id", financial_records: "financial_record_id" };
  for (const [table, rows] of Object.entries(snapshots)) {
    const id = ids[table];
    const originalIds = new Set(rows.map((row) => String(row[id])));
    const selected = id ? current[table].filter((row) => originalIds.has(String(row[id]))) : current[table];
    assert.equal(hash(selected), hash(rows), `Existing ${table} records changed`);
  }
}

async function verify(connection: PoolConnection, bookings: ReturnType<typeof buildPatronageHistory>, actor: string, lifecycle: boolean): Promise<Annual[]> {
  const [counts] = await connection.query<RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM payment_references WHERE provider='Synthetic Demo' AND reference_number LIKE ?) payments,
    (SELECT COUNT(*) FROM financial_records WHERE record_number LIKE ?) financial,
    (SELECT COUNT(*) FROM rental_status_history WHERE remarks LIKE ?) statuses`, [`${HISTORY_PREFIX}%`, `${HISTORY_PREFIX}%`, `${HISTORY_MARKER}:%`]);
  assert.equal(Number(counts[0].payments), bookings.length);
  assert.equal(Number(counts[0].financial), bookings.length * 5);
  assert.equal(Number(counts[0].statuses), bookings.length * 5);
  const adapter = { execute: connection.execute.bind(connection), getConnection: async () => ({ execute: connection.execute.bind(connection), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }) } as unknown as Pool;
  const repository = createPatronageRepository(adapter);
  const auth: AuthContext = { user: { id: actor, displayName: "Synthetic history verification", email: "history@example.test", username: null, role: "chairman" }, sessionId: "demo-check", tokenHash: "demo-check" };
  const annual: Annual[] = [];
  await connection.query("SAVEPOINT history_lifecycle");
  try {
    for (let year = 2021; year <= 2024; year++) {
      const planned = bookings.filter((b) => b.year === year);
      const sources = await loadPatronageSources(connection, `${year}-01-01`, `${year}-12-31`);
      assert.equal(sources.length, 54 + (year - 2021) * 2);
      assert.equal(money(sources.reduce((sum, row) => sum + Number(row.rentalPatronage), 0)), money(planned.reduce((sum, row) => sum + row.estimate.total, 0)));
      for (const source of sources) {
        assert.equal(Number(source.rentalPatronage), money(planned.filter((b) => b.member.member_id === source.memberId).reduce((sum, b) => sum + b.estimate.total, 0)));
      }
      const basis = await repository.financialBasis(`${year}-01-01`, `${year}-12-31`);
      assert.equal(basis.memberRefundRate, 3, "Review current policy before generating this fixture");
      assert.equal(basis.allocationRate, 30);
      // Rental-only reviewed demo basis; existing POS/general business activity is preserved.
      const netSurplus = money(basis.rentalIncome - basis.rentalExpenses);
      const statutoryReserves = money(netSurplus * 0.30); // Illustrative assumption, not a legal determination.
      const refundPool = surplusRefundPool(netSurplus, statutoryReserves, 30);
      const allocations = calculatePatronageAllocations(sources, undefined, 3);
      const memberRefunds = money(allocations.reduce((sum, row) => sum + row.refundAmount, 0));
      assert.ok(memberRefunds > 0 && memberRefunds <= refundPool);
      if (lifecycle) {
        const period = await repository.createPeriod({ name: `${HISTORY_MARKER} ${year} rollback verification`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, netSurplus, statutoryReserves }, auth);
        const calculated = await repository.recalculate(period.id, auth);
        assert.equal(calculated.allocatedRefund, memberRefunds);
        const overview = await repository.overview(period.id);
        assert.equal(overview.allocations.length, sources.length);
        for (const allocation of overview.allocations) assert.equal(allocation.refundAmount, rentalRefund(allocation.rentalPatronage, 3));
        assert.equal((await repository.finalize(period.id, auth)).status, "Finalized");
      }
      annual.push({ year, members: sources.length, bookings: planned.length, rentals: basis.eligibleMemberPatronage, demoExpenses: money(planned.reduce((sum, b) => sum + b.expense, 0)), netSurplus, statutoryReserves, refundPool, memberRefunds, unallocated: money(refundPool - memberRefunds) });
    }
  } finally { await connection.query("ROLLBACK TO SAVEPOINT history_lifecycle"); }
  return annual;
}

async function main() {
  const connection = await getPool().getConnection();
  try {
    const [locks] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 0) acquired", [HISTORY_MARKER]);
    assert.equal(Number(locks[0].acquired), 1, "Another history seeder is running");
    await connection.beginTransaction();
    const [members] = await connection.query<Array<RowDataPacket & DemoMember>>("SELECT *, DATE_FORMAT(true_member_since,'%Y-%m-%d') original_true_member_since, NULL AS complete_address FROM member_profiles WHERE approval_status='Approved' AND official_member_status='Active' AND membership_type='True Member' ORDER BY member_id FOR UPDATE");
    const [assets] = await connection.query<Array<RowDataPacket & DemoAsset>>("SELECT * FROM rental_assets WHERE asset_code IN ('RNT-TRAC-01','RNT-HTR-01','RNT-THR-01','RNT-CSH-01','RNT-PUMP-01') ORDER BY rental_asset_id");
    const bookings = buildPatronageHistory(members, assets);
    const [actors] = await connection.query<RowDataPacket[]>("SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.role_slug='chairman' AND u.account_status='Active' ORDER BY u.user_id LIMIT 1");
    assert.ok(actors[0], "An active chairman is required");
    const actor = String(actors[0].user_id);
    const [existing] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) n FROM rental_bookings WHERE booking_number LIKE ?", [`${HISTORY_PREFIX}%`]);
    if (Number(existing[0].n)) {
      assert.equal(Number(existing[0].n), bookings.length, "Partial fixture detected; inspect the backup");
      const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
      assert.equal(manifest.planHash, planHash(bookings), "Member/asset data changed since seeding; review manifest");
      const original = await baseline(connection);
      const annual = await verify(connection, bookings, actor, true);
      assert.deepEqual(annual, manifest.annual, "Seeded financial results changed since creation");
      await assertPreserved(connection, original);
      await connection.rollback();
      console.info(JSON.stringify({ status: "Existing fixture verified; no duplicate data created", annual }, null, 2));
      return;
    }
    assert.notEqual(mode, "--verify", "No fixture exists yet");
    const [conflicts] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) n FROM rental_bookings WHERE start_datetime<'2025-01-01' AND end_datetime>='2021-01-01'");
    assert.equal(Number(conflicts[0].n), 0, "Historical rentals already exist; review scheduling before applying");
    const [maintenance] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) n FROM rental_maintenance_periods WHERE start_datetime<'2025-01-01' AND end_datetime>='2021-01-01' AND maintenance_status<>'Cancelled'");
    assert.equal(Number(maintenance[0].n), 0, "Historical maintenance requires schedule review");
    const [triggers] = await connection.query<RowDataPacket[]>("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE IN ('member_profiles','rental_bookings','payment_references','financial_records')");
    assert.equal(triggers.length, 0, "Unexpected write triggers require review");
    const [periods] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) n FROM patronage_periods WHERE period_start<'2025-01-01' AND period_end>='2021-01-01'");
    assert.equal(Number(periods[0].n), 0, "Historical refund periods already exist");
    console.info(JSON.stringify({ mode, members: members.length, bookings: bookings.length, annual: [2021, 2022, 2023, 2024].map((year) => { const annual = bookings.filter((b) => b.year === year); return { year, members: new Set(annual.map((b) => b.member.member_id)).size, bookings: annual.length, rentals: money(annual.reduce((sum, b) => sum + b.estimate.total, 0)) }; }) }, null, 2));
    if (mode !== "--apply") { await connection.rollback(); return; }

    const original = await baseline(connection);
    const backupFile = path.join(backupDir, `patronage-history-before-${Date.now()}.json`);
    await mkdir(backupDir, { recursive: true });
    await mkdir(reportDir, { recursive: true });
    await writeFile(backupFile, JSON.stringify({ marker: HISTORY_MARKER, members, assets, original }, null, 2), { flag: "wx" });
    const dateChanges = [];
    for (const member of members) {
      const first = bookings.filter((b) => b.member.member_id === member.member_id).map((b) => b.date).sort()[0];
      if (!first) continue;
      const since = `${first.slice(0, 4)}-01-01`;
      if (member.original_true_member_since && String(member.original_true_member_since) <= since) continue;
      const notes = [member.notes, `[${HISTORY_MARKER}] Synthetic eligibility backfill for 2021–2024 demo rentals. Original dates retained in backup; not actual membership history.`].filter(Boolean).join("\n");
      await connection.execute("UPDATE member_profiles SET true_member_since=?, notes=? WHERE member_id=?", [since, notes, member.member_id]);
      dateChanges.push({ memberId: member.member_id, originalDate: member.original_true_member_since, originalNotes: member.notes, demoDate: since, demoNotes: notes });
    }
    const bookingRows = bookings.map((b) => {
      const address = [b.member.barangay, b.member.municipality ?? "Nasugbu", "Batangas"].filter(Boolean).join(", ");
      const purpose = { marker: HISTORY_MARKER, synthetic: true, requesterType: "Member", fullName: b.member.full_name, memberCode: b.member.member_code, contactNumber: b.member.contact_number ?? "", barangay: b.member.barangay ?? "", municipality: b.member.municipality ?? "Nasugbu", completeAddress: address, serviceLocation: address, serviceBarangay: b.member.barangay ?? "", preferredDate: b.date, preferredEndDate: b.end, preferredStartTime: "08:00", preferredEndTime: "16:00", dailyWork: b.dailyWork, estimatedFee: b.estimate, scheduleStatus: "Scheduled", intendedUse: /thresher|sheller/i.test(b.asset.asset_name) ? "Post-harvest processing" : /pump/i.test(b.asset.asset_name) ? "Irrigation and farm water supply" : "Land preparation", additionalNotes: `${HISTORY_MARKER}: AI-generated demonstration history; not an actual transaction.` };
      return [b.number, b.asset.rental_asset_id, b.member.member_id, b.member.full_name, b.member.contact_number, json(purpose), `${b.date} 08:00:00`, `${b.end} 16:00:00`, "Completed", Number(b.asset.rate_amount), money(b.gross - b.estimate.total), b.estimate.total, "Paid", actor, `${shiftDate(b.date, -5)} 01:00:00`, actor, `${b.end} 16:00:00`, `${HISTORY_MARKER}: synthetic completed service`, `${shiftDate(b.date, -7)} 01:00:00`, `${b.end} 08:15:00`];
    });
    await insert(connection, "rental_bookings", ["booking_number", "rental_asset_id", "member_id", "requester_name", "requester_contact", "purpose", "start_datetime", "end_datetime", "booking_status", "rate_amount", "discount_amount", "total_amount", "payment_status", "approved_by", "approved_at", "recorded_by", "completed_at", "completion_notes", "created_at", "updated_at"], bookingRows);
    const [savedBookings] = await connection.query<RowDataPacket[]>("SELECT rental_booking_id,booking_number FROM rental_bookings WHERE booking_number LIKE ?", [`${HISTORY_PREFIX}%`]);
    const bookingIds = new Map(savedBookings.map((row) => [String(row.booking_number), String(row.rental_booking_id)]));
    await insert(connection, "payment_references", ["member_id", "provider", "payment_channel", "gateway_environment", "reference_number", "payment_purpose", "related_entity_type", "related_entity_id", "amount", "validation_status", "validated_by", "validated_at", "paid_at", "validation_source", "notes", "submitted_at", "updated_at"], bookings.map((b) => [b.member.member_id, "Synthetic Demo", "Cash", "Manual", `${b.number}-PAY`, "Rental", "rental_booking", bookingIds.get(b.number), b.estimate.total, "Validated", actor, `${b.end} 08:15:00`, `${b.end} 08:00:00`, "System", json({ marker: HISTORY_MARKER, synthetic: true, paymentId: `${b.number}-PAY`, paymentMethod: "Cash", paymentDate: b.end, receiptNumber: `${b.number}-DEMO`, status: "Paid", notes: "Synthetic cash record for demo only. No real cash collected." }), `${b.end} 08:05:00`, `${b.end} 08:15:00`]));
    await connection.query("UPDATE rental_bookings b JOIN payment_references p ON p.related_entity_id=b.rental_booking_id AND p.related_entity_type='rental_booking' AND p.provider='Synthetic Demo' SET b.payment_reference_id=p.payment_reference_id,b.updated_at=p.validated_at WHERE b.booking_number LIKE ?", [`${HISTORY_PREFIX}%`]);
    const [payments] = await connection.query<RowDataPacket[]>("SELECT payment_reference_id,reference_number FROM payment_references WHERE provider='Synthetic Demo' AND reference_number LIKE ?", [`${HISTORY_PREFIX}%`]);
    const paymentIds = new Map(payments.map((row) => [String(row.reference_number), String(row.payment_reference_id)]));
    const [categories] = await connection.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('RENTAL_INCOME','FUEL_GASOLINE','REPAIR_MAINTENANCE','OTHER_EXPENSE','UTILITIES')");
    const categoryIds = new Map(categories.map((row) => [String(row.category_code), String(row.financial_category_id)]));
    assert.equal(categoryIds.size, 5);
    const financialRows: unknown[][] = [], statusRows: unknown[][] = [];
    for (const b of bookings) {
      const bookingId = bookingIds.get(b.number), paymentId = paymentIds.get(`${b.number}-PAY`);
      financialRows.push([`${b.number}-INC`, paymentId, b.member.member_id, categoryIds.get("RENTAL_INCOME"), actor, actor, "Income", "Rental", bookingId, b.estimate.total, b.end, "Active", json({ marker: HISTORY_MARKER, synthetic: true, paymentId: `${b.number}-PAY`, paymentMethod: "Cash", referenceNumber: `${b.number}-PAY` }), `${b.end} 08:15:00`, `${b.end} 08:15:00`]);
      let remaining = b.expense;
      for (const [i, [code, label, fraction]] of ([ ["FUEL_GASOLINE", "Fuel", 0.38], ["OTHER_EXPENSE", "Operator labor", 0.37], ["REPAIR_MAINTENANCE", "Maintenance allocation", 0.17], ["UTILITIES", "Rental overhead allocation", 0.08] ] as const).entries()) {
        const amount = i === 3 ? remaining : money(b.expense * fraction); remaining = money(remaining - amount);
        financialRows.push([`${b.number}-EXP${i + 1}`, null, null, categoryIds.get(code), actor, actor, "Expense", "Rental", bookingId, amount, b.end, "Active", json({ marker: HISTORY_MARKER, synthetic: true, expenseId: `${b.number}-EXP${i + 1}`, rentalId: b.number, expenseDate: b.end, equipmentName: b.asset.asset_name, category: label, amount, paymentMethod: "Cash", description: `Synthetic ${label.toLowerCase()} for demonstration`, remarks: HISTORY_MARKER }), `${b.end} 08:20:00`, `${b.end} 08:20:00`]);
      }
      const stages = [[null, "Pending", `${shiftDate(b.date, -7)} 01:00:00`], ["Pending", "Approved", `${shiftDate(b.date, -5)} 01:00:00`], ["Approved", "Scheduled", `${shiftDate(b.date, -1)} 01:00:00`], ["Scheduled", "In Use", `${b.date} 00:00:00`], ["In Use", "Completed", `${b.end} 08:00:00`]];
      for (const [oldStatus, newStatus, at] of stages) statusRows.push([bookingId, oldStatus, newStatus, `${HISTORY_MARKER}: synthetic status history`, actor, at]);
    }
    await insert(connection, "financial_records", ["record_number", "payment_reference_id", "member_id", "financial_category_id", "recorded_by", "approved_by", "record_type", "source_module", "source_record_id", "amount", "record_date", "record_status", "remarks", "created_at", "updated_at"], financialRows);
    await insert(connection, "rental_status_history", ["rental_booking_id", "old_status", "new_status", "remarks", "changed_by", "changed_at"], statusRows);
    const annual = await verify(connection, bookings, actor, true);
    await assertPreserved(connection, original);
    const [currentMembers] = await connection.query<RowDataPacket[]>("SELECT *, DATE_FORMAT(true_member_since,'%Y-%m-%d') original_true_member_since, NULL AS complete_address FROM member_profiles WHERE approval_status='Approved' AND official_member_status='Active' AND membership_type='True Member' ORDER BY member_id");
    const stableMemberFields = (rows: RowDataPacket[]) => rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !['true_member_since','original_true_member_since','notes','updated_at'].includes(key))));
    assert.equal(hash(stableMemberFields(currentMembers)), hash(stableMemberFields(members)), "Unrelated membership fields changed");
    const manifest = { marker: HISTORY_MARKER, backupFile, planHash: planHash(bookings), dateChanges, bookingIds: [...bookingIds.values()], paymentIds: [...paymentIds.values()], annual, status: "prepared" };
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    await connection.commit();
    await writeFile(manifestFile, JSON.stringify({ ...manifest, status: "committed" }, null, 2));
    const report = ["# Synthetic patronage rental history, 2021–2024", "", "AI-generated demo transactions using existing members and equipment. These are not actual financial or membership histories. No patronage periods, payouts or capital credits were created.", "", "Use the following rental-only reviewed demo amounts when creating each yearly period. Net surplus includes existing Rental financial entries, with new demo operating expenses deducted. Other business records are preserved. Statutory deductions below are an illustrative 30% of rental surplus, not a CDA/legal determination; allocation is 30% of the remainder and member refunds are 3% of each member’s qualifying rentals. Unused pool remains unallocated.", "", "| Year | Members | Rentals | Net surplus to enter | Statutory deductions to enter | Pool | Expected refunds |", "|---|---:|---:|---:|---:|---:|---:|", ...annual.map((a) => `| ${a.year} | ${a.members} | ₱${a.rentals.toFixed(2)} | ₱${a.netSurplus.toFixed(2)} | ₱${a.statutoryReserves.toFixed(2)} | ₱${a.refundPool.toFixed(2)} | ₱${a.memberRefunds.toFixed(2)} |`), "", "Eligibility: only true_member_since and notes were backfilled for participating members; original values are retained in the backup. Account/application dates and all existing capital balances and transactions were preserved.", "", `Backup: ${backupFile}`, `Manifest with generated IDs and original eligibility values: ${manifestFile}`, "", "Checked against the application's real SQL source query and create → calculate → finalize flow. Verification periods and allocations were rolled back. Run `npx tsx server/src/scripts/seed-patronage-history.ts --verify` before creating your own periods; verification requires those years to remain unused.", ""].join("\n");
    await writeFile(path.join(reportDir, "README.md"), report);
    console.info(JSON.stringify({ status: "Committed; lifecycle verification rolled back; periods left uncreated", backupFile, report: path.join(reportDir, "README.md"), annual }, null, 2));
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.query("SELECT RELEASE_LOCK(?)", [HISTORY_MARKER]); connection.release(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(closePool);
