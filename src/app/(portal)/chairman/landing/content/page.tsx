import { Globe2 } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanLandingContentPage() {
  return (
    <PortalRoutePage
      eyebrow="Public Website"
      title="Page Content"
      description="Published homepage and cooperative profile content managed by the Chairman."
      icon={Globe2}
    />
  );
}
