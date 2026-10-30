import type { MemberDividend } from "./types";
import type { MemberPatronageSummary } from "../patronage/patronage-api";

const cents = (amount: number) => Math.round(amount * 100);
const sum = (items: MemberDividend[]) => items.reduce((total, item) => total + cents(item.amount), 0) / 100;

export function summarizeMemberInterest(dividends: MemberDividend[]) {
  const published = dividends.filter((item) => item.declarationStatus === "Published");
  return {
    available: sum(published.filter((item) => item.status === "Available")),
    awaiting: sum(published.filter((item) => ["Pending", "Withdrawal Requested", "Capitalization Requested"].includes(item.status))),
    received: sum(published.filter((item) => item.status === "Withdrawn")),
    capitalized: sum(published.filter((item) => item.status === "Added to Share Capital")),
    history: [...published].sort((a, b) => Number(b.status === "Available") - Number(a.status === "Available") || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  };
}

export function summarizeMemberRefund(refunds: MemberPatronageSummary["refunds"]) {
  return {
    available: Math.max(0, cents(refunds.pendingTotal) - cents(refunds.pendingCapitalTotal ?? 0)) / 100,
    awaiting: refunds.pendingCapitalTotal ?? 0,
    received: refunds.paidTotal,
    capitalized: refunds.capitalizedTotal ?? 0,
  };
}

const tiers = [
  { label: "Starter", minimum: 0 }, { label: "Bronze", minimum: 1500 },
  { label: "Silver", minimum: 3000 }, { label: "Gold", minimum: 7500 },
  { label: "Platinum", minimum: 15000 },
];

export function memberCapitalMilestone(balance: number) {
  const amount = Math.max(0, balance);
  const index = tiers.reduce((current, tier, i) => amount >= tier.minimum ? i : current, 0);
  const next = tiers[index + 1];
  return { current: tiers[index].label, next: next?.label, target: next?.minimum ?? 15000,
    remaining: next ? Math.max(0, next.minimum - amount) : 0,
    percentage: next ? Math.min(100, Math.round(amount / next.minimum * 100)) : 100 };
}

export function openMemberCapital(method?: "cash" | "refund") {
  window.dispatchEvent(new CustomEvent("trackcoop:open-share-capital", { detail: { method } }));
}
