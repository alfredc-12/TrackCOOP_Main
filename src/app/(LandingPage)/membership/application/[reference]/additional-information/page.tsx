import { MembershipFollowUpForm } from "@/features/membership/MembershipFollowUpForm";
import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";

export default function MembershipAdditionalInformationPage() {
  return (
    <MembershipPublicShell
      title="Additional Information"
      description="Submit only the information or documents requested by NFFAC. Your application returns to review after server confirmation."
    >
      <MembershipFollowUpForm mode="information" />
    </MembershipPublicShell>
  );
}
