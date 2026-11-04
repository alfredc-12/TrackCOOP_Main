"use client";

import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { DataTable, EmptyState, ErrorState, StatusBadge } from "@/components/portal/PortalPrimitives";
import type { RecentRecord } from "./dashboard-api";
import { formatManilaDate, formatPeso } from "./dashboard-format";
import { InfoButton } from "./InfoButton";

function statusTone(status: RecentRecord["status"]) {
  if (status === "Posted") return "success" as const;
  if (status === "Unposted") return "warning" as const;
  if (status === "Reversed" || status === "Voided") return "danger" as const;
  return "neutral" as const;
}

function classificationBadge(classification: RecentRecord["classification"]) {
  switch (classification) {
    case "operating":
      return { label: "Operating", tone: "success" as const };
    case "capital":
      return { label: "Capital (non-operating)", tone: "neutral" as const };
    case "adjustment":
      return { label: "Adjustment", tone: "warning" as const };
    default:
      return { label: "Excluded from operating", tone: "neutral" as const };
  }
}

type RecentActivityTableProps = {
  recent: RecentRecord[] | null;
  periodLabel: string;
  error?: string;
  onRetry: () => void;
};

export function RecentActivityTable({
  recent,
  periodLabel,
  error,
  onRetry,
}: RecentActivityTableProps) {
  if (error) {
    return (
      <section aria-label="Recent financial activity">
        <ErrorState message={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!recent) {
    return (
      <section aria-label="Recent financial activity" className="h-64 animate-pulse rounded-xl bg-[#E7F2E4]" />
    );
  }

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="min-w-0 rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="recent-activity-heading" className="text-base font-black text-[#123D2A]">
              Recent Financial Records
            </h2>
            <InfoButton label="Recent Financial Records">
              Shows the 10 most recent financial_records entries within the selected period. Clearly distinguishes Posted Operating records from Capital movements, Adjustments, and Unposted drafts. Unvalidated payment submissions live in Payment Validation until approved.
            </InfoButton>
          </div>
          <p className="mt-0.5 text-xs text-[#5D6D63]">
            Latest 10 ledger entries in {periodLabel.toLowerCase()}. Unvalidated payment submissions are reviewed in{" "}
            <Link href="/portal/bookkeeper/payment-validation" className="font-bold text-[#1F6B43] underline">
              Payment Validation
            </Link>
            .
          </p>
        </div>
        <Link
          href="/portal/bookkeeper/financial-ledger"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#1F6B43] hover:text-[#123D2A]"
        >
          Open full Financial Ledger
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Landmark}
            title="No financial records in this period"
            description="Choose a broader reporting range or open the Financial Ledger to record or inspect historical postings."
          />
        </div>
      ) : (
        <div className="mt-4">
          <DataTable>
            <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-xs">
              <thead className="bg-[#F7F8F3] font-bold uppercase tracking-wider text-[#5D6D63]">
                <tr>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Record #</th>
                  <th scope="col" className="px-4 py-3">Source</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Classification</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                  <th scope="col" className="px-4 py-3 text-center">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                {recent.map((record) => {
                  const classBadge = classificationBadge(record.classification);
                  const detailHref = record.paymentReferenceId
                    ? `/portal/bookkeeper/payment-validation?paymentId=${encodeURIComponent(record.paymentReferenceId)}`
                    : "/portal/bookkeeper/financial-ledger";
                  const detailLabel = record.paymentReferenceId ? "Payment ref" : "Ledger";

                  return (
                    <tr key={record.id} className="hover:bg-[#F7F8F3]">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#123D2A]">
                        {formatManilaDate(record.date)}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#123D2A]">{record.recordNumber}</td>
                      <td className="px-4 py-3">{record.source}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#123D2A]">{record.category}</span>{" "}
                        <span className="text-[#5D6D63]">({record.recordType})</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={classBadge.tone}>{classBadge.label}</StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-black tabular-nums text-[#123D2A]">
                        {formatPeso(record.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge tone={statusTone(record.status)}>{record.status}</StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={detailHref}
                          className="inline-flex items-center gap-1 font-bold text-[#1F6B43] hover:text-[#123D2A]"
                        >
                          {detailLabel}
                          <ArrowRight className="size-3" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </div>
      )}
    </section>
  );
}

