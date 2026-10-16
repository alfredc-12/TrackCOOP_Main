"use client";

import { ArrowLeft, ChevronDown, RefreshCcw, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { CurrencyDisplay, DataTable, EmptyState, ErrorState, LoadingSkeleton, StatusBadge } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  listShareCapitalAccounts,
  listShareCapitalLedgerTransactions,
  type ShareCapitalAccount,
  type ShareCapitalLedgerTransaction,
} from "./finance-api";

const ACCOUNT_PAGE_SIZE = 10;
const TRANSACTION_PAGE_SIZE = 10;

function date(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof ApiClientError ? error.message : "The Share Capital ledger could not be loaded.";
}

function modalBackdrop(onClose: () => void) {
  return (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative grid min-w-[9.5rem] gap-1 text-xs font-bold text-[#5D6D63]">
      <span>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-white px-3 text-left text-sm font-semibold text-[#123D2A] shadow-sm outline-none transition hover:border-[#8FAF98] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
      >
        <span>{selectedOption?.label ?? "Select"}</span>
        <ChevronDown className={`size-4 shrink-0 text-[#5D6D63] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div role="listbox" aria-label={label} className="absolute left-0 top-full z-[80] mt-1 w-full min-w-[9.5rem] overflow-hidden rounded-lg border border-[#CAD8CB] bg-white p-1 shadow-xl">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${selected ? "bg-[#E7F2E4] text-[#123D2A]" : "text-[#294B39] hover:bg-[#F7FAF5]"}`}
              >
                <span>{option.label}</span>
                {selected ? <span className="text-[#1F6B43]" aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ShareCapitalLedgerPanel({ role }: { role: "chairman" | "bookkeeper" }) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [accounts, setAccounts] = useState<ShareCapitalAccount[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountPage, setAccountPage] = useState(1);
  const [accountTotal, setAccountTotal] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ShareCapitalLedgerTransaction[]>([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [direction, setDirection] = useState<"" | "Credit" | "Debit">("");
  const [status, setStatus] = useState<"" | "Posted" | "Reversed">("");
  const [loading, setLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactionsError, setTransactionsError] = useState("");
  const ledgerCloseRef = useRef<HTMLButtonElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listShareCapitalAccounts(accountSearch, accountPage, ACCOUNT_PAGE_SIZE);
      setAccounts(result.items);
      setAccountTotal(Number(result.meta.total ?? 0));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [accountPage, accountSearch]);

  const loadTransactions = useCallback(async () => {
    if (!selectedMemberId) {
      setTransactions([]);
      setTransactionTotal(0);
      setTransactionsLoading(false);
      return;
    }

    setTransactionsLoading(true);
    setTransactionsError("");
    try {
      const result = await listShareCapitalLedgerTransactions({
        memberId: selectedMemberId,
        page: transactionPage,
        pageSize: TRANSACTION_PAGE_SIZE,
        direction: direction || undefined,
        status: status || undefined,
      });
      setTransactions(result.items);
      setTransactionTotal(Number(result.meta.total ?? 0));
    } catch (caught) {
      setTransactionsError(errorMessage(caught));
    } finally {
      setTransactionsLoading(false);
    }
  }, [direction, selectedMemberId, status, transactionPage]);

  useEffect(() => {
    if (!ledgerOpen) return;
    const timeoutId = window.setTimeout(() => void loadAccounts(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [ledgerOpen, loadAccounts]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadTransactions]);

  useEffect(() => {
    if (!ledgerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedMemberId) {
        setSelectedMemberId(null);
        setTransactions([]);
      } else {
        setLedgerOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ledgerOpen, selectedMemberId]);

  useEffect(() => {
    if (selectedMemberId) detailCloseRef.current?.focus();
    else if (ledgerOpen) ledgerCloseRef.current?.focus();
  }, [ledgerOpen, selectedMemberId]);

  const closeLedger = () => {
    setLedgerOpen(false);
    setSelectedMemberId(null);
    setTransactions([]);
    setTransactionPage(1);
    setTransactionTotal(0);
    setTransactionsError("");
  };

  const closeDetail = () => {
    setSelectedMemberId(null);
    setTransactions([]);
    setTransactionPage(1);
    setTransactionTotal(0);
    setTransactionsError("");
    setDirection("");
    setStatus("");
  };

  const openDetail = (memberId: string) => {
    setTransactions([]);
    setTransactionsError("");
    setTransactionPage(1);
    setTransactionTotal(0);
    setDirection("");
    setStatus("");
    setSelectedMemberId(memberId);
  };

  const accountPageCount = Math.max(1, Math.ceil(accountTotal / ACCOUNT_PAGE_SIZE));
  const transactionPageCount = Math.max(1, Math.ceil(transactionTotal / TRANSACTION_PAGE_SIZE));
  const selectedAccount = accounts.find((account) => account.memberId === selectedMemberId) ?? null;

  return (
    <>
      <button type="button" onClick={() => setLedgerOpen(true)} className="inline-flex h-11 items-center justify-center rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43]">
        Open Share Capital ledger
      </button>

      {ledgerOpen && !selectedAccount ? (
        <div role="dialog" aria-modal="true" aria-labelledby="share-capital-ledger-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={modalBackdrop(closeLedger)}>
          <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:max-w-7xl">
            <div className="flex flex-col gap-3 border-b border-[#E2E8E2] p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">{role === "chairman" ? "Chairman review" : "Bookkeeper review"}</p>
                <h2 id="share-capital-ledger-title" className="mt-1 text-xl font-black text-[#123D2A]">Share Capital accounts</h2>
                <p className="mt-1 text-sm text-[#5D6D63]">Select a member to open the transaction detail modal.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void loadAccounts()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] disabled:opacity-50">
                  <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                  Refresh
                </button>
                <button ref={ledgerCloseRef} type="button" onClick={closeLedger} aria-label="Close Share Capital accounts modal" className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#F7F8F3]">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              <label className="relative block max-w-md">
                <span className="sr-only">Search Share Capital accounts</span>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
                <input value={accountSearch} onChange={(event) => { setAccountSearch(event.target.value); setAccountPage(1); }} placeholder="Search member name or code" className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]" />
              </label>

              {error ? <div className="mt-4"><ErrorState message={error} onRetry={() => void loadAccounts()} /></div> : null}
              {loading ? <div className="mt-4"><LoadingSkeleton /></div> : accounts.length ? (
                <div className="mt-4">
                  <DataTable>
                    <table className="min-w-[1080px] w-full text-left text-sm">
                      <thead className="bg-[#F7F8F3] text-xs uppercase tracking-wide text-[#5D6D63]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3 text-right">Initial</th><th className="px-4 py-3 text-right">Contributions</th><th className="px-4 py-3 text-right">Interest added</th><th className="px-4 py-3 text-right">Deductions</th><th className="px-4 py-3 text-right">Current balance</th><th className="px-4 py-3 text-center">Transactions</th><th className="px-4 py-3">Check</th></tr></thead>
                      <tbody className="divide-y divide-[#EEF2EC]">
                        {accounts.map((account) => (
                          <tr key={account.accountId} className="hover:bg-[#F7F8F3]">
                            <td className="px-4 py-4"><button type="button" onClick={() => openDetail(account.memberId)} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43] focus-visible:ring-offset-2"><p className="font-bold text-[#123D2A]">{account.memberName}</p><p className="mt-1 text-xs text-[#6C7A70]">{account.memberCode} - {account.membershipType}</p></button></td>
                            <td className="px-4 py-4 text-right"><CurrencyDisplay value={account.initialCapital} /></td>
                            <td className="px-4 py-4 text-right"><CurrencyDisplay value={account.additionalContributions} /></td>
                            <td className="px-4 py-4 text-right"><CurrencyDisplay value={account.dividendsAdded} /></td>
                            <td className="px-4 py-4 text-right"><CurrencyDisplay value={account.totalDeductions} /></td>
                            <td className="px-4 py-4 text-right font-black text-[#123D2A]"><CurrencyDisplay value={account.currentBalance} /></td>
                            <td className="px-4 py-4 text-center">{account.transactionCount}</td>
                            <td className="px-4 py-4"><StatusBadge tone={account.reconciled ? "success" : "danger"}>{account.reconciled ? "Reconciled" : "Needs review"}</StatusBadge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E2] px-4 py-4 text-sm"><span className="font-semibold text-[#6C7A70]">Page {accountPage} of {accountPageCount} - {accountTotal} account{accountTotal === 1 ? "" : "s"}</span><div className="flex gap-2"><button type="button" disabled={accountPage <= 1} onClick={() => setAccountPage((page) => Math.max(1, page - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button><button type="button" disabled={accountPage >= accountPageCount} onClick={() => setAccountPage((page) => Math.min(accountPageCount, page + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button></div></div>
                  </DataTable>
                </div>
              ) : <div className="mt-4"><EmptyState title="No Share Capital accounts" description="Accounts will appear after the ledger migration or the first validated contribution." /></div>}
            </div>
          </div>
        </div>
      ) : null}

      {selectedAccount ? (
        <div role="dialog" aria-modal="true" aria-labelledby="share-capital-member-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={modalBackdrop(closeDetail)}>
          <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:max-w-6xl">
            <div className="flex flex-col gap-3 border-b border-[#E2E8E2] p-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Member account detail</p><h2 id="share-capital-member-title" className="mt-1 text-xl font-black text-[#123D2A]">{selectedAccount.memberName}</h2><p className="mt-1 text-sm text-[#5D6D63]">{selectedAccount.memberCode} - {selectedAccount.membershipType}</p></div><div className="flex items-center gap-2"><button type="button" onClick={closeDetail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#F7F8F3]"><ArrowLeft className="size-4" aria-hidden="true" />Back to accounts</button><button ref={detailCloseRef} type="button" onClick={closeLedger} aria-label="Close member account detail modal" className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#F7F8F3]"><X className="size-5" aria-hidden="true" /></button></div></div>

            <div className="min-h-0 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-5"><div className="rounded-lg border border-[#CAD8CB] bg-[#F7FAF5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Initial</p><p className="mt-1 font-black text-[#123D2A]"><CurrencyDisplay value={selectedAccount.initialCapital} /></p></div><div className="rounded-lg border border-[#CAD8CB] bg-[#F7FAF5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Contributions</p><p className="mt-1 font-black text-[#123D2A]"><CurrencyDisplay value={selectedAccount.additionalContributions} /></p></div><div className="rounded-lg border border-[#CAD8CB] bg-[#F7FAF5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Interest added</p><p className="mt-1 font-black text-[#123D2A]"><CurrencyDisplay value={selectedAccount.dividendsAdded} /></p></div><div className="rounded-lg border border-[#CAD8CB] bg-[#F7FAF5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Deductions</p><p className="mt-1 font-black text-[#123D2A]"><CurrencyDisplay value={selectedAccount.totalDeductions} /></p></div><div className="rounded-lg border border-[#B9DCC1] bg-[#E7F2E4] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#1F6B43]">Current balance</p><p className="mt-1 font-black text-[#123D2A]"><CurrencyDisplay value={selectedAccount.currentBalance} /></p></div></div>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-black text-[#123D2A]">Posted transactions</h3><p className="mt-1 text-sm text-[#6C7A70]">Read-only history for reconciliation.</p></div><div className="flex w-full flex-wrap items-end justify-end gap-3 rounded-lg border border-[#E2E8E2] bg-[#F7FAF5] p-3 sm:w-auto"><FilterSelect label="Direction" value={direction} onChange={(value) => { setDirection(value as typeof direction); setTransactionPage(1); }} options={[{ value: "", label: "All directions" }, { value: "Credit", label: "Credits" }, { value: "Debit", label: "Deductions" }]} /><FilterSelect label="Status" value={status} onChange={(value) => { setStatus(value as typeof status); setTransactionPage(1); }} options={[{ value: "", label: "All statuses" }, { value: "Posted", label: "Posted" }, { value: "Reversed", label: "Reversed" }]} /></div></div>

              {transactionsError ? <div className="mt-4"><ErrorState message={transactionsError} onRetry={() => void loadTransactions()} /></div> : null}
              {transactionsLoading ? <div className="mt-4"><LoadingSkeleton /></div> : transactions.length ? <div className="mt-4"><DataTable><table className="min-w-[940px] w-full text-left text-sm"><thead className="bg-[#F7F8F3] text-xs uppercase tracking-wide text-[#5D6D63]"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Balance after</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-[#E5ECE5] bg-white">{transactions.map((transaction) => <tr key={transaction.id}><td className="px-3 py-3">{date(transaction.transactionDate)}</td><td className="px-3 py-3 font-bold text-[#123D2A]">{transaction.transactionType}</td><td className="px-3 py-3 font-mono text-xs">{transaction.referenceNumber}</td><td className={`px-3 py-3 text-right font-bold ${transaction.direction === "Credit" ? "text-[#1F6B43]" : "text-[#A13B2B]"}`}>{transaction.direction === "Credit" ? "+" : "-"}<CurrencyDisplay value={transaction.amount} /></td><td className="px-3 py-3 text-right"><CurrencyDisplay value={transaction.balanceAfter} /></td><td className="px-3 py-3"><StatusBadge tone={transaction.status === "Posted" ? "success" : "warning"}>{transaction.status}</StatusBadge></td></tr>)}</tbody></table><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E2] px-3 py-3 text-sm"><span className="font-semibold text-[#6C7A70]">Page {transactionPage} of {transactionPageCount} - {transactionTotal} transaction{transactionTotal === 1 ? "" : "s"}</span><div className="flex gap-2"><button type="button" disabled={transactionPage <= 1} onClick={() => setTransactionPage((page) => Math.max(1, page - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button><button type="button" disabled={transactionPage >= transactionPageCount} onClick={() => setTransactionPage((page) => Math.min(transactionPageCount, page + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button></div></div></DataTable></div> : <p className="mt-4 rounded-md border border-[#E5ECE5] bg-[#F7FAF5] p-4 text-sm font-semibold text-[#6C7A70]">No transactions match the selected filters.</p>}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
