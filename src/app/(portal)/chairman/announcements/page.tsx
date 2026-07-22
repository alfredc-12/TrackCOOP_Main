import { Megaphone } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanAnnouncementsPage() {
  return (
    <PortalRoutePage
      eyebrow="Communication"
      title="Announcements"
      description="Publish, target, and archive cooperative announcements for members."
      icon={Megaphone}
    />
  );
}
