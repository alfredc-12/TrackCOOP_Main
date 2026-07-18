import { redirect } from "next/navigation";

export default async function LegacyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; tab?: string }>;
}) {
  const params = await searchParams;

  if (params.role === "member") {
    redirect("/member_dashboard");
  }

  if (params.role === "bookkeeper") {
    redirect("/bookkeeper/dashboard");
  }

  if (params.tab) {
    const legacyTabMap: Record<string, string> = {
      members: "/chairman/members",
      finance: "/chairman/finance",
      payments: "/chairman/payments",
      "rental-pos": "/chairman/pos",
      documents: "/chairman/documents",
      announcements: "/chairman/announcements",
      inquiries: "/chairman/requests",
    };

    redirect(legacyTabMap[params.tab] ?? "/chairman/dashboard");
  }

  redirect("/chairman/dashboard");
}
