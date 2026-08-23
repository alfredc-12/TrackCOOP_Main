import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/PortalShell";

export default function MemberPortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell role="member">{children}</PortalShell>;
}
