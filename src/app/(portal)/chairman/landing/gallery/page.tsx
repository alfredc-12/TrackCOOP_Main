import { Images } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanLandingGalleryPage() {
  return (
    <PortalRoutePage
      eyebrow="Public Website"
      title="Gallery"
      description="Published cooperative photos for events, projects, meetings, and field work."
      icon={Images}
    />
  );
}
