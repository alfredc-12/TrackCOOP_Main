import { WalletCards } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperShareCapitalPage() {
  return (
    <PortalRoutePage
      eyebrow="Payments"
      title="Share Capital"
      description="Record share capital payments, corrections, receipts, and member contribution progress."
      icon={WalletCards}
    />
  );
}
