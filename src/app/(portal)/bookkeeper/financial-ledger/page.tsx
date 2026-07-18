import { Landmark } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperFinancialLedgerPage() {
  return (
    <PortalRoutePage
      eyebrow="Finance"
      title="Financial Ledger"
      description="Post income and expense entries with controlled void and correction workflows."
      icon={Landmark}
    />
  );
}
