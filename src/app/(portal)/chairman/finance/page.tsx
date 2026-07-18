import { Landmark } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanFinancePage() {
  return (
    <PortalRoutePage
      eyebrow="Finance"
      title="Financial Overview"
      description="Financial totals, ledger movement, income, expenses, and posted record review."
      icon={Landmark}
    />
  );
}
