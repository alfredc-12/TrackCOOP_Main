import { FinancialLedgerView } from "@/features/finance/FinanceViews";

export default async function ChairmanFinancialLedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim().slice(0, 190) : "";
  return <FinancialLedgerView initialSearch={search} />;
}
