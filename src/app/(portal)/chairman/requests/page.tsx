import { Inbox } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function ChairmanRequestsPage() {
  return (
    <PortalRoutePage
      eyebrow="Communication"
      title="Requests and Inquiries"
      description="Member and public requests with assignment, response, and status history."
      icon={Inbox}
    />
  );
}
