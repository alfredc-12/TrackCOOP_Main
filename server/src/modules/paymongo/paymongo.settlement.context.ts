import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type { SettlementCommunicationContext } from "./paymongo.settlement.communication";
import type { PaymentReferenceForSettlement } from "./paymongo.settlement.types";

type MemberRow = RowDataPacket & {
  id: string;
  userId: string | null;
  memberCode: string;
  fullName: string;
};
type ApplicationRow = RowDataPacket & {
  id: string;
  applicationCode: string;
  applicationStatus: string;
  convertedMemberId: string | null;
  memberUserId: string | null;
  fullName: string;
};
type PosSaleRow = RowDataPacket & {
  id: string;
  saleNumber: string;
  memberId: string | null;
  memberUserId: string | null;
  customerName: string | null;
};

export async function resolveSettlementContext(
  connection: PoolConnection,
  payment: PaymentReferenceForSettlement,
): Promise<SettlementCommunicationContext> {
  if (payment.relatedEntityType === "member_profile" && payment.relatedEntityId) {
    const [rows] = await connection.execute<MemberRow[]>(
      `SELECT CAST(member_id AS CHAR) AS id, CAST(user_id AS CHAR) AS userId,
              member_code AS memberCode, full_name AS fullName
         FROM member_profiles WHERE member_id = ? LIMIT 1 FOR UPDATE`,
      [payment.relatedEntityId],
    );
    const member = rows[0];
    if (!member) throw new AppError("Member profile was not found", 404, "MEMBER_PROFILE_NOT_FOUND");
    return {
      memberId: member.id,
      memberUserId: member.userId,
      applicationId: null,
      applicationStatus: null,
      subjectReference: member.memberCode,
      subjectName: member.fullName,
    };
  }
  if (payment.relatedEntityType === "membership_application" && payment.relatedEntityId) {
    const [rows] = await connection.execute<ApplicationRow[]>(
      `SELECT CAST(a.membership_application_id AS CHAR) AS id,
              a.application_code AS applicationCode,
              a.application_status AS applicationStatus,
              CAST(a.converted_member_id AS CHAR) AS convertedMemberId,
              CAST(m.user_id AS CHAR) AS memberUserId,
              TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''),
                             a.last_name, NULLIF(a.suffix, ''))) AS fullName
         FROM membership_applications a
         LEFT JOIN member_profiles m ON m.member_id = a.converted_member_id
        WHERE a.membership_application_id = ? LIMIT 1 FOR UPDATE`,
      [payment.relatedEntityId],
    );
    const application = rows[0];
    if (!application) {
      throw new AppError("Membership application was not found", 404, "MEMBERSHIP_APPLICATION_NOT_FOUND");
    }
    return {
      memberId: application.convertedMemberId,
      memberUserId: application.memberUserId,
      applicationId: application.id,
      applicationStatus: application.applicationStatus,
      subjectReference: application.applicationCode,
      subjectName: application.fullName,
    };
  }
  if (payment.relatedEntityType === "pos_sales" && payment.relatedEntityId) {
    const [rows] = await connection.execute<PosSaleRow[]>(
      `SELECT CAST(ps.pos_sale_id AS CHAR) AS id,
              ps.sale_number AS saleNumber,
              CAST(ps.member_id AS CHAR) AS memberId,
              CAST(mp.user_id AS CHAR) AS memberUserId,
              ps.customer_name AS customerName
         FROM pos_sales ps
         LEFT JOIN member_profiles mp ON mp.member_id = ps.member_id
        WHERE ps.pos_sale_id = ? LIMIT 1 FOR UPDATE`,
      [payment.relatedEntityId],
    );
    const sale = rows[0];
    if (!sale) throw new AppError("POS sale was not found", 404, "POS_SALE_NOT_FOUND");
    return {
      memberId: sale.memberId,
      memberUserId: sale.memberUserId,
      applicationId: null,
      applicationStatus: null,
      subjectReference: sale.saleNumber,
      subjectName: sale.customerName ?? "Cooperative store order",
    };
  }
  throw new AppError(
    "Payment reference must be linked to a membership application, member profile, or POS sale",
    422,
    "PAYMENT_SETTLEMENT_ENTITY_INVALID",
  );
}
