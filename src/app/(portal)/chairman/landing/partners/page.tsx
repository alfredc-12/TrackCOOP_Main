import { ShieldCheck } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanLandingPartnersPage() {
  return (
    <PortalRoutePage
      eyebrow="Public Website"
      title="Partners and Certifications"
      description="Public partner logos, certifications, compliance files, and recognition records."
      icon={ShieldCheck}
    />
  );
}
