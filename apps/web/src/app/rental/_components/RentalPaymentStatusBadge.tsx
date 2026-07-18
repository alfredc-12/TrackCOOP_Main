import { CircleDollarSign } from "lucide-react";
import type { PaymentStatus } from "../_types/rental";
import { paymentStatusTone } from "../_lib/rentalConstants";

export function RentalPaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span aria-label={`Payment status: ${status}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${paymentStatusTone[status]}`}><CircleDollarSign className="size-3.5" aria-hidden="true" />{status}</span>;
}
