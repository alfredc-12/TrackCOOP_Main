import { BarChart3 } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperReportsPage() {
  return (
    <PortalRoutePage
      eyebrow="Records"
      title="Reports"
      description="Generate financial, share-capital, POS, inventory, and rental reports."
      icon={BarChart3}
    />
  );
}
