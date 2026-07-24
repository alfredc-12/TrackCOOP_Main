"use client";

import { ClipboardList, RefreshCcw, Search, UserCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  listMembershipApplications,
  type MembershipApplication,
} from "./membership-api";

const filters = [
  ["", "All"],
  ["SUBMITTED", "Submitted"],
  ["UNDER_REVIEW", "Under Review"],
  ["NEEDS_INFORMATION", "Needs Information"],
  ["ON_HOLD", "On Hold"],
  ["APPROVED_PENDING_PAYMENT", "Pending Payment"],
  ["PAYMENT_UNDER_REVIEW", "Payment Review"],
  ["APPROVED", "Approved"],
  ["ACCOUNT_PENDING_ACTIVATION", "Account Pending"],
  ["ACCOUNT_CREATED", "Account Created"],
  ["REJECTED", "Rejected"],
] as const;

function tone(status: string) {
  if (["APPROVED", "ACCOUNT_CREATED"].includes(status)) return "success";
  if (["REJECTED", "CANCELLED"].includes(status)) return "danger";
  if (["SUBMITTED", "UNDER_REVIEW"].includes(status)) return "neutral";
  return "warning";
}

export function MembershipApplicationsView() {
  const [applications, setApplications] = useState<MembershipApplication[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setApplications(
        await listMembershipApplications(
          status || undefined,
          search || undefined,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Membership applications could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const summary = useMemo(
    () => ({
      new: applications.filter((item) => item.status === "SUBMITTED").length,
      review: applications.filter((item) => item.status === "UNDER_REVIEW")
        .length,
      pending: applications.filter(
        (item) => item.status === "APPROVED_PENDING_PAYMENT",
      ).length,
      approved: applications.filter((item) =>
        ["APPROVED", "ACCOUNT_PENDING_ACTIVATION", "ACCOUNT_CREATED"].includes(
          item.status,
        ),
      ).length,
    }),
    [applications],
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="People"
        title="Membership Applications"
        description="Review public membership applications, verify requirements, request additional information, approve qualified applicants, and authorize member-account creation."
        actions={<StatusBadge tone="success">Chairman workflow</StatusBadge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="New Applications"
          value={String(summary.new)}
          icon={ClipboardList}
        />
        <StatCard
          label="Under Review"
          value={String(summary.review)}
          icon={Search}
        />
        <StatCard
          label="Pending Payment"
          value={String(summary.pending)}
          icon={RefreshCcw}
        />
        <StatCard
          label="Approved / Accounts"
          value={String(summary.approved)}
          icon={UserCheck}
        />
      </div>
      <div className="rounded-lg border border-[#CAD8CB] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-md">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]"
              placeholder="Search reference, applicant, or contact"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`min-h-11 shrink-0 rounded-md px-3 text-xs font-bold ${
                  status === value
                    ? "bg-[#123D2A] text-white"
                    : "border border-[#CAD8CB] bg-white text-[#294B39]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingSkeleton />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No membership applications"
          description="New public applications and matching filtered records will appear here."
        />
      ) : (
        <DataTable>
          <table className="min-w-[1050px] divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.14em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Reference</th>
                <th className="px-5 py-4">Applicant</th>
                <th className="px-5 py-4">Barangay / Sector</th>
                <th className="px-5 py-4">Preference</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4">Submitted</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {applications.map((application) => (
                <tr key={application.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4 font-bold text-[#123D2A]">
                    {application.reference}
                    {application.possibleDuplicate ? (
                      <span className="mt-1 block text-xs text-[#9A392A]">
                        Possible duplicate
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold">{application.fullName}</p>
                    <p className="mt-1 text-xs text-[#6C7A70]">
                      {application.contactNumber}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {application.barangay}
                    <br />
                    <span className="text-xs text-[#6C7A70]">
                      {application.sector}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {application.preferredMembershipType.replaceAll("_", " ")}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={tone(application.status)}>
                      {application.status.replaceAll("_", " ")}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4">
                    {application.paymentStatus.replaceAll("_", " ")}
                  </td>
                  <td className="px-5 py-4">
                    {new Date(application.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/portal/chairman/members/applications/${application.id}`}
                      className="inline-flex min-h-11 items-center rounded-md border border-[#CAD8CB] px-4 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC]"
                    >
                      View Application
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}
