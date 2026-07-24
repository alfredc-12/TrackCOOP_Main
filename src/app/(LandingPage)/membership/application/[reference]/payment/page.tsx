import { MembershipFollowUpForm } from "@/features/membership/MembershipFollowUpForm";
import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";

export default function MembershipPaymentPage() {
  return (
    <MembershipPublicShell
      title="Membership Payment"
      description="Submit the exact payment requested by NFFAC. Payment remains under review until a Bookkeeper validates the reference and proof."
    >
      <MembershipFollowUpForm mode="payment" />
    </MembershipPublicShell>
  );
}
