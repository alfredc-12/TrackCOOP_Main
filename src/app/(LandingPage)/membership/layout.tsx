import type { ReactNode } from "react";
import { MembershipDraftProvider } from "@/features/membership/MembershipDraftProvider";

export default function MembershipLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <MembershipDraftProvider>{children}</MembershipDraftProvider>;
}
