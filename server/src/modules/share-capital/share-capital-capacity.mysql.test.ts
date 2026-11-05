import assert from "node:assert/strict";
import test from "node:test";
import { closePool, getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  assertLockedMemberShareCapitalCapacity,
  selectMemberShareCapitalCapacity,
} from "./share-capital-capacity";
import { createShareCapitalRepository } from "./share-capital.repository";
import { createShareCapitalLedgerRepository } from "./share-capital-ledger.repository";
import { createPatronageCapitalRepository } from "../patronage/patronage-capital.repository";

const bookkeeperAuth: AuthContext = {
  user: {
    id: "2",
    displayName: "Bookkeeper",
    email: "bookkeeper@example.test",
    username: "bookkeeper",
    role: "bookkeeper",
  },
  sessionId: "1",
  tokenHash: "hash",
};

const memberAuth: AuthContext = {
  user: {
    id: "3",
    displayName: "Juan Dela Cruz",
    email: "juan@example.test",
    username: "juan",
    role: "member",
  },
  sessionId: "2",
  tokenHash: "hash-member",
};

// Opt-in real MySQL SQL test using an isolated ephemeral database so multi-connection InnoDB row locks and
// concurrent transactions are exercised without reading or modifying any real cooperative rows.
test(
  "real MySQL SQL: unified capacity handles coexisting posted capital, capitalized interest, unposted validated payments, Test/Live PayMongo isolation, and multi-connection InnoDB concurrency",
  { skip: process.env.SHARE_CAPITAL_LOCAL_SQL_TEST !== "1" && process.env.PATRONAGE_LOCAL_SQL_TEST !== "1" },
  async () => {
    const pool = getPool();
    const setupConn = await pool.getConnection();
    const schemaName = `trackcoop_sec2_test_${process.pid}`;
    try {
      await setupConn.query(`CREATE DATABASE IF NOT EXISTS \`${schemaName}\``);
      await setupConn.query(`USE \`${schemaName}\``);

      await setupConn.query(`
        CREATE TABLE system_settings (
          setting_key VARCHAR(120) PRIMARY KEY,
          setting_value TEXT NOT NULL
        ) ENGINE=InnoDB
      `);
      await setupConn.query(`INSERT INTO system_settings VALUES ('membership.maximum_share_capital', '15000')`);

      await setupConn.query(`
        CREATE TABLE member_profiles (
          member_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NULL,
          member_code VARCHAR(40) NOT NULL,
          full_name VARCHAR(120) NOT NULL,
          email VARCHAR(120) NULL,
          contact_number VARCHAR(40) NULL,
          membership_type VARCHAR(30) NOT NULL DEFAULT 'True Member',
          true_member_since DATE NULL,
          approval_status VARCHAR(30) NOT NULL DEFAULT 'Approved',
          official_member_status VARCHAR(30) NOT NULL DEFAULT 'Active',
          share_capital_deadline DATE NULL
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE share_capital_accounts (
          share_capital_account_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          member_id BIGINT UNSIGNED NOT NULL UNIQUE,
          initial_capital DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          current_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          total_additional_contributions DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          total_dividends_added DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          total_deductions DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE share_capital_payments (
          share_payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          member_id BIGINT UNSIGNED NOT NULL,
          payment_reference_id BIGINT UNSIGNED NULL,
          amount DECIMAL(14,2) NOT NULL,
          payment_date DATE NOT NULL,
          payment_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
          verified_by BIGINT UNSIGNED NULL,
          verified_at DATETIME NULL,
          reversal_of_payment_id BIGINT UNSIGNED NULL,
          remarks TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE share_capital_transactions (
          share_capital_transaction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          share_capital_account_id BIGINT UNSIGNED NOT NULL,
          member_id BIGINT UNSIGNED NOT NULL,
          transaction_date DATE NOT NULL,
          transaction_type VARCHAR(60) NOT NULL,
          direction VARCHAR(20) NOT NULL,
          amount DECIMAL(14,2) NOT NULL,
          balance_before DECIMAL(14,2) NOT NULL,
          balance_after DECIMAL(14,2) NOT NULL,
          reference_number VARCHAR(100) NULL,
          source_type VARCHAR(60) NULL,
          source_id BIGINT UNSIGNED NULL,
          transaction_status VARCHAR(30) NOT NULL DEFAULT 'Posted',
          remarks TEXT NULL,
          created_by BIGINT UNSIGNED NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE payment_references (
          payment_reference_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          member_id BIGINT UNSIGNED NULL,
          submitted_by BIGINT UNSIGNED NULL,
          payer_name VARCHAR(120) NULL,
          payer_email VARCHAR(120) NULL,
          payer_contact VARCHAR(40) NULL,
          provider VARCHAR(80) NULL,
          payment_channel VARCHAR(30) NOT NULL DEFAULT 'PayMongo',
          gateway_environment VARCHAR(20) NOT NULL DEFAULT 'Test',
          reference_number VARCHAR(80) NOT NULL,
          payment_purpose VARCHAR(40) NOT NULL,
          related_entity_type VARCHAR(40) NULL,
          related_entity_id BIGINT UNSIGNED NULL,
          amount DECIMAL(14,2) NOT NULL,
          validation_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
          gateway_status VARCHAR(40) NULL,
          validated_at DATETIME NULL,
          paid_at DATETIME NULL,
          submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          client_request_id VARCHAR(100) NULL
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE payment_gateway_checkout_attempts (
          payment_gateway_checkout_attempt_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          payment_reference_id BIGINT UNSIGNED NOT NULL,
          gateway_name VARCHAR(30) NOT NULL DEFAULT 'PayMongo',
          gateway_environment VARCHAR(20) NOT NULL DEFAULT 'Test',
          checkout_url VARCHAR(255) NULL,
          reusable_until DATETIME NOT NULL,
          superseded_at DATETIME NULL,
          completed_at DATETIME NULL,
          gateway_status VARCHAR(30) NULL
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE dividend_declarations (
          dividend_declaration_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          declaration_name VARCHAR(120) NOT NULL,
          declaration_status VARCHAR(30) NOT NULL DEFAULT 'Published',
          coverage_start DATE NOT NULL,
          coverage_end DATE NOT NULL,
          declared_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE member_dividends (
          member_dividend_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          dividend_declaration_id BIGINT UNSIGNED NOT NULL,
          member_id BIGINT UNSIGNED NOT NULL,
          dividend_amount DECIMAL(14,2) NOT NULL,
          dividend_status VARCHAR(40) NOT NULL DEFAULT 'Available',
          member_decision VARCHAR(40) NOT NULL DEFAULT 'Undecided',
          available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          withdrawal_method VARCHAR(40) NULL,
          withdrawal_provider VARCHAR(80) NULL,
          withdrawal_account_name VARCHAR(120) NULL,
          withdrawal_account_number VARCHAR(80) NULL,
          withdrawal_qr_code MEDIUMTEXT NULL,
          withdrawal_receipt MEDIUMTEXT NULL,
          withdrawal_receipt_name VARCHAR(255) NULL,
          decided_at DATETIME NULL,
          processed_at DATETIME NULL,
          processed_by BIGINT UNSIGNED NULL,
          share_capital_transaction_id BIGINT UNSIGNED NULL,
          withdrawal_reference VARCHAR(120) NULL,
          processing_notes TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE dividend_action_history (
          history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          member_dividend_id BIGINT UNSIGNED NOT NULL,
          previous_status VARCHAR(40) NULL,
          new_status VARCHAR(40) NOT NULL,
          action_name VARCHAR(80) NOT NULL,
          remarks TEXT NULL,
          performed_by BIGINT UNSIGNED NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE patronage_periods (
          patronage_period_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          period_name VARCHAR(120) NOT NULL,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          period_status VARCHAR(30) NOT NULL DEFAULT 'Finalized',
          calculation_policy VARCHAR(40) NOT NULL DEFAULT 'Rental3PercentAnnual'
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE patronage_allocations (
          patronage_allocation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          patronage_period_id BIGINT UNSIGNED NOT NULL,
          member_id BIGINT UNSIGNED NOT NULL,
          rental_patronage DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          refund_amount DECIMAL(14,2) NOT NULL,
          payment_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
          paid_by BIGINT UNSIGNED NULL,
          paid_at DATETIME NULL,
          payment_notes TEXT NULL
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE patronage_capital_transfers (
          transfer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          patronage_allocation_id BIGINT UNSIGNED NOT NULL,
          member_id BIGINT UNSIGNED NOT NULL,
          amount DECIMAL(14,2) NOT NULL,
          request_key VARCHAR(64) NOT NULL UNIQUE,
          transfer_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
          requested_by BIGINT UNSIGNED NULL,
          requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          processed_by BIGINT UNSIGNED NULL,
          processed_at DATETIME NULL,
          processing_notes VARCHAR(255) NULL,
          share_capital_transaction_id BIGINT UNSIGNED NULL
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE rental_assets (
          rental_asset_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          asset_type VARCHAR(30) NOT NULL DEFAULT 'Equipment'
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE rental_bookings (
          rental_booking_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          member_id BIGINT UNSIGNED NOT NULL,
          rental_asset_id BIGINT UNSIGNED NOT NULL,
          payment_reference_id BIGINT UNSIGNED NOT NULL,
          start_datetime DATETIME NOT NULL,
          end_datetime DATETIME NOT NULL,
          completed_at DATETIME NOT NULL,
          booking_status VARCHAR(30) NOT NULL DEFAULT 'Completed',
          payment_status VARCHAR(30) NOT NULL DEFAULT 'Paid',
          total_amount DECIMAL(14,2) NOT NULL
        ) ENGINE=InnoDB
      `);

      await setupConn.query(`
        CREATE TABLE audit_logs (
          audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NULL,
          action VARCHAR(120) NOT NULL,
          entity_table VARCHAR(80) NOT NULL,
          record_id VARCHAR(80) NULL,
          description TEXT NULL,
          new_values JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      // Seed Member 1:
      // - 3,000 validated pre-approval payment (NOT posted to share_capital_transactions)
      // - 10,000 validated post-approval payment (posted to share_capital_transactions)
      // - 1,500 capitalized CBU interest in share_capital_accounts (current_balance = 11,500)
      await setupConn.query(
        "INSERT INTO member_profiles (member_id, user_id, member_code, full_name, membership_type, true_member_since, approval_status, official_member_status) VALUES (1, 3, 'MEM-2026-0001', 'Juan Dela Cruz', 'True Member', '2025-01-01', 'Approved', 'Active')",
      );
      await setupConn.query(
        "INSERT INTO share_capital_accounts (share_capital_account_id, member_id, initial_capital, current_balance, total_additional_contributions, total_dividends_added) VALUES (10, 1, 10000.00, 11500.00, 0.00, 1500.00)",
      );
      await setupConn.query(
        "INSERT INTO share_capital_payments (share_payment_id, member_id, payment_reference_id, amount, payment_date, payment_status) VALUES (1, 1, 101, 3000.00, '2026-01-10', 'Validated'), (2, 1, 102, 10000.00, '2026-02-10', 'Validated')",
      );
      await setupConn.query(
        "INSERT INTO share_capital_transactions (share_capital_transaction_id, share_capital_account_id, member_id, transaction_date, transaction_type, direction, amount, balance_before, balance_after, source_type, source_id, transaction_status) VALUES (50, 10, 1, '2026-02-10', 'Initial Share Capital', 'Credit', 10000.00, 0.00, 10000.00, 'share_capital_payment', 2, 'Posted'), (51, 10, 1, '2026-03-10', 'Dividend Added to Share Capital', 'Credit', 1500.00, 10000.00, 11500.00, 'member_dividend', 90, 'Posted')",
      );

      // Active Test PayMongo checkout of 200.00 and Active Live PayMongo checkout of 100.00
      await setupConn.query(
        "INSERT INTO payment_references (payment_reference_id, member_id, payment_purpose, related_entity_type, payment_channel, gateway_environment, validation_status, amount, reference_number, submitted_at) VALUES (201, 1, 'Share Capital', 'member_profile', 'PayMongo', 'Test', 'Pending', 200.00, 'SC-201', UTC_TIMESTAMP()), (202, 1, 'Share Capital', 'member_profile', 'PayMongo', 'Live', 'Pending', 100.00, 'SC-202', UTC_TIMESTAMP())",
      );
      await setupConn.query(
        "INSERT INTO payment_gateway_checkout_attempts (payment_gateway_checkout_attempt_id, payment_reference_id, gateway_name, gateway_environment, checkout_url, reusable_until, gateway_status) VALUES (301, 201, 'PayMongo', 'Test', 'https://checkout.test/201', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE), 'active'), (302, 202, 'PayMongo', 'Live', 'https://checkout.live/202', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE), 'active')",
      );

      // Part 1: Verify coexistence of posted capital (10,000), capitalized interest (1,500), and unposted validated payment (3,000) = 14,500 committed
      const testSnapshot = await selectMemberShareCapitalCapacity(setupConn, {
        memberId: "1",
        gatewayEnvironment: "Test",
      });
      assert.equal(testSnapshot.ledgerBalance, 11500);
      assert.equal(testSnapshot.unpostedValidatedPayments, 3000);
      assert.equal(testSnapshot.validatedPayments, 13000);
      assert.equal(testSnapshot.committedCapital, 14500);
      assert.equal(testSnapshot.activePendingQrph, 200);
      assert.equal(testSnapshot.availableCapacity, 300);

      // Part 2: Verify Test vs Live PayMongo checkout reservation isolation
      const liveSnapshot = await selectMemberShareCapitalCapacity(setupConn, {
        memberId: "1",
        gatewayEnvironment: "Live",
      });
      assert.equal(liveSnapshot.committedCapital, 14500);
      assert.equal(liveSnapshot.activePendingQrph, 100);
      assert.equal(liveSnapshot.availableCapacity, 400);

      await assert.rejects(
        () =>
          assertLockedMemberShareCapitalCapacity(setupConn, {
            memberId: "1",
            requestedAmount: 300.01,
            gatewayEnvironment: "Test",
          }),
        (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
      );

      // Part 3: Multi-connection InnoDB row-lock concurrency test across Payment, CBU Dividend, and Patronage Reservation
      // Clear pending checkouts so Member 1 has 14,500 committed and 500 remaining capacity.
      await setupConn.query("DELETE FROM payment_gateway_checkout_attempts");
      await setupConn.query("DELETE FROM payment_references");

      // Seed an Available CBU dividend of 300.00
      await setupConn.query(
        "INSERT INTO dividend_declarations (dividend_declaration_id, declaration_name, declaration_status, coverage_start, coverage_end) VALUES (1, '2025 Annual Interest', 'Published', '2025-01-01', '2025-12-31')",
      );
      await setupConn.query(
        "INSERT INTO member_dividends (member_dividend_id, dividend_declaration_id, member_id, dividend_amount, dividend_status) VALUES (55, 1, 1, 300.00, 'Available')",
      );

      // Seed an eligible finalized Patronage Refund allocation of 500.00 backed by a 2025 equipment rental
      await setupConn.query("INSERT INTO rental_assets (rental_asset_id, asset_type) VALUES (1, 'Equipment')");
      await setupConn.query(
        "INSERT INTO payment_references (payment_reference_id, member_id, payment_purpose, payment_channel, gateway_environment, validation_status, amount, reference_number, validated_at) VALUES (501, 1, 'Rental', 'PayMongo', 'Live', 'Validated', 16666.67, 'RNT-501', '2025-08-15 04:00:00')",
      );
      await setupConn.query(
        "INSERT INTO rental_bookings (rental_booking_id, member_id, rental_asset_id, payment_reference_id, start_datetime, end_datetime, completed_at, booking_status, payment_status, total_amount) VALUES (1, 1, 1, 501, '2025-08-10 08:00:00', '2025-08-12 17:00:00', '2025-08-12 17:00:00', 'Completed', 'Paid', 16666.67)",
      );
      await setupConn.query(
        "INSERT INTO patronage_periods (patronage_period_id, period_name, period_start, period_end, period_status, calculation_policy) VALUES (20, '2025 Patronage', '2025-01-01', '2025-12-31', 'Finalized', 'Rental3PercentAnnual')",
      );
      await setupConn.query(
        "INSERT INTO patronage_allocations (patronage_allocation_id, patronage_period_id, member_id, rental_patronage, refund_amount, payment_status) VALUES (10, 20, 1, 16666.67, 500.00, 'Pending')",
      );

      // Proxy pool that switches each checked-out connection to our ephemeral test schema
      const scopedPool = {
        async getConnection() {
          const c = await pool.getConnection();
          await c.query(`USE \`${schemaName}\``);
          return c;
        },
        execute: setupConn.execute.bind(setupConn),
      } as unknown as ReturnType<typeof getPool>;

      const shareCapitalRepo = createShareCapitalRepository(scopedPool);
      const ledgerRepo = createShareCapitalLedgerRepository(scopedPool);
      const patronageCapitalRepo = createPatronageCapitalRepository(scopedPool);

      // Remaining capacity is PHP 500. Launch 3 concurrent PHP 300 transactions across separate MySQL connections:
      const results = await Promise.allSettled([
        shareCapitalRepo.create(
          {
            memberId: "1",
            paymentReferenceId: null,
            amount: 300,
            paymentDate: "2026-06-05",
            paymentStatus: "Validated",
            remarks: "Concurrent manual payment",
          },
          bookkeeperAuth,
        ),
        ledgerRepo.addDividendToShareCapital("3", "55"),
        patronageCapitalRepo.request(
          {
            allocationId: "10",
            amount: 300,
            requestKey: "4f2a6b70-9c12-4a83-91b5-28e4a1f09b22",
          },
          memberAuth,
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 2);
      for (const failure of rejected) {
        assert.ok(failure.reason instanceof AppError, `Expected AppError, got: ${failure.reason?.stack || failure.reason}`);
        assert.equal(failure.reason.code, "SHARE_CAPITAL_LIMIT_EXCEEDED");
      }

      const finalSnapshot = await selectMemberShareCapitalCapacity(setupConn, {
        memberId: "1",
      });
      assert.equal(finalSnapshot.totalCommittedAndReserved, 14800);
      assert.equal(finalSnapshot.availableCapacity, 200);
    } finally {
      await setupConn.query(`DROP DATABASE IF EXISTS \`${schemaName}\``);
      setupConn.release();
      await closePool();
    }
  },
);
