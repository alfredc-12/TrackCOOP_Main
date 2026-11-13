import { closePool, getPool } from "../db/pool";
import type { RowDataPacket } from "mysql2/promise";

type Column = RowDataPacket & { columnName: string };

async function main() {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.query<Column[]>(
      `SELECT column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'cooperative_activities'
          AND column_name = 'image_path'`,
    );

    if (!rows.length) {
      await connection.query(
        "ALTER TABLE cooperative_activities ADD COLUMN image_path VARCHAR(1000) NULL AFTER description",
      );
    }

    console.info("Event image storage is ready. Existing events were preserved.");
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error("Activity image migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
