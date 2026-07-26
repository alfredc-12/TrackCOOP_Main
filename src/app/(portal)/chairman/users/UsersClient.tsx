"use client";

import {
  KeyRound,
  Link2,
  LogOut,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UsersRound,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { getAuthenticatedUser } from "@/lib/auth-client";
import { ApiClientError } from "@/lib/api-client";
import {
  changeUserRole,
  changeUserStatus,
  createUser,
  getUserDetail,
  getUserSummary,
  issueActivationLink,
  linkUserMember,
  listLinkableMembers,
  listUsersPaginated,
  revokeAllUserSessions,
  revokeUserSession,
  unlinkUserMember,
  updateUser,
  deleteUser,
  resetUserPassword,
  bulkUserAction,
  exportUsersCsv,
  getUserAuditLogs,
  type AccountStatus,
  type ActivationLinkResult,
  type LinkableMember,
  type RoleSlug,
  type UserDetail,
  type UserListQuery,
  type UserSession,
  type UserSummary,
  type UserSummaryCounts,
  type AuditLogEntry,
} from "@/features/chairman/people-api";

const accountStatuses: AccountStatus[] = ["Pending", "Active", "Suspended", "Inactive"];
const roles: RoleSlug[] = ["chairman", "bookkeeper", "member"];

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20";
const labelClass = "grid gap-2 text-sm font-semibold text-[#294B39]";

type ActionKind =
  | "activate"
  | "suspend"
  | "deactivate"
  | "reactivate"
  | "role"
  | "activation"
  | "revoke-session"
  | "revoke-all"
  | "link-member"
  | "unlink-member"
  | "delete"
  | "reset-password";

type PendingAction = {
  kind: ActionKind;
  user: UserDetail;
  session?: UserSession;
};

type UserFormState = {
  displayName: string;
  email: string;
  username: string;
  role: RoleSlug;
  accountStatus: AccountStatus;
  password: string;
  issueActivationLink: boolean;
};

const blankForm: UserFormState = {
  displayName: "",
  email: "",
  username: "",
  role: "member",
  accountStatus: "Pending",
  password: "",
  issueActivationLink: true,
};

function statusTone(status: AccountStatus) {
  if (status === "Active") return "success";
  if (status === "Pending") return "warning";
  if (status === "Suspended") return "danger";
  return "neutral";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function roleLabel(role: RoleSlug) {
  if (role === "chairman") return "Chairman";
  if (role === "bookkeeper") return "Bookkeeper";
  return "Member";
}

function actionStatus(kind: ActionKind): AccountStatus | null {
  if (kind === "activate" || kind === "reactivate") return "Active";
  if (kind === "suspend") return "Suspended";
  if (kind === "deactivate") return "Inactive";
  return null;
}

export function UsersClient() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [summary, setSummary] = useState<UserSummaryCounts>({
    total: 0,
    active: 0,
    pendingActivation: 0,
    suspendedInactive: 0,
  });
  const [query, setQuery] = useState<UserListQuery>({
    page: 1,
    pageSize: 5,
    search: "",
    role: "all",
    status: "all",
    sortBy: "createdAt",
    sortDirection: "desc",
  });
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDetail | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [activationResult, setActivationResult] = useState<ActivationLinkResult | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [listResult, counts, authUser] = await Promise.all([
        listUsersPaginated(query),
        getUserSummary(),
        getAuthenticatedUser(),
      ]);
      setUsers(listResult.users);
      setTotal(listResult.total);
      setSummary(counts);
      setCurrentUserId(authUser.id);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "User accounts could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const refreshSelected = useCallback(async (userId: string) => {
    const detail = await getUserDetail(userId);
    setSelectedUser(detail);
    return detail;
  }, []);

  async function runMutation(successMessage: string, action: () => Promise<unknown>) {
    setIsMutating(true);
    try {
      await action();
      toast.success(successMessage);
      await loadUsers();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "The account action could not be completed.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function openDetail(userId: string) {
    setIsMutating(true);
    try {
      setSelectedUser(await getUserDetail(userId));
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "User details could not be loaded.");
    } finally {
      setIsMutating(false);
    }
  }

  function updateQuery(next: Partial<UserListQuery>) {
    setQuery((current) => ({ ...current, ...next, page: next.page ?? 1 }));
    setSelectedUserIds(new Set()); // Clear selection on pagination/filter change
  }

  function handleExportCsv() {
    window.location.href = exportUsersCsv(query);
  }

  function toggleSelection(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAllSelection() {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map((u) => u.id)));
    }
  }

  async function openAuditLogs(userId: string) {
    setIsMutating(true);
    try {
      setAuditLogs(await getUserAuditLogs(userId));
      setAuditLogsOpen(true);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Audit logs could not be loaded.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        eyebrow="People"
        title="User Accounts"
        description="Chairman-controlled account access, role assignments, activation links, and session lifecycle."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43]"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Create Account
            </button>
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Total Accounts" value={String(summary.total)} icon={UsersRound} />
        <StatCard label="Active" value={String(summary.active)} icon={ShieldCheck} />
        <StatCard label="Pending Activation" value={String(summary.pendingActivation)} icon={KeyRound} />
        <StatCard label="Suspended/Inactive" value={String(summary.suspendedInactive)} icon={UserMinus} />
      </div>

      <section className="grid min-w-0 gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(8rem,10rem))]">
          <label className="relative block min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
            <input
              value={query.search ?? ""}
              onChange={(event) => updateQuery({ search: event.target.value })}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
              placeholder="Search users"
              type="search"
            />
          </label>
          <select className={inputClass} value={query.role ?? "all"} onChange={(event) => updateQuery({ role: event.target.value as UserListQuery["role"] })} aria-label="Role filter">
            <option value="all">All roles</option>
            {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select>
          <select className={inputClass} value={query.status ?? "all"} onChange={(event) => updateQuery({ status: event.target.value as UserListQuery["status"] })} aria-label="Status filter">
            <option value="all">All statuses</option>
            {accountStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
          <select className={inputClass} value={query.sortBy ?? "createdAt"} onChange={(event) => updateQuery({ sortBy: event.target.value as UserListQuery["sortBy"] })} aria-label="Sort users by">
            <option value="createdAt">Created date</option>
            <option value="displayName">Display name</option>
            <option value="email">Email</option>
            <option value="role">Role</option>
            <option value="accountStatus">Status</option>
          </select>
          <select className={inputClass} value={query.sortDirection ?? "desc"} onChange={(event) => updateQuery({ sortDirection: event.target.value as UserListQuery["sortDirection"] })} aria-label="Sort direction">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No user accounts found"
          description="Adjust the search or filters, or create a new account."
        />
      ) : (
        <>
          {selectedUserIds.size > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-[#CAD8CB] bg-[#EEF2EC] p-3 text-sm font-semibold text-[#123D2A]">
              <span>{selectedUserIds.size} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBulkActionOpen(true)}
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-[#123D2A] shadow-sm ring-1 ring-inset ring-[#CAD8CB] hover:bg-gray-50"
                >
                  Bulk Actions
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set())}
                  className="rounded-md px-3 py-1.5 text-xs font-bold text-[#5D6D63] hover:bg-[#CAD8CB]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <UserTable
            users={users}
            onOpen={openDetail}
            selectedUserIds={selectedUserIds}
            toggleSelection={toggleSelection}
            toggleAllSelection={toggleAllSelection}
          />
          <UserCards users={users} onOpen={openDetail} />
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-[#CAD8CB] bg-white p-4 text-sm font-semibold text-[#294B39] sm:flex-row">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateQuery({ page: 1 })}
                className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="First page"
              >
                <ChevronsLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateQuery({ page: page - 1 })}
                className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
            </div>

            <span className="px-2">
              Page {page} of {totalPages} &middot; {total} accounts
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => updateQuery({ page: page + 1 })}
                className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => updateQuery({ page: totalPages })}
                className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Last page"
              >
                <ChevronsRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      <UserFormDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
        onSave={(input) => runMutation("User account created.", async () => {
          const result = await createUser(input);
          if (result.activationUrl) {
            setActivationResult({
              user: result.user,
              activationUrl: result.activationUrl,
              activationTokenExpiresAt: result.activationTokenExpiresAt ?? "",
            });
          }
          setCreateOpen(false);
        })}
      />

      <UserFormDialog
        key={editUser?.id ?? "edit-closed"}
        open={Boolean(editUser)}
        mode="edit"
        user={editUser ?? undefined}
        onOpenChange={(open) => {
          if (!open) setEditUser(null);
        }}
        onSave={(input) => runMutation("User account updated.", async () => {
          if (!editUser) return;
          await updateUser(editUser.id, {
            displayName: input.displayName,
            email: input.email,
            username: input.username || null,
          });
          await refreshSelected(editUser.id);
          setEditUser(null);
        })}
      />

      <UserDetailDialog
        user={selectedUser}
        currentUserId={currentUserId}
        isMutating={isMutating}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
        onEdit={(user) => {
          setSelectedUser(null);
          setEditUser(user);
        }}
        onAction={setPendingAction}
        onRefresh={refreshSelected}
        onViewAuditLogs={openAuditLogs}
      />

      <LifecycleActionDialog
        action={pendingAction}
        currentUserId={currentUserId}
        isMutating={isMutating}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        onSubmit={(payload) => runMutation(payload.successMessage, async () => {
          const action = pendingAction;
          if (!action) return;

          if (action.kind === "role") {
            await changeUserRole(action.user.id, payload.role, payload.reason);
          } else if (action.kind === "activation") {
            const result = await issueActivationLink(action.user.id, payload.reason);
            setActivationResult(result);
          } else if (action.kind === "revoke-session" && action.session) {
            const detail = await revokeUserSession(action.user.id, action.session.id, payload.reason);
            setSelectedUser(detail);
          } else if (action.kind === "revoke-all") {
            const detail = await revokeAllUserSessions(action.user.id, payload.reason);
            setSelectedUser(detail);
          } else if (action.kind === "link-member") {
            const detail = await linkUserMember(action.user.id, payload.memberId, payload.reason);
            setSelectedUser(detail);
          } else if (action.kind === "unlink-member") {
            const detail = await unlinkUserMember(action.user.id, payload.reason);
            setSelectedUser(detail);
          } else if (action.kind === "reset-password") {
            if (!payload.password) throw new Error("Password is required.");
            await resetUserPassword(action.user.id, payload.password, payload.reason);
          } else if (action.kind === "delete") {
            await deleteUser(action.user.id, payload.reason, payload.selfConfirmation);
            setSelectedUser(null);
          } else {
            const status = actionStatus(action.kind);
            if (status) {
              await changeUserStatus(
                action.user.id,
                status,
                payload.reason,
                payload.selfConfirmation,
              );
            }
          }

          setPendingAction(null);
          if (action.kind !== "revoke-session" && action.kind !== "revoke-all" && action.kind !== "link-member" && action.kind !== "unlink-member") {
            await refreshSelected(action.user.id).catch(() => null);
          }
        })}
      />

      <ActivationResultDialog
        result={activationResult}
        onOpenChange={(open) => {
          if (!open) setActivationResult(null);
        }}
      />

      <BulkActionDialog
        open={bulkActionOpen}
        onOpenChange={setBulkActionOpen}
        selectedCount={selectedUserIds.size}
        onConfirm={async (action, reason) => {
          await runMutation(`Successfully processed ${selectedUserIds.size} accounts.`, async () => {
            await bulkUserAction(Array.from(selectedUserIds), action, reason);
            setSelectedUserIds(new Set());
          });
        }}
      />

      <AuditLogDialog
        open={auditLogsOpen}
        onOpenChange={setAuditLogsOpen}
        logs={auditLogs}
      />
    </div>
  );
}

function UserTable({
  users,
  onOpen,
  selectedUserIds,
  toggleSelection,
  toggleAllSelection,
}: {
  users: UserSummary[];
  onOpen: (userId: string) => Promise<void>;
  selectedUserIds: Set<string>;
  toggleSelection: (userId: string) => void;
  toggleAllSelection: () => void;
}) {
  const allSelected = users.length > 0 && selectedUserIds.size === users.length;
  const someSelected = selectedUserIds.size > 0 && !allSelected;

  return (
    <div className="hidden 2xl:block min-w-0">
      <div className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-white shadow-sm">
        <table className="w-full divide-y divide-[#E2E8E2] text-left text-sm table-fixed">
          <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
            <tr>
              <th className="px-5 py-4 w-10">
                <input
                  type="checkbox"
                  className="rounded border-[#CAD8CB] text-[#123D2A] focus:ring-[#1F6B43]"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={toggleAllSelection}
                  aria-label="Select all"
                />
              </th>
              <th className="px-5 py-4">Display Name</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Username</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Linked Member</th>
              <th className="px-5 py-4">Created</th>
              <th className="px-5 py-4">Last Login</th>
              <th className="px-5 py-4">Sessions</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
            {users.map((user) => (
              <tr key={user.id} className={`hover:bg-[#F7F8F3] ${selectedUserIds.has(user.id) ? "bg-[#EEF2EC]" : ""}`}>
                <td className="px-5 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-[#CAD8CB] text-[#123D2A] focus:ring-[#1F6B43]"
                    checked={selectedUserIds.has(user.id)}
                    onChange={() => toggleSelection(user.id)}
                    aria-label={`Select ${user.displayName}`}
                  />
                </td>
                <td className="px-5 py-4 font-bold text-[#123D2A]">{user.displayName}</td>
                <td className="px-5 py-4">{user.email}</td>
                <td className="px-5 py-4">{user.username ?? "None"}</td>
                <td className="px-5 py-4">{roleLabel(user.role)}</td>
                <td className="px-5 py-4">
                  <StatusBadge tone={statusTone(user.accountStatus)}>{user.accountStatus}</StatusBadge>
                </td>
                <td className="px-5 py-4">{user.linkedMemberCode ?? "Unlinked"}</td>
                <td className="px-5 py-4">{formatDate(user.createdAt)}</td>
                <td className="px-5 py-4">{formatDate(user.lastLoginAt)}</td>
                <td className="px-5 py-4">{user.activeSessionCount}</td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void onOpen(user.id)}
                    className="h-9 rounded-md bg-[#123D2A] px-3 text-xs font-bold text-white transition hover:bg-[#1F6B43]"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserCards({ users, onOpen }: { users: UserSummary[]; onOpen: (userId: string) => Promise<void> }) {
  return (
    <div className="grid gap-3 2xl:hidden">
      {users.map((user) => (
        <article key={user.id} className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-bold text-[#123D2A]">{user.displayName}</p>
              <p className="mt-1 break-all text-sm text-[#5D6D63]">{user.email}</p>
            </div>
            <StatusBadge tone={statusTone(user.accountStatus)}>{user.accountStatus}</StatusBadge>
          </div>
          <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 text-sm text-[#294B39]">
            <Info label="Role" value={roleLabel(user.role)} />
            <Info label="Username" value={user.username ?? "None"} />
            <Info label="Member" value={user.linkedMemberCode ?? "Unlinked"} />
            <Info label="Sessions" value={String(user.activeSessionCount)} />
          </dl>
          <button
            type="button"
            onClick={() => void onOpen(user.id)}
            className="mt-4 h-10 w-full rounded-md bg-[#123D2A] text-sm font-bold text-white transition hover:bg-[#1F6B43]"
          >
            Manage Account
          </button>
        </article>
      ))}
    </div>
  );
}

function UserDetailDialog({
  user,
  currentUserId,
  isMutating,
  onOpenChange,
  onEdit,
  onAction,
  onRefresh,
  onViewAuditLogs,
}: {
  user: UserDetail | null;
  currentUserId: string;
  isMutating: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: UserDetail) => void;
  onAction: (action: PendingAction) => void;
  onRefresh: (userId: string) => Promise<UserDetail>;
  onViewAuditLogs: (userId: string) => void;
}) {
  if (!user) return null;

  const canLink = user.role === "member" && !user.linkedMemberId;
  const canUnlink = user.role === "member" && Boolean(user.linkedMemberId);

  return (
    <FormDialog
      open={Boolean(user)}
      onOpenChange={onOpenChange}
      title={user.displayName}
      description="Account profile, linked member profile, sessions, and lifecycle controls."
    >
      <div className="grid gap-5">
        <section className="grid gap-3 rounded-lg border border-[#CAD8CB] p-4 md:grid-cols-3">
          <Info label="Email" value={user.email} />
          <Info label="Username" value={user.username ?? "None"} />
          <Info label="Role" value={roleLabel(user.role)} />
          <Info label="Status" value={user.accountStatus} />
          <Info label="Linked Member" value={user.linkedMemberCode ? `${user.linkedMemberCode} · ${user.linkedMemberName}` : "Unlinked"} />
          <Info label="Pending Activation" value={user.activationTokenExpiresAt ? formatDate(user.activationTokenExpiresAt) : "None"} />
        </section>

        <section className="grid gap-6">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Profile & Role</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton icon={UserCog} label="Edit Profile" onClick={() => onEdit(user)} />
              <ActionButton icon={UserCog} label="Change Role" onClick={() => onAction({ kind: "role", user })} />
              <ActionButton icon={Link2} label="Link Member" disabled={!canLink} onClick={() => onAction({ kind: "link-member", user })} />
              <ActionButton icon={Link2} label="Unlink Member" disabled={!canUnlink} onClick={() => onAction({ kind: "unlink-member", user })} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Access & Security</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton icon={KeyRound} label="Reset Password" onClick={() => onAction({ kind: "reset-password", user })} />
              <ActionButton icon={KeyRound} label="Issue Activation Link" disabled={user.accountStatus === "Active"} onClick={() => onAction({ kind: "activation", user })} />
            </div>
          </div>

          <div className="rounded-lg border border-[#E7B8A8] bg-[#FFF5F3] p-4">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#9A392A]">Danger Zone</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton icon={ShieldCheck} label="Activate" disabled={user.accountStatus === "Active"} onClick={() => onAction({ kind: "activate", user })} />
              <ActionButton icon={UserMinus} label="Suspend" disabled={user.accountStatus === "Suspended"} onClick={() => onAction({ kind: "suspend", user })} />
              <ActionButton icon={UserMinus} label="Deactivate" disabled={user.accountStatus === "Inactive"} onClick={() => onAction({ kind: "deactivate", user })} />
              <ActionButton icon={UserCheck} label="Reactivate" disabled={user.accountStatus === "Active"} onClick={() => onAction({ kind: "reactivate", user })} />
              <ActionButton icon={Trash2} label="Delete Account" onClick={() => onAction({ kind: "delete", user })} />
            </div>
          </div>

          {user.id === currentUserId ? (
            <p className="rounded-md bg-[#FFF4D7] p-3 text-sm font-semibold text-[#7A5A00]">
              Changes that disable your own account require typing your display name.
            </p>
          ) : null}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Active Sessions</h2>
            <button
              type="button"
              disabled={isMutating || user.sessions.length === 0}
              onClick={() => onAction({ kind: "revoke-all", user })}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#E7B8A8] px-3 text-xs font-bold text-[#9A392A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Revoke All
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {user.sessions.length === 0 ? (
              <p className="rounded-md border border-dashed border-[#CAD8CB] p-4 text-sm text-[#5D6D63]">No active sessions.</p>
            ) : (
              user.sessions.map((session) => (
                <div key={session.id} className="flex flex-col gap-3 rounded-md border border-[#CAD8CB] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-[#123D2A]">{session.ipAddress ?? "Unknown IP"} {session.isCurrent ? "· Current session" : ""}</p>
                    <p className="mt-1 text-[#5D6D63]">{session.userAgent ?? "Unknown device"}</p>
                    <p className="mt-1 text-xs text-[#6C7A70]">Created {formatDate(session.createdAt)} · Expires {formatDate(session.expiresAt)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => onAction({ kind: "revoke-session", user, session })}
                    className="h-9 rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onRefresh(user.id)}
              className="h-9 rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]"
            >
              Refresh Details
            </button>
            <button
              type="button"
              onClick={() => onViewAuditLogs(user.id)}
              className="h-9 rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]"
            >
              View Activity Log
            </button>
          </div>
        </section>
      </div>
    </FormDialog>
  );
}

function UserFormDialog({
  open,
  mode,
  user,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  user?: UserDetail;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UserFormState) => Promise<void>;
}) {
  const [draft, setDraft] = useState<UserFormState>(
    user
      ? {
        displayName: user.displayName,
        email: user.email,
        username: user.username ?? "",
        role: user.role,
        accountStatus: user.accountStatus,
        password: "",
        issueActivationLink: false,
      }
      : blankForm,
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create Account" : "Edit Account"}
      description={mode === "create" ? "Create a staff or member portal account." : "Update profile fields only."}
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(draft);
        }}
      >
        <label className={labelClass}>
          Display Name
          <input className={inputClass} required value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} />
        </label>
        <label className={labelClass}>
          Email
          <input className={inputClass} required type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
        </label>
        <label className={labelClass}>
          Username
          <input className={inputClass} value={draft.username} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} />
        </label>
        {mode === "create" ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Role
                <select className={inputClass} value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as RoleSlug }))}>
                  {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Status
                <select className={inputClass} value={draft.accountStatus} disabled={draft.issueActivationLink} onChange={(event) => setDraft((current) => ({ ...current, accountStatus: event.target.value as AccountStatus }))}>
                  {accountStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#294B39]">
              <input type="checkbox" checked={draft.issueActivationLink} onChange={(event) => setDraft((current) => ({ ...current, issueActivationLink: event.target.checked, accountStatus: event.target.checked ? "Pending" : current.accountStatus }))} />
              Issue activation link instead of setting a password
            </label>
            {!draft.issueActivationLink ? (
              <label className={labelClass}>
                Temporary Password
                <input className={inputClass} required minLength={12} type="password" value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} />
              </label>
            ) : null}
          </>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onOpenChange(false)} className="h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">
            Cancel
          </button>
          <button type="submit" className="h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white">
            Save
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

function LifecycleActionDialog({
  action,
  currentUserId,
  isMutating,
  onOpenChange,
  onSubmit,
}: {
  action: PendingAction | null;
  currentUserId: string;
  isMutating: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    reason: string;
    selfConfirmation?: string;
    role: RoleSlug;
    memberId: string;
    password?: string;
    successMessage: string;
  }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [selfConfirmation, setSelfConfirmation] = useState("");
  const [role, setRole] = useState<RoleSlug>("member");
  const [memberId, setMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [members, setMembers] = useState<LinkableMember[]>([]);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (action?.kind !== "link-member") return;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      listLinkableMembers(memberSearch)
        .then((result) => {
          if (active) setMembers(result);
        })
        .catch(() => {
          if (active) setMembers([]);
        });
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [action?.kind, memberSearch]);

  if (!action) return null;

  const status = actionStatus(action.kind);
  const requiresSelfConfirmation =
    action.kind === "delete" ||
    (action.user.id === currentUserId && status !== null && status !== "Active");
  const title = actionTitle(action);

  return (
    <FormDialog
      open={Boolean(action)}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          setSelfConfirmation("");
          setRole("member");
          setMemberId("");
          setMemberSearch("");
          setMembers([]);
          setPassword("");
        }
        onOpenChange(open);
      }}
      title={title}
      description={
        action.kind === "delete"
          ? "WARNING: This will permanently delete the user account and cannot be undone."
          : "This action requires a reason and will be recorded in the audit log."
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            reason,
            selfConfirmation,
            role,
            memberId,
            password,
            successMessage: successMessage(action),
          });
        }}
      >
        {action.kind === "role" ? (
          <label className={labelClass}>
            New Role
            <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as RoleSlug)}>
              {roles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
            </select>
          </label>
        ) : null}
        {action.kind === "reset-password" ? (
          <label className={labelClass}>
            New Password
            <input className={inputClass} required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        ) : null}
        {action.kind === "link-member" ? (
          <div className="grid gap-3">
            <label className={labelClass}>
              Search Unlinked Members
              <input className={inputClass} value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Name, code, or email" />
            </label>
            <label className={labelClass}>
              Member Profile
              <select className={inputClass} required value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                <option value="">Select member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.memberCode} · {member.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <label className={labelClass}>
          Reason
          <textarea
            required
            rows={3}
            className="w-full rounded-md border border-[#CAD8CB] bg-white px-3 py-2 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {requiresSelfConfirmation ? (
          <label className={labelClass}>
            Type {action.user.displayName} to confirm
            <input className={inputClass} required value={selfConfirmation} onChange={(event) => setSelfConfirmation(event.target.value)} />
          </label>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onOpenChange(false)} className="h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">
            Cancel
          </button>
          <button disabled={isMutating} type="submit" className={`h-11 rounded-md px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${action.kind === "delete" ? "bg-[#B91C1C]" : "bg-[#123D2A]"}`}>
            Confirm
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

function ActivationResultDialog({ result, onOpenChange }: { result: ActivationLinkResult | null; onOpenChange: (open: boolean) => void }) {
  return (
    <FormDialog
      open={Boolean(result)}
      onOpenChange={onOpenChange}
      title="Activation Link Issued"
      description="This raw activation URL is shown once for secure delivery."
    >
      {result ? (
        <div className="grid gap-4">
          <Info label="Account" value={result.user.displayName} />
          <Info label="Expires" value={formatDate(result.activationTokenExpiresAt)} />
          <div className="rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-3 text-sm font-semibold text-[#123D2A] break-all">
            {result.activationUrl}
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white">
            Done
          </button>
        </div>
      ) : null}
    </FormDialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6C7A70]">{label}</p>
      <p className="mt-1 break-words font-semibold text-[#123D2A]">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] px-3 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function actionTitle(action: PendingAction) {
  const titles: Record<ActionKind, string> = {
    activate: "Activate Account",
    suspend: "Suspend Account",
    deactivate: "Deactivate Account",
    reactivate: "Reactivate Account",
    role: "Change Account Role",
    activation: "Issue Activation Link",
    "revoke-session": "Revoke Session",
    "revoke-all": "Revoke All Sessions",
    "link-member": "Link Member Profile",
    "unlink-member": "Unlink Member Profile",
    delete: "Hard Delete Account",
    "reset-password": "Reset Password",
  };

  return titles[action.kind];
}

function successMessage(action: PendingAction) {
  const messages: Record<ActionKind, string> = {
    activate: "Account activated.",
    suspend: "Account suspended.",
    deactivate: "Account deactivated.",
    reactivate: "Account reactivated.",
    role: "Account role changed.",
    activation: "Activation link issued.",
    "revoke-session": "Session revoked.",
    "revoke-all": "Sessions revoked.",
    "link-member": "Member profile linked.",
    "unlink-member": "Member profile unlinked.",
    delete: "User account deleted permanently.",
    "reset-password": "User password reset successfully.",
  };

  return messages[action.kind];
}

function BulkActionDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (action: "Suspend" | "Activate" | "Delete", reason: string) => Promise<void>;
}) {
  const [action, setAction] = useState<"Suspend" | "Activate" | "Delete">("Suspend");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk Account Actions"
      description={`Apply an action to ${selectedCount} selected accounts simultaneously.`}
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setIsSubmitting(true);
          onConfirm(action, reason).finally(() => {
            setIsSubmitting(false);
            onOpenChange(false);
            setReason("");
          });
        }}
      >
        <label className="block text-sm font-bold text-[#123D2A]">
          Action to Apply
          <select
            className="mt-1 block h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            value={action}
            onChange={(event) => setAction(event.target.value as "Suspend" | "Activate" | "Delete")}
            required
          >
            <option value="Suspend">Suspend Accounts</option>
            <option value="Activate">Activate Accounts</option>
            <option value="Delete">Delete Accounts Permanently</option>
          </select>
        </label>

        <label className="block text-sm font-bold text-[#123D2A]">
          Reason
          <textarea
            required
            rows={3}
            className="mt-1 block w-full rounded-md border border-[#CAD8CB] bg-white px-3 py-2 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why are you taking this action?"
          />
        </label>

        {action === "Delete" ? (
          <p className="rounded-md bg-[#FFF4D7] p-3 text-sm font-semibold text-[#7A5A00]">
            Warning: Deleting accounts is permanent and cannot be undone.
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onOpenChange(false)} className="h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">
            Cancel
          </button>
          <button disabled={isSubmitting} type="submit" className={`h-11 rounded-md px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${action === "Delete" ? "bg-[#B91C1C]" : "bg-[#123D2A]"}`}>
            Confirm Action
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

function AuditLogDialog({
  open,
  onOpenChange,
  logs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: AuditLogEntry[];
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Activity Log"
      description="Recent lifecycle and security actions for this account."
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {logs.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#CAD8CB] p-4 text-sm text-[#5D6D63]">No recent activity found.</p>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#CAD8CB] before:to-transparent">
            {logs.map((log) => (
              <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-[#123D2A] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
                <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] rounded-md border border-[#CAD8CB] bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#123D2A] text-sm">{log.action}</span>
                    <time className="text-xs text-[#6C7A70]">{formatDate(log.actionTime)}</time>
                  </div>
                  <p className="text-sm text-[#5D6D63]">{log.description || "System action"}</p>
                  <p className="text-xs text-[#6C7A70] mt-1">by {log.actorName || "System"} ({log.ipAddress || "Internal"})</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
