import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
try {
  const [identity] = await db.query("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  const dir = String(identity[0].dir).replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
  const sql = readFileSync("server/database/migrations/20261108_activity_management.sql", "utf8").replace(/^--.*$/gm, "");
  for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.query(statement);
  console.log("Applied additive activity schema to verified synthetic database; legacy attendance was preserved.");
} finally { await db.end(); }
