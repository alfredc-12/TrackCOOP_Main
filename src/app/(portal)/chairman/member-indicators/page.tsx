import { Gauge } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanMemberIndicatorsPage() {
  return (
    <PortalRoutePage
      eyebrow="People"
      title="Member Indicators"
      description="Membership indicators for true-member progress, activity, and status review."
      icon={Gauge}
    />
  );
}
