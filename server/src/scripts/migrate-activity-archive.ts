import type { RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";

type Column = RowDataPacket & { columnName: string };
type Index = RowDataPacket & { indexName: string };
type Constraint = RowDataPacket & { constraintName: string };

async function main() {
  const connection = await getPool().getConnection();
  try {
    const [columns] = await connection.query<Column[]>(
      `SELECT column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'cooperative_activities'
          AND column_name IN ('archived_at', 'archived_by')`,
    );
    const existingColumns = new Set(columns.map((column) => column.columnName));

    if (!existingColumns.has("archived_at")) {
      await connection.query(
        "ALTER TABLE cooperative_activities ADD COLUMN archived_at DATETIME NULL AFTER completed_at",
      );
    }
    if (!existingColumns.has("archived_by")) {
      await connection.query(
        "ALTER TABLE cooperative_activities ADD COLUMN archived_by BIGINT UNSIGNED NULL AFTER archived_at",
      );
    }

    const [constraints] = await connection.query<Constraint[]>(
      `SELECT constraint_name AS constraintName
         FROM information_schema.table_constraints
        WHERE table_schema = DATABASE()
          AND table_name = 'cooperative_activities'
          AND constraint_name = 'fk_cooperative_activity_archiver'`,
    );
    if (!constraints.length) {
      await connection.query(
        `ALTER TABLE cooperative_activities
           ADD CONSTRAINT fk_cooperative_activity_archiver
             FOREIGN KEY (archived_by) REFERENCES users (user_id)
             ON UPDATE CASCADE ON DELETE SET NULL`,
      );
    }

    const [indexes] = await connection.query<Index[]>(
      `SELECT DISTINCT index_name AS indexName
         FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'cooperative_activities'
          AND index_name = 'idx_cooperative_activity_archive_date'`,
    );
    if (!indexes.length) {
      await connection.query(
        "CREATE INDEX idx_cooperative_activity_archive_date ON cooperative_activities (archived_at, activity_date)",
      );
    }

    console.info("Activity archive storage is ready. Existing events and attendance were preserved.");
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error("Activity archive migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
