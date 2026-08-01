"use client";

import {
  BadgeCheck,
  Banknote,
  Landmark,
  ListChecks,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  createShareCapital,
  getFinancialSummary,
  getShareCapitalSummary,
  listFinancialCategories,
  listFinancialRecords,
  listShareCapital,
  type CreateShareCapitalInput,
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
  fullRequirement: 3000,
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
  count,
  label,
}: {
  search: string;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  count: number;
  label: string;
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
          onChange={(event: any) => onSearch(event.target.value)}
          className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          placeholder={`Search ${label}`}
          type="search"
        />
      </label>
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7A70]">
          {count} shown
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
        >
          <RefreshCcw className="size-4" aria-hidden="true" />
          Refresh
        </button>
      </div>
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Add Share Capital modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; code: string }[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [form, setForm] = useState<Omit<CreateShareCapitalInput, "paymentReferenceId">>({
    memberId: "",
    amount: 0,
    paymentDate: new Date().toISOString().split("T")[0],
    paymentStatus: "Validated",
    remarks: "",
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextPayments, nextSummary] = await Promise.all([listShareCapital(search), getShareCapitalSummary()]);
      setPayments(nextPayments);
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Share capital records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  // Fetch members for dropdown when modal opens or search changes
  useEffect(() => {
    if (!isAddOpen) return;
    setIsMembersLoading(true);
    const params = new URLSearchParams({ pageSize: "100", sortBy: "createdAt", sortDirection: "asc" });
    if (memberSearch.trim()) params.set("search", memberSearch.trim());
    const timeoutId = window.setTimeout(() => {
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
    if (!form.memberId) { toast.error("Please select a member."); return; }
    if (!form.amount || form.amount <= 0) { toast.error("Please enter a valid amount."); return; }
    if (!form.paymentDate) { toast.error("Please enter a payment date."); return; }
    setIsSubmitting(true);
    try {
      await createShareCapital({ ...form, amount: Number(form.amount) });
      toast.success("Share capital added successfully!");
      setIsAddOpen(false);
      setForm({ memberId: "", amount: 0, paymentDate: new Date().toISOString().split("T")[0], paymentStatus: "Validated", remarks: "" });
      setMemberSearch("");
      void load();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Failed to add share capital.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMember = members.find(m => m.id === form.memberId);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Payments" title="Share Capital" description="Validated member capital progress, contribution limits, and payment records." actions={
        <div className="flex items-center gap-2">
          <StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper workflow" : "Read-only oversight"}</StatusBadge>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d2f20]"
          >
            <Plus className="size-4" />
            Add Share Capital
          </button>
        </div>
      } />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Validated Capital" value={money(summary.validatedTotal)} icon={WalletCards} />
        <StatCard label="Pending Capital" value={money(summary.pendingTotal)} icon={ListChecks} />
        <StatCard label="Validated Payments" value={String(summary.validatedPayments)} icon={BadgeCheck} />
        <StatCard label="Member Count" value={String(summary.membersWithValidatedCapital)} icon={Banknote} />
      </div>
      <Toolbar search={search} onSearch={setSearch} onRefresh={() => void load()} count={payments.length} label="share capital" />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? (
        <EmptyState icon={WalletCards} title="No share capital payments found" description="Share capital payments will appear here once recorded." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Member</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Payment Date</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{payment.memberName}</p><p className="mt-1 text-xs text-[#6C7A70]">{payment.memberCode}</p></td>
                  <td className="px-5 py-4"><CurrencyDisplay value={payment.amount} /></td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(payment.paymentStatus)}>{payment.paymentStatus}</StatusBadge></td>
                  <td className="px-5 py-4">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}

      {/* Add Share Capital Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Share Capital</h2>
              <button onClick={() => { setIsAddOpen(false); setMemberSearch(""); }} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="size-5" /></button>
            </div>

            <div className="space-y-4">
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

              {/* Payment Date */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Payment Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.paymentDate}
                  onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                />
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={form.paymentStatus}
                  onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value as CreateShareCapitalInput["paymentStatus"] }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                >
                  <option value="Validated">Validated</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
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
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setIsAddOpen(false); setMemberSearch(""); }}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddSubmit()}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d2f20] disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinancialLedgerView({ role }: { role: "chairman" | "bookkeeper" }) {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>(emptyFinancialSummary);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextRecords, nextSummary] = await Promise.all([listFinancialRecords(search), getFinancialSummary()]);
      setRecords(nextRecords);
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Financial records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Finance" title="Financial Ledger" description="Income, expenses, adjustments, posting, and void tracking for cooperative finances." actions={<StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper workflow" : "Read-only oversight"}</StatusBadge>} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Income" value={money(summary.incomeTotal)} icon={Landmark} />
        <StatCard label="Expenses" value={money(summary.expenseTotal)} icon={ReceiptText} />
        <StatCard label="Net" value={money(summary.netTotal)} icon={Banknote} />
        <StatCard label="Active Records" value={String(summary.activeRecords)} icon={ListChecks} />
      </div>
      <Toolbar search={search} onSearch={setSearch} onRefresh={() => void load()} count={records.length} label="ledger" />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : records.length === 0 ? (
        <EmptyState icon={Landmark} title="No financial records found" description="Ledger entries will appear here once posted or recorded by the bookkeeper." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Record</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{record.recordNumber}</p><p className="mt-1 text-xs text-[#6C7A70]">{new Date(record.recordDate).toLocaleDateString()}</p></td>
                  <td className="px-5 py-4">{record.categoryName}</td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(record.recordType)}>{record.recordType}</StatusBadge></td>
                  <td className="px-5 py-4"><CurrencyDisplay value={record.amount} /></td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(record.approvedBy ? "Posted" : record.recordStatus)}>{record.approvedBy ? "Posted" : record.recordStatus}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}

export function FinancialCategoriesView() {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
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

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Finance" title="Financial Categories" description="Reusable income and expense categories for ledger organization." actions={<StatusBadge tone="success">Bookkeeper workflow</StatusBadge>} />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : categories.length === 0 ? (
        <EmptyState icon={ListChecks} title="No categories found" description="Create financial categories before posting detailed ledger records." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Code</th><th className="px-5 py-4">Name</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4 font-bold text-[#123D2A]">{category.categoryCode}</td>
                  <td className="px-5 py-4">{category.categoryName}</td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(category.categoryType)}>{category.categoryType}</StatusBadge></td>
                  <td className="px-5 py-4"><StatusBadge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Active" : "Inactive"}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}
