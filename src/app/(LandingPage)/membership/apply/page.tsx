import { MembershipApplicationForm } from "@/features/membership/MembershipApplicationForm";
import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";

export default function MembershipApplyPage() {
  return (
    <MembershipPublicShell
      title="Apply for Membership"
      description="Submit your membership application to the Nasugbu Farmers and Fisherfolks Agriculture Cooperative. Your application will be reviewed by an authorized cooperative officer. Submitting this form does not immediately create a member account."
    >
      <div className="mb-6 rounded-lg border border-[#E4C66A] bg-[#FFF4D7] p-4 text-sm leading-6 text-[#6B5000]">
        Your TrackCOOP member account will be created only after your
        application has been approved and the applicable payment has been
        validated.
      </div>
      <MembershipApplicationForm />
    </MembershipPublicShell>
  );
}
