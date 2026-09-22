"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Activity,
  ChevronDown,
  Download,
  FileText,
  KeyRound,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  Monitor,
  Pencil,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UserRound,
  UsersRound,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
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
const sortOptions = [
  { value: "createdAt:desc", label: "Created date" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "displayName:asc", label: "Display name A-Z" },
  { value: "displayName:desc", label: "Display name Z-A" },
  { value: "email:asc", label: "Email A-Z" },
  { value: "role:asc", label: "Role A-Z" },
  { value: "accountStatus:asc", label: "Status A-Z" },
] as const;

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-[#D9E2D8] bg-white px-3 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20";
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
  memberId?: string;
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "UA";
}

function UserMetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-[#D9E2D8] bg-white p-4 shadow-[0_12px_28px_rgba(18,61,42,0.05)]">
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#EEF6EC] text-[#1F6B43]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#6C7A70]">{label}</p>
          <p className="text-2xl font-black leading-none text-[#123D2A]">{value}</p>
        </div>
      </div>
    </article>
  );
}

function ComboSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Select option",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  ariaLabel: string;
  placeholder?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="group inline-flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-[#D9E2D8] bg-white px-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43]/55 hover:bg-[#FBFCF8] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          aria-label={ariaLabel}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-[#365f4a] transition group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-[90] max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border border-[#DDE8D8] bg-white p-2 text-[#365f4a] shadow-2xl shadow-[#123D2A]/14"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              disabled={option.disabled}
              onSelect={() => onChange(option.value)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition ${
                option.value === value
                  ? "bg-[#EAF3E8] text-[#123D2A]"
                  : "text-[#365F4A] hover:bg-[#EAF3E8] hover:text-[#123D2A] focus:bg-[#EAF3E8] focus:text-[#123D2A]"
              } data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45`}
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {option.value === value ? <span className="size-1.5 shrink-0 rounded-full bg-[#1F6B43]" aria-hidden="true" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function isHiddenSystemUser(user: UserSummary) {
  return (
    user.username === "paymongo-system" ||
    user.email === "paymongo-system@trackcoop.local"
  );
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
    includeHidden: false,
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
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [listResult, counts, authUser] = await Promise.all([
        listUsersPaginated(query),
        getUserSummary({ includeHidden: query.includeHidden }),
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
    setExpandedUserId(null);
  }

  function handleExportCsv() {
    window.location.href = exportUsersCsv(query);
  }

  function updateSort(value: string) {
    const [sortBy, sortDirection] = value.split(":") as [
      NonNullable<UserListQuery["sortBy"]>,
      NonNullable<UserListQuery["sortDirection"]>,
    ];
    updateQuery({ sortBy, sortDirection });
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

  async function openResetPassword(userId: string) {
    setIsMutating(true);
    try {
      const detail = await getUserDetail(userId);
      setPendingAction({ kind: "reset-password", user: detail });
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "User details could not be loaded.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        eyebrow="People"
        title="User Accounts"
        description="Manage access, roles, and account status."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white shadow-[0_10px_22px_rgba(18,61,42,0.18)] transition hover:bg-[#1F6B43]"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Create Account
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#D9E2D8] bg-white px-4 text-sm font-bold text-[#294B39] shadow-sm transition hover:bg-[#F7F8F3]"
            >
              <Download className="size-4" aria-hidden="true" />
              Export
            </button>
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="grid size-11 place-items-center rounded-md border border-[#D9E2D8] bg-white text-[#123D2A] shadow-sm transition hover:bg-[#F7F8F3]"
              aria-label="Refresh users"
              title="Refresh users"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UserMetricCard label="Total Accounts" value={String(summary.total)} icon={UsersRound} />
        <UserMetricCard label="Active" value={String(summary.active)} icon={ShieldCheck} />
        <UserMetricCard label="Pending Activation" value={String(summary.pendingActivation)} icon={KeyRound} />
        <UserMetricCard label="Suspended / Inactive" value={String(summary.suspendedInactive)} icon={UserMinus} />
      </div>

      <section className="grid min-w-0 gap-3 rounded-lg border border-[#D9E2D8] bg-white p-4 shadow-[0_14px_32px_rgba(18,61,42,0.06)]">
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.6fr)_minmax(8rem,0.7fr)_minmax(9rem,0.7fr)_minmax(10rem,0.8fr)_minmax(8rem,0.7fr)_auto]">
          <label className="relative block min-w-0 md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
            <input
              value={query.search ?? ""}
              onChange={(event) => updateQuery({ search: event.target.value })}
              className="h-11 w-full rounded-md border border-[#D9E2D8] bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-[#8A9A91] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
              placeholder="Search users"
              type="search"
            />
          </label>
          <ComboSelect
            value={query.role ?? "all"}
            onChange={(value) => updateQuery({ role: value })}
            ariaLabel="Role filter"
            options={[
              { value: "all", label: "All roles" },
              ...roles.map((role) => ({ value: role, label: roleLabel(role) })),
            ]}
          />
          <ComboSelect
            value={query.status ?? "all"}
            onChange={(value) => updateQuery({ status: value })}
            ariaLabel="Status filter"
            options={[
              { value: "all", label: "All statuses" },
              ...accountStatuses.map((status) => ({ value: status, label: status })),
            ]}
          />
          <ComboSelect
            value={`${query.sortBy ?? "createdAt"}:${query.sortDirection ?? "desc"}`}
            onChange={updateSort}
            ariaLabel="Sort users"
            options={[...sortOptions]}
          />
          <ComboSelect
            value={query.sortDirection ?? "desc"}
            onChange={(value) => updateQuery({ sortDirection: value })}
            ariaLabel="Sort direction"
            options={[
              { value: "desc", label: "Descending" },
              { value: "asc", label: "Ascending" },
            ]}
          />
          <button
            type="button"
            onClick={() => updateQuery({ includeHidden: !query.includeHidden })}
            className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md bg-[#F7F8F3] px-3 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC]"
            role="switch"
            aria-checked={Boolean(query.includeHidden)}
            aria-label={query.includeHidden ? "Hide hidden accounts" : "Show hidden accounts"}
            title={query.includeHidden ? "Hide hidden accounts" : "Show hidden accounts"}
          >
            {query.includeHidden ? (
              <Eye className="size-4" aria-hidden="true" />
            ) : (
              <EyeOff className="size-4" aria-hidden="true" />
            )}
            <span
              className={`relative h-5 w-9 rounded-full transition ${
                query.includeHidden ? "bg-[#123D2A]" : "bg-[#D9E2D8]"
              }`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${
                  query.includeHidden ? "left-[1.125rem]" : "left-0.5"
                }`}
              />
            </span>
          </button>
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
          <UserAccountList
            users={users}
            onOpen={openDetail}
            onResetPassword={openResetPassword}
            expandedUserId={expandedUserId}
            onToggleExpanded={(userId) => setExpandedUserId((current) => (current === userId ? null : userId))}
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={(nextPage) => updateQuery({ page: nextPage })}
            onPageSizeChange={(nextPageSize) => updateQuery({ pageSize: nextPageSize, page: 1 })}
          />
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

      <AuditLogDialog
        open={auditLogsOpen}
        onOpenChange={setAuditLogsOpen}
        logs={auditLogs}
      />
    </div>
  );
}

function UserAccountList({
  users,
  onOpen,
  onResetPassword,
  expandedUserId,
  onToggleExpanded,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  users: UserSummary[];
  onOpen: (userId: string) => Promise<void>;
  onResetPassword: (userId: string) => Promise<void>;
  expandedUserId: string | null;
  onToggleExpanded: (userId: string) => void;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min((page - 1) * pageSize + users.length, total);

  return (
    <section className="overflow-hidden rounded-lg border border-[#D9E2D8] bg-white shadow-[0_16px_34px_rgba(18,61,42,0.06)]">
      <div className="hidden grid-cols-[minmax(14rem,1.4fr)_minmax(7rem,.7fr)_minmax(9rem,.9fr)_minmax(8rem,.7fr)_4rem] border-b border-[#E7EEE5] bg-[#FBFCF8] px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-[#6C7A70] md:grid">
        <button type="button" className="inline-flex items-center gap-1 text-left" aria-label="Name column">
          Name
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
        <span>Role</span>
        <span>Member ID</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>

      <div className="divide-y divide-[#E7EEE5]">
        {users.map((user) => {
          const expanded = expandedUserId === user.id;
          const memberCode = user.linkedMemberCode ?? "Unlinked";

          return (
            <article key={user.id} className="bg-white">
              <div className="grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[minmax(14rem,1.4fr)_minmax(7rem,.7fr)_minmax(9rem,.9fr)_minmax(8rem,.7fr)_4rem] md:items-center md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-sm font-black text-[#123D2A]">
                    {initials(user.displayName)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate font-black text-[#123D2A]">{user.displayName}</p>
                      {isHiddenSystemUser(user) ? (
                        <span className="rounded-full bg-[#FFF3C9] px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#775200]">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#5D6D63]">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm md:block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8A9A91] md:hidden">Role</span>
                  <span className="font-semibold text-[#294B39]">{roleLabel(user.role)}</span>
                </div>

                <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm md:block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8A9A91] md:hidden">Member ID</span>
                  <span className="font-semibold text-[#294B39]">{memberCode}</span>
                </div>

                <div className="grid grid-cols-[6rem_1fr] items-center gap-2 md:block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8A9A91] md:hidden">Status</span>
                  <StatusBadge tone={statusTone(user.accountStatus)}>{user.accountStatus}</StatusBadge>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onToggleExpanded(user.id)}
                    className="ml-auto flex size-8 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-[#123D2A] transition hover:border-[#CAD8CB] hover:bg-[#EEF2EC]"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${user.displayName}`}
                  >
                    <ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {expanded ? (
                <div className="px-4 pb-4 md:px-5">
                  <div className="rounded-lg border border-[#D9E2D8] bg-[#FBFCF8] p-4 shadow-[0_10px_24px_rgba(18,61,42,0.04)]">
                    <dl className="grid gap-x-6 gap-y-4 border-b border-[#E7EEE5] pb-4 text-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                      <Info label="Email" value={user.email} />
                      <Info label="Username" value={user.username ?? "None"} />
                      <Info label="Member Code" value={memberCode} />
                      <Info label="Sessions" value={String(user.activeSessionCount)} />
                      <Info label="Created" value={formatDate(user.createdAt)} />
                      <Info label="Last Login" value={formatDate(user.lastLoginAt)} />
                      <Info
                        label="Activation Link"
                        value={user.activationTokenExpiresAt ? `Expires ${formatDate(user.activationTokenExpiresAt)}` : "None pending"}
                      />
                    </dl>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void onOpen(user.id)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white shadow-[0_10px_20px_rgba(18,61,42,0.16)] transition hover:bg-[#1F6B43]"
                      >
                        <UserCog className="size-4" aria-hidden="true" />
                        Manage Account
                      </button>
                      <button
                        type="button"
                        onClick={() => void onResetPassword(user.id)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#D9E2D8] bg-white px-4 text-sm font-bold text-[#294B39] transition hover:bg-[#EAF3E8]"
                      >
                        <KeyRound className="size-4" aria-hidden="true" />
                        Reset Password
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-[#E7EEE5] bg-[#FBFCF8] px-5 py-4 text-sm font-semibold text-[#5D6D63] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {start}-{end} of {total} users
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            className="grid size-9 place-items-center rounded-md border border-[#D9E2D8] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="grid size-9 place-items-center rounded-md border border-[#D9E2D8] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="grid size-9 place-items-center rounded-md bg-[#123D2A] text-sm font-black text-white">
            {page}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="grid size-9 place-items-center rounded-md border border-[#D9E2D8] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="grid size-9 place-items-center rounded-md border border-[#D9E2D8] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" aria-hidden="true" />
          </button>
          <div className="w-32">
            <ComboSelect
              value={String(pageSize)}
              onChange={(value) => onPageSizeChange(Number(value))}
              ariaLabel="Accounts per page"
              options={[
                { value: "5", label: "5 per page" },
                { value: "10", label: "10 per page" },
                { value: "20", label: "20 per page" },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
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
  const suspensionToggle =
    user.accountStatus === "Suspended"
      ? { kind: "reactivate" as const, label: "Unsuspend", icon: UserCheck }
      : { kind: "suspend" as const, label: "Suspend", icon: UserMinus };
  const activeToggle =
    user.accountStatus === "Inactive"
      ? { kind: "activate" as const, label: "Activate", icon: ShieldCheck }
      : { kind: "deactivate" as const, label: "Deactivate", icon: UserMinus };

  return (
    <FormDialog
      open={Boolean(user)}
      onOpenChange={onOpenChange}
      title={
        <span className="inline-flex flex-wrap items-center gap-3">
          {user.displayName}
          <StatusBadge tone={statusTone(user.accountStatus)}>{user.accountStatus}</StatusBadge>
        </span>
      }
      description="Account profile, linked member profile, sessions, and lifecycle controls."
      contentClassName="w-[min(54rem,calc(100vw-2rem))] p-5 sm:p-8"
    >
      <div className="grid gap-6">
        <section className="rounded-lg border border-[#D9E2D8] bg-white p-5">
          <div className="grid gap-6 md:grid-cols-3">
            <IconInfo icon={Mail} label="Email" value={user.email} />
            <IconInfo icon={UserRound} label="Username" value={user.username ?? "None"} />
            <IconInfo icon={ShieldCheck} label="Role" value={roleLabel(user.role)} />
            <IconInfo icon={Activity} label="Status" value={user.accountStatus} valueClassName="text-[#1F6B43]" />
            <IconInfo
              icon={Link2}
              label="Linked Member"
              value={user.linkedMemberCode ? `${user.linkedMemberCode} · ${user.linkedMemberName}` : "Unlinked"}
            />
            <IconInfo
              icon={RefreshCcw}
              label="Pending Activation"
              value={user.activationTokenExpiresAt ? formatDate(user.activationTokenExpiresAt) : "None"}
            />
          </div>
          <div className="mt-6 border-t border-[#E7EEE5] pt-6">
            <IconInfo
              icon={Monitor}
              label="Sessions"
              value={`${user.sessions.length} active session${user.sessions.length === 1 ? "" : "s"}`}
              inline
            />
          </div>
        </section>

        <section className="border-t border-[#E7EEE5] pt-5">
          <h2 className="text-lg font-black text-[#123D2A]">Manage Account</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ActionButton icon={Pencil} label="Edit Profile" variant="primary" onClick={() => onEdit(user)} />
            <ActionButton icon={UsersRound} label="Change Role" variant="primary" onClick={() => onAction({ kind: "role", user })} />
            <ActionButton icon={LockKeyhole} label="Reset Password" onClick={() => onAction({ kind: "reset-password", user })} />
          </div>
        </section>

        <section className="border-t border-[#E7EEE5] pt-5">
          <h2 className="text-lg font-black text-[#123D2A]">Member & Access</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionButton icon={Link2} label="Link Member" disabled={!canLink} onClick={() => onAction({ kind: "link-member", user })} />
            <ActionButton icon={Link2} label="Unlink Member" disabled={!canUnlink} onClick={() => onAction({ kind: "unlink-member", user })} />
            <ActionButton icon={Mail} label="Issue Activation Link" disabled={user.accountStatus === "Active"} onClick={() => onAction({ kind: "activation", user })} />
            <ActionButton icon={FileText} label="View Activity Log" onClick={() => onViewAuditLogs(user.id)} />
          </div>
        </section>

        <section className="border-t border-[#E7EEE5] pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-[#123D2A]">Active Sessions</h2>
            <button
              type="button"
              disabled={isMutating || user.sessions.length === 0}
              onClick={() => onAction({ kind: "revoke-all", user })}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E7B8A8] bg-white px-4 text-sm font-bold text-[#C62828] transition hover:bg-[#FFF5F3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Revoke All
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {user.sessions.length === 0 ? (
              <div className="flex flex-col gap-4 rounded-lg border border-[#D9E2D8] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                    <Monitor className="size-7" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[#123D2A]">No active sessions.</p>
                    <p className="mt-1 text-sm text-[#5D6D63]">This user has no active sessions at this time.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onRefresh(user.id)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#D9E2D8] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EAF3E8]"
                >
                  <RefreshCcw className="size-4" aria-hidden="true" />
                  Refresh
                </button>
              </div>
            ) : (
              user.sessions.map((session) => (
                <div key={session.id} className="flex flex-col gap-3 rounded-lg border border-[#D9E2D8] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-[#123D2A]">{session.ipAddress ?? "Unknown IP"} {session.isCurrent ? "· Current session" : ""}</p>
                    <p className="mt-1 text-[#5D6D63]">{session.userAgent ?? "Unknown device"}</p>
                    <p className="mt-1 text-xs text-[#6C7A70]">Created {formatDate(session.createdAt)} · Expires {formatDate(session.expiresAt)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => onAction({ kind: "revoke-session", user, session })}
                    className="h-10 rounded-md border border-[#E7B8A8] px-4 text-sm font-bold text-[#C62828]"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#F1A6A6] bg-[#FFF5F3] p-5">
          <h2 className="text-lg font-black text-[#B91C1C]">Danger Zone</h2>
          <p className="mt-1 text-sm text-[#7A3023]">These actions impact account access and status.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ActionButton
              icon={suspensionToggle.icon}
              label={suspensionToggle.label}
              variant="danger"
              onClick={() => onAction({ kind: suspensionToggle.kind, user })}
            />
            <ActionButton
              icon={activeToggle.icon}
              label={activeToggle.label}
              variant="danger"
              onClick={() => onAction({ kind: activeToggle.kind, user })}
            />
            <ActionButton icon={Trash2} label="Delete Account" variant="solidDanger" onClick={() => onAction({ kind: "delete", user })} />
          </div>
          {user.id === currentUserId ? (
            <p className="mt-4 rounded-md bg-[#FFF4D7] p-3 text-sm font-semibold text-[#7A5A00]">
              Changes that disable your own account require typing your display name.
            </p>
          ) : null}
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
          const finalDraft = { ...draft };
          if (mode === "create" && !finalDraft.issueActivationLink && !finalDraft.password) {
            finalDraft.password = "Track_coop123";
          }
          void onSave(finalDraft);
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
              <div className={labelClass}>
                <span>Role</span>
                <ComboSelect
                  value={draft.role}
                  onChange={(value) => setDraft((current) => ({ ...current, role: value }))}
                  ariaLabel="Account role"
                  options={roles.map((role) => ({ value: role, label: roleLabel(role) }))}
                />
              </div>
              <div className={labelClass}>
                <span>Status</span>
                <ComboSelect
                  value={draft.accountStatus}
                  onChange={(value) => setDraft((current) => ({ ...current, accountStatus: value }))}
                  ariaLabel="Account status"
                  options={accountStatuses.map((status) => ({ value: status, label: status }))}
                />
              </div>
            </div>
            
            <label className={labelClass}>
              Temporary Password (leave blank to use Track_coop123)
              <input className={inputClass} minLength={3} type="password" value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} />
            </label>
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
          <div className={labelClass}>
            <span>New Role</span>
            <ComboSelect
              value={role}
              onChange={setRole}
              ariaLabel="New role"
              options={roles.map((item) => ({ value: item, label: roleLabel(item) }))}
            />
          </div>
        ) : null}
        {action.kind === "reset-password" ? (
          <label className={labelClass}>
            New Password
            <input className={inputClass} required minLength={3} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        ) : null}
        {action.kind === "link-member" ? (
          <div className="grid gap-3">
            <label className={labelClass}>
              Search Unlinked Members
              <input className={inputClass} value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Name, code, or email" />
            </label>
            <div className={labelClass}>
              <span>Member Profile</span>
              <ComboSelect
                value={memberId}
                onChange={setMemberId}
                ariaLabel="Member profile"
                placeholder="Select member"
                options={[
                  { value: "", label: "Select member" },
                  ...members.map((member) => ({
                    value: member.id,
                    label: `${member.memberCode} · ${member.fullName}`,
                  })),
                ]}
              />
            </div>
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
      title="Account Setup Link Created"
      description="Please copy this link and send it to the new user so they can set up their password. This link will only be shown once."
    >
      {result ? (
        <div className="grid gap-4">
          <Info label="For Account" value={result.user.displayName} />
          <Info label="Link Expires On" value={formatDate(result.activationTokenExpiresAt)} />
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
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#6C7A70]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#123D2A] [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function IconInfo({
  icon: Icon,
  label,
  value,
  valueClassName = "text-[#123D2A]",
  inline = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClassName?: string;
  inline?: boolean;
}) {
  return (
    <div className={`min-w-0 ${inline ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "grid gap-2"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="size-4 shrink-0 text-[#365f4a]" aria-hidden="true" />
        <p className="truncate text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#6C7A70]">{label}</p>
      </div>
      <p className={`min-w-0 max-w-full break-words text-sm font-black leading-5 [overflow-wrap:anywhere] ${inline ? "ml-0" : "ml-7"} ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
  variant = "secondary",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "solidDanger";
}) {
  const variantClass = {
    primary: "border-[#123D2A] bg-[#0B6B3A] text-white shadow-[0_10px_18px_rgba(18,61,42,0.14)] hover:bg-[#123D2A]",
    secondary: "border-[#D9E2D8] bg-white text-[#123D2A] hover:bg-[#EAF3E8]",
    danger: "border-[#F1A6A6] bg-white text-[#B91C1C] hover:bg-[#FFE6E0]",
    solidDanger: "border-[#C62828] bg-[#C62828] text-white shadow-[0_10px_18px_rgba(198,40,40,0.16)] hover:bg-[#A91F1F]",
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
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
