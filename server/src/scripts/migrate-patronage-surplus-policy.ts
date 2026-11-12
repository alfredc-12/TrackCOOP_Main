import type { RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";

async function main() {
  try {
    const pool = getPool();
    const [columns] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM patronage_periods");
    const names = new Set(columns.map((column) => column.Field));
    for (const [name, definition] of [
      ["net_surplus", "DECIMAL(14,2) NULL"],
      ["statutory_reserves", "DECIMAL(14,2) NULL"],
      ["allocation_rate", "DECIMAL(5,2) NULL"],
    ]) {
      if (!names.has(name)) await pool.query(`ALTER TABLE patronage_periods ADD COLUMN ${name} ${definition}`);
    }
    if (!String(columns.find((column) => column.Field === "refund_rate")?.Type).includes("26,8")) {
      await pool.query("ALTER TABLE patronage_periods MODIFY COLUMN refund_rate DECIMAL(26,8) NULL");
    }
    const [table] = await pool.query<RowDataPacket[]>("SHOW CREATE TABLE patronage_periods");
    if (!String(table[0]?.["Create Table"]).includes("RentalConfiguredAnnual")) {
      await pool.query("ALTER TABLE patronage_periods MODIFY COLUMN annual_year SMALLINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN calculation_policy IN ('Rental3PercentAnnual', 'RentalSurplusAnnual', 'RentalConfiguredAnnual') THEN YEAR(period_start) ELSE NULL END) STORED");
    }
    console.info("Surplus-based patronage fields are ready. Existing refund amounts, policies, payments and transfers are unchanged.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally { await closePool(); }
}

void main();
