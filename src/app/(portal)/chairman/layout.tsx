import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/PortalShell";

export default function ChairmanPortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell role="chairman">{children}</PortalShell>;
}
