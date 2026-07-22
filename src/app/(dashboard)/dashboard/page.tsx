import { redirect } from "next/navigation";

export default async function LegacyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; tab?: string }>;
}) {
  const params = await searchParams;

  if (params.role === "member") {
    redirect("/portal/member/dashboard");
  }

  if (params.role === "bookkeeper") {
    redirect("/portal/bookkeeper/dashboard");
  }

  if (params.tab) {
    const legacyTabMap: Record<string, string> = {
      members: "/portal/chairman/members",
      finance: "/portal/chairman/finance",
      payments: "/portal/chairman/payments",
      "rental-pos": "/portal/chairman/pos",
      documents: "/portal/chairman/documents",
      announcements: "/portal/chairman/announcements",
      inquiries: "/portal/chairman/requests",
    };

    redirect(legacyTabMap[params.tab] ?? "/portal/chairman/dashboard");
  }

  redirect("/portal/chairman/dashboard");
}
