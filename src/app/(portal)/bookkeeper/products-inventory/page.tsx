import { Boxes } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperProductsInventoryPage() {
  return (
    <PortalRoutePage
      eyebrow="Operations"
      title="Products and Inventory"
      description="Manage product records, stock movements, and inventory availability for operations."
      icon={Boxes}
    />
  );
}
