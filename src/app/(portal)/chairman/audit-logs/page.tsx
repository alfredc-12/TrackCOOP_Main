import { History } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanAuditLogsPage() {
  return (
    <PortalRoutePage
      eyebrow="System"
      title="Audit Logs"
      description="Security, access, and data-change activity for Chairman review."
      icon={History}
    />
  );
}
