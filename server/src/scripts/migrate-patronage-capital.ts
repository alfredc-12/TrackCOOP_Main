import { readFile } from "node:fs/promises";
import path from "node:path";
import { closePool, getPool } from "../db/pool";

async function main() {
  try {
    const source = await readFile(path.resolve(process.cwd(), "server/database/migrations/20261030_patronage_capital_transfers.sql"), "utf8");
    await getPool().query(source);
    console.info("Patronage Share Capital transfer table is ready. Existing refunds, payouts, and capital records were preserved.");
  } catch (error) {
    console.error("Patronage transfer migration failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();
