import { FileText } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanDocumentsPage() {
  return (
    <PortalRoutePage
      eyebrow="Records"
      title="Documents"
      description="Cooperative files with role-aware access and download history."
      icon={FileText}
    />
  );
}
