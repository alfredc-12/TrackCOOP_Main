import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import { postShareCapitalPaymentToLedger } from "../share-capital/share-capital-ledger.repository";
import { reconcileApplicationCapital } from "./membership-application.capital.reconcile";

const enabled = process.env.MEMBERSHIP_RECONCILIATION_SQL_TEST === "1";
const guardsEnabled = process.env.MEMBERSHIP_CAPACITY_GUARDS_SQL_TEST === "1";
// Explicit localhost-only disposable schema. Project/production DB credentials are never consulted.
test(
  "application reconciliation posts ledger credits transactionally and idempotently in real SQL",
  { skip: !enabled },
  async (t) => {
    const schema = `trackcoop_reconcile_${process.pid}_${Date.now()}`;
    const admin = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3401,
      user: "root",
      charset: "utf8mb4",
      multipleStatements: true,
    });
    let pool: Pool | undefined;
    try {
      await admin.query(
        `CREATE DATABASE ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      await admin.query(`USE ${schema}`);
      await admin.query(
        await readFile(
          path.resolve("server/database/TrackCOOP_MAIN_Database.sql"),
          "utf8",
        ),
      );
      pool = mysql.createPool({
        host: "127.0.0.1",
        port: 3401,
        user: "root",
        database: schema,
        timezone: "Z",
        connectionLimit: 4,
      });
      const db = pool;
      await db.execute(
        `INSERT INTO users(user_id,role_id,email,password_hash,display_name,account_status) SELECT 9,role_id,'reconciliation@example.test','unused','Reconciliation Test','Active' FROM roles WHERE role_slug IN ('chairman','chairman_admin') LIMIT 1`,
      );
      let sequence = 0;
      async function fixture(amounts: number[], existing = false, opening = 0) {
        const key = String(++sequence);
        const [m] = await db.execute<ResultSetHeader>(
          "INSERT INTO member_profiles(member_code,full_name,membership_type,approval_status,official_member_status) VALUES(?,?,'Associate','Approved','Active')",
          [`RECON-${key}`, `Reconciliation ${key}`],
        );
        const memberId = String(m.insertId);
        const [a] = await db.execute<ResultSetHeader>(
          `INSERT INTO membership_applications(application_code,public_tracking_token_hash,requested_membership_type,first_name,last_name,contact_number,current_address,terms_version,applicant_signature_name,signed_at,signed_place) VALUES(?,SHA2(?,256),'True Member','Reconciliation',?,'9123456789','Test address','test',?,UTC_TIMESTAMP(),'Test')`,
          [`RECON-APP-${key}`, key, key, `Reconciliation ${key}`],
        );
        const applicationId = String(a.insertId);
        const references: string[] = [];
        for (const amount of amounts) {
          const ref = `RECON-${key}-${references.length}`;
          const [p] = await db.execute<ResultSetHeader>(
            `INSERT INTO payment_references(payer_name,provider,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,payment_channel,validated_by,validated_at,paid_at) VALUES(?,'Cash',?,'Share Capital','membership_application',?,?,'Validated','Cash',9,'2026-07-27 03:00:00','2026-07-27 02:59:00')`,
            [`Reconciliation ${key}`, ref, applicationId, amount],
          );
          references.push(String(p.insertId));
          if (existing)
            await db.execute(
              "INSERT INTO share_capital_payments(member_id,payment_reference_id,amount,payment_date,payment_status,verified_by,verified_at) VALUES(?,?,?,'2026-07-27','Validated',9,'2026-07-27 03:00:00')",
              [memberId, p.insertId, amount],
            );
        }
        if (opening) {
          const [account] = await db.execute<ResultSetHeader>(
            "INSERT INTO share_capital_accounts(member_id,current_balance) VALUES(?,?)",
            [memberId, opening],
          );
          await db.execute(
            `INSERT INTO share_capital_transactions(share_capital_account_id,member_id,transaction_date,transaction_type,direction,amount,balance_before,balance_after,reference_number,source_type,source_id,created_by) VALUES(?,?,'2026-07-01','Capital Adjustment Credit','Credit',?,0,?,?,'test_opening',?,9)`,
            [account.insertId, memberId, opening, opening, `OPEN-${key}`, key],
          );
        }
        return {
          memberId,
          applicationId,
          applicationCode: `RECON-APP-${key}`,
          references,
        };
      }
      const run = (f: Awaited<ReturnType<typeof fixture>>, actorUserId = "9") =>
        withTransaction(
          (connection) =>
            reconcileApplicationCapital({
              connection,
              applicationId: f.applicationId,
              applicationCode: f.applicationCode,
              memberId: f.memberId,
              actorUserId,
              maximumShareCapital: 15000,
            }),
          db,
        );
      async function balances(memberId: string) {
        const [r] = await db.execute<RowDataPacket[]>(
          `SELECT COALESCE((SELECT current_balance FROM share_capital_accounts WHERE member_id=?),0) AS balance,(SELECT COUNT(*) FROM share_capital_payments WHERE member_id=?) AS payments,(SELECT COUNT(*) FROM share_capital_transactions WHERE member_id=? AND source_type='share_capital_payment') AS credits`,
          [memberId, memberId, memberId],
        );
        return {
          balance: Number(r[0].balance),
          payments: Number(r[0].payments),
          credits: Number(r[0].credits),
        };
      }
      await t.test(
        "new installments post two ledger credits and retry stays unchanged",
        async () => {
          const f = await fixture([1500, 1500]);
          const first = await run(f);
          assert.equal(first.insertedCapitalRows, 2);
          assert.deepEqual(await balances(f.memberId), {
            balance: 3000,
            payments: 2,
            credits: 2,
          });
          assert.equal((await run(f)).insertedCapitalRows, 0);
          assert.deepEqual(await balances(f.memberId), {
            balance: 3000,
            payments: 2,
            credits: 2,
          });
          const [dates] = await db.execute<RowDataPacket[]>(
            "SELECT DATE_FORMAT(transaction_date,'%Y-%m-%d') AS date FROM share_capital_transactions WHERE member_id=?",
            [f.memberId],
          );
          assert.ok(dates.every((r) => r.date === "2026-07-27"));
        },
      );
      await t.test(
        "previously reconciled rows with mixed posted/unposted credits are completed once",
        async () => {
          const f = await fixture([1500, 1500], true);
          const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT share_payment_id FROM share_capital_payments WHERE payment_reference_id=?",
            [f.references[0]],
          );
          await withTransaction(
            (connection) =>
              postShareCapitalPaymentToLedger({
                connection,
                memberId: f.memberId,
                sharePaymentId: String(rows[0].share_payment_id),
                amount: 1500,
                transactionDate: "2026-07-27",
                referenceNumber: "ALREADY-POSTED",
                createdBy: "9",
              }),
            db,
          );
          assert.equal((await run(f)).insertedCapitalRows, 0);
          assert.deepEqual(await balances(f.memberId), {
            balance: 3000,
            payments: 2,
            credits: 2,
          });
          await run(f);
          assert.deepEqual(await balances(f.memberId), {
            balance: 3000,
            payments: 2,
            credits: 2,
          });
          const [original] = await db.execute<RowDataPacket[]>(
            "SELECT reference_number FROM share_capital_transactions WHERE source_type='share_capital_payment' AND source_id=?",
            [rows[0].share_payment_id],
          );
          assert.equal(original[0].reference_number, "ALREADY-POSTED");
        },
      );
      await t.test(
        "posting failure rolls back payment insertion, account creation, credits and links",
        async () => {
          const f = await fixture([1500]);
          await assert.rejects(() => run(f, "99999999"));
          assert.deepEqual(await balances(f.memberId), {
            balance: 0,
            payments: 0,
            credits: 0,
          });
          const [refs] = await db.execute<RowDataPacket[]>(
            "SELECT member_id,amount,validation_status FROM payment_references WHERE payment_reference_id=?",
            [f.references[0]],
          );
          assert.equal(refs[0].member_id, null);
          assert.equal(Number(refs[0].amount), 1500);
          assert.equal(refs[0].validation_status, "Validated");
        },
      );
      await t.test(
        "concurrent reconciliations serialize and create one credit per payment",
        async () => {
          const f = await fixture([1500, 1500]);
          await Promise.all([run(f), run(f)]);
          assert.deepEqual(await balances(f.memberId), {
            balance: 3000,
            payments: 2,
            credits: 2,
          });
        },
      );
      await t.test(
        "combined PR #6 ledger guard permits exactly 15,000, including an idempotent retry",
        { skip: !guardsEnabled },
        async () => {
          const f = await fixture([2000], false, 13000);
          await run(f);
          await run(f);
          assert.deepEqual(await balances(f.memberId), {
            balance: 15000,
            payments: 1,
            credits: 1,
          });
        },
      );
      await t.test(
        "combined PR #6 guard rolls back an over-ceiling new credit",
        { skip: !guardsEnabled },
        async () => {
          const f = await fixture([1000, 500.01], false, 14000);
          await assert.rejects(
            () => run(f),
            (e) =>
              e instanceof AppError &&
              e.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
          );
          assert.deepEqual(await balances(f.memberId), {
            balance: 14000,
            payments: 0,
            credits: 0,
          });
        },
      );
      await t.test(
        "combined PR #6 guard rejects an old missing credit without modifying historical payment",
        { skip: !guardsEnabled },
        async () => {
          const f = await fixture([1500], true, 14000);
          await assert.rejects(
            () => run(f),
            (e) =>
              e instanceof AppError &&
              e.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
          );
          assert.deepEqual(await balances(f.memberId), {
            balance: 14000,
            payments: 1,
            credits: 0,
          });
          const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT amount,payment_status FROM share_capital_payments WHERE payment_reference_id=?",
            [f.references[0]],
          );
          assert.equal(Number(rows[0].amount), 1500);
          assert.equal(rows[0].payment_status, "Validated");
        },
      );
    } finally {
      await pool?.end();
      await admin.query(`DROP DATABASE IF EXISTS ${schema}`);
      await admin.end();
    }
  },
);
