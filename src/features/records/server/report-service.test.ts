import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { REPORT_CATALOG } from "../record-constants";
import { generateReport } from "./report-service";

const chairman = {
  id: "1",
  numericId: 1,
  displayName: "Records Test Chairman",
  email: "records-test@example.invalid",
  username: "records-test",
  role: "chairman" as const,
};

after(async () => {
  await db.end();
});

describe("database-backed reports", () => {
  it("has unique catalog keys and marks client-owned templates", () => {
    assert.equal(
      new Set(REPORT_CATALOG.map((item) => item.key)).size,
      REPORT_CATALOG.length,
    );
    assert.ok(REPORT_CATALOG.some((item) => item.configurationRequired));
    assert.ok(
      REPORT_CATALOG.some((item) => item.key === "document-download-history"),
    );
  });

  it("executes every configured chairman report against the connected schema", async () => {
    const configured = REPORT_CATALOG.filter(
      (item) => !item.configurationRequired,
    );
    for (const definition of configured) {
      const report = await generateReport(definition.key, {}, chairman, {
        record: false,
      });
      assert.equal(report.reportKey, definition.key);
      assert.ok(Array.isArray(report.rows));
    }
  });

  it("financial summary equals active posted ledger effects and excludes unvalidated linked payments", async () => {
    const report = await generateReport("financial-summary", {}, chairman, {
      record: false,
    });
    const [rows] = await db.query<
      (RowDataPacket & {
        income: string | number;
        expense: string | number;
        records: string | number;
      })[]
    >(
      `SELECT COALESCE(SUM(CASE WHEN fr.record_type = 'Income' THEN fr.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN fr.record_type = 'Expense' THEN fr.amount ELSE 0 END), 0) AS expense,
              COUNT(*) AS records
         FROM financial_records fr
         LEFT JOIN payment_references pr ON pr.payment_reference_id = fr.payment_reference_id
        WHERE fr.record_status = 'Active'
          AND fr.approved_by IS NOT NULL
          AND fr.record_type IN ('Income','Expense')
          AND (fr.payment_reference_id IS NULL OR pr.validation_status = 'Validated')`,
    );
    assert.equal(report.summary[0]?.value, Number(rows[0]?.income ?? 0));
    assert.equal(report.summary[1]?.value, Number(rows[0]?.expense ?? 0));
    assert.equal(report.total, Number(rows[0]?.records ?? 0));
  });

  it("membership directory uses approved member profiles", async () => {
    const report = await generateReport("member-directory", {}, chairman, {
      record: false,
    });
    const [rows] = await db.query<(RowDataPacket & { total: number })[]>(
      "SELECT COUNT(*) AS total FROM member_profiles WHERE approval_status = 'Approved'",
    );
    assert.equal(report.total, Number(rows[0]?.total ?? 0));
  });

  it("rental income is sourced from confirmed posted rental ledger entries", async () => {
    const report = await generateReport("rental-income", {}, chairman, {
      record: false,
    });
    const [rows] = await db.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total
         FROM financial_records fr
         LEFT JOIN payment_references pr ON pr.payment_reference_id = fr.payment_reference_id
        WHERE fr.record_status = 'Active'
          AND fr.approved_by IS NOT NULL
          AND fr.source_module = 'Rental'
          AND fr.record_type = 'Income'
          AND (fr.payment_reference_id IS NULL OR pr.validation_status = 'Validated')`,
    );
    assert.equal(report.total, Number(rows[0]?.total ?? 0));
  });
});
