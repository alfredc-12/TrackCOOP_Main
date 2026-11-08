import mysql from "mysql2/promise";

// Apply the existing ledger migration's backfill to one verified synthetic
// seed member whose payment predates the schema-only test migration.
const db = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
try {
  const [identity] = await db.query("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  const dir = String(identity[0].dir).replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  if (Number(identity[0].port) !== 33327 || identity[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
  await db.beginTransaction();
  const [rows] = await db.query("SELECT m.member_id,p.share_payment_id,p.amount,p.payment_date,p.created_at,p.updated_at,p.verified_by,p.remarks FROM member_profiles m JOIN share_capital_payments p ON p.member_id=m.member_id WHERE m.member_code='NFFAC-SEED-0001' AND p.payment_status='Validated' FOR UPDATE");
  if (rows.length !== 1 || Number(rows[0].amount) !== 1500) throw new Error("Unexpected synthetic seed payment; no backfill performed");
  const payment=rows[0];
  const [accounts] = await db.execute("SELECT share_capital_account_id FROM share_capital_accounts WHERE member_id=?",[payment.member_id]);
  if (accounts.length) throw new Error("Synthetic seed account already exists; no backfill performed");
  const [account] = await db.execute("INSERT INTO share_capital_accounts(member_id,initial_capital,current_balance) VALUES(?,?,?)",[payment.member_id,payment.amount,payment.amount]);
  await db.execute("INSERT INTO share_capital_transactions(share_capital_account_id,member_id,transaction_date,transaction_type,direction,amount,balance_before,balance_after,reference_number,source_type,source_id,transaction_status,remarks,created_by,created_at,updated_at) VALUES(?,?,?,'Initial Share Capital','Credit',?,0,?,?,'share_capital_payment',?,'Posted',?,?,?,?)",[account.insertId,payment.member_id,payment.payment_date,payment.amount,payment.amount,`SC-PAY-${payment.share_payment_id}`,String(payment.share_payment_id),payment.remarks,payment.verified_by,payment.created_at,payment.updated_at]);
  await db.commit();
  console.log("Backfilled the single verified synthetic seed payment using the existing ledger migration's rules.");
} catch (error) { await db.rollback(); throw error; } finally { await db.end(); }
