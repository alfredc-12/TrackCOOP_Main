import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";

type CountRow = RowDataPacket & { total: number };

async function exists(
  kind: "columns" | "statistics" | "table_constraints",
  tableName: string,
  name: string,
) {
  const nameColumn =
    kind === "columns"
      ? "column_name"
      : kind === "statistics"
        ? "index_name"
        : "constraint_name";
  const [rows] = await getPool().execute<CountRow[]>(
    `SELECT COUNT(*) AS total
       FROM information_schema.${kind}
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND ${nameColumn} = ?`,
    [tableName, name],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function ensureRentalBookingMemberColumn() {
  const pool = getPool();
  if (!(await exists("columns", "rental_bookings", "member_id"))) {
    await pool.query(
      "ALTER TABLE rental_bookings ADD COLUMN member_id BIGINT UNSIGNED NULL AFTER rental_asset_id",
    );
    console.log("Added rental_bookings.member_id");
  }
  if (!(await exists("statistics", "rental_bookings", "idx_rental_bookings_member"))) {
    await pool.query(
      "CREATE INDEX idx_rental_bookings_member ON rental_bookings (member_id, created_at)",
    );
    console.log("Added idx_rental_bookings_member");
  }
  if (!(await exists("table_constraints", "rental_bookings", "fk_rental_booking_member"))) {
    await pool.query(
      `ALTER TABLE rental_bookings
         ADD CONSTRAINT fk_rental_booking_member
         FOREIGN KEY (member_id) REFERENCES member_profiles (member_id)
         ON UPDATE CASCADE ON DELETE SET NULL`,
    );
    console.log("Added fk_rental_booking_member");
  }
}

async function main() {
  const migrationPath = path.resolve(
    process.cwd(),
    "server",
    "database",
    "migrations",
    "20260723_rental_operations.sql",
  );
  const source = await readFile(migrationPath, "utf8");
  const statements = source
    .split(";")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
  const connection = await getPool().getConnection();
  try {
    await ensureRentalBookingMemberColumn();
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log(`Rental operations migration applied (${statements.length} statements).`);
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error(
      "Rental operations migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(closePool);
