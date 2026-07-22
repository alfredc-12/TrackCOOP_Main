import { redirect } from "next/navigation";

export default async function ChairmanDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab = params.tab || "dashboard";

  const legacyMap: Record<string, string> = {
    dashboard: "/portal/chairman/dashboard",
    users: "/portal/chairman/users",
    members: "/portal/chairman/members",
    indicators: "/portal/chairman/member-indicators",
    "member-indicators": "/portal/chairman/member-indicators",
    payments: "/portal/chairman/payments",
    "share-capital": "/portal/chairman/share-capital",
    finance: "/portal/chairman/finance",
    products: "/portal/chairman/products",
    "rental-pos": "/portal/chairman/pos",
    pos: "/portal/chairman/pos",
    inventory: "/portal/chairman/inventory",
    "rental-assets": "/portal/chairman/rentals/assets",
    "rental-bookings": "/portal/chairman/rentals/bookings",
    documents: "/portal/chairman/documents",
    reports: "/portal/chairman/reports",
    announcements: "/portal/chairman/announcements",
    inquiries: "/portal/chairman/requests",
    requests: "/portal/chairman/requests",
    settings: "/portal/chairman/settings",
    audit: "/portal/chairman/audit-logs",
  };

  redirect(legacyMap[tab] ?? "/portal/chairman/dashboard");
}
