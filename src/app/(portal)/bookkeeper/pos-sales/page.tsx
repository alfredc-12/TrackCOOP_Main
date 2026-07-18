import { ShoppingCart } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperPosSalesPage() {
  return (
    <PortalRoutePage
      eyebrow="Operations"
      title="POS Sales"
      description="Process cooperative product sales and connect completed sales to finance records."
      icon={ShoppingCart}
    />
  );
}
