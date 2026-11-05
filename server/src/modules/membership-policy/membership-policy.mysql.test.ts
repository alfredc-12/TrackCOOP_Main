import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mysql, {
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";
import { createMembershipApplicationRepository } from "../membership-applications/membership-application.repository";
import { createMembershipApprovalConversionService } from "../membership-applications/membership-application.approval-conversion";
import { postMembershipSettlement } from "../paymongo/paymongo.settlement.membership";
import { selectPaymentForSettlement } from "../paymongo/paymongo.settlement.queries";
import { createPaymongoMembershipInstallmentRepository } from "../paymongo/paymongo.membership-installment.repository";
import { capitalCases, caseProgress } from "./membership-progress.repository";
import { applicationPaymentPolicy } from "./membership-policy";
import type { AuthContext } from "../auth/auth.types";
const enabled = process.env.MEMBERSHIP_LOCAL_MYSQL === "1";
test(
  "new submissions, separate fee/capital settlement, conversion, and legacy preservation in local SQL",
  { skip: !enabled },
  async () => {
    const pool = mysql.createPool({
      host: "127.0.0.1",
      port: 3399,
      user: "root",
      database: "membership_migrated",
      timezone: "Z",
      dateStrings: false,
      connectionLimit: 3,
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const repo = createMembershipApplicationRepository(pool);
    const settings = {
      associateFee: 200,
      initialShareCapital: 1500,
      trueMemberRequiredCapital: 3000,
      maximumShareCapital: 15000,
      shareCapitalDeadlineMonths: 6,
      orientationRequired: true,
      activationTokenHours: 72,
      termsVersion: "membership-v2",
    };
    try {
      const [actor] = await pool.execute<ResultSetHeader>(
        "INSERT INTO users(role_id,email,password_hash,display_name,account_status) SELECT role_id,?,'unused','Membership Test Chairman','Active' FROM roles WHERE role_slug IN ('chairman','chairman_admin') LIMIT 1",
        [`chair-${suffix}@example.test`],
      );
      const actorId = String(actor.insertId);
      const auth: AuthContext = {
        user: {
          id: actorId,
          email: `chair-${suffix}@example.test`,
          displayName: "Chairman",
          username: null,
          role: "chairman",
        },
        sessionId: "test",
        tokenHash: "test",
      };
      const result = await repo.createPublicApplication({
        application: {
          requestedMembershipType: "True Member",
          firstName: "Test",
          lastName: suffix,
          email: `member-${suffix}@example.test`,
          contactNumber: "9123456789",
          currentAddress: "Test Sitio",
          municipality: "Nasugbu",
          barangay: "Aga",
          province: "Batangas",
          sector: "Coffee",
          sectors: ["Coffee", "Rice"],
          orientationCommitmentAccepted: true,
          membershipFeeCommitmentAccepted: true,
          shareSubscriptionCommitmentAccepted: true,
          patronageRefundAcknowledged: false,
          bylawsAgreementAccepted: true,
          privacyConsentAccepted: true,
          applicantSignatureName: `Test ${suffix}`,
          signedAt: new Date().toISOString(),
          signedPlace: "Nasugbu",
          beneficiaries: [],
        },
        context: { ipAddress: null, userAgent: null },
        publicTrackingTokenHash: crypto.randomBytes(32).toString("hex"),
        settings,
        duplicateWarning: false,
        warnings: [],
      });
      const [apps] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM membership_applications WHERE application_code=?",
        [result.applicationCode],
      );
      const app = apps[0];
      const id = String(app.membership_application_id);
      assert.equal(Number(app.membership_fee_amount), 200);
      assert.equal(Number(app.share_capital_deadline_months), 6);
      const [sectors] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM membership_application_sectors WHERE membership_application_id=?",
        [id],
      );
      assert.equal(sectors.length, 2);
      await pool.execute(
        "UPDATE membership_applications SET application_status='Payment Required' WHERE membership_application_id=?",
        [id],
      );
      await pool.execute(
        "UPDATE membership_application_requirements SET requirement_status='Verified' WHERE membership_application_id=? AND requirement_type='Signed Application'",
        [id],
      );
      const [requirements] = await pool.execute<RowDataPacket[]>(
        "SELECT requirement_type FROM membership_application_requirements WHERE membership_application_id=?",
        [id],
      );
      assert.ok(
        requirements.some(
          (r) => r.requirement_type === "Associate Membership Fee",
        ),
      );
      async function settle(
        purpose: "Associate Membership Fee" | "Share Capital",
        amount: number,
      ) {
        const [insert] = await pool.execute<ResultSetHeader>(
          `INSERT INTO payment_references(payer_name,provider,reference_number,payment_purpose,related_entity_type,related_entity_id,amount,validation_status,payment_channel,validated_by,validated_at)
    VALUES(?,'Cash',?,?, 'membership_application',?,?,'Validated','Cash',?,UTC_TIMESTAMP())`,
          [
            `Test ${suffix}`,
            `${result.applicationCode}-${purpose}-${amount}`,
            purpose,
            id,
            amount,
            actorId,
          ],
        );
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const payment = await selectPaymentForSettlement(
            connection,
            String(insert.insertId),
          );
          assert.ok(payment);
          await postMembershipSettlement({
            connection,
            payment,
            actorUserId: actorId,
          });
          await connection.commit();
        } catch (e) {
          await connection.rollback();
          throw e;
        } finally {
          connection.release();
        }
        return String(insert.insertId);
      }
      await settle("Share Capital", 1500);
      const [beforeFee] = await pool.execute<RowDataPacket[]>(
        "SELECT application_status FROM membership_applications WHERE membership_application_id=?",
        [id],
      );
      assert.equal(beforeFee[0].application_status, "Payment Required");
      await settle("Associate Membership Fee", 200);
      const [afterFee] = await pool.execute<RowDataPacket[]>(
        "SELECT application_status FROM membership_applications WHERE membership_application_id=?",
        [id],
      );
      assert.equal(afterFee[0].application_status, "Payment Confirmed");
      const [cases] = await capitalCases(
        pool,
        "c.membership_application_id=?",
        [id],
      );
      assert.equal((await caseProgress(pool, cases)).validated, 1500);
      const approval = await createMembershipApprovalConversionService(
        pool,
      ).approve(
        id,
        {
          boardMeetingDate: "2026-11-06",
          secretaryName: "Test Secretary",
          decisionReason:
            "Approved initial membership; classification pending capital review",
          createMemberPortalAccount: false,
          approveTrueMembership: false,
        },
        auth,
      );
      assert.equal(approval.membershipType, "Associate");
      assert.equal(approval.shareCapitalDeadline, cases.deadline);
      const [memberRows] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM member_sectors WHERE member_id=?",
        [approval.memberId],
      );
      assert.equal(memberRows.length, 2);
      const [ledger] = await pool.execute<RowDataPacket[]>("SELECT current_balance FROM share_capital_accounts WHERE member_id=?",[approval.memberId]);
      assert.equal(Number(ledger[0].current_balance),1500,"approval reconciliation must post initial capital to the member ledger");

      const [converted] = await capitalCases(
        pool,
        "c.membership_application_id=?",
        [id],
      );
      assert.equal(
        (await caseProgress(pool, converted)).validated,
        1500,
        "conversion must not double count ledger and application capital",
      );
      const [fees] = await pool.execute<RowDataPacket[]>(
        "SELECT SUM(fr.amount) AS total FROM financial_records fr JOIN financial_categories fc ON fc.financial_category_id=fr.financial_category_id WHERE fc.category_code<>'SHARE_CAPITAL' AND payment_reference_id IN(SELECT payment_reference_id FROM payment_references WHERE related_entity_type='membership_application' AND related_entity_id=?) AND record_type='Income'",
        [id],
      );
      assert.equal(
        Number(fees[0].total),
        200,
        "membership fee must remain separate from capital-category movements",
      );
      const legacy = applicationPaymentPolicy(
        {
          requestedMembershipType: "True Member",
          membershipFeeAmount: 0,
          initialShareCapitalAmount: 1500,
          targetShareCapitalAmount: 1500,
        },
        settings,
      );
      assert.equal(legacy.associateFee, 0);
      assert.equal(legacy.trueMemberRequiredCapital, 1500);
      const [count] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM membership_capital_cases WHERE membership_application_id=?",
        [id],
      );
      assert.equal(Number(count[0].total), 1);
      // Further validated capital after initial approval changes progress, never the official classification.
      await settle("Share Capital", 1500.01);
      const [afterInstallment]=await capitalCases(pool,"c.membership_application_id=?",[id]);
      assert.equal((await caseProgress(pool,afterInstallment)).status,"Completed");
      const [classification]=await pool.execute<RowDataPacket[]>("SELECT membership_type FROM member_profiles WHERE member_id=?",[approval.memberId]);
      assert.equal(classification[0].membership_type,"Associate");
      const installment = createPaymongoMembershipInstallmentRepository(pool);
      assert.ok(installment);
    } finally {
      await pool.end();
    }
  },
);
