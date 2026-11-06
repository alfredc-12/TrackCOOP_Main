import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { previewControlledBudget, withControlledBudget } from "./controlled-budget.guard";

const enabled = process.env.BUDGET_GUARD_ISOLATED_MYSQL === "1";
test("isolated MySQL: migration, fallback/exact races, stale decisions, replay and rollback", { skip: !enabled }, async () => {
  const port = Number(process.env.BUDGET_GUARD_TEST_PORT);
  const expectedDirectory = process.env.BUDGET_GUARD_TEST_DATADIR;
  if (!Number.isInteger(port) || port < 1024 || !expectedDirectory || !expectedDirectory.toLowerCase().includes("trackcoop-budget-1b-synthetic")) throw new Error("Explicit isolated synthetic target is required");
  const db = `trackcoop_budget_test_${randomBytes(4).toString("hex")}`;
  const server = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", multipleStatements: true });
  const [identity] = await server.query<mysql.RowDataPacket[]>("SELECT @@datadir AS dataDir, @@port AS port");
  const normalize = (p: string) => p.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  if (Number(identity[0].port) !== port || normalize(String(identity[0].dataDir)) !== normalize(expectedDirectory)) throw new Error("Refusing non-isolated MySQL target");
  await server.query(`CREATE DATABASE \`${db}\``);
  await server.end();
  const pool = mysql.createPool({ host: "127.0.0.1", port, user: "root", database: db, multipleStatements: true, connectionLimit: 6 });
  try {
    await pool.query(`CREATE TABLE users(user_id BIGINT UNSIGNED PRIMARY KEY);
      CREATE TABLE audit_logs(audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED,action VARCHAR(100),entity_table VARCHAR(100),record_id BIGINT UNSIGNED,description TEXT,new_values JSON,action_time DATETIME);
      CREATE TABLE financial_categories(financial_category_id SMALLINT UNSIGNED PRIMARY KEY, category_type VARCHAR(20), category_code VARCHAR(60), category_name VARCHAR(120));
      CREATE TABLE budgets(budget_id BIGINT UNSIGNED PRIMARY KEY, budget_status VARCHAR(30), coverage_start DATE, coverage_end DATE);
      CREATE TABLE budget_lines(budget_line_id BIGINT UNSIGNED PRIMARY KEY, budget_id BIGINT UNSIGNED, financial_category_id SMALLINT UNSIGNED, season_id BIGINT UNSIGNED NULL, limit_amount DECIMAL(14,2), warning_percentage DECIMAL(5,2), hard_limit TINYINT);
      CREATE TABLE financial_records(financial_record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, financial_category_id SMALLINT UNSIGNED, season_id BIGINT UNSIGNED NULL, record_date DATE, amount DECIMAL(14,2), record_type VARCHAR(20), record_status VARCHAR(20), approved_by BIGINT UNSIGNED NULL, source_module VARCHAR(30), source_record_id BIGINT UNSIGNED NULL, payment_reference_id BIGINT UNSIGNED NULL, correction_of_record_id BIGINT UNSIGNED NULL, reversal_of_record_id BIGINT UNSIGNED NULL);
      CREATE TABLE payment_references(payment_reference_id BIGINT UNSIGNED PRIMARY KEY,payment_purpose VARCHAR(40),payment_channel VARCHAR(40),gateway_environment VARCHAR(20),validation_status VARCHAR(30),amount DECIMAL(14,2));
      CREATE TABLE pos_sales(pos_sale_id BIGINT UNSIGNED PRIMARY KEY);
      CREATE TABLE rental_bookings(rental_booking_id BIGINT UNSIGNED PRIMARY KEY);
      INSERT INTO users VALUES(1);
      INSERT INTO financial_categories VALUES(4,'Expense','FUEL','Fuel'),(5,'Expense','REPAIR','Repair'),(6,'Expense','ADMIN','Admin'),(7,'Expense','OTHER','Other');
      INSERT INTO budgets VALUES(1,'Approved','2026-01-01','2026-12-31');
      INSERT INTO budget_lines VALUES(10,1,4,NULL,100,80,1),(11,1,5,7,100,80,1),(12,1,5,NULL,500,80,1),(13,1,6,NULL,100,80,1),(14,1,7,NULL,100,80,1);`);
    await pool.query(readFileSync("server/database/migrations/20261106_budget_attribution_guard.sql", "utf8"));
    let key = 0;
    async function runRace(categoryId: string, seasonId: string | null, expectedLine: string) {
      const input = { date: "2026-06-01", categoryId, seasonId, amount: "60.00" };
      const preview = await previewControlledBudget(pool, input);
      assert.equal(preview.evaluation.state, "WITHIN_BUDGET");
      assert.equal(preview.evaluation.lineId, expectedLine);
      const operationKeys = [++key, ++key].map((v) => v.toString(16).padStart(64, "0"));
      const post = async (connection: mysql.PoolConnection) => {
        const [result] = await connection.execute<mysql.ResultSetHeader>("INSERT INTO financial_records(financial_category_id,season_id,record_date,amount,record_type,record_status,approved_by,source_module) VALUES(?,?,?,'60.00','Expense','Active',1,'Manual')", [categoryId, seasonId, input.date]);
        return String(result.insertId);
      };
      const results = await Promise.all(operationKeys.map((operationKey) => withControlledBudget(pool, { ...input, actorId: "1", operationKey, expectedBasis: preview.basis! }, post)));
      assert.deepEqual(results.map((r) => r.state).sort(), ["HARD_LIMIT_EXCEEDED", "POSTED"]);
      const index = results.findIndex((r) => r.state === "POSTED");
      const replay = await withControlledBudget(pool, { ...input, actorId: "1", operationKey: operationKeys[index], expectedBasis: preview.basis! }, async () => { throw new Error("Replay repeated a post"); });
      assert.equal(replay.state, "REPLAY");
    }
    await runRace("4", "9", "10");
    await runRace("5", "7", "11");
    await pool.execute("INSERT INTO financial_categories VALUES(9,'Both','BOTH','Both')");
    await pool.execute("INSERT INTO budget_lines VALUES(99,1,9,NULL,100,80,1)");
    const wrong = { date:"2026-06-01",categoryId:"9",seasonId:null,amount:"1.00" };
    const wrongPreview = await previewControlledBudget(pool,wrong);
    await assert.rejects(withControlledBudget(pool,{ ...wrong,actorId:"1",operationKey:"d".repeat(64),expectedBasis:wrongPreview.basis! },async(c)=>{
      const [created]=await c.execute<mysql.ResultSetHeader>("INSERT INTO financial_records(financial_category_id,record_date,amount,record_type,record_status,approved_by,source_module) VALUES(9,'2026-06-01',1,'Income','Active',1,'Manual')");return String(created.insertId);
    }));
    const [wrongRows]=await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM financial_records WHERE financial_category_id=9");assert.equal(wrongRows[0].n,0);
    const [audit] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM audit_logs WHERE action='budget.assignment_created'");
    assert.equal(audit[0].count, 2);
    const staleInput = { date: "2026-06-01", categoryId: "6", seasonId: null, amount: "1.00" };
    const stale = await previewControlledBudget(pool, staleInput);
    await pool.execute("UPDATE budget_lines SET limit_amount=101 WHERE budget_line_id=13");
    const staleResult = await withControlledBudget(pool, { ...staleInput, actorId: "1", operationKey: "a".repeat(64), expectedBasis: stale.basis! }, async () => { throw new Error("stale post"); });
    assert.equal(staleResult.state, "STALE_BUDGET");
    const fresh = await previewControlledBudget(pool, staleInput);
    await assert.rejects(withControlledBudget(pool, { ...staleInput, actorId: "1", operationKey: "b".repeat(64), expectedBasis: fresh.basis! }, async (c) => {
      await c.execute("INSERT INTO financial_records(financial_category_id,record_date,amount,record_type,record_status,approved_by,source_module) VALUES(6,'2026-06-01',1,'Expense','Active',1,'Manual')");
      throw new Error("fixture rollback");
    }));
    const [rolled] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM financial_records WHERE financial_category_id=6");
    assert.equal(rolled[0].count, 0);
    await pool.execute("INSERT INTO financial_records(financial_category_id,record_date,amount,record_type,record_status,approved_by,source_module) VALUES(7,'2026-06-01',1,'Expense','Active',1,'Manual')");
    assert.equal((await previewControlledBudget(pool, { ...staleInput, categoryId: "7" })).evaluation.state, "HISTORICAL_ATTRIBUTION_REQUIRED");
    assert.equal((await previewControlledBudget(pool, { ...staleInput, categoryId: "8" })).evaluation.state, "UNBUDGETED");
    await pool.execute("INSERT INTO budget_lines VALUES(15,1,6,NULL,101,80,1)");
    assert.equal((await previewControlledBudget(pool, staleInput)).evaluation.state, "AMBIGUOUS");
    // Simulate a future cooperating budget-close path that takes the same mutex.
    const close = await pool.getConnection();
    await close.beginTransaction();
    await close.execute("SELECT mutex_id FROM budget_control_mutex WHERE mutex_id=1 FOR UPDATE");
    await close.execute("UPDATE budgets SET budget_status='Closed' WHERE budget_id=1");
    const waitForClose = withControlledBudget(pool, { ...staleInput, categoryId: "4", actorId: "1", operationKey: "c".repeat(64), expectedBasis: "d".repeat(64) }, async () => { throw new Error("closed budget posted"); });
    await close.commit();
    close.release();
    assert.equal((await waitForClose).state, "UNBUDGETED");
  } finally { await pool.end(); }
});
