import { BarChart3 } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanReportsPage() {
  return (
    <PortalRoutePage
      eyebrow="Records"
      title="Reports"
      description="Chairman reports for members, payments, finance, rentals, and operations."
      icon={BarChart3}
    />
  );
}
