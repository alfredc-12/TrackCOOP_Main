import { Inbox } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperRequestsPage() {
  return (
    <PortalRoutePage
      eyebrow="Support"
      title="Assigned Requests"
      description="Review and respond to cooperative requests assigned to Bookkeeper workflows."
      icon={Inbox}
    />
  );
}
