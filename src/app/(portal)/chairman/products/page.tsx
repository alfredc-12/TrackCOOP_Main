import { Package } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanProductsPage() {
  return (
    <PortalRoutePage
      eyebrow="Operations"
      title="Products"
      description="Cooperative product catalog oversight for store and POS workflows."
      icon={Package}
    />
  );
}
