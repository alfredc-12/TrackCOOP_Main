import { PortalRoutePage } from "@/components/portal/PortalRoutePage";
import { LayoutDashboard } from "lucide-react";

export default function MemberDashboardPage() {
  return (
    <PortalRoutePage
      eyebrow="Overview"
      title="Member Dashboard"
      description="Welcome to your cooperative portal."
      icon={LayoutDashboard}
    />
  );
}
