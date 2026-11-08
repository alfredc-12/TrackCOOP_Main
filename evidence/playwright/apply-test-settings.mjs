import mysql from "mysql2/promise";

// This script must never target a shared or live database.
const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
try {
  const [identity] = await db.query("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  const dir = String(identity[0].dir).replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
  const [rows] = await db.execute("SELECT setting_value FROM system_settings WHERE setting_key=?", ["member_indicators.fallback_thresholds"]);
  if (rows.length !== 1) throw new Error("Expected one RFM configuration row");
  const settings = JSON.parse(rows[0].setting_value);
  settings.contributionAmount = [{ min: 15000, score: 5 }, { min: 3000, score: 4 }, { min: 1500, score: 3 }, { min: 0.01, score: 2 }];
  await db.beginTransaction();
  await db.execute("UPDATE system_settings SET setting_value=? WHERE setting_key=?", [JSON.stringify(settings), "member_indicators.fallback_thresholds"]);
  await db.execute("UPDATE system_settings SET setting_value='6' WHERE setting_key=?", ["membership.share_capital_deadline_months"]);
  await db.commit();
  console.log("Updated only the verified synthetic RFM and deadline settings; historical scores were not recalculated.");
} finally { await db.end(); }
