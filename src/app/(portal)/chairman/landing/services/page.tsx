import { ClipboardList } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanLandingServicesPage() {
  return (
    <PortalRoutePage
      eyebrow="Public Website"
      title="Services"
      description="Public service entries for membership help, farm programs, rentals, and store information."
      icon={ClipboardList}
    />
  );
}
