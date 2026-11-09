import { isTractorService, workShiftLabel } from "./rental-hectares";
import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getEmailConfig, isResendMode, type EmailConfig } from "../email/email-config";
import { enqueueEmail, type SqlExecutor } from "../email/email-outbox.repository";
import {
  rentalPaymentContent,
  rentalScheduleContent,
  rentalStatusContent,
  rentalSubmittedContent,
  type RentalEmailContent,
} from "./rental-email";
import type { RentalInquiry, RentalSchedule } from "./rental.types";

/**
 * Queues the rental emails from inside the same transaction as the change that causes them.
 * Recipients are the requester only; the Chairman and Bookkeeper keep their in-app notifications.
 * All of these are no-ops unless EMAIL_DELIVERY is resend.
 */

/** What is stored: the message content and the booking reference. The worker adds the status link when it sends. */
function stored(reference: string, content: RentalEmailContent) {
  return { reference, content };
}

function requester(inquiry: Pick<RentalInquiry, "requester">) {
  return { email: inquiry.requester.email, name: inquiry.requester.fullName };
}

export async function enqueueRentalSubmitted(executor: SqlExecutor, inquiry: RentalInquiry, bookingId: number, config: EmailConfig = getEmailConfig()) {
  if (!isResendMode(config)) return;
  await enqueueEmail(executor, {
    eventKey: "rental.booking.submitted",
    dedupeKey: `rental.submitted:booking:${bookingId}`,
    to: requester(inquiry),
    payload: stored(inquiry.inquiryId, rentalSubmittedContent(inquiry)),
    related: { type: "rental_bookings", id: String(bookingId) },
  }, config);
}

/** `version` distinguishes one status change from the next (the booking's updated_at before the change). */
export async function enqueueRentalStatus(executor: SqlExecutor, inquiry: RentalInquiry, bookingId: number, version: string, config: EmailConfig = getEmailConfig()) {
  if (!isResendMode(config)) return;
  await enqueueEmail(executor, {
    eventKey: "rental.status.updated",
    dedupeKey: `rental.status:${bookingId}:${inquiry.status}:${version}`,
    to: requester(inquiry),
    payload: stored(inquiry.inquiryId, rentalStatusContent(inquiry)),
    related: { type: "rental_bookings", id: String(bookingId) },
  }, config);
}

/** Hash of exactly what the customer would read, so saving an unchanged schedule never re-sends. */
export function scheduleVersion(schedule: RentalSchedule) {
  const tractor = isTractorService({ name: schedule.equipmentName, serviceId: schedule.serviceId });
  const visible = [
    schedule.status, schedule.date, tractor ? "" : schedule.startTime, schedule.endDate, tractor ? "" : schedule.endTime,
    schedule.assignedOperator ?? "", schedule.serviceLocation, schedule.barangay, schedule.customerInstructions ?? "",
    ...(schedule.dailyWork ?? []).map((day) => `${day.date}:${day.hectares}${workShiftLabel(day) ? `:${workShiftLabel(day)}` : ""}`),
  ];
  return createHash("sha256").update(JSON.stringify(visible)).digest("hex").slice(0, 16);
}

export async function enqueueRentalSchedule(
  executor: SqlExecutor,
  inquiry: RentalInquiry,
  schedule: RentalSchedule,
  bookingId: number,
  config: EmailConfig = getEmailConfig(),
) {
  if (!isResendMode(config)) return;
  const content = rentalScheduleContent({
    dailyWork: schedule.dailyWork,
    reference: schedule.rentalId,
    requesterName: inquiry.requester.fullName,
    equipmentName: schedule.equipmentName,
    confirmed: schedule.status === "Confirmed",
    date: schedule.date,
    endDate: schedule.endDate,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    assignedOperator: schedule.assignedOperator,
    serviceLocation: schedule.serviceLocation,
    barangay: schedule.barangay,
    // Only the customer-facing field. schedule.specialInstructions is internal and is never read here.
    customerInstructions: schedule.customerInstructions,
  });
  await enqueueEmail(executor, {
    eventKey: "rental.schedule.updated",
    dedupeKey: `rental.schedule:${bookingId}:${scheduleVersion(schedule)}`,
    to: requester(inquiry),
    payload: stored(schedule.rentalId, content),
    related: { type: "rental_bookings", id: String(bookingId) },
  }, config);
}

export type RentalPaymentConfirmation = {
  bookingId: number | string;
  paymentReferenceId: number | string;
  amount: number;
  paymentMethod?: string;
  paymentReference?: string;
  receiptNumber?: string;
  paidOn?: string;
};

/**
 * One email per payment reference, from whichever path confirmed it (Bookkeeper route, PayMongo webhook,
 * central payment validation). The booking is read inside the same transaction.
 */
export async function enqueueRentalPaymentConfirmed(executor: SqlExecutor, payment: RentalPaymentConfirmation, config: EmailConfig = getEmailConfig()) {
  if (!isResendMode(config)) return;
  const [rows] = await (executor as { execute: (sql: string, values: unknown[]) => Promise<[RowDataPacket[], unknown]> }).execute(
    `SELECT rb.booking_number AS reference, rb.requester_name AS requesterName, rb.purpose AS purpose,
            a.asset_name AS equipmentName, mp.email AS memberEmail, mp.full_name AS memberName
       FROM rental_bookings rb
       JOIN rental_assets a ON a.rental_asset_id = rb.rental_asset_id
       LEFT JOIN member_profiles mp ON mp.member_id = rb.member_id
      WHERE rb.rental_booking_id = ?
      LIMIT 1`,
    [payment.bookingId],
  );
  const row = rows[0];
  if (!row) return;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String(row.purpose ?? "{}")) as Record<string, unknown>;
  } catch {
    meta = {};
  }
  const email = typeof meta.email === "string" && meta.email.trim() ? meta.email : (row.memberEmail as string | null);
  const name = String(row.requesterName ?? row.memberName ?? "Rental requester");
  const content = rentalPaymentContent({
    reference: String(row.reference),
    requesterName: name,
    equipmentName: String(row.equipmentName),
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    paymentReference: payment.paymentReference,
    receiptNumber: payment.receiptNumber,
    paidOn: payment.paidOn,
  });
  await enqueueEmail(executor, {
    eventKey: "rental.payment.confirmed",
    dedupeKey: `rental.payment:payref:${payment.paymentReferenceId}`,
    to: { email, name },
    payload: stored(String(row.reference), content),
    related: { type: "payment_references", id: String(payment.paymentReferenceId) },
  }, config);
}
