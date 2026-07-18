import { redirect } from "next/navigation";

export default async function BookkeeperDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "dashboard";

  const legacyMap: Record<string, string> = {
    dashboard: "/bookkeeper/dashboard",
    payments: "/bookkeeper/payment-validation",
    "payment-validation": "/bookkeeper/payment-validation",
    "share-capital": "/bookkeeper/share-capital",
    financial: "/bookkeeper/financial-ledger",
    "financial-ledger": "/bookkeeper/financial-ledger",
    categories: "/bookkeeper/financial-categories",
    expenditures: "/bookkeeper/financial-ledger",
    pos: "/bookkeeper/pos-sales",
    "pos-sales": "/bookkeeper/pos-sales",
    inventory: "/bookkeeper/products-inventory",
    "products-inventory": "/bookkeeper/products-inventory",
    rentals: "/bookkeeper/rental-transactions",
    documents: "/bookkeeper/documents",
    reports: "/bookkeeper/reports",
    requests: "/bookkeeper/requests",
  };

  redirect(legacyMap[tab] ?? "/bookkeeper/dashboard");
}
