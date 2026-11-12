import { closePool, getPool } from "../db/pool";
import type { RowDataPacket } from "mysql2/promise";

type Column = RowDataPacket & { columnName: string; columnType: string };

async function main() {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.query<Column[]>(
      `SELECT column_name AS columnName, column_type AS columnType
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'cooperative_activities'
          AND column_name IN ('activity_status', 'cancellation_reason', 'completed_at')`,
    );
    const columns = new Map(rows.map((row) => [row.columnName, row]));
    const status = columns.get("activity_status");
    if (!status) throw new Error("Activity management migration is required before this migration.");
    if (!status.columnType.includes("'Completed'")) {
      await connection.query("ALTER TABLE cooperative_activities MODIFY COLUMN activity_status ENUM('Scheduled','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled'");
    }
    if (!columns.has("cancellation_reason")) {
      await connection.query("ALTER TABLE cooperative_activities ADD COLUMN cancellation_reason TEXT NULL AFTER activity_status");
    }
    if (!columns.has("completed_at")) {
      await connection.query("ALTER TABLE cooperative_activities ADD COLUMN completed_at DATETIME NULL AFTER cancellation_reason");
    }
    console.info("Activity completion and cancellation-reason fields are ready. Existing events were preserved.");
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error("Activity completion migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
