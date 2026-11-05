import { readFileSync } from "node:fs";
import path from "node:path";
import { closePool, getPool } from "../db/pool";

async function main() {
  try {
    await getPool().query(readFileSync(path.resolve("server/database/migrations/20261105_membership_upgrade_requests.sql"), "utf8"));
    console.info("Membership upgrade requests are ready. Existing data was preserved.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally { await closePool(); }
}
void main();
