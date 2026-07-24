import { MembershipApplicationReview } from "@/features/membership/MembershipApplicationReview";
import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";

export default function MembershipApplicationReviewPage() {
  return (
    <MembershipPublicShell
      title="Review Application"
      description="Confirm your applicant information, cooperative profile, selected preference, documents, and consent before final submission."
    >
      <MembershipApplicationReview />
    </MembershipPublicShell>
  );
}
