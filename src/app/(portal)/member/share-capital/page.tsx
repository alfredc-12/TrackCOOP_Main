import { MemberShareCapitalDashboard } from "@/features/member-share-capital/MemberShareCapitalDashboard";
import { requireServerTrueMember } from "@/lib/true-member-server";

export default async function MemberShareCapitalPage() {
  await requireServerTrueMember();
  return <MemberShareCapitalDashboard />;
}
