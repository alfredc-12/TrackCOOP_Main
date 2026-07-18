import { LayoutDashboard } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperDashboardPage() {
  return (
    <PortalRoutePage
      eyebrow="Overview"
      title="Bookkeeper Dashboard"
      description="Daily payment validation, ledger activity, POS, inventory, and rental workload."
      icon={LayoutDashboard}
    />
  );
}
