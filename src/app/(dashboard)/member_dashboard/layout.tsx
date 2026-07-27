import type { ReactNode } from "react";
import { MemberShareCapitalLauncher } from "@/features/member-share-capital/MemberShareCapitalLauncher";

export default function MemberDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MemberShareCapitalLauncher />
    </>
  );
}
