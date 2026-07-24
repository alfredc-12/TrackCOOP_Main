import { MembershipPublicShell } from "@/features/membership/MembershipPublicShell";
import { MembershipStatusLookup } from "@/features/membership/MembershipStatusLookup";

export default function MembershipApplicationStatusPage() {
  return (
    <MembershipPublicShell
      title="Application Status"
      description="Enter your application reference and matching contact number. TrackCOOP displays only privacy-safe application information."
    >
      <MembershipStatusLookup />
    </MembershipPublicShell>
  );
}
