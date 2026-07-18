import { Tractor } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanLandingProgramsPage() {
  return (
    <PortalRoutePage
      eyebrow="Public Website"
      title="Programs and Projects"
      description="Public cooperative programs, agriculture projects, and community initiatives."
      icon={Tractor}
    />
  );
}
