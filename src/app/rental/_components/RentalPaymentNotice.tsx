import type { RentalInquiry } from "../_types/rental";
import { formatRentalDate } from "../_lib/rentalFormatting";

export function RentalPaymentNotice({ inquiry }: { inquiry: Pick<RentalInquiry, "paymentStatus" | "paymentDeadline" | "status"> }) {
  if (inquiry.paymentStatus === "Paid" || ["Cancelled", "Rejected", "Completed"].includes(inquiry.status) || !inquiry.paymentDeadline) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const overdue = inquiry.paymentDeadline < today;
  return <span className={`mt-2 block text-xs font-semibold ${overdue ? "text-red-700" : "text-coop-muted"}`}>
    {overdue ? "Payment overdue - staff review needed." : "Payment pending."} Pay by {formatRentalDate(inquiry.paymentDeadline)}. Payment must be verified before work starts.
  </span>;
}
