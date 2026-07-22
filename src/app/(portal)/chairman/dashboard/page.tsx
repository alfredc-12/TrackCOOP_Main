import { LayoutDashboard } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanDashboardPage() {
  return (
    <PortalRoutePage
      eyebrow="Overview"
      title="Chairman Dashboard"
      description="Oversight for member growth, payments, operations, and cooperative activity."
      icon={LayoutDashboard}
    />
  );
}
