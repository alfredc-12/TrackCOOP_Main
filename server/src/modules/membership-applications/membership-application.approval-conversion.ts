import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  decideApprovalMembership,
  loadApplicationCapitalReferencesForUpdate,
  reconcileApplicationCapital,
  type CapitalReconciliationResult,
} from "./membership-application.capital";
import {
  assertNoDuplicateMember,
  selectApprovalApplication,
  selectApprovalRequirements,
  validatedApplicationReferences,
} from "./membership-application.approval-queries";
import {
  createApprovedMemberUser,
  insertApprovedMemberProfile,
} from "./membership-application.approval-members";
import {
  synchronizeApprovalRequirements,
  validateApplicationForApproval,
  validateApprovalRequirements,
} from "./membership-application.approval-requirements";
import {
  approvalActivationUrl,
  approvalMoney,
  assertChairman,
  dateMonthsFromNow,
  loadApprovalSettings,
  mysqlDate,
  normalizeApprovalEmail,
  prepareApprovalActivation,
} from "./membership-application.approval-support";
import type { ApprovalInput, ApprovalResult } from "./membership-application.types";
import {
  buildStatusEmail,
  triggerMembershipEmail,
} from "./membership-application-email";

async function notifyReferralMember(
  connection: PoolConnection,
  referrerMemberId: string,
  title: string,
  message: string,
  applicationId: string,
) {
  await connection.execute(
    `INSERT INTO notifications
       (user_id, notification_type, title, message, related_entity_type, related_entity_id)
     SELECT mp.user_id, 'System', ?, ?, 'member_referral', ?
       FROM member_profiles mp
      WHERE mp.member_id = ?
        AND mp.user_id IS NOT NULL`,
    [title, message, applicationId, referrerMemberId],
  );
}

async function auditReferralStatus(
  connection: PoolConnection,
  referralId: string | number,
  status: string,
  description: string,
  actorUserId?: string | number | null,
) {
  await connection.execute(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, new_values)
     VALUES (?, 'member_referral.status_changed', 'member_referrals', ?, ?, ?)`,
    [actorUserId ?? null, referralId, description, JSON.stringify({ referralStatus: status })],
  );
}

export interface MembershipApprovalConversionService {
  approve(
    applicationId: string,
    approval: ApprovalInput,
    auth: AuthContext,
  ): Promise<ApprovalResult>;
  reconcileCapital(
    applicationId: string,
    auth: AuthContext,
  ): Promise<CapitalReconciliationResult>;
}

export function createMembershipApprovalConversionService(
  pool?: Pool,
): MembershipApprovalConversionService {
  const databasePool = () => pool ?? getPool();

  return {
    async approve(applicationId, rawApproval, auth) {
      assertChairman(auth);
      const approval: ApprovalInput = {
        ...rawApproval,
        accountEmail: normalizeApprovalEmail(rawApproval.accountEmail),
        username: rawApproval.username?.trim() || null,
      };
      const settings = await loadApprovalSettings(databasePool());
      const activation = await prepareApprovalActivation(approval, settings);

      const result = await withTransaction(async (connection) => {
        const application = await selectApprovalApplication(connection, applicationId);
        if (!application) {
          throw new AppError(
            "Membership application was not found",
            404,
            "MEMBERSHIP_APPLICATION_NOT_FOUND",
          );
        }
        validateApplicationForApproval(application, approval);

        const requirements = await selectApprovalRequirements(connection, applicationId);
        const feeReferences = await validatedApplicationReferences(
          connection,
          applicationId,
          "Associate Membership Fee",
        );
        const capitalReferences = await loadApplicationCapitalReferencesForUpdate(
          connection,
          applicationId,
        );
        const validatedCapitalReferences = capitalReferences.filter(
          (reference) => reference.validationStatus === "Validated",
        );
        const validatedCapitalAmount = approvalMoney(
          validatedCapitalReferences.reduce(
            (total, reference) => total + reference.amount,
            0,
          ),
        );
        if (validatedCapitalAmount > approvalMoney(settings.maximumShareCapital)) {
          throw new AppError(
            "Validated share capital cannot exceed PHP 15,000",
            409,
            "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
          );
        }

        const feeTotal = await synchronizeApprovalRequirements({
          connection,
          actorUserId: auth.user.id,
          requestedMembershipType: application.requestedMembershipType,
          requirements,
          settings,
          feeReferences,
          validatedCapitalAmount,
          latestCapitalReferenceId:
            validatedCapitalReferences.at(-1)?.paymentReferenceId ?? null,
        });
        const requirementsByType = validateApprovalRequirements(application, requirements);
        if (
          application.requestedMembershipType === "Associate"
          && requirementsByType.get("Associate Membership Fee")?.requirementStatus !== "Waived"
          && feeTotal < approvalMoney(settings.associateFee)
        ) {
          throw new AppError(
            "The PHP 200 associate membership fee has not been validated",
            409,
            "MEMBERSHIP_FEE_INCOMPLETE",
          );
        }

        const membership = decideApprovalMembership({
          requestedMembershipType: application.requestedMembershipType,
          validatedCapitalAmount,
          settings,
        });
        await assertNoDuplicateMember(connection, application);
        const userId = await createApprovedMemberUser({
          connection,
          application,
          approval,
          auth,
          activation,
        });
        const trueMemberSince = membership.trueMemberEligible
          ? mysqlDate(new Date())
          : null;
        const shareCapitalDeadline = membership.needsShareCapitalDeadline
          ? dateMonthsFromNow(settings.shareCapitalDeadlineMonths)
          : null;
        const member = await insertApprovedMemberProfile({
          connection,
          application,
          auth,
          userId,
          membershipType: membership.membershipType,
          trueMemberSince,
          shareCapitalDeadline,
        });
        const reconciliation = await reconcileApplicationCapital({
          connection,
          applicationId,
          applicationCode: application.applicationCode,
          memberId: member.memberId,
          actorUserId: auth.user.id,
          maximumShareCapital: settings.maximumShareCapital,
          references: capitalReferences,
        });

        await connection.execute(
          `INSERT INTO member_status_history
             (member_id, old_membership_type, new_membership_type,
              old_official_status, new_official_status, reason, changed_by)
           VALUES (?, NULL, ?, NULL, 'Active', ?, ?)`,
          [member.memberId, membership.membershipType, approval.decisionReason, auth.user.id],
        );
        await connection.execute(
          `UPDATE membership_applications
              SET application_status = 'Approved', reviewed_by = ?,
                  reviewed_at = UTC_TIMESTAMP(), board_meeting_date = ?,
                  secretary_name = ?, decision_reason = ?, converted_member_id = ?
            WHERE membership_application_id = ?`,
          [
            auth.user.id,
            approval.boardMeetingDate,
            approval.secretaryName,
            approval.decisionReason,
            member.memberId,
            applicationId,
          ],
        );
        const [referralRows] = await connection.execute<RowDataPacket[]>(
          `SELECT member_referral_id AS referralId, referrer_member_id AS referrerMemberId
             FROM member_referrals
            WHERE membership_application_id = ?
              AND referral_status = 'Pending'
            LIMIT 1
            FOR UPDATE`,
          [applicationId],
        );
        await connection.execute(
          `UPDATE member_referrals
              SET referred_member_id = ?, referral_status = 'Successful',
                  qualified_at = UTC_TIMESTAMP(), qualified_by = ?
            WHERE membership_application_id = ?
              AND referral_status = 'Pending'`,
          [member.memberId, auth.user.id, applicationId],
        );
        const referral = referralRows[0];
        if (referral) {
          await notifyReferralMember(
            connection,
            String(referral.referrerMemberId),
            "Referral successful",
            `The referred applicant ${application.applicationCode} has been approved as a member.`,
            applicationId,
          );
          await auditReferralStatus(
            connection,
            referral.referralId,
            "Successful",
            "Referral was marked successful after membership approval.",
            auth.user.id,
          );
        }
        await connection.execute(
          `INSERT INTO membership_application_status_history
             (membership_application_id, old_status, new_status,
              internal_note, applicant_message, changed_by)
           VALUES (?, 'Payment Confirmed', 'Approved', ?,
                   'Your membership application was approved.', ?)`,
          [applicationId, approval.decisionReason, auth.user.id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.approved', 'membership_applications', ?,
                   'Application approved and pre-approval capital preserved.', ?)`,
          [
            auth.user.id,
            applicationId,
            JSON.stringify({
              memberId: member.memberId,
              memberCode: member.memberCode,
              membershipType: membership.membershipType,
              validatedCapitalAmount: reconciliation.validatedCapitalAmount,
              reconciledCapitalRows: reconciliation.insertedCapitalRows,
            }),
          ],
        );

        return {
          applicationId,
          applicationCode: application.applicationCode,
          applicantEmail: application.email,
          applicantName: application.fullName,
          memberId: member.memberId,
          memberCode: member.memberCode,
          membershipType: membership.membershipType,
          shareCapitalDeadline,
          activationTokenExpiresAt: activation?.expiresAt ?? null,
        };
      }, databasePool());

      const {
        applicantEmail,
        applicantName,
        ...approvalResult
      } = result;
      const activationUrl = activation ? approvalActivationUrl(activation.rawToken) : null;
      void triggerMembershipEmail(buildStatusEmail({
        event: "membership.application.approved",
        email: applicantEmail ?? approval.accountEmail ?? null,
        name: applicantName ?? approvalResult.applicationCode,
        applicationCode: approvalResult.applicationCode,
        status: "Approved",
        subject: `Membership approved: ${approvalResult.applicationCode}`,
        message: activationUrl
          ? `Your membership was approved. Activate your member portal account here: ${activationUrl}`
          : "Your membership was approved. Welcome to the cooperative.",
      }));

      return {
        ...approvalResult,
        activationUrl,
      };
    },

    async reconcileCapital(applicationId, auth) {
      assertChairman(auth);
      return withTransaction(async (connection) => {
        const application = await selectApprovalApplication(connection, applicationId);
        if (!application) {
          throw new AppError(
            "Membership application was not found",
            404,
            "MEMBERSHIP_APPLICATION_NOT_FOUND",
          );
        }
        if (application.applicationStatus !== "Approved" || !application.convertedMemberId) {
          throw new AppError(
            "Only an approved and converted application can be reconciled",
            409,
            "MEMBERSHIP_CAPITAL_RECONCILIATION_NOT_ELIGIBLE",
          );
        }
        const settings = await loadApprovalSettings(connection);
        const reconciliation = await reconcileApplicationCapital({
          connection,
          applicationId,
          applicationCode: application.applicationCode,
          memberId: application.convertedMemberId,
          actorUserId: auth.user.id,
          maximumShareCapital: settings.maximumShareCapital,
        });
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'membership_application.capital_reconciled',
                   'membership_applications', ?,
                   'A Chairman explicitly reconciled pre-approval Share Capital.', ?)`,
          [auth.user.id, applicationId, JSON.stringify(reconciliation)],
        );
        return reconciliation;
      }, databasePool());
    },
  };
}
