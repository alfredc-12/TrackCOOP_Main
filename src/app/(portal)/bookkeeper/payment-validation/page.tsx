import { ReceiptText } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperPaymentValidationPage() {
  return (
    <PortalRoutePage
      eyebrow="Payments"
      title="Payment Validation"
      description="Validate, reject, or request clarification for submitted member payment references."
      icon={ReceiptText}
    />
  );
}
