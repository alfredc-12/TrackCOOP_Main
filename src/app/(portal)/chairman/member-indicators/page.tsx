import { MemberIndicatorsClient } from "./MemberIndicatorsClient";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/portal/PortalPrimitives";

export default function ChairmanMemberIndicatorsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <MemberIndicatorsClient />
    </Suspense>
  );
}
