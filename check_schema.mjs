import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ path: "./server/.env" });

async function check() {
  const db = await createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const [columns] = await db.query("SHOW COLUMNS FROM documents");
    console.log(columns);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
check();
