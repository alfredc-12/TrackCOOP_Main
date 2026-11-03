import { readFile } from "node:fs/promises";
import path from "node:path";
import { closePool, getPool } from "../db/pool";

/** Applies 20261104_email_outbox.sql (three new tables). Idempotent, additive, manual. */
export function splitSqlStatements(source: string) {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  try {
    const source = await readFile(path.resolve(process.cwd(), "server/database/migrations/20261104_email_outbox.sql"), "utf8");
    for (const statement of splitSqlStatements(source)) {
      await getPool().query(statement);
    }
    console.info("Email outbox tables are ready. No existing table was changed.");
  } catch (error) {
    console.error("Email outbox migration failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (require.main === module) void main();
