import dotenv from "dotenv";
dotenv.config({ path: "./server/.env" });
import { getPool } from "../server/src/db/pool";

async function run() {
  const pool = getPool();
  try {
    const [members]: any = await pool.execute("SELECT full_name, user_id FROM members LIMIT 10");
    console.log("Members:", members);
  } catch (error) {
    console.error("Error fetching members:", error);
  } finally {
    await pool.end();
  }
}

run();
