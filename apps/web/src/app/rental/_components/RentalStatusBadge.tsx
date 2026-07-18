import { CircleCheck, Clock3 } from "lucide-react";
import type { RentalStatus } from "../_types/rental";
import { rentalStatusTone } from "../_lib/rentalConstants";

export function RentalStatusBadge({ status }: { status: RentalStatus }) {
  const Icon = status === "Completed" || status === "Payment Confirmed" ? CircleCheck : Clock3;
  return <span aria-label={`Rental status: ${status}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${rentalStatusTone[status]}`}><Icon className="size-3.5" aria-hidden="true" />{status}</span>;
}
