import { Settings } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanSettingsPage() {
  return (
    <PortalRoutePage
      eyebrow="System"
      title="Settings"
      description="System-level cooperative settings, defaults, and controlled configuration."
      icon={Settings}
    />
  );
}
