import { Suspense } from "react";
import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";
import { MembershipSuccess } from "@/features/membership/MembershipSuccess";

export default function MembershipApplicationSuccessPage() {
  return (
    <MembershipPublicShell
      title="Application Received"
      description="Your application reference is the key to privacy-safe status updates."
    >
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-white" />}
      >
        <MembershipSuccess />
      </Suspense>
    </MembershipPublicShell>
  );
}
