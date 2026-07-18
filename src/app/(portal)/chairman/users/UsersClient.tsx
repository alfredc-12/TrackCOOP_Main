"use client";

import { RefreshCcw, Search, ShieldCheck, UserRoundCog, UsersRound } from "lucide-react";
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
import { listUsers, type UserSummary } from "@/features/chairman/people-api";

function statusTone(status: UserSummary["accountStatus"]) {
  if (status === "Active") return "success";
  if (status === "Pending") return "warning";
  if (status === "Suspended") return "danger";
  return "neutral";
}

export function UsersClient() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setUsers(await listUsers(search));
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "User accounts could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.accountStatus === "Active").length,
      chairman: users.filter((user) => user.role === "chairman").length,
    }),
    [users],
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="People"
        title="User Accounts"
        description="Chairman-controlled account access, roles, and monitoring for staff and members."
        actions={
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Accounts" value={String(counts.total)} icon={UsersRound} />
        <StatCard label="Active" value={String(counts.active)} icon={ShieldCheck} />
        <StatCard label="Chairmen" value={String(counts.chairman)} icon={UserRoundCog} />
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
            placeholder="Search users"
            type="search"
          />
        </label>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7A70]">
          {users.length} shown
        </p>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UserRoundCog}
          title="No user accounts found"
          description="Create or activate accounts from the backend user-management workflow to populate this table."
        />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4 font-bold text-[#123D2A]">{user.displayName}</td>
                  <td className="px-5 py-4 capitalize">{user.role}</td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={statusTone(user.accountStatus)}>
                      {user.accountStatus}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4">{user.email}</td>
                  <td className="px-5 py-4">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : "Never"}
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
