"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { AgriculturalSectorFields } from "./MembershipSelectionFields";
export type CapitalProgress = {
  caseId: string;
  applicationDate: string;
  deadline: string;
  validated: number;
  pending: number;
  target: number;
  remaining: number;
  percentage: number;
  status: "In Progress" | "Reminder" | "Overdue" | "Completed";
  eligibleForTrueMembershipReview: boolean;
};
const peso = (v: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    v,
  );
export function CapitalProgressCard({ capital }: { capital: CapitalProgress }) {
  const Icon =
    capital.status === "Completed"
      ? CheckCircle2
      : capital.status === "Overdue"
        ? Activity
        : Clock3;
  const tone =
    capital.status === "Completed"
      ? "text-coop-success bg-coop-success-bg"
      : capital.status === "Overdue"
        ? "text-coop-danger bg-coop-danger-bg"
        : "text-coop-warning bg-coop-warning-bg";
  return (
    <section className="coop-panel p-4 sm:p-5" aria-label="Capital completion">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <WalletCards className="size-5" aria-hidden="true" />
          Capital completion
        </h3>
        <span
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-bold ${tone}`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {capital.status}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Validated", peso(capital.validated)],
          ["Pending", peso(capital.pending)],
          ["Required", peso(capital.target)],
          ["Remaining", peso(capital.remaining)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-coop-muted">{label}</dt>
            <dd className="mt-1 font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <progress
        aria-label="Validated capital completion"
        value={capital.percentage}
        max={100}
        className="my-4 h-2 w-full overflow-hidden rounded-full accent-coop-green [&::-webkit-progress-bar]:bg-coop-subtle [&::-webkit-progress-value]:bg-coop-green [&::-moz-progress-bar]:bg-coop-green"
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>Application: {capital.applicationDate}</span>
        <span>Deadline: {capital.deadline}</span>
        <strong>{capital.percentage.toFixed(0)}%</strong>
      </div>
      {capital.eligibleForTrueMembershipReview && (
        <p className="mt-3 text-sm font-bold text-coop-success">
          Eligible for True Membership Review · Chairman approval required
        </p>
      )}
    </section>
  );
}
type MemberProgress = {
  membershipType: string;
  sectors: string[];
  capital: CapitalProgress | null;
  validatedCapital: number;
  legacyReviewRequired: boolean;
  legacyDeadline: string | null;
};
export function MemberMembershipPanel() {
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [data, setData] = useState<MemberProgress | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<MemberProgress>("/api/members/me/membership-progress", {
      signal: controller.signal,
    })
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to load your membership progress.");
      });
    return () => controller.abort();
  }, [revision]);
  if (error)
    return (
      <div role="alert" className="coop-panel my-4 p-4">
        {error}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setError("");
            setRevision((v) => v + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  if (!data)
    return (
      <p role="status" className="my-4 text-sm text-coop-muted">
        Loading membership progress…
      </p>
    );
  return (
    <div className="my-4 space-y-4">
      {data.capital ? (
        <CapitalProgressCard capital={data.capital} />
      ) : (
        <div className="coop-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h3 className="font-bold">Personal share capital</h3>
            <p>{peso(data.validatedCapital)}</p>
            {data.legacyDeadline && (
              <p className="text-sm text-coop-muted">
                Recorded deadline: {data.legacyDeadline}
              </p>
            )}
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-coop-muted">
                Recorded policy
              </summary>
              Your existing obligations and classification are preserved.
              Contact the cooperative for review of legacy inconsistencies.
            </details>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("trackcoop:open-share-capital", {
                detail: { method: "cash" },
              }),
            )
          }
        >
          <WalletCards className="size-4" aria-hidden="true" />
          Contribute share capital
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>
      <details className="coop-panel p-4">
        <summary className="cursor-pointer font-bold">
          Agricultural sectors
        </summary>
        <div className="mt-4">
          <AgriculturalSectorFields
            value={data.sectors}
            onChange={(sectors) => setData({ ...data, sectors })}
          />
          <Button
            className="mt-4"
            disabled={!data.sectors.length}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await apiRequest("/api/members/me/membership-sectors", {
                  method: "PUT",
                  body: JSON.stringify({ sectors: data.sectors }),
                });
              } catch {
                setError("Unable to save agricultural sectors.");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save sectors
          </Button>
        </div>
      </details>
      <details
        className="coop-panel p-4"
        onToggle={(event) => setPaymentsOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer font-bold">
          Personal payment history
        </summary>
        <div className="mt-4">
          {paymentsOpen && <MembershipHistory kind="payments" />}
        </div>
      </details>
    </div>
  );
}
type HistoryItem = {
  id?: string;
  applicantName?: string;
  applicationCode?: string;
  status: string;
  createdAt?: string;
  qualifiedAt?: string;
  reference?: string;
  purpose?: string;
  amount?: number;
  submittedAt?: string;
};
export function MembershipHistory({
  kind,
}: {
  kind: "referrals" | "payments";
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: HistoryItem[];
    total: number;
  } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    apiRequest<{ items: HistoryItem[]; total: number }>(
      `/api/members/me/${kind === "referrals" ? "referrals" : "membership-payments"}?page=${page}&pageSize=10`,
    )
      .then((d) => {
        if (active) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [page, kind, retry]);
  if (error)
    return (
      <div role="alert">
        Unable to load history.
        <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
          Retry
        </Button>
      </div>
    );
  if (!data) return <p role="status">Loading history…</p>;
  return (
    <div>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={kind + " history"}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">
                {kind === "referrals" ? "Applicant" : "Reference"}
              </th>
              <th className="p-2">
                {kind === "referrals" ? "Application" : "Payment for"}
              </th>
              <th className="p-2">Status</th>
              <th className="p-2">Date</th>
              {kind === "payments" && (
                <th className="p-2 text-right">Amount</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr
                key={item.id ?? item.reference ?? i}
                className="border-t border-coop-border"
              >
                <td className="p-2">{item.applicantName ?? item.reference}</td>
                <td className="p-2">{item.applicationCode ?? item.purpose}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">
                  {new Date(
                    item.createdAt ?? item.submittedAt ?? "",
                  ).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}
                  {item.qualifiedAt && (
                    <span className="mt-1 block text-xs text-coop-muted">
                      Qualified{" "}
                      {new Date(item.qualifiedAt).toLocaleDateString("en-PH", {
                        timeZone: "Asia/Manila",
                      })}
                    </span>
                  )}
                </td>
                {kind === "payments" && (
                  <td className="p-2 text-right tabular-nums">
                    {peso(item.amount ?? 0)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && (
        <p className="py-4 text-sm text-coop-muted">No {kind} recorded.</p>
      )}
      <div className="mt-3 flex items-center justify-end gap-3">
        <span className="text-sm text-coop-muted">
          Page {page} of {Math.max(1, Math.ceil(data.total / 10))}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page * 10 >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
