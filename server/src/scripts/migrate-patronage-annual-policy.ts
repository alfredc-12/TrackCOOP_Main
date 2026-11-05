import type { RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";

async function main() {
  try {
    const pool = getPool();
    const [columns] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM patronage_periods");
    const names = new Set(columns.map((column) => column.Field));
    if (!names.has("calculation_policy")) await pool.query("ALTER TABLE patronage_periods ADD COLUMN calculation_policy VARCHAR(40) NOT NULL DEFAULT 'Legacy'");
    if (!names.has("refund_rate")) await pool.query("ALTER TABLE patronage_periods ADD COLUMN refund_rate DECIMAL(5,2) NULL");
    if (!names.has("annual_year")) await pool.query("ALTER TABLE patronage_periods ADD COLUMN annual_year SMALLINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN calculation_policy = 'Rental3PercentAnnual' THEN YEAR(period_start) ELSE NULL END) STORED");
    const [indexes] = await pool.query<RowDataPacket[]>("SHOW INDEX FROM patronage_periods WHERE Key_name = 'uq_patronage_annual_year'");
    if (!indexes.length) await pool.query("ALTER TABLE patronage_periods ADD UNIQUE KEY uq_patronage_annual_year (annual_year)");
    console.info("Annual patronage policy fields are ready. Existing allocations and payments remain unchanged and are marked Legacy.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally { await closePool(); }
}

void main();
