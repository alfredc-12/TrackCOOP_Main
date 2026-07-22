import { Tractor } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperRentalTransactionsPage() {
  return (
    <PortalRoutePage
      eyebrow="Operations"
      title="Rental Transactions"
      description="Record rental charges, payment status, receipts, and related financial entries."
      icon={Tractor}
    />
  );
}
