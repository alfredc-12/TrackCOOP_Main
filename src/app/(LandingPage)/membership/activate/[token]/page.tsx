import { MembershipActivationForm } from "@/features/membership/MembershipActivationForm";
import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";

export default function MembershipActivationPage() {
  return (
    <MembershipPublicShell
      title="Activate Member Account"
      description="Set a private password using the one-time activation link provided by NFFAC. The link can only be used once."
    >
      <MembershipActivationForm />
    </MembershipPublicShell>
  );
}
