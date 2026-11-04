import { FinancialLedgerView } from "@/features/finance/FinanceViews";
import { parseLedgerFilters } from "@/features/finance/ledger-filters";

export default async function ChairmanFinancialLedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim().slice(0, 190) : "";
  return <FinancialLedgerView initialSearch={search} initialFilters={parseLedgerFilters(params)} fromAnalytics={params.from === "analytics"} />;
}
