/** Settlement must never undo a reserved, active, completed or cancelled schedule. */
export function confirmRentalPaymentState(bookingStatus: string, purpose: Record<string, unknown>) {
  const preserveSchedule = ["Scheduled", "In Use", "Completed", "Cancelled", "Rejected"].includes(bookingStatus)
    || ["Confirmed", "In Progress", "Completed", "Cancelled"].includes(String(purpose.scheduleStatus))
    || ["On Hold", "Rejected", "Cancelled", "Completed"].includes(String(purpose.statusOverride));
  if (!preserveSchedule) {
    purpose.statusOverride = "Approved for Scheduling";
    purpose.scheduleStatus = "Proposed";
    purpose.publicNote = "Payment confirmed. Your rental is approved for scheduling.";
  }
  purpose.paymentStatusOverride = "Paid";
  return preserveSchedule ? bookingStatus : "Approved";
}
