import { closePool, getPool } from "../db/pool";
import type { RowDataPacket } from "mysql2/promise";

async function main() {
  try {
    const pool = getPool();
    const [columns] = await pool.execute<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_profiles' AND COLUMN_NAME = 'occupation'",
    );
    if (!columns.length) {
      await pool.query("ALTER TABLE member_profiles ADD COLUMN occupation VARCHAR(190) NULL AFTER email");
    }
    console.info("Member occupation field is ready. Existing profiles and application records were preserved.");
  } catch (error) {
    console.error("Member occupation migration failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();
