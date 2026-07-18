import { UsersRound } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanMembersPage() {
  return (
    <PortalRoutePage
      eyebrow="People"
      title="Members"
      description="Member records, approval status, profile details, and status history."
      icon={UsersRound}
    />
  );
}
