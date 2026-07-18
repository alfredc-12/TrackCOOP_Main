import { Tractor } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanRentalAssetsPage() {
  return (
    <PortalRoutePage
      eyebrow="Operations"
      title="Rental Assets"
      description="Cooperative equipment, rental availability, pricing, and asset condition."
      icon={Tractor}
    />
  );
}
