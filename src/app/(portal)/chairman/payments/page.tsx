import { ReceiptText } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanPaymentsPage() {
  return (
    <PortalRoutePage
      eyebrow="Finance"
      title="Payments"
      description="Reviewed payment references and validation outcomes for cooperative oversight."
      icon={ReceiptText}
    />
  );
}
