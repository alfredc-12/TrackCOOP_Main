"use client";

/* eslint-disable @next/next/no-img-element -- member QR previews are dynamic data URLs. */

import * as Select from "@radix-ui/react-select";
import { Calculator, Check, CheckCircle2, ChevronDown, Eye, EyeOff, HandCoins, History, Info, Plus, Send, Users, WalletCards, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CurrencyDisplay, DataTable, EmptyState, ErrorState, StatusBadge } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  completeDividendAction,
  approveDividendDeclaration,
  createDividendDeclaration,
  getDividendFinancialBasis,
  listDividendActionHistory,
  listDividendDeclarationMembers,
  listDividendDeclarations,
  listDividendActionRequests,
  previewDividendDeclaration,
  rejectDividendDeclaration,
  publishDividendDeclaration,
  type DividendDeclaration,
  type DividendDeclarationMember,
  type DividendDeclarationPreview,
  type DividendFinancialBasis,
  type DividendActionRequest,
} from "./finance-api";

type DialogState =
  | { kind: "create" }
  | { kind: "members"; declaration: DividendDeclaration }
  | { kind: "publish"; declaration: DividendDeclaration }
  | { kind: "action"; request: DividendActionRequest }
  | null;

type ApprovalConfirmation = {
  action: "approve" | "reject";
  declaration: DividendDeclaration;
} | null;

type PayoutForm = {
  referenceNumber: string;
  notes: string;
  withdrawalReceipt: string | null;
  withdrawalReceiptName: string;
};

const EMPTY_PAYOUT: PayoutForm = {
  referenceNumber: "",
  notes: "",
  withdrawalReceipt: null,
  withdrawalReceiptName: "",
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function interestRate(value: number | null | undefined) {
  return value === null || value === undefined
    ? "-"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 7,
        maximumFractionDigits: 7,
      }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function message(error: unknown) {
  return error instanceof ApiClientError ? error.message : "The Annual Interest action could not be completed.";
}

function matchesMemberSearch(member: { memberName: string; memberCode: string; membershipType: string }, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return `${member.memberName} ${member.memberCode} ${member.membershipType}`.toLowerCase().includes(normalizedQuery);
}

function isActiveDeclaration(status: DividendDeclaration["status"]) {
  return status === "Draft" || status === "Approved" || status === "Published";
}

function findCoverageConflict(declarations: DividendDeclaration[], coverageStart: string, coverageEnd: string) {
  if (!coverageStart || !coverageEnd || coverageEnd < coverageStart) return null;
  return declarations.find((declaration) => isActiveDeclaration(declaration.status) && declaration.coverageStart <= coverageEnd && declaration.coverageEnd >= coverageStart) ?? null;
}

function MemberSearch({
  inputId,
  search,
  onSearchChange,
  className = "max-w-2xl",
}: {
  inputId: string;
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label htmlFor={inputId} className={`block w-full ${className} text-xs font-bold uppercase tracking-wide text-[#365F4A]`}>
      Search members
      <input
        id={inputId}
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Name, member code, or type"
        className="mt-2 h-12 w-full rounded-lg border border-[#CAD8CB] bg-white px-4 text-sm font-normal shadow-sm transition placeholder:text-[#8A9A8F] focus:border-[#1F6B43] focus:outline-none focus:ring-4 focus:ring-[#82E6A7]/20"
      />
    </label>
  );
}

function FieldError({ message: error }: { message?: string }) {
  return error ? <span role="alert" className="mt-1 block text-xs font-bold text-red-700">{error}</span> : null;
}

function MemberPagination({
  page,
  pageCount,
  total,
  onPrevious,
  onNext,
  label = "member",
}: {
  page: number;
  pageCount: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  label?: string;
}) {
  return (
    <div className="mt-4 flex shrink-0 flex-col gap-3 border-t border-[#E5ECE5] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-semibold text-[#6C7A70]">Page {page} of {pageCount} - {total} {label}{total === 1 ? "" : "s"}</span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={onPrevious} className="inline-flex h-10 min-w-24 items-center justify-center rounded-lg border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pageCount} onClick={onNext} className="inline-flex h-10 min-w-20 items-center justify-center rounded-lg border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

function DeclarationActionCard({
  declaration,
  approvalBusyId,
  approvalBusyAction,
  onApprove,
  onReject,
  onPublish,
}: {
  declaration: DividendDeclaration;
  approvalBusyId: string | null;
  approvalBusyAction: "approve" | "reject" | null;
  onApprove: (declaration: DividendDeclaration) => void;
  onReject: (declaration: DividendDeclaration) => void;
  onPublish: (declaration: DividendDeclaration) => void;
}) {
  const approved = declaration.status === "Approved";

  return (
    <div className={`flex min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between ${approved ? "border-[#CAD8CB] bg-[#F7FAF5]" : "border-[#E7DDBD] bg-[#FFFDF4]"}`}>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#123D2A]">{declaration.name}</p>
        <p className="text-xs text-[#6C7A70]">{declaration.memberCount} members · <CurrencyDisplay value={declaration.totalDeclaredAmount} /></p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {approved ? <button type="button" onClick={() => onPublish(declaration)} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#123D2A] bg-[#123D2A] px-3 text-sm font-bold text-white transition hover:bg-[#1F6B43]"><Send className="size-4" /> Publish</button> : <><button type="button" disabled={approvalBusyId !== null} onClick={() => onApprove(declaration)} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#123D2A] bg-[#123D2A] px-3 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="size-4" />{approvalBusyId === declaration.id && approvalBusyAction === "approve" ? "Approving..." : "Approve"}</button><button type="button" disabled={approvalBusyId !== null} onClick={() => onReject(declaration)} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#D9A99F] bg-[#FFF8F5] px-3 text-sm font-bold text-[#8A3D2F] transition hover:bg-[#FFECE5] disabled:cursor-not-allowed disabled:opacity-50"><XCircle className="size-4" />{approvalBusyId === declaration.id && approvalBusyAction === "reject" ? "Rejecting..." : "Reject"}</button></>}
      </div>
    </div>
  );
}

function ApprovalConfirmationModal({
  confirmation,
  busy,
  onCancel,
  onConfirm,
}: {
  confirmation: Exclude<ApprovalConfirmation, null>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const approving = confirmation.action === "approve";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="approval-confirmation-title" aria-describedby="approval-confirmation-description" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${approving ? "bg-[#E2F3E5] text-[#1F6B43]" : "bg-[#FFF0EC] text-[#A13B2B]"}`}>
              {approving ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">{approving ? "Approval confirmation" : "Rejection confirmation"}</p>
              <h3 id="approval-confirmation-title" className="mt-1 text-xl font-black text-[#123D2A]">{approving ? "Approve this declaration?" : "Reject this declaration?"}</h3>
            </div>
          </div>
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-md border border-[#CAD8CB] p-2 text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:opacity-50" aria-label="Close confirmation"><X className="size-4" /></button>
        </div>
        <div className="mt-5 rounded-xl border border-[#DDE8DD] bg-[#F7FAF5] p-4">
          <p className="font-black text-[#123D2A]">{confirmation.declaration.name}</p>
          <p className="mt-1 text-sm text-[#6C7A70]">{confirmation.declaration.memberCount} members · <CurrencyDisplay value={confirmation.declaration.totalDeclaredAmount} /></p>
        </div>
        <p id="approval-confirmation-description" className="mt-4 text-sm leading-6 text-[#42594B]">
          {approving
            ? "Approval locks the calculated member allocations and moves this declaration to Approval History. Publication remains a separate step before members can claim the amount."
            : "Rejecting cancels this declaration before publication and removes it from the approval queue. This action cannot be used to publish the declaration later."}
        </p>
        <div className="mt-6 flex justify-end gap-3 border-t border-[#E5ECE5] pt-5">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-md border border-[#CAD8CB] px-4 py-2.5 font-bold text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`rounded-md px-4 py-2.5 font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${approving ? "bg-[#123D2A] hover:bg-[#1F6B43]" : "bg-[#A13B2B] hover:bg-[#8A3024]"}`}>{busy ? "Processing..." : approving ? "Approve declaration" : "Reject declaration"}</button>
        </div>
      </div>
    </div>
  );
}

function PublishHistoryView({
  declarations,
  onViewMembers,
}: {
  declarations: DividendDeclaration[];
  onViewMembers: (declaration: DividendDeclaration) => void;
}) {
  const publishedDeclarations = declarations.filter((declaration) => declaration.status === "Published");

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm leading-6 text-[#5D6D63]">Published Annual Interest on Share Capital declarations are listed here for reference. Open a declaration to review its member allocations.</p>
      {publishedDeclarations.length ? (
        <div className="overflow-x-auto rounded-xl border border-[#DDE8DD]">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]">
              <tr><th className="px-4 py-3">Declaration</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Declared total</th><th className="px-4 py-3 text-center">Members</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-[#E5ECE5]">
              {publishedDeclarations.map((declaration) => (
                <tr key={declaration.id}>
                  <td className="px-4 py-4"><p className="font-bold text-[#123D2A]">{declaration.name}</p><p className="mt-1 text-xs text-[#6C7A70]">{declaration.calculationMethod}</p></td>
                  <td className="px-4 py-4 whitespace-nowrap">{date(declaration.coverageStart)} - {date(declaration.coverageEnd)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{date(declaration.declaredAt ?? declaration.createdAt)}</td>
                  <td className="px-4 py-4 text-right"><CurrencyDisplay value={declaration.totalDeclaredAmount} /></td>
                  <td className="px-4 py-4 text-center">{declaration.memberCount}</td>
                  <td className="px-4 py-4"><StatusBadge tone="success">{declaration.status}</StatusBadge></td>
                  <td className="px-4 py-4 text-right"><button type="button" onClick={() => onViewMembers(declaration)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#123D2A] px-3 text-xs font-bold text-[#123D2A] transition hover:bg-[#EEF6EC]"><Eye className="size-3.5" />View members</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E7DDBD] bg-[#FFF9E8] p-4 text-sm font-semibold text-[#6E5B1C]">No published Annual Interest declarations yet.</div>
      )}
    </div>
  );
}

function PublishedMembersModal({
  declaration,
  members,
  visibleMembers,
  loading,
  error,
  search,
  page,
  pageCount,
  total,
  onSearchChange,
  onPrevious,
  onNext,
  onViewCalculation,
  onClose,
}: {
  declaration: DividendDeclaration;
  members: DividendDeclarationMember[];
  visibleMembers: DividendDeclarationMember[];
  loading: boolean;
  error: string;
  search: string;
  page: number;
  pageCount: number;
  total: number;
  onSearchChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onViewCalculation: () => void;
  onClose: () => void;
}) {
  const withdrawnCount = members.length ? members.filter((member) => member.status === "Withdrawn").length : declaration.withdrawnCount;
  const withdrawalRequestedCount = members.length ? members.filter((member) => member.status === "Withdrawal Requested").length : declaration.withdrawalRequestedCount;
  const capitalizedCount = members.length ? members.filter((member) => member.status === "Added to Share Capital").length : declaration.capitalizedCount;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="published-members-title" className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5ECE5] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Published Annual Interest</p>
            <h3 id="published-members-title" className="mt-1 text-xl font-black text-[#123D2A]">Member allocations</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#CAD8CB] p-2 text-[#123D2A]" aria-label="Close published member allocations"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <div className="rounded-xl bg-[#F4F7F2] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-black text-[#123D2A]">{declaration.name}</p>
                <p className="mt-1 text-sm text-[#6C7A70]">{declaration.memberCount} members · <CurrencyDisplay value={declaration.totalDeclaredAmount} /></p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="rounded-lg border border-[#DDE8DD] bg-white px-3 py-2"><span className="block font-bold uppercase tracking-wide text-[#7A887F]">Coverage start</span><strong className="mt-1 block text-sm text-[#123D2A]">{date(declaration.coverageStart)}</strong></div>
                <div className="rounded-lg border border-[#DDE8DD] bg-white px-3 py-2"><span className="block font-bold uppercase tracking-wide text-[#7A887F]">Coverage end</span><strong className="mt-1 block text-sm text-[#123D2A]">{date(declaration.coverageEnd)}</strong></div>
                <button type="button" onClick={onViewCalculation} className="inline-flex h-10 items-center justify-center rounded-md border border-[#123D2A] bg-[#123D2A] px-3 text-xs font-bold text-white hover:bg-[#1F6B43]">View full calculation</button>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#DDE8DD] bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Withdrawn</p>
              <p className="mt-1 text-2xl font-black text-[#123D2A]">{withdrawnCount}</p>
            </div>
            <div className="rounded-xl border border-[#E7DDBD] bg-[#FFFDF4] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6E5B1C]">Withdrawal requested</p>
              <p className="mt-1 text-2xl font-black text-[#6E5B1C]">{withdrawalRequestedCount}</p>
            </div>
            <div className="rounded-xl border border-[#DDE8DD] bg-[#EEF6EC] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#1F6B43]">Added to Share Capital</p>
              <p className="mt-1 text-2xl font-black text-[#123D2A]">{capitalizedCount}</p>
            </div>
          </div>
          {loading ? <p className="mt-5 text-sm font-semibold text-[#5D6D63]">Loading member allocations...</p> : error ? <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : members.length ? <div className="mt-5"><MemberSearch inputId="published-member-search" className="max-w-none" search={search} onSearchChange={onSearchChange} /><div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-[#DDE8DD] bg-white"><table className="min-w-[900px] w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3 text-right">Average share month</th><th className="px-4 py-3 text-right">Interest</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Decision</th></tr></thead><tbody className="divide-y divide-[#EEF2EC]">{visibleMembers.length ? visibleMembers.map((member) => <tr key={member.memberId}><td className="px-4 py-3"><p className="font-bold text-[#123D2A]">{member.memberName}</p><p className="text-xs text-[#6C7A70]">{member.memberCode}</p></td><td className="px-4 py-3 text-xs text-[#5D6D63]">{member.membershipType}</td><td className="px-4 py-3 text-right">{money(member.averageShareMonth)}</td><td className="px-4 py-3 text-right font-bold text-[#123D2A]">{money(member.dividendAmount)}</td><td className="px-4 py-3"><StatusBadge tone={member.status === "Available" || member.status === "Added to Share Capital" || member.status === "Withdrawn" ? "success" : "warning"}>{member.status}</StatusBadge></td><td className="px-4 py-3 text-xs text-[#5D6D63]">{member.decision ?? "-"}</td></tr>) : <tr><td colSpan={6} className="px-4 py-8 text-center text-sm font-semibold text-[#6C7A70]">No matching members found.</td></tr>}</tbody></table></div><MemberPagination page={page} pageCount={pageCount} total={total} onPrevious={onPrevious} onNext={onNext} /></div> : <p className="mt-5 rounded-lg border border-[#E7DDBD] bg-[#FFF9E8] p-3 text-sm font-semibold text-[#6E5B1C]">No member allocations were found for this published declaration.</p>}
        </div>
      </div>
    </div>
  );
}

function FieldInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="dividend-field-info-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Field guide</p>
            <h3 id="dividend-field-info-title" className="mt-1 text-xl font-black text-[#123D2A]">Annual Interest calculation inputs</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#CAD8CB] p-2 text-[#123D2A]" aria-label="Close field guide"><X className="size-4" /></button>
        </div>
        <div className="mt-5 space-y-4 text-sm leading-6 text-[#42594B]">
          <div className="rounded-xl border border-[#DDE8DD] bg-[#F7FAF5] p-4">
            <p className="font-black text-[#123D2A]">Fiscal-year coverage</p>
            <p className="mt-1">Create one declaration for a complete 12-month fiscal year. Monthly paid-up share balances are used only to calculate each member&apos;s average share month.</p>
          </div>
          <div className="rounded-xl border border-[#DDE8DD] bg-[#F7FAF5] p-4">
            <p className="font-black text-[#123D2A]">Statutory reserves (%)</p>
            <p className="mt-1">The approved portion of net surplus set aside for statutory reserves before distributable surplus is calculated. The amount is calculated automatically from the net surplus.</p>
          </div>
          <div className="rounded-xl border border-[#DDE8DD] bg-[#F7FAF5] p-4">
            <p className="font-black text-[#123D2A]">Interest on Share Capital allocation (%)</p>
            <p className="mt-1">The approved portion of distributable surplus allocated to the Interest on Share Capital pool. The pool is distributed using each member&apos;s average paid-up share month.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end border-t border-[#E5ECE5] pt-5">
          <button type="button" onClick={onClose} className="rounded-md border border-[#CAD8CB] px-4 py-2.5 font-bold text-[#123D2A]">Close</button>
        </div>
      </div>
    </div>
  );
}

type CalculationDetails = {
  title: string;
  calculationMethod: string;
  netSurplus: number | null;
  statutoryReserves: number | null;
  distributableSurplus: number | null;
  interestAllocationRate: number | null;
  totalAverageShareMonth: number | null;
  interestRate: number | null;
  interestAllocationAmount: number | null;
  totalAmount: number;
  qualifiedMemberCount: number | null;
};

type DividendFormValues = {
  name: string;
  coverageStart: string;
  coverageEnd: string;
  availableDate: string;
  netSurplus: string;
  statutoryReservesRate: string;
  interestAllocationRate: string;
  notes: string;
};

type DividendFieldErrors = Partial<Record<keyof DividendFormValues, string>>;

const SUGGESTED_STATUTORY_RESERVES_RATE = "10";
const SUGGESTED_INTEREST_ALLOCATION_RATE = "70";

const completeFiscalYearPeriodMessage = "Use one complete fiscal year (12 months), such as Jan 1 to Dec 31.";

function isCompleteFiscalYearPeriod(coverageStart: string, coverageEnd: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(coverageStart);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(coverageEnd)) return false;

  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const expectedEnd = new Date(Date.UTC(startYear + 1, startMonth - 1, startDay));
  expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);
  const formattedEnd = [
    expectedEnd.getUTCFullYear().toString().padStart(4, "0"),
    (expectedEnd.getUTCMonth() + 1).toString().padStart(2, "0"),
    expectedEnd.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
  return formattedEnd === coverageEnd;
}

function getDefaultDividendForm(): DividendFormValues {
  const year = new Date().getFullYear();
  return {
    name: "",
    coverageStart: `${year}-01-01`,
    coverageEnd: `${year}-12-31`,
    availableDate: "",
    netSurplus: "",
    statutoryReservesRate: SUGGESTED_STATUTORY_RESERVES_RATE,
    interestAllocationRate: SUGGESTED_INTEREST_ALLOCATION_RATE,
    notes: "",
  };
}

function CalculationModal({ details, onClose }: { details: CalculationDetails; onClose: () => void }) {
  const isLegacy = details.calculationMethod !== "Interest on Share Capital - Average Share Month";
  const hasAverageShareMonth = details.totalAverageShareMonth !== null && details.totalAverageShareMonth > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="calculation-modal-title" className="max-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Calculation details</p>
            <h3 id="calculation-modal-title" className="mt-1 text-xl font-black text-[#123D2A]">{details.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#CAD8CB] p-2" aria-label="Close calculation details"><X className="size-4" /></button>
        </div>

        <div className="mt-5 rounded-xl bg-[#F4F7F2] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Calculation method</p>
          <p className="mt-1 font-bold text-[#123D2A]">{details.calculationMethod}</p>
        </div>

        {isLegacy ? (
          <div className="mt-4 rounded-xl border border-[#E7DDBD] bg-[#FFF9E8] p-4 text-sm leading-6 text-[#6E5B1C]">
            This is a legacy declaration created using the old Share Capital Balance Percentage method. It has no stored net surplus, statutory reserves, or Average Share Month values. Create a new declaration to use the CDA-based calculation.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-[#E5ECE5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Net surplus</p><p className="mt-1 font-black text-[#123D2A]">{money(details.netSurplus ?? 0)}</p></div>
              <div className="rounded-lg border border-[#E5ECE5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Statutory reserves</p><p className="mt-1 font-black text-[#123D2A]">{money(details.statutoryReserves ?? 0)}</p></div>
              <div className="rounded-lg border border-[#E5ECE5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Distributable surplus</p><p className="mt-1 font-black text-[#123D2A]">{money(details.distributableSurplus ?? 0)}</p></div>
              <div className="rounded-lg border border-[#E5ECE5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">ISC allocation</p><p className="mt-1 font-black text-[#123D2A]">{details.interestAllocationRate ?? 0}%</p></div>
              <div className="rounded-lg border border-[#E5ECE5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Total average share month</p><p className="mt-1 font-black text-[#123D2A]">{money(details.totalAverageShareMonth ?? 0)}</p></div>
              <div className="rounded-lg border border-[#E5ECE5] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Qualified members</p><p className="mt-1 font-black text-[#123D2A]">{details.qualifiedMemberCount ?? 0}</p></div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3 md:items-stretch">
            <div className="rounded-xl border border-[#CAD8CB] bg-[#F7FAF5] p-4 md:col-span-2">
              <p className="font-black text-[#123D2A]">Formula breakdown</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[#42594B]">
                <p><strong>1.</strong> {money(details.netSurplus ?? 0)} - {money(details.statutoryReserves ?? 0)} = <strong>{money(details.distributableSurplus ?? 0)}</strong> distributable surplus</p>
                <p><strong>2.</strong> {money(details.distributableSurplus ?? 0)} × {details.interestAllocationRate ?? 0}% = <strong>{money(details.interestAllocationAmount ?? details.totalAmount)}</strong> Interest on Share Capital pool</p>
                <p><strong>3.</strong> {hasAverageShareMonth ? `${money(details.interestAllocationAmount ?? details.totalAmount)} ÷ ${money(details.totalAverageShareMonth ?? 0)} = ${interestRate(details.interestRate)}` : "No Average Share Month is available to calculate the rate."}</p>
                <p><strong>4.</strong> Member interest = member&apos;s Average Share Month × computed rate</p>
              </div>
            </div>

            <div className="flex flex-col rounded-lg bg-[#123D2A] p-4 text-white md:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide text-[#C5E7CF]">Interest pool / declared total</p>
              <p className="mt-1 text-2xl font-black">{money(details.totalAmount)}</p>
              <p className="mt-2 text-xs leading-5 text-[#D7EBDD] md:mt-auto md:pt-4">The member amounts are calculated from the monthly paid-up share balances and rounded to the centavo.</p>
            </div>
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end"><button type="button" onClick={onClose} className="rounded-md border border-[#CAD8CB] px-4 py-2.5 font-bold text-[#123D2A]">Close</button></div>
      </div>
    </div>
  );
}


export function DividendManagementPanel({ role }: { role: "chairman" | "bookkeeper" }) {
  const [declarations, setDeclarations] = useState<DividendDeclaration[]>([]);
  const [publishedDeclarations, setPublishedDeclarations] = useState<DividendDeclaration[]>([]);
  const [allActionRequests, setAllActionRequests] = useState<DividendActionRequest[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<DividendDeclarationPreview | null>(null);
  const [financialBasis, setFinancialBasis] = useState<DividendFinancialBasis | null>(null);
  const [financialBasisLoading, setFinancialBasisLoading] = useState(false);
  const [financialBasisError, setFinancialBasisError] = useState("");
  const [calculation, setCalculation] = useState<CalculationDetails | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [showQualifiedMembers, setShowQualifiedMembers] = useState(false);
  const [membersDeclaration, setMembersDeclaration] = useState<DividendDeclaration | null>(null);
  const [publishedMembersDeclaration, setPublishedMembersDeclaration] = useState<DividendDeclaration | null>(null);
  const [declarationMembers, setDeclarationMembers] = useState<DividendDeclarationMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [previewMemberSearch, setPreviewMemberSearch] = useState("");
  const [previewMemberPage, setPreviewMemberPage] = useState(1);
  const [declarationMemberSearch, setDeclarationMemberSearch] = useState("");
  const [declarationMemberPage, setDeclarationMemberPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const financialBasisRequest = useRef(0);
  const previewRequest = useRef(0);
  const membersRequest = useRef(0);
  const autoOpenMembersRef = useRef<string | null>(null);
  const declarationMembersListRef = useRef<HTMLDivElement>(null);
  const membersPanelRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<DividendFormValues>(getDefaultDividendForm());
  const [createFieldErrors, setCreateFieldErrors] = useState<DividendFieldErrors>({});
  const [payout, setPayout] = useState<PayoutForm>(EMPTY_PAYOUT);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [approvalBusyAction, setApprovalBusyAction] = useState<"approve" | "reject" | null>(null);
  const [approvalConfirmation, setApprovalConfirmation] = useState<ApprovalConfirmation>(null);
  const memberPageSize = 5;
  const actionRequestPageSize = 5;
  const [actionRequestPage, setActionRequestPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [approvalHistoryOpen, setApprovalHistoryOpen] = useState(false);
  const [actionHistoryOpen, setActionHistoryOpen] = useState(false);
  const [actionHistory, setActionHistory] = useState<DividendActionRequest[]>([]);
  const [actionHistoryLoading, setActionHistoryLoading] = useState(false);
  const [actionHistoryError, setActionHistoryError] = useState("");
  const [actionHistoryPage, setActionHistoryPage] = useState(1);
  const [actionHistorySearch, setActionHistorySearch] = useState("");
  const [actionHistoryDeclaration, setActionHistoryDeclaration] = useState("all");
  const [fieldInfoOpen, setFieldInfoOpen] = useState(false);
  const panelCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialog?.kind !== "action" || dialog.request.decision !== "Withdraw") return;
    if (dialog.request.withdrawalMethod && dialog.request.withdrawalMethod !== "Cash") return;
    const generatedReference = `CASH-DIV-${dialog.request.id}`;
    // Cash withdrawal references are derived from the selected request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayout((current) => current.referenceNumber ? current : { ...current, referenceNumber: generatedReference });
  }, [dialog]);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      if (role === "chairman") {
        const nextDeclarations = await listDividendDeclarations();
        setDeclarations(nextDeclarations.filter((declaration) => declaration.status !== "Published"));
        setPublishedDeclarations(nextDeclarations.filter((declaration) => declaration.status === "Published"));
        const workflowDeclaration = nextDeclarations.find((declaration) => declaration.status === "Draft" || declaration.status === "Approved");
        if (!silent && workflowDeclaration && autoOpenMembersRef.current === null) {
          autoOpenMembersRef.current = workflowDeclaration.id;
          void openMembers(workflowDeclaration);
        }
      } else setAllActionRequests(await listDividendActionRequests());
      setError("");
    } catch (caught) {
      if (!silent) setError(message(caught));
    } finally {
      inFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, [role]);

  async function openActionHistory() {
    setActionHistoryOpen(true);
    setActionHistoryLoading(true);
    setActionHistoryError("");
    setActionHistoryPage(1);
    setActionHistorySearch("");
    setActionHistoryDeclaration("all");
    try {
      setActionHistory(await listDividendActionHistory());
    } catch (caught) {
      setActionHistory([]);
      setActionHistoryError(message(caught));
    } finally {
      setActionHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!panelOpen) return;
    const firstLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !dialog) void load({ silent: true });
    }, 15_000);
    return () => { window.clearTimeout(firstLoad); window.clearInterval(timer); };
  }, [dialog, load, panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (approvalConfirmation) {
        if (!approvalBusyId) setApprovalConfirmation(null);
        return;
      }
      if (fieldInfoOpen) { setFieldInfoOpen(false); return; }
      if (calculation) { setCalculation(null); return; }
      if (dialog) {
        if (!busy) { setDialog(null); setError(""); }
        return;
      }
      if (actionHistoryOpen) { setActionHistoryOpen(false); return; }
      if (approvalHistoryOpen) { setApprovalHistoryOpen(false); return; }
      if (publishedMembersDeclaration) { setPublishedMembersDeclaration(null); closeMembers(); return; }
      closeMembers();
      setPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [actionHistoryOpen, approvalBusyId, approvalConfirmation, approvalHistoryOpen, busy, calculation, dialog, fieldInfoOpen, panelOpen, publishedMembersDeclaration]);

  useEffect(() => {
    if (panelOpen && !dialog) panelCloseRef.current?.focus();
  }, [dialog, panelOpen]);

  useEffect(() => {
    const requestId = ++financialBasisRequest.current;
    const resetBasis = () => {
      setFinancialBasis(null);
      setFinancialBasisError("");
      setFinancialBasisLoading(false);
    };
    if (dialog?.kind !== "create") {
      const timeoutId = window.setTimeout(resetBasis, 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (!form.coverageStart || !form.coverageEnd || form.coverageEnd < form.coverageStart || !isCompleteFiscalYearPeriod(form.coverageStart, form.coverageEnd)) {
      const timeoutId = window.setTimeout(() => {
        resetBasis();
        setForm((current) => (current.netSurplus ? { ...current, netSurplus: "" } : current));
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    const timeoutId = window.setTimeout(() => {
      if (requestId !== financialBasisRequest.current) return;
      setFinancialBasis(null);
      setFinancialBasisError("");
      setFinancialBasisLoading(true);
      setForm((current) => (current.netSurplus ? { ...current, netSurplus: "" } : current));
      void getDividendFinancialBasis(form.coverageStart, form.coverageEnd)
        .then((nextBasis) => {
          if (requestId !== financialBasisRequest.current) return;
          setFinancialBasis(nextBasis);
          setForm((current) => ({ ...current, netSurplus: nextBasis.netSurplus.toFixed(2) }));
        })
        .catch((caught) => {
          if (requestId !== financialBasisRequest.current) return;
          setFinancialBasisError(message(caught));
        })
        .finally(() => {
          if (requestId === financialBasisRequest.current) setFinancialBasisLoading(false);
        });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [dialog?.kind, form.coverageStart, form.coverageEnd]);

  useEffect(() => {
    const requestId = ++previewRequest.current;
    if (dialog?.kind !== "create") return;
    if (!isCompleteFiscalYearPeriod(form.coverageStart, form.coverageEnd) || financialBasisLoading || !financialBasis || financialBasis.coverageStart !== form.coverageStart || financialBasis.coverageEnd !== form.coverageEnd) {
      const resetTimeout = window.setTimeout(() => {
        if (requestId !== previewRequest.current) return;
        setPreview(null);
        setPreviewError("");
        setPreviewLoading(false);
      }, 0);
      return () => window.clearTimeout(resetTimeout);
    }
    const netSurplus = Number(form.netSurplus);
    const statutoryReservesRate = Number(form.statutoryReservesRate);
    const statutoryReserves = netSurplus * (statutoryReservesRate / 100);
    const interestAllocationRate = Number(form.interestAllocationRate);
    const timeoutId = window.setTimeout(() => {
      if (!form.coverageStart || !form.coverageEnd || form.netSurplus === "" || form.statutoryReservesRate === "" || form.interestAllocationRate === "" || !Number.isFinite(netSurplus) || netSurplus < 0 || !Number.isFinite(statutoryReservesRate) || statutoryReservesRate < 0 || statutoryReservesRate > 100 || !Number.isFinite(statutoryReserves) || !Number.isFinite(interestAllocationRate) || interestAllocationRate < 0 || interestAllocationRate > 70) {
        setPreview(null);
        setPreviewError("");
        setPreviewLoading(false);
        return;
      }
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(true);
      void previewDividendDeclaration({ coverageStart: form.coverageStart, coverageEnd: form.coverageEnd, netSurplus, statutoryReserves, interestAllocationRate })
        .then((nextPreview) => {
          if (requestId === previewRequest.current) setPreview(nextPreview);
        })
        .catch((caught) => {
          if (requestId !== previewRequest.current) return;
          setPreview(null);
          setPreviewError(message(caught));
        })
        .finally(() => {
          if (requestId === previewRequest.current) setPreviewLoading(false);
        });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [dialog?.kind, financialBasis, financialBasisLoading, form.coverageStart, form.coverageEnd, form.netSurplus, form.statutoryReservesRate, form.interestAllocationRate]);

  function closeDialog() {
    if (busy) return;
    const closingMembersDialog = dialog?.kind === "members";
    financialBasisRequest.current += 1;
    previewRequest.current += 1;
    setDialog(null);
    setFinancialBasis(null);
    setFinancialBasisError("");
    setFinancialBasisLoading(false);
    setError("");
    setPreview(null);
    setCalculation(null);
    setPreviewError("");
    setPreviewLoading(false);
    setShowQualifiedMembers(false);
    setPreviewMemberSearch("");
    setPreviewMemberPage(1);
    setDeclarationMemberSearch("");
    setDeclarationMemberPage(1);
    setCreateFieldErrors({});
    setFieldInfoOpen(false);
    setPayout(EMPTY_PAYOUT);
    if (closingMembersDialog) closeMembers();
  }

  function formFieldClass(field: keyof DividendFormValues, extras = "h-11") {
    const invalid = Boolean(createFieldErrors[field]);
    return `mt-1 ${extras} w-full rounded-md border px-3 font-normal ${invalid ? "border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-100" : "border-[#CAD8CB] focus:border-[#1F6B43] focus:ring-[#82E6A7]/20"} focus:outline-none focus:ring-4`;
  }

  function updateFormField(field: keyof DividendFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setCreateFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError("");
  }

  function openPreviewCalculation(value: DividendDeclarationPreview) {
    setCalculation({
      title: form.name.trim() || "New Annual Interest on Share Capital declaration",
      calculationMethod: value.calculationMethod,
      netSurplus: value.netSurplus,
      statutoryReserves: value.statutoryReserves,
      distributableSurplus: value.distributableSurplus,
      interestAllocationRate: value.interestAllocationRate,
      totalAverageShareMonth: value.totalAverageShareMonth,
      interestRate: value.interestRate,
      interestAllocationAmount: value.interestAllocationAmount,
      totalAmount: value.dividendPool,
      qualifiedMemberCount: value.qualifiedMemberCount,
    });
  }

  function openDeclarationCalculation(declaration: DividendDeclaration) {
    const distributableSurplus = declaration.netSurplus !== null && declaration.statutoryReserves !== null
      ? Math.max(0, declaration.netSurplus - declaration.statutoryReserves)
      : null;
    setCalculation({
      title: declaration.name,
      calculationMethod: declaration.calculationMethod,
      netSurplus: declaration.netSurplus,
      statutoryReserves: declaration.statutoryReserves,
      distributableSurplus,
      interestAllocationRate: declaration.interestAllocationRate,
      totalAverageShareMonth: declaration.totalAverageShareMonth,
      interestRate: declaration.interestRate,
      interestAllocationAmount: declaration.status === "Draft" || declaration.status === "Approved" || declaration.status === "Published"
        ? declaration.totalDeclaredAmount
        : null,
      totalAmount: declaration.totalDeclaredAmount,
      qualifiedMemberCount: declaration.memberCount,
    });
  }

  async function openMembers(declaration: DividendDeclaration) {
    const requestId = ++membersRequest.current;
    autoOpenMembersRef.current = declaration.id;
    setError("");
    setMembersDeclaration(declaration);
    setDeclarationMembers([]);
    setMembersError("");
    setMembersLoading(true);
    setDeclarationMemberSearch("");
    setDeclarationMemberPage(1);
    try {
      const members = await listDividendDeclarationMembers(declaration.id);
      if (requestId === membersRequest.current) setDeclarationMembers(members);
    } catch (caught) {
      if (requestId === membersRequest.current) setMembersError(message(caught));
    } finally {
      if (requestId === membersRequest.current) setMembersLoading(false);
    }
  }

  function openMembersModal(declaration: DividendDeclaration) {
    setApprovalHistoryOpen(false);
    setPublishedMembersDeclaration(null);
    closeMembers();
    setDialog({ kind: "members", declaration });
    void openMembers(declaration);
  }

  function openPublishedMembersModal(declaration: DividendDeclaration) {
    setApprovalHistoryOpen(false);
    setDialog(null);
    setPublishedMembersDeclaration(declaration);
    closeMembers();
    void openMembers(declaration);
  }

  function closePublishedMembersModal() {
    setPublishedMembersDeclaration(null);
    closeMembers();
  }

  function closeMembers() {
    membersRequest.current += 1;
    setMembersDeclaration(null);
    setDeclarationMembers([]);
    setMembersError("");
    setMembersLoading(false);
    setDeclarationMemberSearch("");
    setDeclarationMemberPage(1);
  }

  function openPanel() {
    autoOpenMembersRef.current = null;
    setPublishedMembersDeclaration(null);
    closeMembers();
    setDeclarations([]);
    setPublishedDeclarations([]);
    setLoading(true);
    setApprovalHistoryOpen(false);
    setFieldInfoOpen(false);
    setError("");
    setPanelOpen(true);
  }

  function openCreateDialog() {
    setError("");
    setCreateFieldErrors({});
    setFinancialBasis(null);
    setFinancialBasisError("");
    setFinancialBasisLoading(false);
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(false);
    setShowQualifiedMembers(false);
    setPreviewMemberSearch("");
    setPreviewMemberPage(1);
    setForm(getDefaultDividendForm());
    setDialog({ kind: "create" });
  }

  useEffect(() => {
    if (!membersDeclaration) return;
    const frame = window.requestAnimationFrame(() => {
      declarationMembersListRef.current?.scrollTo({ top: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [membersDeclaration, declarationMemberPage, declarationMemberSearch, declarationMembers.length]);

  useEffect(() => {
    if (!membersDeclaration) return;
    const frame = window.requestAnimationFrame(() => {
      membersPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [membersDeclaration]);

  function validateCreateForm() {
    const netSurplus = Number(form.netSurplus);
    const statutoryReservesRate = Number(form.statutoryReservesRate);
    const statutoryReserves = netSurplus * (statutoryReservesRate / 100);
    const interestAllocationRate = Number(form.interestAllocationRate);
    const errors: DividendFieldErrors = {};

    if (!form.name.trim()) errors.name = "Enter a declaration name.";
    if (!form.coverageStart) errors.coverageStart = "Select a coverage start date.";
    if (!form.coverageEnd) errors.coverageEnd = "Select a coverage end date.";
    if (form.coverageStart && form.coverageEnd && form.coverageEnd < form.coverageStart) {
      errors.coverageStart = "Start date must be on or before the coverage end date.";
      errors.coverageEnd = "End date must be on or after the coverage start date.";
    } else if (form.coverageStart && form.coverageEnd && !isCompleteFiscalYearPeriod(form.coverageStart, form.coverageEnd)) {
      errors.coverageStart = completeFiscalYearPeriodMessage;
      errors.coverageEnd = completeFiscalYearPeriodMessage;
    }
    if (!form.availableDate) errors.availableDate = "Select a distribution date.";

    if (form.netSurplus === "") errors.netSurplus = "Select valid coverage dates to calculate net surplus.";
    else if (!Number.isFinite(netSurplus) || netSurplus < 0) errors.netSurplus = "Enter a valid non-negative net surplus.";

    if (form.statutoryReservesRate === "") errors.statutoryReservesRate = "Enter the statutory-reserve percentage.";
    else if (!Number.isFinite(statutoryReservesRate) || statutoryReservesRate < 0 || statutoryReservesRate > 100) errors.statutoryReservesRate = "Enter a percentage from 0 to 100.";

    if (form.interestAllocationRate === "") errors.interestAllocationRate = "Enter the Interest on Share Capital allocation percentage.";
    else if (!Number.isFinite(interestAllocationRate) || interestAllocationRate < 0 || interestAllocationRate > 70) errors.interestAllocationRate = "Enter a percentage from 0 to 70.";

    setCreateFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Complete the highlighted fields before creating the draft.");
      return null;
    }

    return { netSurplus, statutoryReserves, interestAllocationRate };
  }

  async function submitCreate() {
    const validated = validateCreateForm();
    if (!validated) return;
    const { netSurplus, statutoryReserves, interestAllocationRate } = validated;
    if (previewLoading) {
      setError("Wait for the qualified-member preview to finish calculating.");
      return;
    }
    if (!financialBasis || financialBasis.coverageStart !== form.coverageStart || financialBasis.coverageEnd !== form.coverageEnd || financialBasis.netSurplus !== netSurplus) {
      setError(financialBasisError || "Wait for the selected-date net surplus to finish calculating.");
      return;
    }
    if (!preview || preview.netSurplus !== netSurplus || preview.statutoryReserves !== statutoryReserves || preview.interestAllocationRate !== interestAllocationRate || preview.calculationMethod !== "Interest on Share Capital - Average Share Month") {
      setError(previewError || "Preview the qualified members before creating this declaration.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await createDividendDeclaration({
        name: form.name.trim(),
        coverageStart: form.coverageStart,
        coverageEnd: form.coverageEnd,
        availableAt: `${form.availableDate}T00:00:00+08:00`,
        netSurplus,
        statutoryReserves,
        interestAllocationRate,
        notes: form.notes.trim() || null,
      });
      toast.success("Dividend declaration created. Review it before publishing.");
      setForm(getDefaultDividendForm());
      setCreateFieldErrors({});
      setDialog(null);
      setPreview(null);
      setPreviewError("");
      await load({ silent: true });
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submitPublish(declaration: DividendDeclaration) {
    setBusy(true);
    setError("");
    try {
      await publishDividendDeclaration(declaration.id);
      toast.success("Dividend published and made available to members.");
      await load({ silent: true });
      setDialog(null);
      closeMembers();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  function approveDraft(declaration: DividendDeclaration) {
    setError("");
    setApprovalConfirmation({ action: "approve", declaration });
  }

  function rejectDraft(declaration: DividendDeclaration) {
    setError("");
    setApprovalConfirmation({ action: "reject", declaration });
  }

  async function confirmApprovalAction() {
    if (!approvalConfirmation || approvalBusyId) return;
    const { action, declaration } = approvalConfirmation;
    setApprovalBusyId(declaration.id);
    setApprovalBusyAction(action);
    setError("");
    try {
      if (action === "approve") {
        await approveDividendDeclaration(declaration.id);
        toast.success("Dividend declaration approved. It is ready for publication.");
        await load({ silent: true });
        setMembersDeclaration((current) => current?.id === declaration.id ? { ...current, status: "Approved" } : current);
      } else {
        await rejectDividendDeclaration(declaration.id);
        toast.success("Dividend declaration rejected and removed from the approval queue.");
        await load({ silent: true });
        closeMembers();
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setApprovalBusyId(null);
      setApprovalBusyAction(null);
      setApprovalConfirmation(null);
    }
  }

  function handlePayoutReceipt(file: File | undefined) {
    if (!file) return;
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Receipt must be a PDF, PNG, JPG, or WebP file.");
      return;
    }
    if (file.size > 600 * 1024) {
      setError("Receipt must be 600 KB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setPayout((current) => ({
        ...current,
        withdrawalReceipt: result,
        withdrawalReceiptName: file.name,
      }));
      setError("");
    };
    reader.onerror = () => setError("The receipt could not be read.");
    reader.readAsDataURL(file);
  }

  async function submitDividendAction(request: DividendActionRequest) {
    const isCashPayout = request.decision === "Withdraw" && (!request.withdrawalMethod || request.withdrawalMethod === "Cash");
    const referenceNumber = payout.referenceNumber.trim() || (isCashPayout ? `CASH-DIV-${request.id}` : "");
    if (request.decision === "Withdraw" && !isCashPayout && referenceNumber.length < 2) {
      setError("Enter the official payout reference number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await completeDividendAction(request.id, {
        referenceNumber: request.decision === "Withdraw" ? referenceNumber : "",
        notes: payout.notes.trim() || null,
        withdrawalReceipt: request.decision === "Withdraw" ? payout.withdrawalReceipt : null,
        withdrawalReceiptName: request.decision === "Withdraw" ? payout.withdrawalReceiptName.trim() || null : null,
      });
      toast.success(request.decision === "Withdraw"
        ? "Dividend withdrawal completed and recorded in the financial ledger."
        : "Dividend added to Share Capital and recorded in the ledger.");
      setPayout(EMPTY_PAYOUT);
      setDialog(null);
      await load({ silent: true });
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  const filteredPreviewMembers = preview?.qualifiedMembers.filter((member) => matchesMemberSearch(member, previewMemberSearch)) ?? [];
  const previewPageCount = Math.max(1, Math.ceil(filteredPreviewMembers.length / memberPageSize));
  const currentPreviewMemberPage = Math.min(previewMemberPage, previewPageCount);
  const visiblePreviewMembers = filteredPreviewMembers.slice(
    (currentPreviewMemberPage - 1) * memberPageSize,
    currentPreviewMemberPage * memberPageSize,
  );
  const filteredDeclarationMembers = declarationMembers.filter((member) => matchesMemberSearch(member, declarationMemberSearch));
  const declarationPageCount = Math.max(1, Math.ceil(filteredDeclarationMembers.length / memberPageSize));
  const currentDeclarationMemberPage = Math.min(declarationMemberPage, declarationPageCount);
  const visibleDeclarationMembers = filteredDeclarationMembers.slice(
    (currentDeclarationMemberPage - 1) * memberPageSize,
    currentDeclarationMemberPage * memberPageSize,
  );
  const actionRequestPageCount = Math.max(1, Math.ceil(allActionRequests.length / actionRequestPageSize));
  const currentActionRequestPage = Math.min(actionRequestPage, actionRequestPageCount);
  const actionRequests = allActionRequests.slice(
    (currentActionRequestPage - 1) * actionRequestPageSize,
    currentActionRequestPage * actionRequestPageSize,
  );
  const actionHistoryPageSize = 5;
  const actionHistoryDeclarations = Array.from(new Set(actionHistory.map((item) => item.declarationName))).sort((left, right) => left.localeCompare(right));
  const normalizedActionHistorySearch = actionHistorySearch.trim().toLowerCase();
  const filteredActionHistory = actionHistory.filter((item) => {
    const matchesDeclaration = actionHistoryDeclaration === "all" || item.declarationName === actionHistoryDeclaration;
    const searchableText = [item.memberName, item.memberCode, item.declarationName, item.withdrawalMethod, item.withdrawalProvider, item.withdrawalReference]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesDeclaration && (!normalizedActionHistorySearch || searchableText.includes(normalizedActionHistorySearch));
  });
  const actionHistoryPageCount = Math.max(1, Math.ceil(filteredActionHistory.length / actionHistoryPageSize));
  const currentActionHistoryPage = Math.min(actionHistoryPage, actionHistoryPageCount);
  const visibleActionHistory = filteredActionHistory.slice(
    (currentActionHistoryPage - 1) * actionHistoryPageSize,
    currentActionHistoryPage * actionHistoryPageSize,
  );
  useEffect(() => {
    // Keep pagination within the available result pages after async refreshes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActionRequestPage((page) => Math.min(page, actionRequestPageCount));
  }, [actionRequestPageCount]);
  useEffect(() => {
    // Keep pagination within the available result pages after async refreshes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActionHistoryPage((page) => Math.min(page, actionHistoryPageCount));
  }, [actionHistoryPageCount]);
  const coverageConflict = findCoverageConflict([...declarations, ...publishedDeclarations], form.coverageStart, form.coverageEnd);
  const mainPanelReady = !loading && (
    role !== "chairman"
    || membersDeclaration === null
    || !membersLoading
  );

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43]"
      >
        {role === "chairman" ? "Open Annual Interest declarations" : "Open Annual Interest requests"}
      </button>
      {panelOpen && mainPanelReady && !dialog && !calculation && !approvalHistoryOpen && !actionHistoryOpen && !approvalConfirmation && !fieldInfoOpen && !publishedMembersDeclaration ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dividend-panel-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !dialog) setPanelOpen(false); }}
        >
          <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:max-w-[min(96vw,1600px)]">
            <div className="flex shrink-0 flex-col gap-4 border-b border-[#E2E8E2] px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Annual Interest</p><h2 id="dividend-panel-title" className="mt-1 text-xl font-black text-[#123D2A]">{role === "chairman" ? "Annual Interest declarations" : "Annual Interest requests"}</h2><p className="mt-1 text-sm text-[#5D6D63]">{role === "chairman" ? "Annual fiscal-year Interest on Share Capital declaration using monthly paid-up share balances." : "Process member withdrawal and Share Capital requests with Bookkeeper approval."}</p></div>
              <div className="flex shrink-0 items-center gap-2">{role === "chairman" ? <button type="button" disabled={Boolean(dialog)} onClick={() => { setError(""); setApprovalHistoryOpen(true); }} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] px-3 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:opacity-50"><History className="size-4" /> Publish history</button> : <button type="button" disabled={actionHistoryLoading} onClick={() => void openActionHistory()} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-50"><History className="size-4" /> History</button>}{role === "chairman" ? <button type="button" disabled={Boolean(dialog)} onClick={openCreateDialog} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-50"><Plus className="size-4" /> New declaration</button> : null}<button ref={panelCloseRef} type="button" disabled={Boolean(dialog)} onClick={() => setPanelOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#CAD8CB] p-0 text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:opacity-50" aria-label="Close Annual Interest panel"><X className="size-4" /></button></div>
            </div>
            <div className="flex min-h-0 flex-col overflow-y-auto">
              {error && !dialog ? <div className="p-6"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
              {role === "chairman" && membersDeclaration ? (
        <div ref={membersPanelRef} className="dividend-members-panel order-last shrink-0 bg-[#F7FAF5] p-6 sm:p-7" aria-labelledby="dividend-members-title">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1F6B43]">Member allocations</p>
                      <h3 id="dividend-members-title" className="mt-1 text-lg font-black text-[#123D2A]">{membersDeclaration.name}</h3>
                      <p className="mt-1 text-sm text-[#6C7A70]">{membersDeclaration.memberCount} members · <CurrencyDisplay value={membersDeclaration.totalDeclaredAmount} /></p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-end">
                      <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto" aria-label="Coverage period">
                        <div className="min-w-[132px] rounded-lg border border-[#DDE8DD] bg-white px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A887F]">Coverage start</p>
                          <p className="mt-1 text-sm font-bold leading-5 text-[#123D2A]">{date(membersDeclaration.coverageStart)}</p>
                        </div>
                        <div className="min-w-[132px] rounded-lg border border-[#DDE8DD] bg-white px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A887F]">Coverage end</p>
                          <p className="mt-1 text-sm font-bold leading-5 text-[#123D2A]">{date(membersDeclaration.coverageEnd)}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => openDeclarationCalculation(membersDeclaration)} className="inline-flex h-10 items-center rounded-md border border-[#123D2A] bg-[#123D2A] px-3 text-xs font-bold text-white transition hover:bg-[#1F6B43]">View full calculation</button>
                    </div>
                  </div>
                  <div className="mt-6 rounded-xl border border-[#DDE8DD] bg-white p-4 shadow-sm sm:p-5">
                    {membersLoading ? <p className="text-sm font-semibold text-[#5D6D63]">Loading member allocations...</p> : membersError ? <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between"><span>{membersError}</span><button type="button" onClick={() => openMembersModal(membersDeclaration)} className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-red-300 px-3 text-xs font-bold text-red-800 hover:bg-red-100">Try again</button></div> : declarationMembers.length ? <div><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] lg:items-end"><MemberSearch inputId="declaration-member-search" search={declarationMemberSearch} onSearchChange={(value) => { setDeclarationMemberSearch(value); setDeclarationMemberPage(1); }} />{membersDeclaration.status === "Draft" || membersDeclaration.status === "Approved" ? <DeclarationActionCard declaration={membersDeclaration} approvalBusyId={approvalBusyId} approvalBusyAction={approvalBusyAction} onApprove={approveDraft} onReject={rejectDraft} onPublish={(declaration) => { setError(""); setDialog({ kind: "publish", declaration }); }} /> : null}</div><div ref={declarationMembersListRef} className="mt-3 max-h-80 overflow-auto overscroll-contain rounded-lg border border-[#DDE8DD] bg-white"><table className="min-w-[900px] text-left text-sm"><thead className="sticky top-0 z-10 bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3 text-right">Average share month</th><th className="px-4 py-3 text-right">Interest</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Decision</th></tr></thead><tbody className="divide-y divide-[#EEF2EC]">{visibleDeclarationMembers.map((member) => <tr key={member.memberId}><td className="px-4 py-3"><p className="font-bold text-[#123D2A]">{member.memberName}</p><p className="text-xs text-[#6C7A70]">{member.memberCode}</p></td><td className="px-4 py-3 text-xs text-[#5D6D63]">{member.membershipType}</td><td className="px-4 py-3 text-right">{money(member.averageShareMonth)}</td><td className="px-4 py-3 text-right font-bold text-[#123D2A]">{money(member.dividendAmount)}</td><td className="px-4 py-3"><StatusBadge tone={member.status === "Available" || member.status === "Added to Share Capital" || member.status === "Withdrawn" ? "success" : "warning"}>{member.status}</StatusBadge></td><td className="px-4 py-3 text-xs text-[#5D6D63]">{member.decision ?? "-"}</td></tr>)}</tbody></table></div><MemberPagination page={currentDeclarationMemberPage} pageCount={declarationPageCount} total={filteredDeclarationMembers.length} onPrevious={() => setDeclarationMemberPage((page) => Math.max(1, page - 1))} onNext={() => setDeclarationMemberPage((page) => Math.min(declarationPageCount, page + 1))} /></div> : <p className="rounded-lg border border-[#E7DDBD] bg-[#FFF9E8] p-3 text-sm font-semibold text-[#6E5B1C]">No member allocations were found for this declaration.</p>}
                  </div>
                </div>
              ) : null}
      {role === "chairman" ? declarations.length ? <DataTable><table className="min-w-[940px] w-full text-left text-sm"><thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Declaration</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3 text-right">Rate / ASM</th><th className="px-4 py-3 text-right">Declared total</th><th className="px-4 py-3 text-center">Members</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#E5ECE5]">{declarations.map((item) => <tr key={item.id}><td className="px-4 py-4"><p className="font-bold text-[#123D2A]">{item.name}</p><p className="mt-1 text-xs text-[#6C7A70]">{item.calculationMethod}</p></td><td className="px-4 py-4">{date(item.coverageStart)} - {date(item.coverageEnd)}</td><td className="px-4 py-4 text-right font-bold">{interestRate(item.interestRate)}</td><td className="px-4 py-4 text-right"><CurrencyDisplay value={item.totalDeclaredAmount} /></td><td className="px-4 py-4 text-center">{item.memberCount}</td><td className="px-4 py-4"><StatusBadge tone={item.status === "Published" ? "success" : item.status === "Cancelled" ? "danger" : "warning"}>{item.status}</StatusBadge></td><td className="px-4 py-4 text-right"><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={Boolean(dialog)} onClick={() => openMembersModal(item)} className="inline-flex items-center gap-2 rounded-md border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-50"><Eye className="size-3.5" /> Members</button>{item.status === "Approved" ? <button type="button" disabled={Boolean(dialog)} onClick={() => { setError(""); setDialog({ kind: "publish", declaration: item }); }} className="inline-flex items-center gap-2 rounded-md bg-[#123D2A] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-50"><Send className="size-3.5" /> Publish</button> : item.status === "Draft" ? <span className="self-center text-xs font-semibold text-[#6C7A70]">Awaiting approval</span> : <span className="self-center text-xs text-[#6C7A70]">{item.capitalizedCount} capitalized - {item.withdrawnCount} withdrawn</span>}</div></td></tr>)}</tbody></table></DataTable> : !loading && !error ? <div className="p-6"><EmptyState icon={HandCoins} title="No annual declaration yet" description="Create a draft to calculate Interest on Share Capital from approved net surplus and average paid-up share months." /></div> : null : actionRequests.length ? <DividendActionRequestTable requests={actionRequests} pageSize={actionRequestPageSize} dialogOpen={Boolean(dialog)} onOpen={(item) => { setError(""); setPayout(EMPTY_PAYOUT); setDialog({ kind: "action", request: item }); }} /> : !loading && !error ? <div className="p-6"><EmptyState icon={WalletCards} title="No Annual Interest requests" description="Member withdrawal and Share Capital requests will appear here automatically." /></div> : null}
      {role === "bookkeeper" && allActionRequests.length ? <div className="px-6 pb-6 sm:px-7"><MemberPagination page={currentActionRequestPage} pageCount={actionRequestPageCount} total={allActionRequests.length} label="request" onPrevious={() => setActionRequestPage((page) => Math.max(1, page - 1))} onNext={() => setActionRequestPage((page) => Math.min(actionRequestPageCount, page + 1))} /></div> : null}

            </div>
          </div>
        </div>
      ) : null}

      {approvalConfirmation ? (
        <ApprovalConfirmationModal
          confirmation={approvalConfirmation}
          busy={approvalBusyId !== null}
          onCancel={() => setApprovalConfirmation(null)}
          onConfirm={() => void confirmApprovalAction()}
        />
      ) : null}

      {approvalHistoryOpen && !approvalConfirmation && !fieldInfoOpen && !calculation && !dialog ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="publish-history-title" className="max-h-[calc(100vh-1rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Published Annual Interest</p><h3 id="publish-history-title" className="mt-1 text-xl font-black text-[#123D2A]">Publish history</h3></div>
              <button type="button" onClick={() => setApprovalHistoryOpen(false)} className="rounded-md border border-[#CAD8CB] p-2 text-[#123D2A]" aria-label="Close publish history"><X className="size-4" /></button>
            </div>
            <PublishHistoryView declarations={publishedDeclarations} onViewMembers={openPublishedMembersModal} />
            <div className="mt-6 flex justify-end border-t border-[#E5ECE5] pt-5"><button type="button" onClick={() => setApprovalHistoryOpen(false)} className="rounded-md border border-[#CAD8CB] px-4 py-2.5 font-bold text-[#123D2A]">Close</button></div>
          </div>
        </div>
      ) : null}

      {actionHistoryOpen && !approvalConfirmation && !approvalHistoryOpen && !fieldInfoOpen && !calculation && !dialog ? (
        <DividendActionHistoryModal
          history={visibleActionHistory}
          loading={actionHistoryLoading}
          error={actionHistoryError}
          search={actionHistorySearch}
          declarationFilter={actionHistoryDeclaration}
          declarations={actionHistoryDeclarations}
          page={currentActionHistoryPage}
          pageCount={actionHistoryPageCount}
          total={filteredActionHistory.length}
          onSearchChange={(value) => { setActionHistorySearch(value); setActionHistoryPage(1); }}
          onDeclarationChange={(value) => { setActionHistoryDeclaration(value); setActionHistoryPage(1); }}
          onPrevious={() => setActionHistoryPage((page) => Math.max(1, page - 1))}
          onNext={() => setActionHistoryPage((page) => Math.min(actionHistoryPageCount, page + 1))}
          onClose={() => setActionHistoryOpen(false)}
        />
      ) : null}

      {publishedMembersDeclaration && !approvalConfirmation && !approvalHistoryOpen && !fieldInfoOpen && !calculation ? (
        <PublishedMembersModal
          declaration={publishedMembersDeclaration}
          members={declarationMembers}
          visibleMembers={visibleDeclarationMembers}
          loading={membersLoading}
          error={membersError}
          search={declarationMemberSearch}
          page={currentDeclarationMemberPage}
          pageCount={declarationPageCount}
          total={filteredDeclarationMembers.length}
          onSearchChange={(value) => { setDeclarationMemberSearch(value); setDeclarationMemberPage(1); }}
          onPrevious={() => setDeclarationMemberPage((page) => Math.max(1, page - 1))}
          onNext={() => setDeclarationMemberPage((page) => Math.min(declarationPageCount, page + 1))}
          onViewCalculation={() => openDeclarationCalculation(publishedMembersDeclaration)}
          onClose={closePublishedMembersModal}
        />
      ) : null}

      {!approvalConfirmation && !approvalHistoryOpen && (fieldInfoOpen ? <FieldInfoModal onClose={() => setFieldInfoOpen(false)} /> : dialog && !calculation ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className={`${dialog.kind === "action" ? "dividend-action-modal w-full max-w-4xl overflow-visible p-4" : "max-h-[calc(100vh-1rem)] w-full max-w-3xl overflow-y-auto p-6"} rounded-2xl bg-white shadow-2xl`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Annual Interest workflow{dialog.kind === "create" ? " · Annual fiscal year" : ""}</p><h3 className="mt-1 text-xl font-black text-[#123D2A]">{dialog.kind === "create" ? "New Annual Interest on Share Capital declaration" : dialog.kind === "members" ? "Member allocations" : dialog.kind === "publish" ? "Publish Annual Interest declaration?" : dialog.request.decision === "Withdraw" ? "Complete Annual Interest withdrawal" : "Approve Share Capital addition"}</h3></div><button type="button" disabled={busy} onClick={closeDialog} className="rounded-md border border-[#CAD8CB] p-2" aria-label="Close"><X className="size-4" /></button></div>
        {dialog.kind === "create" ? <div className="mt-5 space-y-5">{coverageConflict ? <div role="alert" className="rounded-lg border border-[#E7DDBD] bg-[#FFF9E8] p-3 text-sm font-semibold text-[#6E5B1C]">This coverage period overlaps with an existing {coverageConflict.status.toLowerCase()} declaration: <strong>{coverageConflict.name}</strong>. Use a different period or finish the existing workflow first.</div> : null}<div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-sm font-bold text-[#294B39]">Declaration name<input value={form.name} onChange={(event) => updateFormField("name", event.target.value)} className={formFieldClass("name")} /><FieldError message={createFieldErrors.name} /></label><label className="text-sm font-bold text-[#294B39]">Coverage start<input type="date" value={form.coverageStart} onChange={(event) => updateFormField("coverageStart", event.target.value)} className={formFieldClass("coverageStart")} /><FieldError message={createFieldErrors.coverageStart} /></label><label className="text-sm font-bold text-[#294B39]">Coverage end<input type="date" value={form.coverageEnd} onChange={(event) => updateFormField("coverageEnd", event.target.value)} className={formFieldClass("coverageEnd")} /><FieldError message={createFieldErrors.coverageEnd} /></label><label className="text-sm font-bold text-[#294B39]">Distribution date<input type="date" value={form.availableDate} onChange={(event) => updateFormField("availableDate", event.target.value)} className={formFieldClass("availableDate")} /><FieldError message={createFieldErrors.availableDate} /></label><label className="text-sm font-bold text-[#294B39]">Net surplus<input type="number" min="0" step="0.01" value={form.netSurplus} readOnly aria-readonly="true" className={formFieldClass("netSurplus", "h-11 bg-[#F4F7F2]")} /><FieldError message={createFieldErrors.netSurplus} />{createFieldErrors.netSurplus ? null : financialBasisLoading ? <span className="mt-1 block text-xs font-semibold text-[#6C7A70]">Computing from posted financial records...</span> : financialBasisError ? <span className="mt-1 block text-xs font-semibold text-red-700">{financialBasisError}</span> : financialBasis ? <span className="mt-1 block text-xs font-semibold text-[#5D6D63]">Auto-calculated from posted financial records for the selected dates.</span> : <span className="mt-1 block text-xs font-semibold text-[#6C7A70]">Select coverage dates to calculate automatically.</span>}</label><label className="text-sm font-bold text-[#294B39]"><span className="inline-flex items-center gap-1.5">Statutory reserves (%)<button type="button" aria-label="What are statutory reserves?" className="inline-flex size-5 items-center justify-center rounded-full border border-[#CAD8CB] text-[#1F6B43] transition hover:bg-[#EEF2EC]" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFieldInfoOpen(true); }}><Info className="size-3.5" /></button></span><input type="number" min="0" max="100" step="0.01" value={form.statutoryReservesRate} onChange={(event) => updateFormField("statutoryReservesRate", event.target.value)} className={formFieldClass("statutoryReservesRate")} /><FieldError message={createFieldErrors.statutoryReservesRate} />{createFieldErrors.statutoryReservesRate ? null : financialBasis && form.statutoryReservesRate !== "" ? <span className="mt-1 block text-xs font-semibold text-[#5D6D63]">Calculated amount: {money(financialBasis.netSurplus * (Number(form.statutoryReservesRate) / 100))}</span> : <span className="mt-1 block text-xs font-semibold text-[#6C7A70]">Suggested starting point: 10%. You can edit this based on the approved policy.</span>}</label><label className="text-sm font-bold text-[#294B39]"><span className="inline-flex items-center gap-1.5">Interest on Share Capital allocation (%)<button type="button" aria-label="What is the Interest on Share Capital allocation?" className="inline-flex size-5 items-center justify-center rounded-full border border-[#CAD8CB] text-[#1F6B43] transition hover:bg-[#EEF2EC]" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFieldInfoOpen(true); }}><Info className="size-3.5" /></button></span><input type="number" min="0" max="70" step="0.01" value={form.interestAllocationRate} onChange={(event) => updateFormField("interestAllocationRate", event.target.value)} className={formFieldClass("interestAllocationRate")} /><FieldError message={createFieldErrors.interestAllocationRate} /><span className="mt-1 block text-xs font-semibold text-[#6C7A70]">Suggested starting point: 70%. You can lower this based on the approved policy.</span></label><label className="sm:col-span-2 text-sm font-bold text-[#294B39]">Notes<textarea value={form.notes} onChange={(event) => updateFormField("notes", event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-[#CAD8CB] p-3 font-normal" /></label></div>{financialBasisLoading ? <div className="mb-4 rounded-xl border border-[#CAD8CB] bg-[#F7FAF5] p-4 text-sm font-semibold text-[#5D6D63]">Computing net surplus from posted financial records...</div> : financialBasisError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{financialBasisError}</div> : financialBasis ? <div className="mb-4 rounded-xl border border-[#CAD8CB] bg-[#F7FAF5] p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Posted income</p><p className="mt-1 font-black text-[#123D2A]">{money(financialBasis.incomeTotal)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Posted expenses</p><p className="mt-1 font-black text-[#8A3D2F]">{money(financialBasis.expenseTotal)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Adjustments</p><p className="mt-1 font-black text-[#123D2A]">{money(financialBasis.adjustmentTotal)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-[#365F4A]">Net surplus</p><p className="mt-1 font-black text-[#123D2A]">{money(financialBasis.netSurplus)}</p></div></div>{financialBasis.unpostedRecordCount > 0 ? <p className="mt-3 text-xs font-semibold text-[#6E5B1C]">{financialBasis.unpostedRecordCount} active financial record(s) are not posted and are excluded from this calculation.</p> : null}</div> : null}<div className="rounded-xl border border-[#CAD8CB] bg-[#F7FAF5] p-4" aria-live="polite"><div className="flex items-start gap-3"><div className="rounded-lg bg-[#E2F3E5] p-2 text-[#1F6B43]"><Calculator className="size-5" /></div><div><p className="font-black text-[#123D2A]">Automatic Interest on Share Capital pool</p><p className="mt-1 text-sm text-[#5D6D63]">The Interest on Share Capital pool is allocated from distributable net surplus using each member&apos;s average paid-up share month. The system caps this allocation at 70%, leaving at least 30% for patronage refund and other approved allocations. Final allocation must follow the cooperative&apos;s approved policy.</p></div></div>{previewLoading ? <p className="mt-4 text-sm font-semibold text-[#5D6D63]">Calculating qualified members and allocations...</p> : previewError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{previewError}</div> : preview ? <><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#6C7A70]"><Users className="size-3.5" /> Qualified members</p><p className="mt-1 text-xl font-black text-[#123D2A]">{preview.qualifiedMemberCount}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Distributable surplus</p><p className="mt-1 text-lg font-black text-[#123D2A]">{money(preview.distributableSurplus)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Total average share month</p><p className="mt-1 text-lg font-black text-[#123D2A]">{money(preview.totalAverageShareMonth)}</p></div><div className="rounded-lg bg-[#123D2A] p-3 text-white"><p className="text-xs font-bold uppercase tracking-wide text-[#C5E7CF]">Interest pool</p><p className="mt-1 text-lg font-black">{money(preview.dividendPool)}</p></div></div><p className="mt-3 text-xs font-semibold text-[#5D6D63]">Interest allocation: {preview.interestAllocationRate}% of distributable surplus - Rate per average share month: {interestRate(preview.interestRate)}</p><button type="button" onClick={() => openPreviewCalculation(preview)} className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC]">View full calculation</button>{preview.qualifiedMembers.length ? <><button type="button" onClick={() => setShowQualifiedMembers((visible) => !visible)} aria-expanded={showQualifiedMembers} aria-controls="qualified-member-list" className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#CAD8CB] px-3 py-2 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]">{showQualifiedMembers ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{showQualifiedMembers ? "Hide qualified-member list" : "View qualified-member list"}</button>{showQualifiedMembers ? <div><MemberSearch inputId="preview-member-search" search={previewMemberSearch} onSearchChange={(value) => { setPreviewMemberSearch(value); setPreviewMemberPage(1); }} /><div id="qualified-member-list" className="mt-3 max-h-64 overflow-auto rounded-lg border border-[#DDE8DD] bg-white"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-3 py-2">Qualified member</th><th className="px-3 py-2">Membership</th><th className="px-3 py-2 text-right">Average share month</th><th className="px-3 py-2 text-right">Interest</th></tr></thead><tbody className="divide-y divide-[#EEF2EC]">{visiblePreviewMembers.map((member) => <tr key={member.memberId}><td className="px-3 py-2"><p className="font-bold text-[#123D2A]">{member.memberName}</p><p className="text-xs text-[#6C7A70]">{member.memberCode}</p></td><td className="px-3 py-2 text-xs text-[#5D6D63]">{member.membershipType}</td><td className="px-3 py-2 text-right">{money(member.averageShareMonth)}</td><td className="px-3 py-2 text-right font-bold text-[#123D2A]">{money(member.dividendAmount)}</td></tr>)}</tbody></table></div><MemberPagination page={currentPreviewMemberPage} pageCount={previewPageCount} total={filteredPreviewMembers.length} onPrevious={() => setPreviewMemberPage((page) => Math.max(1, page - 1))} onNext={() => setPreviewMemberPage((page) => Math.min(previewPageCount, page + 1))} /></div> : null}</> : <p className="mt-4 rounded-lg border border-[#E7DDBD] bg-[#FFF9E8] p-3 text-sm font-semibold text-[#6E5B1C]">No members currently meet the qualification rule, so this declaration will have a zero pool.</p>}</> : <p className="mt-4 text-sm text-[#6C7A70]">Enter the coverage dates, net surplus, reserves, and allocation percentage to preview qualified members.</p>}</div></div> : dialog.kind === "members" ? <div className="mt-6 space-y-6"><div className="rounded-xl bg-[#F4F7F2] p-5"><p className="font-black text-[#123D2A]">{dialog.declaration.name}</p><div className="mt-4 grid grid-cols-2 gap-4 text-sm"><p><span className="block text-[#6C7A70]">Members</span><strong>{dialog.declaration.memberCount}</strong></p><p><span className="block text-[#6C7A70]">Total interest</span><strong>{money(dialog.declaration.totalDeclaredAmount)}</strong></p></div></div><button type="button" onClick={() => openDeclarationCalculation(dialog.declaration)} className="inline-flex items-center gap-2 rounded-md border border-[#CAD8CB] px-4 py-3 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC]">View full calculation</button>{membersLoading ? <p className="text-sm font-semibold text-[#5D6D63]">Loading qualified members...</p> : membersError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{membersError}</div> : declarationMembers.length ? <div><MemberSearch inputId="declaration-member-search" search={declarationMemberSearch} onSearchChange={(value) => { setDeclarationMemberSearch(value); setDeclarationMemberPage(1); }} /><div ref={declarationMembersListRef} className="min-h-0 max-h-64 overflow-auto overscroll-contain rounded-lg border border-[#DDE8DD] bg-white"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3 text-right">Average share month</th><th className="px-4 py-3 text-right">Interest</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Decision</th></tr></thead><tbody className="divide-y divide-[#EEF2EC]">{visibleDeclarationMembers.map((member) => <tr key={member.memberId}><td className="px-4 py-3"><p className="font-bold text-[#123D2A]">{member.memberName}</p><p className="text-xs text-[#6C7A70]">{member.memberCode}</p></td><td className="px-4 py-3 text-xs text-[#5D6D63]">{member.membershipType}</td><td className="px-4 py-3 text-right">{money(member.averageShareMonth)}</td><td className="px-4 py-3 text-right font-bold text-[#123D2A]">{money(member.dividendAmount)}</td><td className="px-4 py-3"><StatusBadge tone={member.status === "Available" || member.status === "Added to Share Capital" || member.status === "Withdrawn" ? "success" : "warning"}>{member.status}</StatusBadge></td><td className="px-4 py-3 text-xs text-[#5D6D63]">{member.decision ?? "-"}</td></tr>)}</tbody></table></div><MemberPagination page={currentDeclarationMemberPage} pageCount={declarationPageCount} total={filteredDeclarationMembers.length} onPrevious={() => setDeclarationMemberPage((page) => Math.max(1, page - 1))} onNext={() => setDeclarationMemberPage((page) => Math.min(declarationPageCount, page + 1))} /></div> : <p className="rounded-lg border border-[#E7DDBD] bg-[#FFF9E8] p-3 text-sm font-semibold text-[#6E5B1C]">No member allocations were found for this declaration.</p>}</div> : dialog.kind === "publish" ? <div className="mt-5 space-y-4"><div className="rounded-xl bg-[#F4F7F2] p-4"><p className="font-black text-[#123D2A]">{dialog.declaration.name}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p><span className="block text-[#6C7A70]">Members</span><strong>{dialog.declaration.memberCount}</strong></p><p><span className="block text-[#6C7A70]">Total interest</span><strong>{money(dialog.declaration.totalDeclaredAmount)}</strong></p></div></div><p className="text-sm leading-6 text-[#42594B]">Publishing makes every allocation available to members for withdrawal or addition to Share Capital. This declaration can no longer be silently edited.</p></div> : <div className="mt-5 space-y-4"><div className="rounded-xl bg-[#F4F7F2] p-4"><p className="font-black text-[#123D2A]">{dialog.request.memberName}</p><p className="mt-1 text-2xl font-black text-[#123D2A]">{money(dialog.request.amount)}</p></div>{dialog.request.decision === "Withdraw" ? <><div className="rounded-lg border border-[#DDE8DD] bg-[#F7FAF5] p-4 text-sm text-[#42594B]"><div className="grid gap-3 sm:grid-cols-2"><p><span className="block text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Payout method</span><strong className="mt-1 block text-[#123D2A]">{dialog.request.withdrawalMethod ?? "Cash"}</strong></p>{dialog.request.withdrawalMethod === "Online Transfer" ? <p><span className="block text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Provider</span><strong className="mt-1 block text-[#123D2A]">{dialog.request.withdrawalProvider ?? "-"}</strong></p> : null}</div>{dialog.request.withdrawalMethod === "Online Transfer" ? <div className="mt-3 grid gap-3 border-t border-[#DDE8DD] pt-3 sm:grid-cols-2"><p><span className="block text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Account name</span><strong className="mt-1 block break-words text-[#123D2A]">{dialog.request.withdrawalAccountName ?? "-"}</strong></p><p><span className="block text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Account/mobile number</span><strong className="mt-1 block break-words text-[#123D2A]">{dialog.request.withdrawalAccountNumber ?? "-"}</strong></p></div> : <p className="mt-3 border-t border-[#DDE8DD] pt-3">Member will claim the payout through the cooperative office.</p>}{dialog.request.withdrawalQrCode ? <div className="mt-3 border-t border-[#DDE8DD] pt-3"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Member QR code</p><img src={dialog.request.withdrawalQrCode} alt="Member payout QR code" className="mt-2 h-40 w-40 rounded-lg border border-[#CAD8CB] bg-white object-contain p-2" /></div> : null}<p className="mt-3 text-xs font-semibold text-[#6C7A70]">Verify the payout details before sending the money, then record the official reference below.</p></div><label className="block text-sm font-bold text-[#294B39]">Official payout reference<input value={payout.referenceNumber} onChange={(event) => setPayout((current) => ({ ...current, referenceNumber: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" /></label></> : <p className="rounded-lg border border-[#DDE8DD] bg-[#F7FAF5] p-3 text-sm text-[#42594B]">The requested amount will be posted to the member&apos;s Share Capital only after Bookkeeper approval.</p>}{dialog.request.decision === "Withdraw" ? <><label className="block text-sm font-bold text-[#294B39]">Payout receipt <span className="font-normal text-[#6C7A70]">(optional)</span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => handlePayoutReceipt(event.target.files?.[0])} className="mt-1 block w-full rounded-md border border-[#CAD8CB] bg-white p-2 text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-[#6C7A70]">Attach the payout slip or receipt. PDF, PNG, JPG, or WebP up to 600 KB.</span></label>{payout.withdrawalReceiptName ? <p className="text-xs font-semibold text-[#2F7D57]">Receipt attached: {payout.withdrawalReceiptName}</p> : null}</> : null}<label className="block text-sm font-bold text-[#294B39]">Processing notes<textarea value={payout.notes} onChange={(event) => setPayout((current) => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-20 w-full rounded-md border border-[#CAD8CB] p-3 font-normal" /></label></div>}
        {error ? <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}<div className="mt-7 flex shrink-0 justify-end gap-3 border-t border-[#E5ECE5] pb-1 pt-5"><button type="button" disabled={busy} onClick={closeDialog} className="rounded-md border border-[#CAD8CB] px-4 py-2.5 font-bold text-[#123D2A] disabled:opacity-50">Cancel</button>{dialog.kind !== "members" ? <button type="button" disabled={busy || (dialog.kind === "create" && Boolean(coverageConflict))} onClick={() => void (dialog.kind === "create" ? submitCreate() : dialog.kind === "publish" ? submitPublish(dialog.declaration) : submitDividendAction(dialog.request))} className="rounded-md bg-[#123D2A] px-4 py-2.5 font-bold text-white disabled:opacity-50">{busy ? "Processing..." : dialog.kind === "create" ? "Create draft" : dialog.kind === "publish" ? "Publish Annual Interest" : dialog.request.decision === "Withdraw" ? "Complete payout" : "Approve & add to capital"}</button> : null}</div>
      </div></div> : null)}
      {!approvalConfirmation && !approvalHistoryOpen && !fieldInfoOpen && (calculation ? <CalculationModal details={calculation} onClose={() => setCalculation(null)} /> : null)}
    </>
  );
}
function DividendActionRequestTable({
  requests,
  pageSize,
  dialogOpen,
  onOpen,
}: {
  requests: DividendActionRequest[];
  pageSize: number;
  dialogOpen: boolean;
  onOpen: (request: DividendActionRequest) => void;
}) {
  const emptyRows = Math.max(0, pageSize - requests.length);

  return (
    <DataTable>
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[20%]" />
          <col className="w-[12%]" />
          <col className="w-[13%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]">
          <tr>
            <th className="break-words px-3 py-3">Member</th>
            <th className="break-words px-3 py-3">Declaration</th>
            <th className="break-words px-3 py-3">Request</th>
            <th className="break-words px-3 py-3">Payout</th>
            <th className="break-words px-3 py-3 text-center">Requested</th>
            <th className="break-words px-3 py-3 text-right">Amount</th>
            <th className="break-words px-3 py-3 text-center">Status</th>
            <th className="break-words px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5ECE5]">
          {requests.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-4 align-top">
                <p className="font-bold text-[#123D2A]">{item.memberName}</p>
                <p className="text-xs text-[#6C7A70]">{item.memberCode}</p>
              </td>
              <td className="break-words px-3 py-4 align-top">{item.declarationName}</td>
              <td className="break-words px-3 py-4 align-top">{item.decision === "Withdraw" ? "Withdrawal" : "Add to Share Capital"}</td>
              <td className="break-words px-3 py-4 align-top">{item.decision === "Withdraw" ? <div><p className="font-bold text-[#123D2A]">{item.withdrawalMethod ?? "Cash"}</p>{item.withdrawalMethod === "Online Transfer" ? <p className="break-words text-xs text-[#6C7A70]">{item.withdrawalProvider ?? "Online provider"}</p> : null}</div> : <span className="text-xs text-[#6C7A70]">-</span>}</td>
              <td className="px-3 py-4 text-center align-top whitespace-nowrap">{item.decidedAt ? date(item.decidedAt) : "-"}</td>
              <td className="px-3 py-4 text-right align-top whitespace-nowrap"><CurrencyDisplay value={item.amount} /></td>
              <td className="px-3 py-4 text-center align-top"><StatusBadge tone="warning" className="max-w-full whitespace-normal text-center">{item.status}</StatusBadge></td>
              <td className="px-3 py-4 text-right align-top">
                <button
                  type="button"
                  disabled={dialogOpen}
                  onClick={() => onOpen(item)}
                  className="inline-flex max-w-full justify-center break-words rounded-md bg-[#123D2A] px-2.5 py-2 text-center text-xs font-bold text-white disabled:opacity-50"
                >
                  {item.decision === "Withdraw" ? "Record payout" : "Approve & add to capital"}
                </button>
              </td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }, (_, index) => (
            <tr key={`empty-request-${index}`} aria-hidden="true">
              <td colSpan={8} className="h-[82px] px-4 py-4">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}

function DividendActionHistoryModal({
  history,
  loading,
  error,
  search,
  declarationFilter,
  declarations,
  page,
  pageCount,
  total,
  onSearchChange,
  onDeclarationChange,
  onPrevious,
  onNext,
  onClose,
}: {
  history: DividendActionRequest[];
  loading: boolean;
  error: string;
  search: string;
  declarationFilter: string;
  declarations: string[];
  page: number;
  pageCount: number;
  total: number;
  onSearchChange: (value: string) => void;
  onDeclarationChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="dividend-action-history-title" className="max-h-[calc(100vh-1rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Bookkeeper records</p>
            <h3 id="dividend-action-history-title" className="mt-1 text-xl font-black text-[#123D2A]">Successful action history</h3>
            <p className="mt-1 text-sm text-[#5D6D63]">Completed Annual Interest withdrawals and Share Capital additions.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#CAD8CB] p-2 text-[#123D2A]" aria-label="Close action history"><X className="size-4" /></button>
        </div>

        {!loading && !error ? <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)]">
          <label className="text-sm font-bold text-[#294B39]">
            Search history
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Member, code, declaration, or reference"
              className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#C5E7CF]"
            />
          </label>
          <label className="text-sm font-bold text-[#294B39]">
            Filter by declaration
            <Select.Root value={declarationFilter} onValueChange={onDeclarationChange}>
              <Select.Trigger aria-label="Filter by declaration" className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-[#CAD8CB] bg-white px-3 text-left font-normal text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20">
                <Select.Value placeholder="All declarations" />
                <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position="popper" sideOffset={6} className="z-[120] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.18)]">
                  <Select.Viewport>
                    <Select.Item value="all" className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                      <Select.ItemText>All declarations</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                    {declarations.map((declaration) => (
                      <Select.Item key={declaration} value={declaration} className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                        <Select.ItemText>{declaration}</Select.ItemText>
                        <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </label>
        </div> : null}

        {loading ? <p className="mt-6 rounded-lg border border-[#DDE8DD] bg-[#F7FAF5] p-4 text-sm font-semibold text-[#5D6D63]">Loading successful actions...</p> : error ? <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : history.length ? <div className="mt-6 overflow-hidden rounded-lg border border-[#CAD8CB]">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]">
              <tr>
                <th className="break-words px-3 py-3">Member</th>
                <th className="break-words px-3 py-3">Declaration</th>
                <th className="break-words px-3 py-3">Successful action</th>
                <th className="break-words px-3 py-3">Payout</th>
                <th className="break-words px-3 py-3 text-right">Amount</th>
                <th className="break-words px-3 py-3 text-center">Completed</th>
                <th className="break-words px-3 py-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5ECE5]">
              {history.map((item) => (
                <tr key={item.id}>
                  <td className="break-words px-3 py-4 align-top"><p className="font-bold text-[#123D2A]">{item.memberName}</p><p className="text-xs text-[#6C7A70]">{item.memberCode}</p></td>
                  <td className="break-words px-3 py-4 align-top">{item.declarationName}</td>
                  <td className="px-3 py-4 align-top"><StatusBadge tone="success" className="max-w-full whitespace-normal text-center">{item.decision === "Withdraw" ? "Successful withdrawal" : "Added to Share Capital"}</StatusBadge></td>
                  <td className="break-words px-3 py-4 align-top">{item.decision === "Withdraw" ? <div><p className="font-bold text-[#123D2A]">{item.withdrawalMethod ?? "Cash"}</p>{item.withdrawalProvider ? <p className="break-words text-xs text-[#6C7A70]">{item.withdrawalProvider}</p> : null}</div> : <span className="text-xs text-[#6C7A70]">—</span>}</td>
                  <td className="px-3 py-4 text-right align-top whitespace-nowrap"><CurrencyDisplay value={item.amount} /></td>
                  <td className="px-3 py-4 text-center align-top whitespace-nowrap">{item.processedAt ? date(item.processedAt) : "—"}</td>
                  <td className="break-all px-3 py-4 align-top text-xs text-[#5D6D63]">{item.decision === "Withdraw" ? <><p>{item.withdrawalReference ?? "—"}</p>{item.withdrawalReceiptName ? <p className="mt-1 font-semibold text-[#2F7D57]">Receipt attached</p> : null}</> : <span>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <p className="mt-6 rounded-lg border border-[#E7DDBD] bg-[#FFF9E8] p-4 text-sm font-semibold text-[#6E5B1C]">{search.trim() || declarationFilter !== "all" ? "No matching history found." : "No successful withdrawals or Share Capital additions yet."}</p>}

        {!loading && !error && total ? <MemberPagination page={page} pageCount={pageCount} total={total} label="completed action" onPrevious={onPrevious} onNext={onNext} /> : null}
      </div>
    </div>
  );
}

