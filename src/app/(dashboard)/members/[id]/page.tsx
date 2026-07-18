import { redirect } from "next/navigation";

export default async function LegacyMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/chairman/members?member=${encodeURIComponent(id)}`);
}
