"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Award, CheckCircle2, Clock, Leaf, PieChart, Printer, RefreshCw, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MemberPatronageClient } from "@/features/patronage/MemberPatronageClient";
import type { MemberPatronageSummary } from "@/features/patronage/patronage-api";
import type { MemberDividend } from "./types";
import { memberCapitalMilestone, openMemberCapital, summarizeMemberInterest, summarizeMemberRefund } from "./member-share-summary";

const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
const actionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#CAD8CB] px-3 py-2 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF5EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43] disabled:opacity-50";

export type MemberCapitalActivity = { id: string; date: string | Date; amount: number | string; type: string; status: string; direction?: "Credit" | "Debit" };
type Props = {
  capital: number;
  linked: boolean;
  memberSince?: string | Date | null;
  contributionCount: number;
  activities: MemberCapitalActivity[];
  dividends: MemberDividend[];
  patronage: MemberPatronageSummary | null;
  loading: { capital: boolean; interest: boolean; patronage: boolean };
  errors: { capital: boolean; interest: boolean; patronage: boolean };
  onRefresh: () => void;
  onDividendAction: (dividend: MemberDividend, action: "withdraw" | "capital") => void;
  dividendBusy: boolean;
};

function MoneyRows({ summary, unavailable, waitingLabel = "Not yet available" }: { summary: { awaiting: number; received: number; capitalized: number }; unavailable: boolean; waitingLabel?: string }) {
  return <dl className="mt-3 space-y-1.5 text-sm text-[#5D6D63]">
    {[[waitingLabel, summary.awaiting], ["Received as cash", summary.received], ["Added to Share Capital", summary.capitalized]].map(([label, amount]) => <div key={String(label)} className="flex justify-between gap-3"><dt>{label}</dt><dd className="shrink-0 font-semibold text-[#173626]">{unavailable ? "—" : money(Number(amount))}</dd></div>)}
  </dl>;
}

const interestStatus: Record<MemberDividend["status"], string> = {
  Pending: "Not yet released", Available: "Available to use", "Withdrawal Requested": "Waiting for cash payout",
  "Capitalization Requested": "Waiting to be added to capital", Withdrawn: "Received as cash",
  "Added to Share Capital": "Added to Share Capital", Cancelled: "Cancelled", Reversed: "Reversed",
};

export function MemberShareOverview(props: Props) {
  const [interestOpen, setInterestOpen] = useState(false);
  const [patronageOpen, setPatronageOpen] = useState(false);
  const interest = summarizeMemberInterest(props.dividends);
  const refund = summarizeMemberRefund(props.patronage?.refunds ?? { allocatedTotal: 0, paidTotal: 0, pendingTotal: 0 });
  const milestone = memberCapitalMilestone(props.capital);
  const unavailable = {
    capital: props.errors.capital || (!props.linked && !props.loading.capital),
    interest: props.errors.interest,
    patronage: props.errors.patronage || (!props.patronage && !props.loading.patronage),
  };
  const memberDate = props.memberSince ? new Date(props.memberSince) : null;
  const anniversary = memberDate ? new Date(memberDate) : null;
  if (anniversary) anniversary.setFullYear(anniversary.getFullYear() + 1);
  const badges = [
    { label: "1 year member", earned: Boolean(anniversary && !Number.isNaN(anniversary.getTime()) && new Date() >= anniversary), unknown: unavailable.capital || props.loading.capital || !memberDate || Number.isNaN(memberDate.getTime()) },
    { label: "First capital addition", earned: props.contributionCount >= 1, unknown: unavailable.capital || props.loading.capital },
    { label: "3 capital additions", earned: props.contributionCount >= 3, unknown: unavailable.capital || props.loading.capital },
    { label: "Interest reinvested", earned: interest.capitalized > 0, unknown: unavailable.interest || props.loading.interest },
  ];
  const display = (value: number, loading: boolean, error: boolean) => error ? "—" : loading ? "Loading…" : money(value);

  return <section aria-labelledby="member-share-heading" className="space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2F7D57]">Member &amp; Share</p><h2 id="member-share-heading" className="mt-1 text-2xl font-bold text-[#173626]">Your capital and member benefits</h2></div>
      <button type="button" className={actionClass} disabled={props.loading.capital || props.loading.interest || props.loading.patronage} onClick={props.onRefresh}><RefreshCw className="size-4" />Update</button>
    </header>
    {Object.values(props.errors).some(Boolean) ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">Some records could not be loaded. Unavailable amounts show “—”. Press Update to try again.</p> : null}
    {!props.linked && !props.loading.capital && !props.errors.capital ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Ask the cooperative office to link your account to your member profile.</p> : null}

    <div className="grid items-stretch gap-3 lg:grid-cols-3">
      <article aria-label="Digital Passbook" className="flex flex-col rounded-2xl bg-gradient-to-br from-[#1F6B43] to-[#123D2A] p-5 text-white shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white/90"><Wallet className="size-4" />Digital Passbook</h3>
        <p className="mt-4 text-sm text-white/80">Current Share Capital</p>
        <p className="mt-1 text-3xl font-black tracking-tight">{display(props.capital, props.loading.capital, unavailable.capital)}</p>
        <p className="mt-2 text-sm text-white/80">Approved additions, less any deductions.</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <button type="button" disabled={unavailable.capital || props.loading.capital} onClick={() => openMemberCapital()} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#123D2A] hover:bg-[#EFF6EC] disabled:opacity-50"><Leaf className="size-4" />Add Share Capital</button>
          <a href="/statement" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-sm font-bold hover:bg-white/10"><Printer className="size-4" />Print / Save</a>
        </div>
      </article>

      <article aria-label="Share Capital Interest" className="flex flex-col rounded-2xl border border-[#DDE8D8] bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-[#173626]"><PieChart className="size-4 text-[#A15C16]" />Share Capital Interest</h3>
        <p className="mt-2 text-sm text-[#5D6D63]">Available to use</p><p className="mt-1 text-2xl font-black text-[#1F6B43]">{display(interest.available, props.loading.interest, unavailable.interest)}</p>
        <MoneyRows summary={interest} unavailable={unavailable.interest || props.loading.interest} />
        <button type="button" onClick={() => setInterestOpen(true)} className={`${actionClass} mt-auto w-full pt-2`}>View interest details</button>
      </article>

      <article aria-label="Patronage Refund" className="flex flex-col rounded-2xl border border-[#DDE8D8] bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-[#173626]"><Award className="size-4 text-[#2F7D57]" />Patronage Refund</h3>
        <p className="mt-2 text-sm text-[#5D6D63]">Available to use</p><p className="mt-1 text-2xl font-black text-[#1F6B43]">{display(refund.available, props.loading.patronage, unavailable.patronage)}</p>
        <MoneyRows summary={refund} unavailable={unavailable.patronage || props.loading.patronage} waitingLabel="Waiting for approval" />
        <div className="mt-auto flex gap-2 pt-2"><button type="button" onClick={() => setPatronageOpen(true)} className={`${actionClass} flex-1`}>View refund details</button><button type="button" disabled={unavailable.patronage || props.loading.patronage || refund.available <= 0} onClick={() => openMemberCapital("refund")} className={`${actionClass} flex-1`}>Add to capital</button></div>
      </article>
    </div>

    <div className="grid items-stretch gap-3 lg:grid-cols-[1.2fr_1fr]">
      <article className="min-w-0 rounded-2xl border border-[#DDE8D8] bg-white p-4">
        <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-[#173626]">Recent capital changes</h3><Link href="/portal/member/share-capital" className="text-sm font-bold text-[#1F6B43] hover:underline">Full history</Link></div>
        <div className="mt-2 max-h-32 divide-y divide-[#EEF2EC] overflow-y-auto">
          {unavailable.capital ? <p className="py-3 text-sm text-[#6C7A70]">Capital history is unavailable.</p> : props.loading.capital ? <p role="status" className="py-3 text-sm text-[#6C7A70]">Loading your capital history…</p> : props.activities.length ? props.activities.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0"><p className="truncate font-semibold text-[#173626]">{item.type === "Patronage Refund Added to Share Capital" ? "Refund added to capital" : item.type === "Dividend Added to Share Capital" ? "Interest added to capital" : item.direction === "Debit" ? "Capital deduction" : "Capital addition"}</p><p className="text-xs text-[#6C7A70]">{new Date(item.date).toLocaleDateString("en-PH")}</p></div>
            <span className={`flex shrink-0 items-center gap-1 font-bold ${item.direction === "Debit" ? "text-[#A15C16]" : "text-[#1F6B43]"}`}>{item.direction === "Debit" ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}{item.direction === "Debit" ? "−" : "+"}{money(Number(item.amount))}</span>
          </div>) : <p className="py-3 text-sm text-[#6C7A70]">No capital changes recorded yet.</p>}
        </div>
      </article>
      <article className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
        <div className="flex justify-between gap-2"><h3 className="font-bold text-[#173626]">Your milestones</h3><span className="text-sm font-bold text-[#2F7D57]">{unavailable.capital || props.loading.capital ? "—" : `${milestone.current} tier`}</span></div>
        <p className="mt-2 text-sm text-[#5D6D63]">{unavailable.capital || props.loading.capital ? "Load your capital records to see progress." : milestone.next ? `${money(props.capital)} of ${money(milestone.target)} toward ${milestone.next}` : "Platinum capital milestone reached."}</p>
        <div role="progressbar" aria-label="Progress to next capital milestone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={unavailable.capital || props.loading.capital ? undefined : milestone.percentage} className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF2EC]"><div className="h-full rounded-full bg-[#2F7D57]" style={{ width: `${unavailable.capital || props.loading.capital ? 0 : milestone.percentage}%` }} /></div>
        <p className="mt-1 text-xs text-[#6C7A70]">{unavailable.capital || props.loading.capital ? "Progress unavailable" : `${milestone.percentage}%${milestone.next ? ` · ${money(milestone.remaining)} to the next tier` : " · Highest tier"}`}</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">{badges.map((badge) => <span key={badge.label} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${badge.unknown ? "bg-slate-50 text-slate-500" : badge.earned ? "bg-[#EAF3E8] text-[#1F6B43]" : "bg-slate-50 text-slate-500"}`}>{badge.earned && !badge.unknown ? <CheckCircle2 className="size-3.5 shrink-0" /> : <Clock className="size-3.5 shrink-0" />}{badge.label} · {badge.unknown ? "Unknown" : badge.earned ? "Earned" : "Not yet"}</span>)}</div>
      </article>
    </div>

    <Modal title="Your Share Capital interest" description="All published interest records. Only available amounts can be withdrawn or added to capital." open={interestOpen} onOpenChange={setInterestOpen} maxWidth="max-w-2xl" trigger={<span className="hidden" />}>
      {unavailable.interest ? <p role="alert" className="text-sm text-red-700">Interest records could not be loaded. Close this window and press Update.</p> : props.loading.interest ? <p role="status">Loading interest records…</p> : interest.history.length ? <div className="space-y-3">{interest.history.map((item) => <article key={item.id} className="rounded-xl border border-[#DDE8D8] p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-[#173626]">{item.declarationName}</h3><strong className="text-[#1F6B43]">{money(item.amount)}</strong></div>
        <p className="mt-1 text-[#6C7A70]">{item.coverageStart} to {item.coverageEnd}</p><p className="mt-2 font-semibold text-[#365F4A]">{interestStatus[item.status]}</p>
        {item.status === "Pending" && item.distributionDate ? <p className="mt-1 text-[#6C7A70]">Release date: {new Date(item.distributionDate).toLocaleDateString("en-PH")}</p> : null}
        {item.status === "Available" ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={props.dividendBusy} className={actionClass} onClick={() => { setInterestOpen(false); props.onDividendAction(item, "withdraw"); }}>Request withdrawal</button><button type="button" disabled={props.dividendBusy} className={actionClass} onClick={() => { setInterestOpen(false); props.onDividendAction(item, "capital"); }}>Add to capital</button></div> : null}
      </article>)}</div> : <p className="text-sm text-[#6C7A70]">No published interest yet. This does not mean your capital is missing; interest appears after the cooperative publishes it.</p>}
    </Modal>
    <Modal title="Your patronage refund" description="Refunds based on your eligible cooperative purchases and rentals." open={patronageOpen} onOpenChange={setPatronageOpen} maxWidth="max-w-4xl" trigger={<span className="hidden" />}>
      {patronageOpen ? <MemberPatronageClient /> : null}
    </Modal>
  </section>;
}
