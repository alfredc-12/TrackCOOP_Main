"use client";

import {
  BadgeCheck,
  Banknote,
  ChevronDown,
  Landmark,
  ListChecks,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import { PaymentValidationView } from "./PaymentValidationView";
import {
  createPaymentReference,
  getFinancialSummary,
  getShareCapitalSummary,
  listFinancialCategories,
  listFinancialRecords,
  listShareCapital,
  validatePaymentReference,
  type FinancialCategory,
  type FinancialRecord,
  type FinancialSummary,
  type ShareCapitalPayment,
  type ShareCapitalSummary,
} from "./finance-api";

const emptyShareSummary: ShareCapitalSummary = {
  validatedTotal: 0,
  pendingTotal: 0,
  validatedPayments: 0,
  membersWithValidatedCapital: 0,
  initialRequirement: 1500,
  fullRequirement: 1500,
  maximumAllowed: 15000,
};

const emptyFinancialSummary: FinancialSummary = {
  incomeTotal: 0,
  expenseTotal: 0,
  adjustmentTotal: 0,
  netTotal: 0,
  activeRecords: 0,
  voidedRecords: 0,
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPaymentDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function badgeTone(status: string) {
  if (["Validated", "Active", "Income", "Posted"].includes(status)) return "success" as const;
  if (["Pending", "Needs Clarification", "Adjustment"].includes(status)) return "warning" as const;
  if (["Rejected", "Reversed", "Voided", "Expense"].includes(status)) return "danger" as const;
  return "neutral" as const;
}

function Toolbar({
  search,
  onSearch,
  onRefresh,
  refreshing,
  count,
  label,
  rightContent,
}: {
  search: string;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  count?: number;
  label: string;
  rightContent?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full max-w-md">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]"
          aria-hidden="true"
        />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          placeholder={`Search ${label}`}
          type="search"
        />
      </label>
      <div className="flex items-center gap-3">
        {rightContent ?? (count !== undefined ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7A70]">{count} shown</p> : null)}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          {refreshing ? "Loading..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}

function RowsPerPageSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const options = [5, 10, 20, 50];
  return (
    <div className="relative w-40">
      <button type="button" aria-label="Rows per page" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#8FB79A] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
        <span>{value} per page</span><ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? <div role="listbox" aria-label="Rows per page options" className="absolute right-0 z-30 mt-2 w-full rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
        {options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); }}
          className={`flex w-full items-center rounded px-3 py-3 text-left text-sm transition ${option === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}>{option} per page</button>)}
      </div> : null}
    </div>
  );
}

export function PaymentReferencesView({ role }: { role: "chairman" | "bookkeeper" }) {
  return <PaymentValidationView role={role} />;
}

export function ShareCapitalView({ role }: { role: "chairman" | "bookkeeper" }) {
  const [payments, setPayments] = useState<ShareCapitalPayment[]>([]);
  const [summary, setSummary] = useState<ShareCapitalSummary>(emptyShareSummary);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshInFlight = useRef(false);

  // Add Share Capital modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string; code: string }[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [form, setForm] = useState({
    memberId: "",
    amount: 0,
    paymentChannel: "Cash" as "Cash" | "Manual GCash" | "Bank Transfer",
    referenceNumber: "",
    remarks: "",
  });
  const [moneyReceived, setMoneyReceived] = useState(false);
  const [detailsCorrect, setDetailsCorrect] = useState(false);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) {
      setIsLoading(true);
      setError("");
    }
    try {
      const [nextPayments, nextSummary] = await Promise.all([listShareCapital(search), getShareCapitalSummary()]);
      setPayments(nextPayments);
      setSummary(nextSummary);
      setError("");
    } catch (caught) {
      if (!silent) setError(caught instanceof ApiClientError ? caught.message : "Share capital records could not be loaded.");
    } finally {
      refreshInFlight.current = false;
      if (!silent) setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 15_000);
    return () => { window.clearTimeout(timeoutId); window.clearInterval(refreshTimer); };
  }, [load]);

  // Fetch members for dropdown when modal opens or search changes
  useEffect(() => {
    if (!isAddOpen) return;
    const params = new URLSearchParams({ pageSize: "100", sortBy: "createdAt", sortDirection: "asc" });
    if (memberSearch.trim()) params.set("search", memberSearch.trim());
    const timeoutId = window.setTimeout(() => {
      setIsMembersLoading(true);
      void apiRequest<{ id: string; fullName?: string; memberCode?: string }[]>(`/api/members?${params}`)
        .then(rows => {
          setMembers(rows.map(m => ({ id: String(m.id), name: m.fullName ?? "Unknown", code: m.memberCode ?? "" })));
        })
        .catch(() => setMembers([]))
        .finally(() => setIsMembersLoading(false));
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [isAddOpen, memberSearch]);

  const handleAddSubmit = async () => {
    const fail = (message: string) => { setFormError(message); toast.error(message); };
    if (!form.memberId) { fail("Please select a member."); return; }
    if (!form.amount || form.amount <= 0) { fail("Please enter a valid amount."); return; }
    if (form.referenceNumber.trim().length < 2) { fail("Please enter the receipt or payment reference number."); return; }
    if (!createdPaymentId && payments.some((payment) => payment.referenceNumber?.trim().toLowerCase() === form.referenceNumber.trim().toLowerCase())) {
      fail("This receipt or payment reference is already recorded. Use a unique reference number.");
      return;
    }
    if (!moneyReceived || !detailsCorrect) { fail("Please confirm that the money and details were checked."); return; }
    setFormError("");
    setIsSubmitting(true);
    let paymentId = createdPaymentId;
    try {
      paymentId = paymentId ?? (await createPaymentReference({
        memberId: form.memberId,
        payerName: selectedMember?.name ?? null,
        provider: form.paymentChannel === "Cash" ? "Cashier" : form.paymentChannel,
        paymentChannel: form.paymentChannel,
        referenceNumber: form.referenceNumber.trim(),
        paymentPurpose: "Share Capital",
        relatedEntityType: "member_profile",
        relatedEntityId: form.memberId,
        amount: Number(form.amount),
        notes: form.remarks.trim() || null,
      })).id;
      setCreatedPaymentId(paymentId);
      await validatePaymentReference(paymentId);
      toast.success("Share capital payment approved and recorded.");
      setIsAddOpen(false);
      setCreatedPaymentId(null);
      setForm({ memberId: "", amount: 0, paymentChannel: "Cash", referenceNumber: "", remarks: "" });
      setMoneyReceived(false);
      setDetailsCorrect(false);
      setMemberSearch("");
      void load();
    } catch (caught) {
      const message = caught instanceof ApiClientError ? caught.message : paymentId ? "Payment was recorded, but approval failed. Retry approval safely." : "Failed to record share capital payment.";
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMember = members.find(m => m.id === form.memberId);
  const pageCount = Math.max(1, Math.ceil(payments.length / pageSize));
  const visiblePayments = payments.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-4">
      <PageHeader eyebrow="Payments" title="Share Capital" description="Validated member capital progress, contribution limits, and payment records." actions={
        <div className="flex items-center gap-2">
          {role === "bookkeeper" ? <button
              onClick={() => { setFormError(""); setCreatedPaymentId(null); setIsAddOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d2f20]"
            >
              <Plus className="size-4" />
              Record Payment
            </button> : null}
        </div>
      } />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Validated Capital" value={money(summary.validatedTotal)} icon={WalletCards} />
        <StatCard label="Pending Capital" value={money(summary.pendingTotal)} icon={ListChecks} />
        <StatCard label="Validated Payments" value={String(summary.validatedPayments)} icon={BadgeCheck} />
        <StatCard label="Member Count" value={String(summary.membersWithValidatedCapital)} icon={Banknote} />
      </div>
      <Toolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} onRefresh={() => void load()} refreshing={isLoading} label="share capital" rightContent={<RowsPerPageSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />} />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? (
        <EmptyState icon={WalletCards} title="No share capital payments found" description="Share capital payments will appear here once recorded." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4 text-left">Member</th><th className="px-5 py-4 text-center">Amount</th><th className="px-5 py-4 text-center">Payment method</th><th className="px-5 py-4 text-center">Reference number</th><th className="px-5 py-4 text-center">Status</th><th className="px-5 py-4 text-center">Payment date</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {visiblePayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{payment.memberName}</p><p className="mt-1 text-xs text-[#6C7A70]">{payment.memberCode}</p></td>
                  <td className="px-5 py-4 text-center"><CurrencyDisplay value={payment.amount} /></td>
                  <td className={`px-5 py-4 text-center ${payment.paymentChannel ? "" : "italic text-[#8A968D]"}`}>{payment.paymentChannel ?? "Not recorded"}</td>
                  <td className={`max-w-[18rem] px-5 py-4 text-center font-mono text-xs ${payment.referenceNumber ? "" : "italic text-[#8A968D]"}`}>
                    {payment.referenceNumber ? <span className="inline-block max-w-full truncate align-bottom" title={payment.referenceNumber}>{payment.referenceNumber}</span> : "Not recorded"}
                  </td>
                  <td className="px-5 py-4 text-center"><StatusBadge tone={badgeTone(payment.paymentStatus)}>{payment.paymentStatus}</StatusBadge></td>
                  <td className="px-5 py-4 text-center">{formatPaymentDate(payment.paymentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E2] px-5 py-4 text-sm">
            <span className="font-semibold text-[#6C7A70]">Showing {payments.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, payments.length)} of {payments.length} payments</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button>
            </div>
          </div>
        </DataTable>
      )}

      {/* Add Share Capital Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8 backdrop-blur-sm">
          <div className="my-auto w-full max-w-md rounded-3xl bg-white p-8 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Record Share Capital Payment</h2>
              <button onClick={() => { setIsAddOpen(false); setMemberSearch(""); setFormError(""); setCreatedPaymentId(null); }} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="size-5" /></button>
            </div>

            <div className="space-y-4">
              {formError ? <div role="alert" aria-live="assertive" className="rounded-xl border border-[#D9A99F] bg-[#FFF4F1] p-3 text-sm font-semibold text-[#7A3023]">{formError}</div> : null}
              {/* Member selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Member <span className="text-red-500">*</span></label>
                {selectedMember ? (
                  <div className="flex items-center justify-between rounded-xl border border-[#123D2A] bg-[#f0f7f4] px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-[#123D2A]">{selectedMember.name}</p>
                      <p className="text-xs text-gray-500">{selectedMember.code}</p>
                    </div>
                    <button onClick={() => { setForm(f => ({ ...f, memberId: "" })); setMemberSearch(""); }} className="text-xs text-red-500 hover:underline">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search member name or code..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      onFocus={() => setShowMemberDropdown(true)}
                      onBlur={() => window.setTimeout(() => setShowMemberDropdown(false), 150)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                    />
                    {showMemberDropdown && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl">
                        {isMembersLoading ? (
                          <div className="px-4 py-3 text-sm text-gray-400">Loading members...</div>
                        ) : members.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400">
                            {memberSearch.trim() ? `No members found for "${memberSearch}"` : "No members found"}
                          </div>
                        ) : (
                          members.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onMouseDown={e => {
                                e.preventDefault(); // prevent blur before click
                                setForm(f => ({ ...f, memberId: m.id }));
                                setMemberSearch("");
                                setShowMemberDropdown(false);
                              }}
                              className="flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-[#f0f7f4] border-b border-gray-50 last:border-0"
                            >
                              <span className="font-semibold text-[#123D2A]">{m.name}</span>
                              <span className="text-xs text-gray-400">{m.code}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₱) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1" max="15000" step="0.01"
                  value={form.amount || ""}
                  onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  placeholder="e.g. 1500"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Paid through <span className="text-red-500">*</span></label>
                <select
                  value={form.paymentChannel}
                  onChange={e => setForm(f => ({ ...f, paymentChannel: e.target.value as typeof form.paymentChannel }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                >
                  <option value="Cash">Cash</option>
                  <option value="Manual GCash">GCash checked manually</option>
                  <option value="Bank Transfer">Bank transfer</option>
                </select>
              </div>

              {/* Reference */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Receipt or payment reference <span className="text-red-500">*</span></label>
                <input
                  value={form.referenceNumber}
                  onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
                  placeholder="Example: OR-2026-0012"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                <textarea
                  value={form.remarks ?? ""}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A] resize-none"
                />
              </div>

              <div className="grid gap-3 rounded-xl border border-[#B7D7BD] bg-[#F2FAF3] p-4">
                <label className="flex items-start gap-3 text-sm font-semibold text-[#294B39]"><input type="checkbox" checked={moneyReceived} onChange={e => setMoneyReceived(e.target.checked)} className="mt-0.5 size-5 accent-[#1F6B43]" />I received the money or checked the payment record.</label>
                <label className="flex items-start gap-3 text-sm font-semibold text-[#294B39]"><input type="checkbox" checked={detailsCorrect} onChange={e => setDetailsCorrect(e.target.checked)} className="mt-0.5 size-5 accent-[#1F6B43]" />The member, amount, and reference number are correct.</label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setIsAddOpen(false); setMemberSearch(""); setFormError(""); setCreatedPaymentId(null); }}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddSubmit()}
                disabled={isSubmitting || !moneyReceived || !detailsCorrect}
                className="flex-1 rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d2f20] disabled:opacity-60"
              >
                {isSubmitting ? (createdPaymentId ? "Approving..." : "Recording...") : createdPaymentId ? "Retry approval" : "Approve and record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinancialLedgerView() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>(emptyFinancialSummary);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const ledgerRefreshInFlight = useRef(false);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (ledgerRefreshInFlight.current) return;
    ledgerRefreshInFlight.current = true;
    if (!silent) {
      setIsLoading(true);
      setError("");
    }
    try {
      const [nextRecords, nextSummary] = await Promise.all([listFinancialRecords(search), getFinancialSummary()]);
      setRecords(nextRecords);
      setSummary(nextSummary);
      setError("");
    } catch (caught) {
      if (!silent) setError(caught instanceof ApiClientError ? caught.message : "Financial records could not be loaded.");
    } finally {
      ledgerRefreshInFlight.current = false;
      if (!silent) setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 15_000);
    return () => { window.clearTimeout(timeoutId); window.clearInterval(refreshTimer); };
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const visibleRecords = records.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-4">
      <PageHeader eyebrow="Finance" title="Financial Ledger" description="Income, expenses, adjustments, posting, and void tracking for cooperative finances." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Income" value={money(summary.incomeTotal)} icon={Landmark} />
        <StatCard label="Expenses" value={money(summary.expenseTotal)} icon={ReceiptText} />
        <StatCard label="Net" value={money(summary.netTotal)} icon={Banknote} />
        <StatCard label="Active Records" value={String(summary.activeRecords)} icon={ListChecks} />
      </div>
      <Toolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} onRefresh={() => void load()} refreshing={isLoading} label="ledger" rightContent={<RowsPerPageSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />} />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {isLoading ? <LoadingSkeleton /> : records.length === 0 ? (
        <EmptyState icon={Landmark} title="No financial records found" description="Ledger entries will appear here once posted or recorded by the bookkeeper." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4 text-left">Record</th><th className="px-5 py-4 text-left">Category</th><th className="px-5 py-4 text-center">Type</th><th className="px-5 py-4 text-center">Amount</th><th className="px-5 py-4 text-center">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {visibleRecords.map((record) => (
                <tr key={record.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{record.recordNumber}</p><p className="mt-1 text-xs text-[#6C7A70]">{formatPaymentDate(record.recordDate)}</p></td>
                  <td className="px-5 py-4">{record.categoryName}</td>
                  <td className="px-5 py-4 text-center"><StatusBadge tone={badgeTone(record.recordType)}>{record.recordType}</StatusBadge></td>
                  <td className="px-5 py-4 text-center"><CurrencyDisplay value={record.amount} /></td>
                  <td className="px-5 py-4 text-center"><StatusBadge tone={badgeTone(record.recordStatus)}>{record.recordStatus}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E2] px-5 py-4 text-sm">
            <span className="font-semibold text-[#6C7A70]">Showing {records.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, records.length)} of {records.length} records</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button>
            </div>
          </div>
        </DataTable>
      )}
    </div>
  );
}

export function FinancialCategoriesView() {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setCategories(await listFinancialCategories());
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Financial categories could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(categories.length / pageSize));
  const visibleCategories = categories.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-4">
      <PageHeader eyebrow="Finance" title="Financial Categories" description="Reusable income and expense categories for ledger organization." />
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border border-[#CAD8CB] bg-white p-3">
        <RowsPerPageSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />
        <button type="button" onClick={() => void load()} disabled={isLoading} aria-busy={isLoading} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:cursor-wait disabled:opacity-60">
          <RefreshCcw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />{isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {isLoading ? <LoadingSkeleton /> : categories.length === 0 ? (
        <EmptyState icon={ListChecks} title="No categories found" description="Create financial categories before posting detailed ledger records." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4 text-left">Code</th><th className="px-5 py-4 text-left">Name</th><th className="px-5 py-4 text-center">Type</th><th className="px-5 py-4 text-center">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {visibleCategories.map((category) => (
                <tr key={category.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4 font-bold text-[#123D2A]">{category.categoryCode}</td>
                  <td className="px-5 py-4">{category.categoryName}</td>
                  <td className="px-5 py-4 text-center"><StatusBadge tone={badgeTone(category.categoryType)}>{category.categoryType}</StatusBadge></td>
                  <td className="px-5 py-4 text-center"><StatusBadge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Active" : "Inactive"}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E2] px-5 py-4 text-sm">
            <span className="font-semibold text-[#6C7A70]">Showing {categories.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, categories.length)} of {categories.length} categories</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button>
            </div>
          </div>
        </DataTable>
      )}
    </div>
  );
}
