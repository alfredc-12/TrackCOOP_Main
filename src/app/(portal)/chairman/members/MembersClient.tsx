"use client";

import { CheckCircle2, Clock3, RefreshCcw, Search, UserCheck, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  getMemberSummary,
  listMembers,
  type MemberProfile,
  type MemberSummary,
} from "@/features/chairman/people-api";

const emptySummary: MemberSummary = {
  total: 0,
  pendingApproval: 0,
  approved: 0,
  associate: 0,
  trueMember: 0,
  active: 0,
  inactive: 0,
  suspended: 0,
};

function statusTone(status: MemberProfile["officialMemberStatus"]) {
  if (status === "Active") return "success";
  if (status === "Pending") return "warning";
  if (["Suspended", "Terminated"].includes(status)) return "danger";
  return "neutral";
}

function approvalTone(status: MemberProfile["approvalStatus"]) {
  if (status === "Approved") return "success";
  if (status === "Rejected") return "danger";
  if (status === "Needs Information") return "warning";
  return "neutral";
}

export function MembersClient() {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [summary, setSummary] = useState<MemberSummary>(emptySummary);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextMembers, nextSummary] = await Promise.all([
        listMembers(search),
        getMemberSummary(),
      ]);
      setMembers(nextMembers);
      setSummary(nextSummary);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Member records could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMembers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMembers]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="People"
        title="Members"
        description="Member records, approval status, profile details, and official membership monitoring."
        actions={
          <button
            type="button"
            onClick={() => void loadMembers()}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Members" value={String(summary.total)} icon={UsersRound} />
        <StatCard label="Approved" value={String(summary.approved)} icon={CheckCircle2} />
        <StatCard label="Pending" value={String(summary.pendingApproval)} icon={Clock3} />
        <StatCard label="True Members" value={String(summary.trueMember)} icon={UserCheck} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            placeholder="Search members"
            type="search"
          />
        </label>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7A70]">
          {members.length} shown
        </p>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : members.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No member records found"
          description="Member profiles will appear here once they are created or imported into the cooperative database."
        />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Approval</th>
                <th className="px-5 py-4">Official Status</th>
                <th className="px-5 py-4">Barangay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#123D2A]">{member.fullName}</p>
                    <p className="mt-1 text-xs text-[#6C7A70]">{member.memberCode}</p>
                  </td>
                  <td className="px-5 py-4">{member.membershipType}</td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={approvalTone(member.approvalStatus)}>
                      {member.approvalStatus}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={statusTone(member.officialMemberStatus)}>
                      {member.officialMemberStatus}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4">{member.barangay ?? "Unspecified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}
