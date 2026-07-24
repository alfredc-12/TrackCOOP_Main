import { MembershipActivationForm } from "@/features/membership/MembershipActivationForm";
import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";

export default function MembershipActivationPage() {
  return (
    <MembershipPublicShell
      title="Activate Member Account"
      description="Set a private password using the one-time activation link provided by NFFAC. The token expires after 72 hours and cannot be reused."
    >
      <MembershipActivationForm />
    </MembershipPublicShell>
  );
}
