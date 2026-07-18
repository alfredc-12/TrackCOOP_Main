import { UserRoundCog } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanUsersPage() {
  return (
    <PortalRoutePage
      eyebrow="People"
      title="User Accounts"
      description="Chairman-controlled account creation, role assignment, and access monitoring."
      icon={UserRoundCog}
    />
  );
}
