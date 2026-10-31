import { closePool, getPool } from "../db/pool";
import type { RowDataPacket } from "mysql2/promise";

async function main() {
  try {
    const pool = getPool();
    const [columns] = await pool.execute<RowDataPacket[]>("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_profiles' AND COLUMN_NAME = 'livelihoods'");
    if (!columns.length) await pool.query("ALTER TABLE member_profiles ADD COLUMN livelihoods JSON NULL AFTER occupation");
    console.info("Member livelihoods field is ready. Existing member records were preserved.");
  } catch (error) {
    console.error("Member livelihoods migration failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();
