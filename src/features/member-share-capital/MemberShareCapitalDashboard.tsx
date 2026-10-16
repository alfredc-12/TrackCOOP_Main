"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  CalendarDays,
  ChevronDown,
  HandCoins,
  History,
  LineChart as LineChartIcon,
  RefreshCcw,
  WalletCards,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  CurrencyDisplay,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  getMemberCapitalGrowth,
  getMemberCapitalOverview,
  getMemberCapitalTransactions,
  getMemberDividends,
  requestDividendCapitalization,
  requestDividendWithdrawal,
  type MemberCapitalTransactionFilters,
} from "./api";
import type {
  MemberCapitalGrowthPoint,
  MemberCapitalOverview,
  MemberCapitalTransaction,
  MemberDividend,
  DividendWithdrawalMethod,
} from "./types";

const PAGE_SIZE = 10;

function currency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.message
    : "Your Share Capital information could not be loaded.";
}

export function MemberShareCapitalDashboard() {
  const [overview, setOverview] = useState<MemberCapitalOverview | null>(null);
  const [transactions, setTransactions] = useState<MemberCapitalTransaction[]>([]);
  const [growth, setGrowth] = useState<MemberCapitalGrowthPoint[]>([]);
  const [dividends, setDividends] = useState<MemberDividend[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [transactionFilters, setTransactionFilters] = useState<MemberCapitalTransactionFilters>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionDividend, setActionDividend] = useState<MemberDividend | null>(null);
  const [dividendAction, setDividendAction] = useState<"capital" | "withdraw" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState<DividendWithdrawalMethod>("Cash");
  const [withdrawalProvider, setWithdrawalProvider] = useState("");
  const [withdrawalAccountName, setWithdrawalAccountName] = useState("");
  const [withdrawalAccountNumber, setWithdrawalAccountNumber] = useState("");
  const [withdrawalQrCode, setWithdrawalQrCode] = useState<string | null>(null);
  const [withdrawalQrFileName, setWithdrawalQrFileName] = useState("");
  const refreshInFlight = useRef(false);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [nextOverview, transactionPage, nextGrowth, nextDividends] = await Promise.all([
        getMemberCapitalOverview(),
        getMemberCapitalTransactions(page, PAGE_SIZE, transactionFilters),
        getMemberCapitalGrowth(),
        getMemberDividends(),
      ]);
      setOverview(nextOverview);
      setTransactions(transactionPage.items);
      setTotal(Number(transactionPage.meta.total ?? 0));
      setGrowth(nextGrowth);
      setDividends(nextDividends);
      setError("");
    } catch (caught) {
      if (!silent) setError(errorMessage(caught));
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, transactionFilters]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 15_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const chartData = growth.map((point) => ({
    ...point,
    label: displayDate(point.date),
  }));
  const approvedDividends = dividends.filter((item) => item.declarationStatus === "Approved");
  const availableDividends = dividends.filter((item) => item.declarationStatus === "Published" && item.status === "Available");
  const totalAvailableDividend = availableDividends.reduce((sum, item) => sum + item.amount, 0);

  function openDividendConfirmation(dividend: MemberDividend, action: "capital" | "withdraw") {
    if (actionDividend || actionBusy) return;
    setActionDividend(dividend);
    setDividendAction(action);
    setActionError("");
    if (action === "withdraw") {
      setWithdrawalMethod("Cash");
      setWithdrawalProvider("");
      setWithdrawalAccountName("");
      setWithdrawalAccountNumber("");
      setWithdrawalQrCode(null);
      setWithdrawalQrFileName("");
    }
  }

  function resetDividendAction() {
    setActionDividend(null);
    setDividendAction(null);
    setActionError("");
    setWithdrawalMethod("Cash");
    setWithdrawalProvider("");
    setWithdrawalAccountName("");
    setWithdrawalAccountNumber("");
    setWithdrawalQrCode(null);
    setWithdrawalQrFileName("");
  }

  function handleWithdrawalQrCode(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setActionError("QR code must be a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 400 * 1024) {
      setActionError("QR code image must be 400 KB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setWithdrawalQrCode(reader.result);
        setWithdrawalQrFileName(file.name);
        setActionError("");
      }
    };
    reader.readAsDataURL(file);
  }

  async function confirmDividendAction() {
    if (!actionDividend || !dividendAction || actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      if (dividendAction === "capital") await requestDividendCapitalization(actionDividend.id);
      else await requestDividendWithdrawal(actionDividend.id, {
        withdrawalMethod,
        withdrawalProvider: withdrawalMethod === "Online Transfer" ? withdrawalProvider : null,
        withdrawalAccountName: withdrawalMethod === "Online Transfer" ? withdrawalAccountName : null,
        withdrawalAccountNumber: withdrawalMethod === "Online Transfer" ? withdrawalAccountNumber : null,
        withdrawalQrCode: withdrawalMethod === "Online Transfer" ? withdrawalQrCode : null,
      });
      resetDividendAction();
      await load({ silent: true });
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My investment"
        title="My Share Capital"
        description="See every contribution, updated balance, and how your ownership capital grows over time."
        actions={(
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 py-2.5 text-sm font-bold text-[#123D2A] transition hover:bg-[#F3F7F1] disabled:opacity-50"
          >
            <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading && !overview ? <LoadingSkeleton /> : null}

      {overview ? (
        <>
          <section className="rounded-xl border border-[#CAD8CB] bg-[linear-gradient(135deg,#123D2A,#1F6B43)] p-6 text-white shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DCEB9A]">{overview.member.membershipType}</p>
                <h2 className="mt-2 text-2xl font-black">{overview.member.memberName}</h2>
                <p className="mt-1 text-sm text-white/75">Member code {overview.member.memberCode}</p>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/10 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-white/70">Current Share Capital</p>
                <p className="mt-1 text-3xl font-black">{currency(overview.summary.currentBalance)}</p>
              </div>
            </div>
          </section>

          {!overview.reconciliation.reconciled ? (
            <div role="alert" className="rounded-lg border border-[#E8B4A9] bg-[#FFF4F1] p-4 text-sm font-semibold text-[#7A3023]">
              This account needs reconciliation. The recorded balance differs from its transaction history by {currency(Math.abs(overview.reconciliation.difference))}.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Initial capital" value={currency(overview.summary.initialCapital)} icon={Banknote} />
            <StatCard label="Additional contributions" value={currency(overview.summary.additionalContributions)} icon={ArrowUpRight} />
            <StatCard label="Dividends added" value={currency(overview.summary.dividendsAdded)} icon={HandCoins} />
            <StatCard label="Total deductions" value={currency(overview.summary.totalDeductions)} icon={ArrowDownLeft} />
            <StatCard label="Transactions" value={String(overview.transactionCount)} icon={History} />
          </div>

          <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-[#123D2A]"><LineChartIcon className="size-5" /> Share Capital growth</h2>
                <p className="mt-1 text-sm text-[#5D6D63]">Running balance after every posted transaction.</p>
              </div>
              <StatusBadge tone={overview.reconciliation.reconciled ? "success" : "warning"}>
                {overview.reconciliation.reconciled ? "Reconciled" : "Needs review"}
              </StatusBadge>
            </div>
            {chartData.length ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E2" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5D6D63" }} />
                    <YAxis tickFormatter={(value) => `₱${Number(value).toLocaleString("en-PH")}`} tick={{ fontSize: 11, fill: "#5D6D63" }} width={84} />
                    <Tooltip formatter={(value) => [currency(Number(value)), "Balance"]} />
                    <Line type="monotone" dataKey="balance" stroke="#1F6B43" strokeWidth={3} dot={{ r: 4, fill: "#FFD447", stroke: "#123D2A" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={LineChartIcon} title="No growth data yet" description="Your growth chart will appear after your first validated Share Capital transaction." />
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#123D2A]">My Dividends</h2>
                <p className="mt-1 text-sm text-[#5D6D63]">See your approved amount first. Withdrawal or Share Capital action becomes available after publication and the scheduled distribution date.</p>
              </div>
              <div className="rounded-lg border border-[#B8D6BE] bg-[#F0F8F1] px-4 py-3">
                <p className="text-xs font-bold uppercase text-[#5D6D63]">Available now</p>
                <p className="mt-1 text-xl font-black text-[#123D2A]">{currency(totalAvailableDividend)}</p>
              </div>
            </div>
            {approvedDividends.length ? (
              <div role="status" className="rounded-lg border border-[#E7DDBD] bg-[#FFF9E8] p-4 text-sm font-semibold text-[#6E5B1C]">
                Your dividend allocation has been approved. The amount shown below is your calculated entitlement; actions will unlock after publication and the scheduled distribution date.
              </div>
            ) : null}
            {dividends.length ? (
              <DataTable>
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]">
                    <tr><th className="px-4 py-3">Declaration</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3">Declared</th><th className="px-4 py-3">Distribution</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5ECE5]">
                    {dividends.map((dividend) => (
                      <tr key={dividend.id} className="text-[#294B39]">
                        <td className="px-4 py-4 font-bold text-[#123D2A]">{dividend.declarationName}</td>
                        <td className="px-4 py-4">{displayDate(dividend.coverageStart)} – {displayDate(dividend.coverageEnd)}</td>
                        <td className="px-4 py-4">{dividend.declarationStatus === "Approved" ? "Approved" : dividend.declaredAt ? displayDate(dividend.declaredAt) : "Not declared"}</td>
                        <td className="px-4 py-4">{dividend.distributionDate ? dividend.declarationStatus === "Approved" ? `After publication · ${displayDate(dividend.distributionDate)}` : displayDate(dividend.distributionDate) : "Not available"}</td>
                        <td className="px-4 py-4 text-right"><CurrencyDisplay value={dividend.amount} /></td>
                        <td className="px-4 py-4"><StatusBadge tone={dividend.declarationStatus === "Approved" ? "warning" : dividend.status === "Available" || dividend.status === "Withdrawal Requested" || dividend.status === "Capitalization Requested" ? "warning" : dividend.status === "Withdrawn" || dividend.status === "Added to Share Capital" ? "success" : "neutral"}>{dividend.declarationStatus === "Approved" ? "Approved — awaiting publication" : dividend.status}</StatusBadge></td>
                        <td className="px-4 py-4">
                          {dividend.declarationStatus === "Approved" ? (
                            <p className="text-right text-xs font-semibold text-[#6E5B1C]">Awaiting publication</p>
                          ) : dividend.status === "Available" ? (
                            <div className="flex justify-end gap-2">
                              <button type="button" disabled={Boolean(actionDividend) || actionBusy} onClick={() => openDividendConfirmation(dividend, "withdraw")} className="rounded-md border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#123D2A] hover:bg-[#F3F7F1] disabled:opacity-50">Withdraw</button>
                              <button type="button" disabled={Boolean(actionDividend) || actionBusy} onClick={() => openDividendConfirmation(dividend, "capital")} className="rounded-md bg-[#123D2A] px-3 py-2 text-xs font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50">Add to capital</button>
                            </div>
                          ) : <p className="text-right text-xs text-[#6C7A70]">{dividend.status === "Withdrawal Requested" || dividend.status === "Capitalization Requested" ? "Awaiting Bookkeeper approval" : dividend.withdrawalReference ?? dividend.decision ?? "No action available"}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            ) : (
              <EmptyState icon={HandCoins} title="No declared dividends yet" description="Approved dividend declarations will appear here after approval." />
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-black text-[#123D2A]">Transaction History</h2>
              <p className="mt-1 text-sm text-[#5D6D63]">Each row shows the balance immediately after that transaction.</p>
            </div>
            <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs font-bold uppercase tracking-wide text-[#5D6D63]">
                From
                <input
                  type="date"
                  value={transactionFilters.dateFrom ?? ""}
                  onChange={(event) => {
                    setTransactionFilters((current) => ({ ...current, dateFrom: event.target.value || undefined }));
                    setPage(1);
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-[#CAD8CB] px-3 text-sm font-normal text-[#294B39]"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-[#5D6D63]">
                To
                <input
                  type="date"
                  value={transactionFilters.dateTo ?? ""}
                  min={transactionFilters.dateFrom}
                  onChange={(event) => {
                    setTransactionFilters((current) => ({ ...current, dateTo: event.target.value || undefined }));
                    setPage(1);
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-[#CAD8CB] px-3 text-sm font-normal text-[#294B39]"
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-[#5D6D63]">
                Direction
                <select
                  value={transactionFilters.direction ?? ""}
                  onChange={(event) => {
                    setTransactionFilters((current) => ({
                      ...current,
                      direction: (event.target.value || undefined) as MemberCapitalTransactionFilters["direction"],
                    }));
                    setPage(1);
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-normal text-[#294B39]"
                >
                  <option value="">All</option>
                  <option value="Credit">Credits</option>
                  <option value="Debit">Deductions</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-[#5D6D63]">
                Status
                <select
                  value={transactionFilters.status ?? ""}
                  onChange={(event) => {
                    setTransactionFilters((current) => ({
                      ...current,
                      status: (event.target.value || undefined) as MemberCapitalTransactionFilters["status"],
                    }));
                    setPage(1);
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-normal text-[#294B39]"
                >
                  <option value="">All</option>
                  <option value="Posted">Posted</option>
                  <option value="Reversed">Reversed</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setTransactionFilters({});
                  setPage(1);
                }}
                disabled={!transactionFilters.dateFrom && !transactionFilters.dateTo && !transactionFilters.direction && !transactionFilters.status}
                className="self-end rounded-md border border-[#CAD8CB] px-3 py-2.5 text-sm font-bold text-[#123D2A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear filters
              </button>
            </div>
            {transactions.length ? (
              <DataTable>
                <table className="min-w-[920px] w-full text-left text-sm">
                  <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Transaction type</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3 text-right">Added</th>
                      <th className="px-4 py-3 text-right">Deducted</th>
                      <th className="px-4 py-3 text-right">Updated balance</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5ECE5]">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="text-[#294B39] hover:bg-[#F8FAF7]">
                        <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-[#6C7A70]" />{displayDate(transaction.transactionDate)}</span></td>
                        <td className="px-4 py-4 font-bold text-[#123D2A]">{transaction.transactionType}</td>
                        <td className="px-4 py-4 font-mono text-xs">{transaction.referenceNumber}</td>
                        <td className="px-4 py-4 text-right font-bold text-[#1F6B43]">{transaction.direction === "Credit" ? <CurrencyDisplay value={transaction.amount} /> : "—"}</td>
                        <td className="px-4 py-4 text-right font-bold text-[#A13B2B]">{transaction.direction === "Debit" ? <CurrencyDisplay value={transaction.amount} /> : "—"}</td>
                        <td className="px-4 py-4 text-right"><CurrencyDisplay value={transaction.balanceAfter} /></td>
                        <td className="px-4 py-4"><StatusBadge tone={transaction.status === "Posted" ? "success" : "warning"}>{transaction.status}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E2] px-5 py-4 text-sm">
                  <span className="font-semibold text-[#6C7A70]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} transactions</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button>
                    <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button>
                  </div>
                </div>
              </DataTable>
            ) : (
              <EmptyState icon={WalletCards} title="No Share Capital transactions yet" description="Validated contributions and capitalized dividends will appear here." />
            )}
          </section>
        </>
      ) : null}

      {actionDividend && dividendAction ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="dividend-confirm-title" className="w-full max-w-lg rounded-2xl border border-[#CAD8CB] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Confirm important action</p>
                <h2 id="dividend-confirm-title" className="mt-2 text-xl font-black text-[#123D2A]">{dividendAction === "capital" ? "Add dividend to Share Capital?" : "Withdraw this dividend?"}</h2>
              </div>
              <button type="button" disabled={actionBusy} onClick={resetDividendAction} className="rounded-md border border-[#CAD8CB] p-2 text-[#365F4A] hover:bg-[#F3F7F1] disabled:opacity-50" aria-label="Close confirmation"><X className="size-4" /></button>
            </div>
            <div className="mt-5 rounded-xl bg-[#F4F7F2] p-4">
              <p className="text-sm text-[#5D6D63]">{actionDividend.declarationName}</p>
              <p className="mt-1 text-3xl font-black text-[#123D2A]">{currency(actionDividend.amount)}</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#42594B]">{dividendAction === "capital" ? "This will send a Share Capital addition request to the Bookkeeper. It will be posted to your running balance only after approval." : "Choose whether you want to receive this dividend through Cash or Online Transfer. The Bookkeeper will verify the request before recording the payout."}</p>
            {dividendAction === "withdraw" ? (
              <div className="mt-4 space-y-3">
                <fieldset>
                  <legend className="text-sm font-bold text-[#294B39]">Payout method</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["Cash", "Online Transfer"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setWithdrawalMethod(method)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition ${withdrawalMethod === method ? "border-[#123D2A] bg-[#123D2A] text-white" : "border-[#CAD8CB] text-[#123D2A] hover:bg-[#F3F7F1]"}`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {withdrawalMethod === "Online Transfer" ? (
                  <div className="space-y-3 rounded-lg border border-[#DDE8D8] bg-[#F7FAF5] p-3">
                    <label className="block text-sm font-bold text-[#294B39]">
                      Provider
                      <Select.Root value={withdrawalProvider || undefined} onValueChange={setWithdrawalProvider}>
                        <Select.Trigger aria-label="Provider" className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-[#CAD8CB] bg-white px-3 text-left font-normal text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 data-[placeholder]:text-[#6C7A70]">
                          <Select.Value placeholder="Select provider" />
                          <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content position="popper" sideOffset={6} className="z-[120] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.18)]">
                            <Select.Viewport>
                              {["GCash", "Maya", "Bank Transfer"].map((provider) => (
                                <Select.Item key={provider} value={provider} className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                                  <Select.ItemText>{provider}</Select.ItemText>
                                  <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </label>
                    <label className="block text-sm font-bold text-[#294B39]">
                      Account name
                      <input value={withdrawalAccountName} onChange={(event) => setWithdrawalAccountName(event.target.value)} placeholder="Name registered on the account" className="mt-1 h-10 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" />
                    </label>
                    <label className="block text-sm font-bold text-[#294B39]">
                      Account / mobile number
                      <input value={withdrawalAccountNumber} onChange={(event) => setWithdrawalAccountNumber(event.target.value)} placeholder="Optional if QR is uploaded" className="mt-1 h-10 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" />
                    </label>
                    <label className="block text-sm font-bold text-[#294B39]">
                      QR code <span className="font-normal text-[#6C7A70]">(optional)</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleWithdrawalQrCode(event.target.files?.[0])} className="mt-1 block w-full rounded-md border border-[#CAD8CB] bg-white p-2 text-sm font-normal" />
                    </label>
                    {withdrawalQrFileName ? <p className="text-xs font-semibold text-[#2F7D57]">QR attached: {withdrawalQrFileName}</p> : null}
                    <p className="text-xs text-[#6C7A70]">Provide an account/mobile number or a QR code. These details are visible only to the Bookkeeper.</p>
                  </div>
                ) : (
                  <p className="rounded-lg border border-[#DDE8D8] bg-[#F7FAF5] p-3 text-sm text-[#42594B]">Cash withdrawals will be claimed through the cooperative office after Bookkeeper processing.</p>
                )}
              </div>
            ) : null}
            {actionError ? <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</div> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={actionBusy} onClick={resetDividendAction} className="rounded-md border border-[#CAD8CB] px-4 py-2.5 font-bold text-[#123D2A] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={actionBusy || (dividendAction === "withdraw" && withdrawalMethod === "Online Transfer" && (!withdrawalProvider.trim() || !withdrawalAccountName.trim() || (!withdrawalAccountNumber.trim() && !withdrawalQrCode)))} onClick={() => void confirmDividendAction()} className="rounded-md bg-[#123D2A] px-4 py-2.5 font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50">{actionBusy ? "Processing…" : dividendAction === "capital" ? "Yes, request approval" : "Yes, request withdrawal"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
