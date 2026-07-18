import { WalletCards } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanShareCapitalPage() {
  return (
    <PortalRoutePage
      eyebrow="Finance"
      title="Share Capital"
      description="Share capital progress, payment history, certificates, and contribution summaries."
      icon={WalletCards}
    />
  );
}
