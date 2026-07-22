import { redirect } from "next/navigation";

export default function LegacyMembersPage() {
  redirect("/portal/chairman/members");
}
