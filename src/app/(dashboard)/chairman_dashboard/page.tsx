import { redirect } from "next/navigation";

export default async function ChairmanDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab = params.tab || "dashboard";

  const legacyMap: Record<string, string> = {
    dashboard: "/chairman/dashboard",
    users: "/chairman/users",
    members: "/chairman/members",
    indicators: "/chairman/member-indicators",
    "member-indicators": "/chairman/member-indicators",
    payments: "/chairman/payments",
    "share-capital": "/chairman/share-capital",
    finance: "/chairman/finance",
    products: "/chairman/products",
    "rental-pos": "/chairman/pos",
    pos: "/chairman/pos",
    inventory: "/chairman/inventory",
    "rental-assets": "/chairman/rentals/assets",
    "rental-bookings": "/chairman/rentals/bookings",
    documents: "/chairman/documents",
    reports: "/chairman/reports",
    announcements: "/chairman/announcements",
    inquiries: "/chairman/requests",
    requests: "/chairman/requests",
    settings: "/chairman/settings",
    audit: "/chairman/audit-logs",
  };

  redirect(legacyMap[tab] ?? "/chairman/dashboard");
}
