import { readFile } from "node:fs/promises";
import path from "node:path";
import { closePool, getPool } from "../db/pool";

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
