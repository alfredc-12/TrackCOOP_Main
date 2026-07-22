import { FileText } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperDocumentsPage() {
  return (
    <PortalRoutePage
      eyebrow="Records"
      title="Documents"
      description="Upload and manage receipts, proofs, and financial supporting documents."
      icon={FileText}
    />
  );
}
