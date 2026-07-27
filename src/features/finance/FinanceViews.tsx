"use client";

import {
  BadgeCheck,
  Banknote,
  Landmark,
  ListChecks,
  ReceiptText,
  RefreshCcw,
  Search,
  WalletCards,
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
import { ApiClientError } from "@/lib/api-client";
import { PaymentValidationView } from "./PaymentValidationView";
import {
  getFinancialSummary,
  getShareCapitalSummary,
  listFinancialCategories,
  listFinancialRecords,
  listShareCapital,
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

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Payments" title="Share Capital" description="Validated member capital progress, contribution limits, and payment records." actions={<StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper workflow" : "Read-only oversight"}</StatusBadge>} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Validated Capital" value={money(summary.validatedTotal)} icon={WalletCards} />
        <StatCard label="Pending Capital" value={money(summary.pendingTotal)} icon={ListChecks} />
        <StatCard label="Validated Payments" value={String(summary.validatedPayments)} icon={BadgeCheck} />
        <StatCard label="Member Count" value={String(summary.membersWithValidatedCapital)} icon={Banknote} />
      </div>
      <Toolbar search={search} onSearch={setSearch} onRefresh={() => void load()} count={payments.length} label="share capital" />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? (
        <EmptyState icon={WalletCards} title="No share capital payments found" description="Share capital payments will appear here once recorded by the bookkeeper." />
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
