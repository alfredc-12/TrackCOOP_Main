import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/PortalShell";

export default function BookkeeperPortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell role="bookkeeper">{children}</PortalShell>;
}
