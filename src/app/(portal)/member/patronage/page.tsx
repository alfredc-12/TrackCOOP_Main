import { MemberPatronageClient } from "@/features/patronage/MemberPatronageClient";
import { requireServerTrueMember } from "@/lib/true-member-server";

export default async function MemberPatronagePage() {
  await requireServerTrueMember();
  return <MemberPatronageClient />;
}
