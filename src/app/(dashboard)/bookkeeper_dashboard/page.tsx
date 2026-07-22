import { redirect } from "next/navigation";

export default async function BookkeeperDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "dashboard";

  const legacyMap: Record<string, string> = {
    dashboard: "/portal/bookkeeper/dashboard",
    payments: "/portal/bookkeeper/payment-validation",
    "payment-validation": "/portal/bookkeeper/payment-validation",
    "share-capital": "/portal/bookkeeper/share-capital",
    financial: "/portal/bookkeeper/financial-ledger",
    "financial-ledger": "/portal/bookkeeper/financial-ledger",
    categories: "/portal/bookkeeper/financial-categories",
    expenditures: "/portal/bookkeeper/financial-ledger",
    pos: "/portal/bookkeeper/pos-sales",
    "pos-sales": "/portal/bookkeeper/pos-sales",
    inventory: "/portal/bookkeeper/products-inventory",
    "products-inventory": "/portal/bookkeeper/products-inventory",
    rentals: "/portal/bookkeeper/rental-transactions",
    documents: "/portal/bookkeeper/documents",
    reports: "/portal/bookkeeper/reports",
    requests: "/portal/bookkeeper/requests",
  };

  redirect(legacyMap[tab] ?? "/portal/bookkeeper/dashboard");
}
