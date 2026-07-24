import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";
import type { AuthContext, RoleSlug } from "../modules/auth/auth.types";
import { createMembershipService } from "../modules/membership/membership.service";

type StaffRow = RowDataPacket & {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  role: RoleSlug;
};

async function staffAuth(
  role: "chairman" | "bookkeeper",
): Promise<AuthContext> {
  const [rows] = await getPool().execute<StaffRow[]>(
    `SELECT CAST(u.user_id AS CHAR) AS id,
            u.display_name AS displayName,
            u.email,
            u.username,
            r.role_slug AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug = ? AND u.account_status = 'Active'
      ORDER BY u.user_id
      LIMIT 1`,
    [role],
  );
  const account = rows[0];
  if (!account) {
    throw new Error(`An active ${role} account is required for verification.`);
  }
  return {
    user: account,
    sessionId: "membership-flow-verification",
    tokenHash: "membership-flow-verification",
  };
}

async function main() {
  const service = createMembershipService();
  const existingReference = process.argv[2];
  if (existingReference) {
    const [applications, payments] = await Promise.all([
      service.listApplications(undefined, existingReference),
      service.listPayments(),
    ]);
    const application = applications.find(
      (item) => item.reference === existingReference,
    );
    const payment = payments.find(
      (item) => item.applicationReference === existingReference,
    );
    console.log(
      JSON.stringify(
        {
          reference: existingReference,
          visibleInChairmanList: Boolean(application),
          visibleInBookkeeperQueue: Boolean(payment),
          applicationStatus: application?.status ?? null,
          paymentStatus: payment?.paymentStatus ?? null,
          receiptNumber: payment?.receiptNumber ?? null,
          linkedMemberId: application?.linkedMemberId ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }
  const chairman = await staffAuth("chairman");
  const bookkeeper = await staffAuth("bookkeeper");
  const runId = Date.now().toString();
  const contactNumber = `0917${runId.slice(-7)}`;
  const email = `membership.verification.${runId}@example.test`;

  const submitted = await service.submitApplication(
    {
      idempotencyKey: randomUUID(),
      firstName: "Membership",
      middleName: "Flow",
      lastName: `Verification ${runId}`,
      suffix: null,
      contactNumber,
      email,
      preferredContactMethod: "Email",
      completeAddress: "TrackCOOP verification record",
      barangay: "Wawa",
      municipality: "Nasugbu",
      province: "Batangas",
      sector: "Farmer",
      livelihood: "Rice farming",
      applicantClassification: "Farmer",
      primaryActivity: "Rice production",
      preferredMembershipType: "ASSOCIATE",
      consentAccuracy: true,
      consentPrivacy: true,
      consentNoImmediateMembership: true,
      consentAccountAfterApproval: true,
      privacyNoticeVersion: "2026-07-24",
    },
    [],
  );
  await service.reviewApplication(
    submitted.id,
    {
      action: "START_REVIEW",
      internalNote: "Automated end-to-end verification.",
    },
    chairman,
  );
  await service.reviewApplication(
    submitted.id,
    {
      action: "APPROVE",
      approvedMembershipType: "ASSOCIATE",
      publicMessage: "Approved for verification pending the ₱200.00 fee.",
      internalNote: "Automated end-to-end verification.",
    },
    chairman,
  );
  const payment = await service.submitPayment(
    submitted.reference,
    contactNumber,
    {
      provider: "Direct GCash",
      referenceNumber: `VERIFY-${runId}`,
      amount: 200,
      proofFilePath:
        "storage/uploads/membership-payments/verification-only.pdf",
      notes: "Automated end-to-end verification record.",
    },
  );
  await service.validatePayment(
    payment.id,
    "VERIFIED",
    "Reference and amount verified during end-to-end test.",
    bookkeeper,
  );
  const account = await service.createAccount(
    submitted.id,
    {
      duplicateResolution: "CONFIRM_NEW",
      overrideReason:
        "Unique verification contact and email confirmed; create a new record.",
    },
    chairman,
  );
  await service.activateAccount(
    account.activationToken,
    `TrackCOOP-${runId}-Secure`,
  );
  const detail = await service.getApplication(submitted.id);
  if (!detail) {
    throw new Error("The verified application could not be reloaded.");
  }

  console.log(
    JSON.stringify(
      {
        reference: submitted.reference,
        applicationId: submitted.id,
        paymentId: payment.id,
        linkedMemberId: account.application.linkedMemberId,
        finalStatus: detail.status,
        paymentStatus: detail.paymentStatus,
        accountActivated: detail.status === "ACCOUNT_CREATED",
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(
      "Membership flow verification failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(closePool);
