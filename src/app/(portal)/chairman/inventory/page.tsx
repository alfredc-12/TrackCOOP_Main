import { Boxes } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanInventoryPage() {
  return (
    <PortalRoutePage
      eyebrow="Operations"
      title="Inventory"
      description="Inventory movement history, stock adjustments, and product availability."
      icon={Boxes}
    />
  );
}
