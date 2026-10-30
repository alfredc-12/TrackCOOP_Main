import assert from "node:assert/strict";
import test from "node:test";
import type { MemberDividend } from "./types";
import { memberCapitalMilestone, summarizeMemberInterest, summarizeMemberRefund } from "./member-share-summary";

const dividend = (id: string, status: MemberDividend["status"], amount: number, declarationStatus: MemberDividend["declarationStatus"] = "Published") => ({ id, status, amount, declarationStatus, createdAt: `2026-01-${id.padStart(2, "0")}` }) as MemberDividend;

test("interest includes older available allocations even after the latest interest was withdrawn", () => {
  const summary = summarizeMemberInterest([
    dividend("1", "Available", 200), dividend("8", "Withdrawn", 500),
    dividend("2", "Pending", 100), dividend("3", "Withdrawal Requested", 150),
    dividend("4", "Added to Share Capital", 300), dividend("5", "Reversed", 999),
    dividend("6", "Available", 900, "Draft"), dividend("7", "Cancelled", 800),
  ]);
  assert.equal(summary.available, 200);
  assert.equal(summary.awaiting, 250);
  assert.equal(summary.received, 500);
  assert.equal(summary.capitalized, 300);
  assert.equal(summary.history[0].id, "1");
  assert.equal(summary.history.length, 7);
});

test("interest sums preserve cents without treating pending amounts as available", () => {
  assert.equal(summarizeMemberInterest([dividend("1", "Available", 0.1), dividend("2", "Available", 0.2)]).available, 0.3);
  assert.equal(summarizeMemberInterest([dividend("1", "Capitalization Requested", 400)]).available, 0);
  assert.deepEqual(summarizeMemberInterest([]), { available: 0, awaiting: 0, received: 0, capitalized: 0, history: [] });
});

test("a paid patronage refund shows zero available and keeps the amount received", () => {
  assert.deepEqual(summarizeMemberRefund({ allocatedTotal: 750, paidTotal: 750, pendingTotal: 0 }), { available: 0, received: 750, capitalized: 0, awaiting: 0 });
});

test("patronage transfer reservations are held out of the available refund", () => {
  assert.deepEqual(summarizeMemberRefund({ allocatedTotal: 1000, paidTotal: 200, pendingTotal: 500, capitalizedTotal: 300, pendingCapitalTotal: 150 }), { available: 350, awaiting: 150, received: 200, capitalized: 300 });
  assert.equal(summarizeMemberRefund({ allocatedTotal: 1, paidTotal: 0, pendingTotal: 0.3, pendingCapitalTotal: 0.1 }).available, 0.2);
});

test("milestone percentage uses the stated next target, rather than the maximum capital", () => {
  assert.deepEqual(memberCapitalMilestone(2250), { current: "Bronze", next: "Silver", target: 3000, remaining: 750, percentage: 75 });
  assert.equal(memberCapitalMilestone(0).percentage, 0);
  assert.equal(memberCapitalMilestone(3000).current, "Silver");
  assert.equal(memberCapitalMilestone(15000).percentage, 100);
  assert.equal(memberCapitalMilestone(20000).remaining, 0);
});
