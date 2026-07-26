"use client";

import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  FilePlus2,
  FileText,
  Filter,
  History,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Unlink,
  UserCheck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { Button } from "@/components/ui/Button";
import { ApiClientError } from "@/lib/api-client";
import {
  addApplicationBeneficiary,
  addApplicationRequirement,
  approveApplication,
  createChairmanApplication,
  deleteApplicationBeneficiary,
  deleteApplicationDocument,
  downloadApplicationPdf,
  getChairmanApplication,
  getChairmanApplicationSummary,
  listChairmanApplications,
  transitionApplication,
  updateApplicationBeneficiary,
  updateApplicationRequirement,
  updateChairmanApplication,
  uploadChairmanApplicationDocument,
} from "@/features/membership-applications/membership-application-api";
import {
  createMember,
  getMemberDetail,
  getMemberSummary,
  linkUserMember,
  listMembersPaginated,
  listUnifiedStatusHistory,
  listUsersPaginated,
  unlinkUserMember,
  updateMember,
  updateMemberStatus,
  type MemberDetail,
  type MemberListQuery,
  type MemberProfile,
  type MemberProfileInput,
  type MemberSummary as DirectoryMemberSummary,
  type MembershipType,
  type OfficialMemberStatus,
  type UnifiedStatusHistoryEntry,
  type UserSummary,
} from "@/features/chairman/people-api";
import {
  civilStatuses,
  documentTypes,
  membershipApplicationSources,
  membershipApplicationStatuses,
  requestedMembershipTypes,
  requirementStatuses,
  requirementTypes,
  type ApprovalInput,
  type ApprovalResult,
  type BeneficiaryInput,
  type ChairmanApplicationDetail,
  type ChairmanApplicationListItem,
  type ChairmanApplicationListQuery,
  type ChairmanApplicationSummary,
  type ChairmanMembershipApplicationInput,
  type ChairmanMembershipApplicationUpdateInput,
  type MembershipApplicationSource,
  type MembershipApplicationStatus,
  type MembershipDocumentType,
  type RequestedMembershipType,
  type RequirementStatus,
  type RequirementType,
} from "@/features/membership-applications/membership-application-types";

const emptySummary: ChairmanApplicationSummary = {
  total: 0,
  submitted: 0,
  underReview: 0,
  needsInformation: 0,
  approved: 0,
  rejected: 0,
  withdrawn: 0,
};

const defaultQuery: ChairmanApplicationListQuery = {
  page: 1,
  pageSize: 10,
  status: "All",
  requestedMembershipType: "All",
  applicationSource: "All",
  sortBy: "submittedAt",
  sortDirection: "desc",
};

const emptyDirectorySummary: DirectoryMemberSummary = {
  total: 0,
  pendingApproval: 0,
  approved: 0,
  associate: 0,
  trueMember: 0,
  active: 0,
  inactive: 0,
  suspended: 0,
};

const defaultMemberQuery: MemberListQuery = {
  page: 1,
  pageSize: 10,
  approvalStatus: "All",
  officialMemberStatus: "All",
  membershipType: "All",
  sortBy: "createdAt",
  sortDirection: "desc",
};

const officialMemberStatuses: OfficialMemberStatus[] = [
  "Pending",
  "Active",
  "Inactive",
  "Suspended",
  "Terminated",
];
const membershipTypes: MembershipType[] = ["Associate", "True Member"];

const blankMemberForm: MemberFormState = {
  memberCode: "",
  fullName: "",
  contactNumber: "",
  email: "",
  barangay: "",
  municipality: "Nasugbu",
  province: "Batangas",
  sector: "",
  membershipType: "Associate",
  approvalStatus: "Approved",
  officialMemberStatus: "Active",
  applicationDate: new Date().toISOString().slice(0, 10),
  shareCapitalDeadline: "",
  notes: "",
};

const blankApplication: ApplicationFormState = {
  applicationSource: "Imported Paper Form",
  requestedMembershipType: "Associate",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  email: "",
  contactNumber: "",
  civilStatus: "Single",
  placeOfBirth: "",
  dateOfBirth: "",
  currentAddress: "",
  barangay: "",
  municipality: "Nasugbu",
  province: "Batangas",
  fatherName: "",
  motherName: "",
  spouseName: "",
  occupation: "",
  orientationCommitmentAccepted: true,
  membershipFeeCommitmentAccepted: true,
  shareSubscriptionCommitmentAccepted: true,
  patronageRefundAcknowledged: true,
  bylawsAgreementAccepted: true,
  privacyConsentAccepted: true,
  applicantSignatureName: "",
  signedAt: new Date().toISOString().slice(0, 16),
  signedPlace: "Nasugbu, Batangas",
  boardMeetingDate: "",
  secretaryName: "",
  decisionReason: "",
};

type ApplicationFormState = ChairmanMembershipApplicationUpdateInput & {
  applicationSource: Extract<MembershipApplicationSource, "Chairman Entry" | "Imported Paper Form">;
  requestedMembershipType: RequestedMembershipType;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  contactNumber: string;
  currentAddress: string;
  municipality: string;
  province: string;
  applicantSignatureName: string;
  signedAt: string;
  signedPlace: string;
};

type DetailMap = Record<string, ChairmanApplicationDetail>;
type TabKey = "applications" | "directory" | "history";
type HistorySource = "All" | "Application" | "Member" | "Account";
type MemberFormState = {
  memberCode: string;
  fullName: string;
  contactNumber: string;
  email: string;
  barangay: string;
  municipality: string;
  province: string;
  sector: string;
  membershipType: MembershipType;
  approvalStatus: MemberProfile["approvalStatus"];
  officialMemberStatus: OfficialMemberStatus;
  applicationDate: string;
  shareCapitalDeadline: string;
  notes: string;
};
type MemberAccountAction =
  | { type: "link"; member: MemberDetail }
  | { type: "unlink"; member: MemberDetail };
type ConfirmAction =
  | { type: "transition"; action: "start-review" | "request-information" | "reject" | "withdraw"; label: string }
  | { type: "delete-beneficiary"; beneficiaryId: string; label: string }
  | { type: "delete-document"; documentId: string; label: string };

function statusTone(status: MembershipApplicationStatus) {
  if (status === "Approved") return "success";
  if (status === "Needs Information" || status === "Submitted") return "warning";
  if (status === "Rejected" || status === "Withdrawn") return "danger";
  return "neutral";
}

function requirementTone(status: RequirementStatus) {
  if (status === "Verified" || status === "Waived") return "success";
  if (status === "Rejected") return "danger";
  if (status === "Submitted") return "warning";
  return "neutral";
}

export function MembersClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("applications");
  const [summary, setSummary] = useState<ChairmanApplicationSummary>(emptySummary);
  const [applications, setApplications] = useState<ChairmanApplicationListItem[]>([]);
  const [detailsById, setDetailsById] = useState<DetailMap>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState<ChairmanApplicationListQuery>(defaultQuery);
  const [requirementCompletion, setRequirementCompletion] = useState("All");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [paperOpen, setPaperOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [activationResult, setActivationResult] = useState<ApprovalResult | null>(null);
  const [memberSummary, setMemberSummary] = useState<DirectoryMemberSummary>(emptyDirectorySummary);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [memberQuery, setMemberQuery] = useState<MemberListQuery>(defaultMemberQuery);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberError, setMemberError] = useState("");
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDetail | null>(null);
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberDetail | null>(null);
  const [statusMember, setStatusMember] = useState<MemberDetail | null>(null);
  const [accountAction, setAccountAction] = useState<MemberAccountAction | null>(null);
  const [historyEntries, setHistoryEntries] = useState<UnifiedStatusHistoryEntry[]>([]);
  const [historyQuery, setHistoryQuery] = useState<{ page: number; pageSize: number; search: string; sourceModule: HistorySource }>({
    page: 1,
    pageSize: 10,
    search: "",
    sourceModule: "All",
  });
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const selectedDetail = selectedId ? detailsById[selectedId] ?? null : null;

  const loadApplications = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextSummary, list] = await Promise.all([
        getChairmanApplicationSummary(),
        listChairmanApplications(query),
      ]);
      setSummary(nextSummary);
      setApplications(list.applications);

      const details = await Promise.all(
        list.applications.map((application) => getChairmanApplication(application.id)),
      );
      setDetailsById((current) => {
        const next = { ...current };
        details.forEach((detail) => {
          next[detail.id] = detail;
        });
        return next;
      });
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Membership applications could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const loadDirectory = useCallback(async () => {
    setIsMemberLoading(true);
    setMemberError("");

    try {
      const [nextSummary, list] = await Promise.all([
        getMemberSummary(),
        listMembersPaginated(memberQuery),
      ]);
      setMemberSummary(nextSummary);
      setMembers(list.members);
      setMemberTotal(list.total);
    } catch (caught) {
      setMemberError(caught instanceof ApiClientError ? caught.message : "Member directory could not be loaded.");
    } finally {
      setIsMemberLoading(false);
    }
  }, [memberQuery]);

  const loadUnifiedHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError("");

    try {
      const result = await listUnifiedStatusHistory(historyQuery);
      setHistoryEntries(result.entries);
      setHistoryTotal(result.total);
    } catch (caught) {
      setHistoryError(caught instanceof ApiClientError ? caught.message : "Unified status history could not be loaded.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [historyQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadApplications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadApplications]);

  useEffect(() => {
    if (activeTab !== "directory") return;
    const timeoutId = window.setTimeout(() => {
      void loadDirectory();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, loadDirectory]);

  useEffect(() => {
    if (activeTab !== "history") return;
    const timeoutId = window.setTimeout(() => {
      void loadUnifiedHistory();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, loadUnifiedHistory]);

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => {
      const detail = detailsById[application.id];
      if (submittedFrom && new Date(application.submittedAt) < new Date(submittedFrom)) {
        return false;
      }
      if (submittedTo && new Date(application.submittedAt) > new Date(`${submittedTo}T23:59:59`)) {
        return false;
      }
      if (requirementCompletion !== "All" && detail) {
        const completed = requirementProgress(detail).isComplete;
        if (requirementCompletion === "Complete" && !completed) return false;
        if (requirementCompletion === "Incomplete" && completed) return false;
      }
      return true;
    });
  }, [applications, detailsById, requirementCompletion, submittedFrom, submittedTo]);

  const refreshDetail = async (id: string) => {
    const detail = await getChairmanApplication(id);
    setDetailsById((current) => ({ ...current, [id]: detail }));
    return detail;
  };

  const refreshMemberDetail = async (id: string) => {
    const detail = await getMemberDetail(id);
    setSelectedMember(detail);
    return detail;
  };

  const runMutation = async (successMessage: string, action: () => Promise<unknown>) => {
    setIsMutating(true);
    try {
      await action();
      toast.success(successMessage);
      await loadApplications();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Action failed.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleConfirmedAction = () => {
    if (!confirmAction || !selectedDetail) return;

    if (confirmAction.type === "transition") {
      void runMutation(`${confirmAction.label} completed.`, async () => {
        await transitionApplication(selectedDetail.id, confirmAction.action, {
          reason: `${confirmAction.label} from Chairman Members page.`,
          internalNote: `${confirmAction.label} confirmed by Chairman.`,
          applicantMessage:
            confirmAction.action === "request-information"
              ? "The cooperative needs more information to continue reviewing your application."
              : null,
        });
      });
    }

    if (confirmAction.type === "delete-beneficiary") {
      void runMutation("Beneficiary removed.", async () => {
        await deleteApplicationBeneficiary(confirmAction.beneficiaryId);
        await refreshDetail(selectedDetail.id);
      });
    }

    if (confirmAction.type === "delete-document") {
      void runMutation("Document removed.", async () => {
        await deleteApplicationDocument(confirmAction.documentId);
        await refreshDetail(selectedDetail.id);
      });
    }

    setConfirmAction(null);
  };

  const handlePrint = async (application: ChairmanApplicationDetail) => {
    await runMutation("Printable PDF generated.", async () => {
      const blob = await downloadApplicationPdf(application.id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(url), 20_000);
    });
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="People"
        title="Members"
        description="Membership applications, accepted-member records, and official status history."
        actions={
          <>
            <Button
              type="button"
              onClick={() => activeTab === "directory" ? setMemberFormOpen(true) : setPaperOpen(true)}
              className="h-11 bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]"
            >
              {activeTab === "directory" ? <Plus className="size-4" aria-hidden="true" /> : <FilePlus2 className="size-4" aria-hidden="true" />}
              {activeTab === "directory" ? "Create Manual Member" : "Encode Paper Application"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (activeTab === "directory") void loadDirectory();
                else if (activeTab === "history") void loadUnifiedHistory();
                else void loadApplications();
              }}
              className="h-11 border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-[#CAD8CB]">
        {[
          ["applications", "Applications"],
          ["directory", "Member Directory"],
          ["history", "Status History"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as TabKey)}
            className={`border-b-2 px-4 py-3 text-sm font-bold transition ${
              activeTab === key
                ? "border-[#1F6B43] text-[#123D2A]"
                : "border-transparent text-[#6C7A70] hover:text-[#123D2A]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "applications" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
            <StatCard label="Submitted" value={String(summary.submitted)} icon={FileText} />
            <StatCard label="Under Review" value={String(summary.underReview)} icon={ClipboardCheck} />
            <StatCard label="Needs Info" value={String(summary.needsInformation)} icon={Send} />
            <StatCard label="Approved" value={String(summary.approved)} icon={CheckCircle2} />
            <StatCard label="Rejected" value={String(summary.rejected)} icon={X} />
          </div>

          <ApplicationFilters
            query={query}
            requirementCompletion={requirementCompletion}
            submittedFrom={submittedFrom}
            submittedTo={submittedTo}
            setQuery={setQuery}
            setRequirementCompletion={setRequirementCompletion}
            setSubmittedFrom={setSubmittedFrom}
            setSubmittedTo={setSubmittedTo}
          />

          {error ? <ErrorState message={error} /> : null}
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredApplications.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No membership applications found"
              description="Submitted and encoded membership applications will appear here for Chairman review."
            />
          ) : (
            <>
              <ApplicationsResponsiveList
                applications={filteredApplications}
                detailsById={detailsById}
                onSelect={setSelectedId}
              />
              <Pagination
                query={query}
                shown={filteredApplications.length}
                total={summary.total}
                setQuery={setQuery}
              />
            </>
          )}
        </>
      ) : activeTab === "directory" ? (
        <MemberDirectorySection
          summary={memberSummary}
          members={members}
          query={memberQuery}
          total={memberTotal}
          isLoading={isMemberLoading}
          error={memberError}
          setQuery={setMemberQuery}
          onCreate={() => setMemberFormOpen(true)}
          onOpen={async (memberId) => {
            const detail = await getMemberDetail(memberId);
            setSelectedMember(detail);
          }}
        />
      ) : (
        <UnifiedHistorySection
          entries={historyEntries}
          query={historyQuery}
          total={historyTotal}
          isLoading={isHistoryLoading}
          error={historyError}
          setQuery={setHistoryQuery}
        />
      )}

      <ApplicationDetailDialog
        detail={selectedDetail}
        open={Boolean(selectedDetail)}
        isMutating={isMutating}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onRefresh={() => selectedDetail ? refreshDetail(selectedDetail.id) : Promise.resolve(null)}
        onEdit={() => setEditOpen(true)}
        onPrint={handlePrint}
        onConfirmAction={setConfirmAction}
        runMutation={runMutation}
        setActivationResult={setActivationResult}
      />

      <ApplicationFormDialog
        key={paperOpen ? "paper-open" : "paper-closed"}
        open={paperOpen}
        mode="create"
        title="Encode Paper Application"
        onOpenChange={setPaperOpen}
        onSaved={async (application) => {
          setPaperOpen(false);
          setSelectedId(application.id);
          await loadApplications();
        }}
      />

      {selectedDetail ? (
        <ApplicationFormDialog
          key={selectedDetail.id}
          open={editOpen}
          mode="edit"
          title="Edit Encoded Application Data"
          detail={selectedDetail}
          onOpenChange={setEditOpen}
          onSaved={async (application) => {
            setEditOpen(false);
            setDetailsById((current) => ({ ...current, [application.id]: application }));
            await loadApplications();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title="Confirm action"
        description={`Continue with ${confirmAction?.label ?? "this action"}? This will be recorded in the application history and audit log.`}
        confirmLabel={isMutating ? "Working..." : "Confirm"}
        onConfirm={handleConfirmedAction}
      />

      <ActivationResultDialog
        result={activationResult}
        onOpenChange={(open) => {
          if (!open) setActivationResult(null);
        }}
      />

      <MemberFormDialog
        key={editingMember ? `edit-${editingMember.id}` : memberFormOpen ? "member-create-open" : "member-create-closed"}
        open={memberFormOpen || Boolean(editingMember)}
        mode={editingMember ? "edit" : "create"}
        member={editingMember}
        onOpenChange={(open) => {
          if (!open) {
            setMemberFormOpen(false);
            setEditingMember(null);
          }
        }}
        onSaved={async (member) => {
          setMemberFormOpen(false);
          setEditingMember(null);
          await loadDirectory();
          const detail = await getMemberDetail(member.id);
          setSelectedMember(detail);
        }}
      />

      <MemberDetailDialog
        member={selectedMember}
        onOpenChange={(open) => {
          if (!open) setSelectedMember(null);
        }}
        onEdit={(member) => setEditingMember(member)}
        onStatus={(member) => setStatusMember(member)}
        onAccountAction={setAccountAction}
        onRefresh={refreshMemberDetail}
      />

      <MemberStatusDialog
        key={statusMember?.id ?? "status-closed"}
        member={statusMember}
        onOpenChange={(open) => {
          if (!open) setStatusMember(null);
        }}
        onSaved={async (member) => {
          setStatusMember(null);
          await loadDirectory();
          await refreshMemberDetail(member.id);
          await loadUnifiedHistory();
        }}
      />

      <MemberAccountLinkDialog
        key={accountAction ? `${accountAction.type}-${accountAction.member.id}` : "account-link-closed"}
        action={accountAction}
        onOpenChange={(open) => {
          if (!open) setAccountAction(null);
        }}
        onSaved={async (memberId) => {
          setAccountAction(null);
          await loadDirectory();
          await refreshMemberDetail(memberId);
          await loadUnifiedHistory();
        }}
      />
    </div>
  );
}

function MemberDirectorySection({
  summary,
  members,
  query,
  total,
  isLoading,
  error,
  setQuery,
  onCreate,
  onOpen,
}: {
  summary: DirectoryMemberSummary;
  members: MemberProfile[];
  query: MemberListQuery;
  total: number;
  isLoading: boolean;
  error: string;
  setQuery: (updater: (current: MemberListQuery) => MemberListQuery) => void;
  onCreate: () => void;
  onOpen: (memberId: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Members" value={String(summary.total)} icon={UsersRound} />
        <StatCard label="Active" value={String(summary.active)} icon={UserCheck} />
        <StatCard label="Associates" value={String(summary.associate)} icon={WalletCards} />
        <StatCard label="True Members" value={String(summary.trueMember)} icon={ShieldCheck} />
      </div>

      <MemberFilters query={query} setQuery={setQuery} onCreate={onCreate} />

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : members.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No member records found"
          description="Approved or manually migrated member profiles will appear here."
        />
      ) : (
        <>
          <MemberResponsiveList members={members} onOpen={onOpen} />
          <SimplePagination
            page={query.page ?? 1}
            pageSize={query.pageSize ?? 10}
            total={total}
            shown={members.length}
            noun="members"
            setPage={(page) => setQuery((current) => ({ ...current, page }))}
          />
        </>
      )}
    </div>
  );
}

function MemberFilters({
  query,
  setQuery,
  onCreate,
}: {
  query: MemberListQuery;
  setQuery: (updater: (current: MemberListQuery) => MemberListQuery) => void;
  onCreate: () => void;
}) {
  const updateQuery = (patch: Partial<MemberListQuery>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };

  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6C7A70]">
          <Filter className="size-4" aria-hidden="true" />
          Member Directory Filters
        </div>
        <Button type="button" className="h-10 bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]" onClick={onCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Create Manual Member
        </Button>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-6">
        <label className="relative block min-w-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
          <input
            value={query.search ?? ""}
            onChange={(event) => updateQuery({ search: event.target.value })}
            className="h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]"
            placeholder="Search members"
            type="search"
          />
        </label>
        <Select value={query.officialMemberStatus ?? "All"} onChange={(value) => updateQuery({ officialMemberStatus: value as MemberListQuery["officialMemberStatus"] })}>
          <option value="All">All official statuses</option>
          {officialMemberStatuses.map((status) => <option key={status}>{status}</option>)}
        </Select>
        <Select value={query.membershipType ?? "All"} onChange={(value) => updateQuery({ membershipType: value as MemberListQuery["membershipType"] })}>
          <option value="All">All member types</option>
          {membershipTypes.map((type) => <option key={type}>{type}</option>)}
        </Select>
        <input
          value={query.barangay ?? ""}
          onChange={(event) => updateQuery({ barangay: event.target.value })}
          className="h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm outline-none focus:border-[#1F6B43]"
          placeholder="Barangay"
        />
        <Select value={query.sortBy ?? "createdAt"} onChange={(value) => setQuery((current) => ({ ...current, sortBy: value as MemberListQuery["sortBy"] }))}>
          <option value="createdAt">Sort by created</option>
          <option value="fullName">Sort by name</option>
          <option value="memberCode">Sort by code</option>
          <option value="applicationDate">Sort by application date</option>
        </Select>
        <Select value={query.sortDirection ?? "desc"} onChange={(value) => setQuery((current) => ({ ...current, sortDirection: value as "asc" | "desc" }))}>
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </Select>
      </div>
    </section>
  );
}

function MemberResponsiveList({
  members,
  onOpen,
}: {
  members: MemberProfile[];
  onOpen: (memberId: string) => Promise<void>;
}) {
  return (
    <>
      <div className="hidden 2xl:block">
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Barangay</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Official Status</th>
                <th className="px-5 py-4">Linked Account</th>
                <th className="px-5 py-4">Application Date</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#123D2A]">{member.fullName}</p>
                    <p className="mt-1 text-xs text-[#6C7A70]">{member.memberCode}</p>
                  </td>
                  <td className="px-5 py-4">{member.email ?? member.contactNumber ?? "Not provided"}</td>
                  <td className="px-5 py-4">{member.barangay ?? "Unspecified"}</td>
                  <td className="px-5 py-4">{member.membershipType}</td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={memberStatusTone(member.officialMemberStatus)}>{member.officialMemberStatus}</StatusBadge>
                  </td>
                  <td className="px-5 py-4">{member.linkedUserEmail ?? "Unlinked"}</td>
                  <td className="px-5 py-4">{formatDate(member.applicationDate)}</td>
                  <td className="px-5 py-4">
                    <Button type="button" className="h-9 bg-[#123D2A] px-3 text-white hover:bg-[#1F6B43]" onClick={() => void onOpen(member.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </div>

      <div className="grid gap-3 2xl:hidden">
        {members.map((member) => (
          <article key={member.id} className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-bold text-[#123D2A]">{member.fullName}</p>
                <p className="mt-1 text-xs text-[#6C7A70]">{member.memberCode}</p>
              </div>
              <StatusBadge tone={memberStatusTone(member.officialMemberStatus)}>
                {member.officialMemberStatus}
              </StatusBadge>
            </div>
            <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 text-sm text-[#294B39]">
              <Info label="Type" value={member.membershipType} />
              <Info label="Barangay" value={member.barangay ?? "Unspecified"} />
              <Info label="Contact" value={member.email ?? member.contactNumber ?? "Not provided"} />
              <Info label="Account" value={member.linkedUserEmail ?? "Unlinked"} />
            </dl>
            <Button type="button" className="mt-4 h-10 w-full bg-[#123D2A] text-white hover:bg-[#1F6B43]" onClick={() => void onOpen(member.id)}>
              View Member
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}

function MemberDetailDialog({
  member,
  onOpenChange,
  onEdit,
  onStatus,
  onAccountAction,
  onRefresh,
}: {
  member: MemberDetail | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (member: MemberDetail) => void;
  onStatus: (member: MemberDetail) => void;
  onAccountAction: (action: MemberAccountAction) => void;
  onRefresh: (memberId: string) => Promise<MemberDetail>;
}) {
  if (!member) return null;

  const capitalPercent = Math.min(100, Math.round((member.shareCapital.validatedTotal / member.shareCapital.fullRequirement) * 100));

  return (
    <FormDialog
      open={Boolean(member)}
      onOpenChange={onOpenChange}
      title={`${member.memberCode} - ${member.fullName}`}
      description="Member profile, official status, linked account, share capital progress, and recent cooperative activity."
    >
      <div className="grid gap-6">
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Pencil} label="Edit" onClick={() => onEdit(member)} />
          <ActionButton icon={ShieldCheck} label="Update Status / Type" onClick={() => onStatus(member)} />
          {member.userId ? (
            <ActionButton icon={Unlink} label="Unlink Account" danger onClick={() => onAccountAction({ type: "unlink", member })} />
          ) : (
            <ActionButton icon={Link2} label="Link Account" onClick={() => onAccountAction({ type: "link", member })} />
          )}
          <ActionButton icon={Printer} label="Print Profile" onClick={() => window.print()} />
          <ActionButton icon={RefreshCcw} label="Refresh" onClick={() => void onRefresh(member.id)} />
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Info label="Official Status" value={member.officialMemberStatus} />
          <Info label="Membership Type" value={member.membershipType} />
          <Info label="Approval" value={member.approvalStatus} />
          <Info label="Email" value={member.email ?? "Not provided"} />
          <Info label="Contact" value={member.contactNumber ?? "Not provided"} />
          <Info label="Barangay" value={member.barangay ?? "Unspecified"} />
          <Info label="Municipality" value={`${member.municipality}, ${member.province}`} />
          <Info label="Sector" value={member.sector ?? "Not provided"} />
          <Info label="Linked Account" value={member.linkedUserEmail ? `${member.linkedUserEmail} (${member.linkedUserStatus ?? "Unknown"})` : "Unlinked"} />
        </section>

        <Panel title="Share-Capital Progress">
          <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-center">
            <div>
              <div className="h-3 overflow-hidden rounded-full bg-[#E2E8E2]">
                <div className="h-full rounded-full bg-[#1F6B43]" style={{ width: `${capitalPercent}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold text-[#294B39]">
                {formatCurrency(member.shareCapital.validatedTotal)} validated of {formatCurrency(member.shareCapital.fullRequirement)} required for True Member.
              </p>
            </div>
            <div className="grid gap-2 text-sm">
              <Info label="Pending" value={formatCurrency(member.shareCapital.pendingTotal)} />
              <Info label="Allowed Remaining" value={formatCurrency(member.shareCapital.remainingAllowed)} />
            </div>
          </div>
        </Panel>

        <section className="grid gap-4 xl:grid-cols-3">
          <ActivityPanel
            title="Recent Payments"
            icon={CreditCard}
            empty="No recent payment references."
            items={member.recentPayments.map((payment) => ({
              id: payment.id,
              title: payment.referenceNumber,
              meta: `${payment.paymentPurpose} - ${payment.validationStatus}`,
              amount: formatCurrency(payment.amount),
              date: formatDate(payment.submittedAt),
            }))}
          />
          <ActivityPanel
            title="Recent POS"
            icon={ShoppingCart}
            empty="No recent POS activity."
            items={member.recentPosActivity.map((sale) => ({
              id: sale.id,
              title: sale.saleNumber,
              meta: `${sale.saleStatus} - ${sale.paymentStatus}`,
              amount: formatCurrency(sale.totalAmount),
              date: formatDate(sale.saleDate),
            }))}
          />
          <ActivityPanel
            title="Recent Rentals"
            icon={CalendarDays}
            empty="No recent rental activity."
            items={member.recentRentalActivity.map((rental) => ({
              id: rental.id,
              title: rental.bookingNumber,
              meta: `${rental.assetName} - ${rental.bookingStatus}`,
              amount: formatCurrency(rental.totalAmount),
              date: formatDate(rental.startDatetime),
            }))}
          />
        </section>

        <Panel title="Latest Indicator">
          {member.latestIndicator ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Info label="Label" value={member.latestIndicator.statusLabel} />
              <Info label="Score" value={String(member.latestIndicator.totalScore)} />
              <Info label="Computed" value={formatDate(member.latestIndicator.computedAt)} />
              <p className="rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-3 text-sm text-[#294B39] md:col-span-3">
                {member.latestIndicator.basisSummary ?? "No basis summary recorded."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#5D6D63]">No indicator has been calculated for this member yet.</p>
          )}
        </Panel>

        <Panel title="Member Status History">
          <ol className="grid gap-3">
            {member.statusHistory.length === 0 ? (
              <li className="rounded-md border border-dashed border-[#CAD8CB] p-4 text-sm text-[#5D6D63]">No member status history yet.</li>
            ) : (
              member.statusHistory.map((entry) => (
                <li key={entry.id} className="rounded-md border border-[#CAD8CB] p-3 text-sm">
                  <p className="font-bold text-[#123D2A]">
                    {entry.oldMembershipType ?? "New"} / {entry.oldOfficialStatus ?? "New"} to {entry.newMembershipType ?? "No type change"} / {entry.newOfficialStatus ?? "No status change"}
                  </p>
                  <p className="mt-1 text-[#5D6D63]">{formatDate(entry.changedAt)}</p>
                  <p className="mt-1 text-[#294B39]">{entry.reason ?? "No reason recorded."}</p>
                </li>
              ))
            )}
          </ol>
        </Panel>
      </div>
    </FormDialog>
  );
}

function ActivityPanel({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ id: string; title: string; meta: string; amount: string; date: string }>;
  empty: string;
}) {
  return (
    <Panel title={title}>
      <div className="grid gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-[#5D6D63]">{empty}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-md border border-[#CAD8CB] p-3 text-sm">
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 text-[#1F6B43]" aria-hidden="true" />
                <div>
                  <p className="font-bold text-[#123D2A]">{item.title}</p>
                  <p className="mt-1 text-[#5D6D63]">{item.meta}</p>
                  <p className="mt-1 text-[#294B39]">{item.amount} - {item.date}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function MemberFormDialog({
  open,
  mode,
  member,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  member: MemberDetail | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (member: MemberProfile) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MemberFormState>(member ? memberToDraft(member) : blankMemberForm);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      const saved = mode === "create"
        ? await createMember(memberPayload(draft))
        : await updateMember(member?.id ?? "", memberPayload(draft));
      toast.success(mode === "create" ? "Manual member created." : "Member profile updated.");
      await onSaved(saved);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Member could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={mode === "create" ? "Create Manual Member" : "Edit Member Profile"}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Member code" value={draft.memberCode} onChange={(value) => setDraft((current) => ({ ...current, memberCode: value }))} />
        <TextInput label="Full name" value={draft.fullName} onChange={(value) => setDraft((current) => ({ ...current, fullName: value }))} />
        <TextInput label="Contact number" value={draft.contactNumber} onChange={(value) => setDraft((current) => ({ ...current, contactNumber: value }))} />
        <TextInput label="Email" value={draft.email} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
        <TextInput label="Barangay" value={draft.barangay} onChange={(value) => setDraft((current) => ({ ...current, barangay: value }))} />
        <TextInput label="Sector" value={draft.sector} onChange={(value) => setDraft((current) => ({ ...current, sector: value }))} />
        <TextInput label="Municipality" value={draft.municipality} onChange={(value) => setDraft((current) => ({ ...current, municipality: value }))} />
        <TextInput label="Province" value={draft.province} onChange={(value) => setDraft((current) => ({ ...current, province: value }))} />
        <Select value={draft.membershipType} onChange={(value) => setDraft((current) => ({ ...current, membershipType: value as MembershipType }))}>
          {membershipTypes.map((type) => <option key={type}>{type}</option>)}
        </Select>
        <Select value={draft.officialMemberStatus} onChange={(value) => setDraft((current) => ({ ...current, officialMemberStatus: value as OfficialMemberStatus }))}>
          {officialMemberStatuses.map((status) => <option key={status}>{status}</option>)}
        </Select>
        <TextInput label="Application date" type="date" value={draft.applicationDate} onChange={(value) => setDraft((current) => ({ ...current, applicationDate: value }))} />
        <TextInput label="Share-capital deadline" type="date" value={draft.shareCapitalDeadline} onChange={(value) => setDraft((current) => ({ ...current, shareCapitalDeadline: value }))} />
        <label className="grid gap-2 text-sm font-semibold text-[#294B39] md:col-span-2">
          Notes
          <textarea className="min-h-28 rounded-md border border-[#CAD8CB] bg-white p-3 text-sm outline-none focus:border-[#1F6B43]" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="button" disabled={isSaving} className="bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]" onClick={() => void save()}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Save
        </Button>
      </div>
    </FormDialog>
  );
}

function MemberStatusDialog({
  member,
  onOpenChange,
  onSaved,
}: {
  member: MemberDetail | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (member: MemberDetail) => Promise<void>;
}) {
  const [membershipType, setMembershipType] = useState<MembershipType>(member?.membershipType ?? "Associate");
  const [officialMemberStatus, setOfficialMemberStatus] = useState<OfficialMemberStatus>(member?.officialMemberStatus ?? "Active");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!member) return;
    setIsSaving(true);
    try {
      const updated = await updateMemberStatus(member.id, {
        membershipType,
        officialMemberStatus,
        reason,
        confirmation,
      });
      toast.success("Member status updated.");
      await onSaved(updated);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Member status could not be updated.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormDialog
      open={Boolean(member)}
      onOpenChange={onOpenChange}
      title="Update Official Status"
      description="Reason and full-name confirmation are required. True Member promotion requires PHP 3,000 validated share capital and cannot exceed PHP 15,000."
    >
      {member ? (
        <div className="grid gap-4">
          <div className="rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-3 text-sm text-[#294B39]">
            Validated share capital: <strong>{formatCurrency(member.shareCapital.validatedTotal)}</strong>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
              Membership type
              <Select value={membershipType} onChange={(value) => setMembershipType(value as MembershipType)}>
                {membershipTypes.map((type) => <option key={type}>{type}</option>)}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
              Official status
              <Select value={officialMemberStatus} onChange={(value) => setOfficialMemberStatus(value as OfficialMemberStatus)}>
                {officialMemberStatuses.map((status) => <option key={status}>{status}</option>)}
              </Select>
            </label>
          </div>
          <TextInput label="Reason" value={reason} onChange={setReason} />
          <TextInput label={`Type "${member.fullName}" to confirm`} value={confirmation} onChange={setConfirmation} />
          <div className="flex justify-end gap-3">
            <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={isSaving || !reason || confirmation !== member.fullName} className="bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]" onClick={() => void save()}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Save Status
            </Button>
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
}

function MemberAccountLinkDialog({
  action,
  onOpenChange,
  onSaved,
}: {
  action: MemberAccountAction | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (memberId: string) => Promise<void>;
}) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!action || action.type !== "link") return;
    void listUsersPaginated({ role: "member", pageSize: 100, sortBy: "displayName", sortDirection: "asc" })
      .then((result) => {
        const linkable = result.users.filter((user) => !user.linkedMemberId);
        setUsers(linkable);
        setUserId(linkable[0]?.id ?? "");
      })
      .catch(() => {
        setUsers([]);
        setUserId("");
      });
  }, [action]);

  const save = async () => {
    if (!action) return;
    setIsSaving(true);
    try {
      if (action.type === "link") {
        await linkUserMember(userId, action.member.id, reason);
        toast.success("Member account linked.");
      } else if (action.member.userId) {
        await unlinkUserMember(action.member.userId, reason);
        toast.success("Member account unlinked.");
      }
      await onSaved(action.member.id);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Account link action failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormDialog
      open={Boolean(action)}
      onOpenChange={onOpenChange}
      title={action?.type === "link" ? "Link Member Account" : "Unlink Member Account"}
      description="Only Member-role accounts can be linked, and each member/account can have one link."
    >
      {action ? (
        <div className="grid gap-4">
          <Info label="Member" value={`${action.member.memberCode} - ${action.member.fullName}`} />
          {action.type === "link" ? (
            <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
              Member account
              <Select value={userId} onChange={setUserId}>
                {users.length === 0 ? <option value="">No unlinked Member accounts</option> : null}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} - {user.email} ({user.accountStatus})
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <Info label="Linked Account" value={action.member.linkedUserEmail ?? "Unknown account"} />
          )}
          <TextInput label="Reason" value={reason} onChange={setReason} />
          <div className="flex justify-end gap-3">
            <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={isSaving || !reason || (action.type === "link" && !userId)} className="bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]" onClick={() => void save()}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Confirm
            </Button>
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
}

function UnifiedHistorySection({
  entries,
  query,
  total,
  isLoading,
  error,
  setQuery,
}: {
  entries: UnifiedStatusHistoryEntry[];
  query: { page: number; pageSize: number; search: string; sourceModule: HistorySource };
  total: number;
  isLoading: boolean;
  error: string;
  setQuery: (updater: (current: { page: number; pageSize: number; search: string; sourceModule: HistorySource }) => { page: number; pageSize: number; search: string; sourceModule: HistorySource }) => void;
}) {
  const updateQuery = (patch: Partial<typeof query>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };

  return (
    <div className="grid gap-5">
      <section className="grid min-w-0 gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6C7A70]">
          <History className="size-4" aria-hidden="true" />
          Unified Status History
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="relative block min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
            <input
              value={query.search}
              onChange={(event) => updateQuery({ search: event.target.value })}
              className="h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]"
              placeholder="Search history"
              type="search"
            />
          </label>
          <Select value={query.sourceModule} onChange={(value) => updateQuery({ sourceModule: value as HistorySource })}>
            {["All", "Application", "Member", "Account"].map((source) => <option key={source}>{source}</option>)}
          </Select>
          <Select value={String(query.pageSize)} onChange={(value) => setQuery((current) => ({ ...current, pageSize: Number(value), page: 1 }))}>
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
          </Select>
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No status history found" description="Application, member, and linked account status changes will appear here." />
      ) : (
        <>
          <div className="hidden 2xl:block">
            <DataTable>
              <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
                <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                  <tr>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Source</th>
                    <th className="px-5 py-4">Person / Record</th>
                    <th className="px-5 py-4">Old</th>
                    <th className="px-5 py-4">New</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#F7F8F3]">
                      <td className="px-5 py-4">{formatDate(entry.changedAt)}</td>
                      <td className="px-5 py-4">{entry.sourceModule}</td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-[#123D2A]">{entry.subjectName}</p>
                        <p className="mt-1 text-xs text-[#6C7A70]">{entry.subjectCode}</p>
                      </td>
                      <td className="px-5 py-4">{entry.oldStatus ?? "New"}</td>
                      <td className="px-5 py-4">{entry.newStatus}</td>
                      <td className="px-5 py-4">{entry.reason ?? "No reason recorded"}</td>
                      <td className="px-5 py-4">{entry.actor ?? "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
          <div className="grid gap-3 2xl:hidden">
            {entries.map((entry) => (
              <article key={entry.id} className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-bold text-[#123D2A]">{entry.subjectName}</p>
                    <p className="mt-1 text-xs text-[#6C7A70]">{entry.subjectCode}</p>
                  </div>
                  <StatusBadge tone="neutral">{entry.sourceModule}</StatusBadge>
                </div>
                <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 text-sm text-[#294B39]">
                  <Info label="Old" value={entry.oldStatus ?? "New"} />
                  <Info label="New" value={entry.newStatus} />
                  <Info label="Actor" value={entry.actor ?? "System"} />
                  <Info label="Date" value={formatDate(entry.changedAt)} />
                </dl>
                <p className="mt-3 text-sm text-[#5D6D63]">{entry.reason ?? "No reason recorded"}</p>
              </article>
            ))}
          </div>
          <SimplePagination
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            shown={entries.length}
            noun="history records"
            setPage={(page) => setQuery((current) => ({ ...current, page }))}
          />
        </>
      )}
    </div>
  );
}

function ApplicationFilters({
  query,
  requirementCompletion,
  submittedFrom,
  submittedTo,
  setQuery,
  setRequirementCompletion,
  setSubmittedFrom,
  setSubmittedTo,
}: {
  query: ChairmanApplicationListQuery;
  requirementCompletion: string;
  submittedFrom: string;
  submittedTo: string;
  setQuery: (updater: (current: ChairmanApplicationListQuery) => ChairmanApplicationListQuery) => void;
  setRequirementCompletion: (value: string) => void;
  setSubmittedFrom: (value: string) => void;
  setSubmittedTo: (value: string) => void;
}) {
  const updateQuery = (patch: Partial<ChairmanApplicationListQuery>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };

  return (
    <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6C7A70]">
        <Filter className="size-4" aria-hidden="true" />
        Filters
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
          <input
            value={query.search ?? ""}
            onChange={(event) => updateQuery({ search: event.target.value })}
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]"
            placeholder="Search applications"
            type="search"
          />
        </label>
        <Select value={query.status ?? "All"} onChange={(value) => updateQuery({ status: value as ChairmanApplicationListQuery["status"] })}>
          <option value="All">All statuses</option>
          {membershipApplicationStatuses.map((status) => <option key={status}>{status}</option>)}
        </Select>
        <Select value={query.requestedMembershipType ?? "All"} onChange={(value) => updateQuery({ requestedMembershipType: value as ChairmanApplicationListQuery["requestedMembershipType"] })}>
          <option value="All">All types</option>
          {requestedMembershipTypes.map((type) => <option key={type}>{type}</option>)}
        </Select>
        <Select value={query.applicationSource ?? "All"} onChange={(value) => updateQuery({ applicationSource: value as ChairmanApplicationListQuery["applicationSource"] })}>
          <option value="All">All sources</option>
          {membershipApplicationSources.map((source) => <option key={source}>{source}</option>)}
        </Select>
        <input
          value={query.barangay ?? ""}
          onChange={(event) => updateQuery({ barangay: event.target.value })}
          className="h-11 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm outline-none focus:border-[#1F6B43]"
          placeholder="Barangay"
        />
        <Select value={requirementCompletion} onChange={setRequirementCompletion}>
          <option value="All">All requirements</option>
          <option value="Complete">Complete</option>
          <option value="Incomplete">Incomplete</option>
        </Select>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input
          value={submittedFrom}
          onChange={(event) => setSubmittedFrom(event.target.value)}
          className="h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm outline-none focus:border-[#1F6B43]"
          type="date"
          aria-label="Submitted from"
        />
        <input
          value={submittedTo}
          onChange={(event) => setSubmittedTo(event.target.value)}
          className="h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm outline-none focus:border-[#1F6B43]"
          type="date"
          aria-label="Submitted to"
        />
        <Select value={query.sortBy} onChange={(value) => setQuery((current) => ({ ...current, sortBy: value as ChairmanApplicationListQuery["sortBy"] }))}>
          <option value="submittedAt">Sort by submitted</option>
          <option value="fullName">Sort by applicant</option>
          <option value="applicationStatus">Sort by status</option>
          <option value="requestedMembershipType">Sort by type</option>
        </Select>
        <Select value={query.sortDirection} onChange={(value) => setQuery((current) => ({ ...current, sortDirection: value as "asc" | "desc" }))}>
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </Select>
      </div>
    </section>
  );
}

function ApplicationsResponsiveList({
  applications,
  detailsById,
  onSelect,
}: {
  applications: ChairmanApplicationListItem[];
  detailsById: DetailMap;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden 2xl:block">
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Application</th>
                <th className="px-5 py-4">Applicant</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Barangay</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Submitted</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Requirements</th>
                <th className="px-5 py-4">Reviewer</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {applications.map((application) => {
                const detail = detailsById[application.id];
                const progress = detail ? requirementProgress(detail) : null;
                return (
                  <tr key={application.id} className="hover:bg-[#F7F8F3]">
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#123D2A]">{application.applicationCode}</p>
                      <p className="mt-1 text-xs text-[#6C7A70]">{application.applicationSource}</p>
                    </td>
                    <td className="px-5 py-4">{application.fullName}</td>
                    <td className="px-5 py-4">{application.requestedMembershipType}</td>
                    <td className="px-5 py-4">{application.barangay ?? "Unspecified"}</td>
                    <td className="px-5 py-4">{application.contactNumber}</td>
                    <td className="px-5 py-4">{formatDate(application.submittedAt)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={statusTone(application.applicationStatus)}>
                        {application.applicationStatus}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4">
                      {progress ? `${progress.completed}/${progress.total}` : "Loading"}
                    </td>
                    <td className="px-5 py-4">{detail?.reviewedBy ?? "Unassigned"}</td>
                    <td className="px-5 py-4">
                      <Button
                        type="button"
                        onClick={() => onSelect(application.id)}
                        className="h-9 bg-[#123D2A] px-3 text-white hover:bg-[#1F6B43]"
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
      </div>

      <div className="grid gap-3 2xl:hidden">
        {applications.map((application) => {
          const detail = detailsById[application.id];
          const progress = detail ? requirementProgress(detail) : null;
          return (
            <article key={application.id} className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-bold text-[#123D2A]">{application.fullName}</p>
                  <p className="mt-1 text-xs text-[#6C7A70]">{application.applicationCode}</p>
                </div>
                <StatusBadge tone={statusTone(application.applicationStatus)}>
                  {application.applicationStatus}
                </StatusBadge>
              </div>
              <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 text-sm text-[#294B39]">
                <Info label="Type" value={application.requestedMembershipType} />
                <Info label="Barangay" value={application.barangay ?? "Unspecified"} />
                <Info label="Submitted" value={formatDate(application.submittedAt)} />
                <Info label="Requirements" value={progress ? `${progress.completed}/${progress.total}` : "Loading"} />
              </dl>
              <Button
                type="button"
                onClick={() => onSelect(application.id)}
                className="mt-4 h-10 w-full bg-[#123D2A] text-white hover:bg-[#1F6B43]"
              >
                Review Application
              </Button>
            </article>
          );
        })}
      </div>
    </>
  );
}

function ApplicationDetailDialog({
  detail,
  open,
  isMutating,
  onOpenChange,
  onRefresh,
  onEdit,
  onPrint,
  onConfirmAction,
  runMutation,
  setActivationResult,
}: {
  detail: ChairmanApplicationDetail | null;
  open: boolean;
  isMutating: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<ChairmanApplicationDetail | null>;
  onEdit: () => void;
  onPrint: (detail: ChairmanApplicationDetail) => Promise<void>;
  onConfirmAction: (action: ConfirmAction) => void;
  runMutation: (successMessage: string, action: () => Promise<unknown>) => Promise<void>;
  setActivationResult: (result: ApprovalResult) => void;
}) {
  const [beneficiaryDraft, setBeneficiaryDraft] = useState<BeneficiaryInput>({
    fullName: "",
    relationship: "",
    ageAtApplication: null,
    birthDate: null,
  });
  const [requirementDraft, setRequirementDraft] = useState<{ requirementType: RequirementType; remarks: string }>({
    requirementType: "Other",
    remarks: "",
  });
  const [approvalConfirmOpen, setApprovalConfirmOpen] = useState(false);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalInput>({
    boardMeetingDate: new Date().toISOString().slice(0, 10),
    secretaryName: "",
    decisionReason: "",
    createMemberPortalAccount: false,
    accountEmail: "",
    username: "",
  });
  const [documentType, setDocumentType] = useState<MembershipDocumentType>("Valid ID");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  if (!detail) return null;

  const progress = requirementProgress(detail);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${detail.applicationCode} - ${detail.fullName}`}
      description="Review application details, requirements, documents, timeline, and conversion actions."
      contentClassName="w-[min(72rem,calc(100vw-2rem))]"
    >
      <div className="grid min-w-0 gap-6">
        <div className="flex min-w-0 flex-wrap gap-2">
          <ActionButton icon={Pencil} label="Edit" onClick={onEdit} />
          <ActionButton icon={ClipboardCheck} label="Start Review" onClick={() => onConfirmAction({ type: "transition", action: "start-review", label: "Start review" })} />
          <ActionButton icon={Send} label="Request Info" onClick={() => onConfirmAction({ type: "transition", action: "request-information", label: "Request information" })} />
          <ActionButton icon={X} label="Reject" danger onClick={() => onConfirmAction({ type: "transition", action: "reject", label: "Reject application" })} />
          <ActionButton icon={Archive} label="Withdraw" danger onClick={() => onConfirmAction({ type: "transition", action: "withdraw", label: "Withdraw application" })} />
          <ActionButton icon={Download} label="Print PDF" onClick={() => void onPrint(detail)} />
        </div>

        <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge tone={statusTone(detail.applicationStatus)}>{detail.applicationStatus}</StatusBadge>
            <p className="text-sm font-bold text-[#123D2A]">
              Requirements: {progress.completed}/{progress.total}
            </p>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#5D6D63]">
            Duplicate review: compare full name, contact number, email, and birth date
            before final approval. The backend does not expose a persisted duplicate flag
            on this detail response.
          </p>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2">
          <Info label="Source" value={detail.applicationSource} />
          <Info label="Requested type" value={detail.requestedMembershipType} />
          <Info label="Email" value={detail.email ?? "Not provided"} />
          <Info label="Contact" value={detail.contactNumber} />
          <Info label="Civil status" value={detail.civilStatus ?? "Not provided"} />
          <Info label="Birth" value={[detail.placeOfBirth, detail.dateOfBirth].filter(Boolean).join(" / ") || "Not provided"} />
          <Info label="Address" value={detail.currentAddress} />
          <Info label="Barangay" value={detail.barangay ?? "Unspecified"} />
          <Info label="Parents" value={[detail.fatherName, detail.motherName].filter(Boolean).join(" / ") || "Not provided"} />
          <Info label="Spouse / occupation" value={[detail.spouseName, detail.occupation].filter(Boolean).join(" / ") || "Not provided"} />
          <Info label="Signature" value={`${detail.applicantSignatureName} at ${detail.signedPlace}`} />
          <Info label="Signed at" value={formatDate(detail.signedAt)} />
        </section>

        <Commitments detail={detail} />

        <Panel title="Beneficiaries">
          <div className="grid gap-2">
            {detail.beneficiaries.map((beneficiary) => (
              <div key={beneficiary.id} className="flex flex-col gap-2 rounded-md border border-[#CAD8CB] p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#294B39]">
                  <strong>{beneficiary.fullName}</strong> - {beneficiary.relationship ?? "Beneficiary"} ({beneficiary.ageAtApplication ?? beneficiary.birthDate ?? "No age"})
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-9 border border-[#CAD8CB] bg-white px-3 text-[#123D2A] hover:bg-[#EEF2EC]"
                    onClick={() => {
                      const fullName = window.prompt("Beneficiary full name", beneficiary.fullName);
                      if (!fullName) return;
                      void runMutation("Beneficiary updated.", async () => {
                        await updateApplicationBeneficiary(beneficiary.id, { fullName });
                        await onRefresh();
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    className="h-9 border border-red-200 bg-white px-3 text-red-700 hover:bg-red-50"
                    onClick={() => onConfirmAction({ type: "delete-beneficiary", beneficiaryId: beneficiary.id, label: "Remove beneficiary" })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="grid gap-2 rounded-md border border-dashed border-[#B9CABD] p-3 md:grid-cols-4">
              <input className={inputClass} placeholder="Full name" value={beneficiaryDraft.fullName} onChange={(event) => setBeneficiaryDraft((current) => ({ ...current, fullName: event.target.value }))} />
              <input className={inputClass} placeholder="Relationship" value={beneficiaryDraft.relationship ?? ""} onChange={(event) => setBeneficiaryDraft((current) => ({ ...current, relationship: event.target.value }))} />
              <input className={inputClass} placeholder="Age" type="number" value={beneficiaryDraft.ageAtApplication ?? ""} onChange={(event) => setBeneficiaryDraft((current) => ({ ...current, ageAtApplication: event.target.value ? Number(event.target.value) : null }))} />
              <Button
                type="button"
                className="h-11 bg-[#123D2A] text-white hover:bg-[#1F6B43]"
                onClick={() => void runMutation("Beneficiary added.", async () => {
                  await addApplicationBeneficiary(detail.id, beneficiaryDraft);
                  setBeneficiaryDraft({ fullName: "", relationship: "", ageAtApplication: null, birthDate: null });
                  await onRefresh();
                })}
              >
                <Plus className="size-4" /> Add
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Documents">
          <div className="grid gap-2">
            {detail.documents.map((document) => (
              <div key={document.id} className="flex flex-col gap-2 rounded-md border border-[#CAD8CB] p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#294B39]">
                  <strong>{document.documentType}</strong> - {document.originalFileName}
                </p>
                <Button
                  type="button"
                  className="h-9 border border-red-200 bg-white px-3 text-red-700 hover:bg-red-50"
                  onClick={() => onConfirmAction({ type: "delete-document", documentId: document.id, label: "Remove document" })}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="grid gap-2 rounded-md border border-dashed border-[#B9CABD] p-3 md:grid-cols-[220px_1fr_auto]">
              <Select value={documentType} onChange={(value) => setDocumentType(value as MembershipDocumentType)}>
                {documentTypes.map((type) => <option key={type}>{type}</option>)}
              </Select>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[#123D2A] file:mr-4 file:h-11 file:border-0 file:bg-[#123D2A] file:px-4 file:font-bold file:text-white"
              />
              <Button
                type="button"
                disabled={!documentFile}
                className="h-11 bg-[#123D2A] text-white hover:bg-[#1F6B43]"
                onClick={() => void runMutation("Document uploaded.", async () => {
                  if (!documentFile) return;
                  await uploadChairmanApplicationDocument({ applicationId: detail.id, documentType, file: documentFile });
                  setDocumentFile(null);
                  await onRefresh();
                })}
              >
                Upload
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Requirements">
          <div className="grid gap-2">
            {detail.requirements.map((requirement) => (
              <RequirementRow
                key={requirement.id}
                requirement={requirement}
                onSave={(requirementStatus, remarks) =>
                  runMutation("Requirement updated.", async () => {
                    await updateApplicationRequirement(requirement.id, { requirementStatus, remarks });
                    await onRefresh();
                  })
                }
              />
            ))}
            <div className="grid gap-2 rounded-md border border-dashed border-[#B9CABD] p-3 md:grid-cols-[220px_1fr_auto]">
              <Select value={requirementDraft.requirementType} onChange={(value) => setRequirementDraft((current) => ({ ...current, requirementType: value as RequirementType }))}>
                {requirementTypes.map((type) => <option key={type}>{type}</option>)}
              </Select>
              <input className={inputClass} placeholder="Remarks" value={requirementDraft.remarks} onChange={(event) => setRequirementDraft((current) => ({ ...current, remarks: event.target.value }))} />
              <Button
                type="button"
                className="h-11 bg-[#123D2A] text-white hover:bg-[#1F6B43]"
                onClick={() => void runMutation("Requirement added.", async () => {
                  await addApplicationRequirement(detail.id, {
                    requirementType: requirementDraft.requirementType,
                    requirementStatus: "Pending",
                    remarks: requirementDraft.remarks || null,
                  });
                  setRequirementDraft({ requirementType: "Other", remarks: "" });
                  await onRefresh();
                })}
              >
                Add
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Status Timeline">
          <ol className="grid gap-3">
            {detail.history.map((entry) => (
              <li key={entry.id} className="rounded-md border border-[#CAD8CB] p-3 text-sm">
                <p className="font-bold text-[#123D2A]">{entry.oldStatus ?? "New"} to {entry.newStatus}</p>
                <p className="mt-1 text-[#5D6D63]">{formatDate(entry.changedAt)}</p>
                {entry.applicantMessage ? <p className="mt-2 text-[#294B39]">Applicant: {entry.applicantMessage}</p> : null}
                {entry.internalNote ? <p className="mt-1 text-[#294B39]">Internal: {entry.internalNote}</p> : null}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Payment Links and Approval">
          <div className="grid gap-3 md:grid-cols-2">
            <input className={inputClass} type="date" aria-label="Board meeting date" value={approvalDraft.boardMeetingDate} onChange={(event) => setApprovalDraft((current) => ({ ...current, boardMeetingDate: event.target.value }))} />
            <input className={inputClass} placeholder="Secretary name" value={approvalDraft.secretaryName} onChange={(event) => setApprovalDraft((current) => ({ ...current, secretaryName: event.target.value }))} />
            <input className={inputClass} placeholder="Decision reason" value={approvalDraft.decisionReason} onChange={(event) => setApprovalDraft((current) => ({ ...current, decisionReason: event.target.value }))} />
            <input className={inputClass} placeholder="Account email" value={approvalDraft.accountEmail ?? ""} onChange={(event) => setApprovalDraft((current) => ({ ...current, accountEmail: event.target.value }))} />
            <label className="flex items-center gap-2 text-sm font-semibold text-[#294B39]">
              <input type="checkbox" checked={approvalDraft.createMemberPortalAccount} onChange={(event) => setApprovalDraft((current) => ({ ...current, createMemberPortalAccount: event.target.checked }))} />
              Create member portal account
            </label>
          </div>
          <Button
            type="button"
            disabled={isMutating}
            className="mt-4 h-11 bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]"
            onClick={() => setApprovalConfirmOpen(true)}
          >
            <UserCheck className="size-4" />
            Approve and Convert
          </Button>
        </Panel>
      </div>
      <ConfirmDialog
        open={approvalConfirmOpen}
        onOpenChange={setApprovalConfirmOpen}
        title="Approve and convert application"
        description="This will create or link the member record, finalize the application, and generate the activation URL if requested."
        confirmLabel={isMutating ? "Working..." : "Approve"}
        onConfirm={() => {
          setApprovalConfirmOpen(false);
          void runMutation("Application approved and converted.", async () => {
            const result = await approveApplication(detail.id, approvalDraft);
            setActivationResult(result);
            await onRefresh();
          });
        }}
      />
    </FormDialog>
  );
}

function ApplicationFormDialog({
  open,
  mode,
  title,
  detail,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  detail?: ChairmanApplicationDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (application: ChairmanApplicationDetail) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ApplicationFormState>(
    detail ? fromDetail(detail) : blankApplication,
  );
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createChairmanApplication(toCreatePayload(draft))
          : await updateChairmanApplication(detail?.id ?? "", toUpdatePayload(draft));

      if (mode === "create" && scanFile) {
        await uploadChairmanApplicationDocument({
          applicationId: saved.id,
          documentType: "Scanned Paper Application",
          file: scanFile,
        });
      }

      toast.success(mode === "create" ? "Paper application encoded." : "Application updated.");
      await onSaved(saved);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Application could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="grid gap-4 md:grid-cols-2">
        <Select value={draft.applicationSource} onChange={(value) => setDraft((current) => ({ ...current, applicationSource: value as ApplicationFormState["applicationSource"] }))}>
          <option value="Chairman Entry">Chairman Entry</option>
          <option value="Imported Paper Form">Imported Paper Form</option>
        </Select>
        <Select value={draft.requestedMembershipType} onChange={(value) => setDraft((current) => ({ ...current, requestedMembershipType: value as RequestedMembershipType }))}>
          {requestedMembershipTypes.map((type) => <option key={type}>{type}</option>)}
        </Select>
        <TextInput
          label="First name"
          value={draft.firstName}
          onChange={(value) =>
            setDraft((current) => {
              const next = { ...current, firstName: value };
              return { ...next, applicantSignatureName: current.applicantSignatureName || applicationFullName(next) };
            })
          }
        />
        <TextInput
          label="Middle name"
          value={draft.middleName}
          onChange={(value) => setDraft((current) => ({ ...current, middleName: value }))}
        />
        <TextInput
          label="Last name"
          value={draft.lastName}
          onChange={(value) =>
            setDraft((current) => {
              const next = { ...current, lastName: value };
              return { ...next, applicantSignatureName: current.applicantSignatureName || applicationFullName(next) };
            })
          }
        />
        <TextInput
          label="Suffix"
          value={draft.suffix}
          onChange={(value) => setDraft((current) => ({ ...current, suffix: value }))}
        />
        <TextInput label="Contact number" value={draft.contactNumber} onChange={(value) => setDraft((current) => ({ ...current, contactNumber: value }))} />
        <TextInput label="Email" value={draft.email ?? ""} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
        <Select value={draft.civilStatus ?? "Single"} onChange={(value) => setDraft((current) => ({ ...current, civilStatus: value as ApplicationFormState["civilStatus"] }))}>
          {civilStatuses.map((status) => <option key={status}>{status}</option>)}
        </Select>
        <TextInput label="Place of birth" value={draft.placeOfBirth ?? ""} onChange={(value) => setDraft((current) => ({ ...current, placeOfBirth: value }))} />
        <TextInput label="Date of birth" type="date" value={draft.dateOfBirth ?? ""} onChange={(value) => setDraft((current) => ({ ...current, dateOfBirth: value }))} />
        <TextInput label="Current address" value={draft.currentAddress} onChange={(value) => setDraft((current) => ({ ...current, currentAddress: value }))} className="md:col-span-2" />
        <TextInput label="Barangay" value={draft.barangay ?? ""} onChange={(value) => setDraft((current) => ({ ...current, barangay: value }))} />
        <TextInput label="Municipality" value={draft.municipality} onChange={(value) => setDraft((current) => ({ ...current, municipality: value }))} />
        <TextInput label="Province" value={draft.province} onChange={(value) => setDraft((current) => ({ ...current, province: value }))} />
        <TextInput label="Father name" value={draft.fatherName ?? ""} onChange={(value) => setDraft((current) => ({ ...current, fatherName: value }))} />
        <TextInput label="Mother name" value={draft.motherName ?? ""} onChange={(value) => setDraft((current) => ({ ...current, motherName: value }))} />
        <TextInput label="Spouse name" value={draft.spouseName ?? ""} onChange={(value) => setDraft((current) => ({ ...current, spouseName: value }))} />
        <TextInput label="Occupation" value={draft.occupation ?? ""} onChange={(value) => setDraft((current) => ({ ...current, occupation: value }))} />
        <TextInput label="Signature name" value={draft.applicantSignatureName} onChange={(value) => setDraft((current) => ({ ...current, applicantSignatureName: value }))} />
        <TextInput label="Signed place" value={draft.signedPlace} onChange={(value) => setDraft((current) => ({ ...current, signedPlace: value }))} />
        <TextInput label="Signed date/time" type="datetime-local" value={draft.signedAt} onChange={(value) => setDraft((current) => ({ ...current, signedAt: value }))} />
        {mode === "create" ? (
          <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
            Scanned paper form
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setScanFile(event.target.files?.[0] ?? null)} />
          </label>
        ) : null}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {[
          ["orientationCommitmentAccepted", "Orientation"],
          ["membershipFeeCommitmentAccepted", "PHP 200 fee"],
          ["shareSubscriptionCommitmentAccepted", "Share agreement"],
          ["patronageRefundAcknowledged", "Patronage provisions"],
          ["bylawsAgreementAccepted", "Bylaws"],
          ["privacyConsentAccepted", "Privacy consent"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm font-semibold text-[#294B39]">
            <input
              type="checkbox"
              checked={Boolean(draft[key as keyof ApplicationFormState])}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" disabled={isSaving} className="bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]" onClick={() => void save()}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Save
        </Button>
      </div>
    </FormDialog>
  );
}

function RequirementRow({
  requirement,
  onSave,
}: {
  requirement: ChairmanApplicationDetail["requirements"][number];
  onSave: (status: RequirementStatus, remarks: string | null) => Promise<void>;
}) {
  const [status, setStatus] = useState<RequirementStatus>(requirement.requirementStatus);
  const [remarks, setRemarks] = useState(requirement.remarks ?? "");

  return (
    <div className="grid gap-2 rounded-md border border-[#CAD8CB] p-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-center">
      <div>
        <p className="font-bold text-[#123D2A]">{requirement.requirementType}</p>
        <StatusBadge tone={requirementTone(requirement.requirementStatus)}>
          {requirement.requirementStatus}
        </StatusBadge>
      </div>
      <Select value={status} onChange={(value) => setStatus(value as RequirementStatus)}>
        {requirementStatuses.map((nextStatus) => <option key={nextStatus}>{nextStatus}</option>)}
      </Select>
      <input className={inputClass} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Remarks" />
      <Button type="button" className="h-10 bg-[#123D2A] px-3 text-white hover:bg-[#1F6B43]" onClick={() => void onSave(status, remarks || null)}>
        Save
      </Button>
    </div>
  );
}

function ActivationResultDialog({
  result,
  onOpenChange,
}: {
  result: ApprovalResult | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog
      open={Boolean(result)}
      onOpenChange={onOpenChange}
      title="Application Approved"
      description="The activation URL is shown once. Store it before closing this dialog."
    >
      {result ? (
        <div className="grid gap-4">
          <Info label="Member code" value={result.memberCode} />
          {result.activationUrl ? (
            <div className="rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-4">
              <p className="text-sm font-bold text-[#123D2A]">Activation URL</p>
              <code className="mt-2 block break-all text-sm text-[#294B39]">{result.activationUrl}</code>
              <Button
                type="button"
                className="mt-3 h-10 bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]"
                onClick={() => {
                  void navigator.clipboard.writeText(result.activationUrl ?? "");
                  toast.success("Activation URL copied.");
                }}
              >
                Copy URL
              </Button>
            </div>
          ) : (
            <p className="text-sm text-[#5D6D63]">No portal account was created.</p>
          )}
        </div>
      ) : null}
    </FormDialog>
  );
}

function SimplePagination({
  page,
  pageSize,
  total,
  shown,
  noun,
  setPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  noun: string;
  setPage: (page: number) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[#5D6D63]">
        Showing {shown} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" disabled={page <= 1} className="h-10 border border-[#CAD8CB] bg-white px-3 text-[#123D2A]" onClick={() => setPage(Math.max(1, page - 1))}>
          Previous
        </Button>
        <span className="text-sm font-bold text-[#123D2A]">Page {page} / {maxPage}</span>
        <Button type="button" disabled={page >= maxPage} className="h-10 border border-[#CAD8CB] bg-white px-3 text-[#123D2A]" onClick={() => setPage(Math.min(maxPage, page + 1))}>
          Next
        </Button>
      </div>
    </div>
  );
}

function Pagination({
  query,
  shown,
  total,
  setQuery,
}: {
  query: ChairmanApplicationListQuery;
  shown: number;
  total: number;
  setQuery: (updater: (current: ChairmanApplicationListQuery) => ChairmanApplicationListQuery) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / query.pageSize));
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[#5D6D63]">
        Showing {shown} of {total} applications
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" disabled={query.page <= 1} className="h-10 border border-[#CAD8CB] bg-white px-3 text-[#123D2A]" onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>
          Previous
        </Button>
        <span className="text-sm font-bold text-[#123D2A]">Page {query.page} / {maxPage}</span>
        <Button type="button" disabled={query.page >= maxPage} className="h-10 border border-[#CAD8CB] bg-white px-3 text-[#123D2A]" onClick={() => setQuery((current) => ({ ...current, page: Math.min(maxPage, current.page + 1) }))}>
          Next
        </Button>
      </div>
    </div>
  );
}

function Commitments({ detail }: { detail: ChairmanApplicationDetail }) {
  return (
    <Panel title="Commitments">
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["Orientation", detail.orientationCommitmentAccepted],
          ["Membership fee", detail.membershipFeeCommitmentAccepted],
          ["Share agreement", detail.shareSubscriptionCommitmentAccepted],
          ["Patronage provisions", detail.patronageRefundAcknowledged],
          ["Bylaws", detail.bylawsAgreementAccepted],
          ["Privacy consent", detail.privacyConsentAccepted],
        ].map(([label, accepted]) => (
          <div key={String(label)} className="flex items-center justify-between rounded-md border border-[#CAD8CB] p-3 text-sm">
            <span>{label}</span>
            <StatusBadge tone={accepted ? "success" : "danger"}>
              {accepted ? "Accepted" : "Missing"}
            </StatusBadge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#123D2A]">{title}</h3>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}

function ActionButton({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={`h-10 px-3 ${
        danger
          ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
          : "border border-[#CAD8CB] bg-white text-[#123D2A] hover:bg-[#EEF2EC]"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </Button>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm text-[#123D2A] outline-none focus:border-[#1F6B43]"
    >
      {children}
    </select>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 text-sm font-semibold text-[#294B39] ${className}`}>
      {label}
      <input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6C7A70]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#123D2A]">{value}</p>
    </div>
  );
}

function requirementProgress(detail: ChairmanApplicationDetail) {
  const total = detail.requirements.length;
  const completed = detail.requirements.filter((requirement) =>
    ["Verified", "Waived"].includes(requirement.requirementStatus),
  ).length;
  return { completed, total, isComplete: total > 0 && completed === total };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

function memberStatusTone(status: OfficialMemberStatus) {
  if (status === "Active") return "success";
  if (status === "Pending" || status === "Inactive") return "warning";
  if (status === "Suspended" || status === "Terminated") return "danger";
  return "neutral";
}

function memberToDraft(member: MemberDetail): MemberFormState {
  return {
    memberCode: member.memberCode,
    fullName: member.fullName,
    contactNumber: member.contactNumber ?? "",
    email: member.email ?? "",
    barangay: member.barangay ?? "",
    municipality: member.municipality,
    province: member.province,
    sector: member.sector ?? "",
    membershipType: member.membershipType,
    approvalStatus: member.approvalStatus,
    officialMemberStatus: member.officialMemberStatus,
    applicationDate: member.applicationDate?.slice(0, 10) ?? "",
    shareCapitalDeadline: member.shareCapitalDeadline?.slice(0, 10) ?? "",
    notes: member.notes ?? "",
  };
}

function memberPayload(draft: MemberFormState): MemberProfileInput {
  return {
    memberCode: draft.memberCode,
    fullName: draft.fullName,
    contactNumber: draft.contactNumber || null,
    email: draft.email || null,
    barangay: draft.barangay || null,
    municipality: draft.municipality,
    province: draft.province,
    sector: draft.sector || null,
    membershipType: draft.membershipType,
    approvalStatus: draft.approvalStatus,
    officialMemberStatus: draft.officialMemberStatus,
    applicationDate: draft.applicationDate || null,
    shareCapitalDeadline: draft.shareCapitalDeadline || null,
    notes: draft.notes || null,
  };
}

function applicationFullName(draft: Pick<ApplicationFormState, "firstName" | "middleName" | "lastName" | "suffix">) {
  return [draft.firstName, draft.middleName, draft.lastName, draft.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function toCreatePayload(draft: ApplicationFormState): ChairmanMembershipApplicationInput {
  return {
    applicationSource: draft.applicationSource,
    requestedMembershipType: draft.requestedMembershipType,
    firstName: draft.firstName,
    middleName: draft.middleName || null,
    lastName: draft.lastName,
    suffix: draft.suffix || null,
    email: draft.email || null,
    contactNumber: draft.contactNumber,
    civilStatus: draft.civilStatus ?? null,
    placeOfBirth: draft.placeOfBirth || null,
    dateOfBirth: draft.dateOfBirth || null,
    currentAddress: draft.currentAddress,
    barangay: draft.barangay || null,
    municipality: draft.municipality,
    province: draft.province,
    fatherName: draft.fatherName || null,
    motherName: draft.motherName || null,
    spouseName: draft.spouseName || null,
    occupation: draft.occupation || null,
    orientationCommitmentAccepted: true,
    membershipFeeCommitmentAccepted: true,
    shareSubscriptionCommitmentAccepted: true,
    patronageRefundAcknowledged: Boolean(draft.patronageRefundAcknowledged),
    bylawsAgreementAccepted: true,
    privacyConsentAccepted: true,
    applicantSignatureName: draft.applicantSignatureName,
    signedAt: draft.signedAt,
    signedPlace: draft.signedPlace,
    beneficiaries: [],
  };
}

function toUpdatePayload(draft: ApplicationFormState): ChairmanMembershipApplicationUpdateInput {
  const { applicationSource: _source, beneficiaries: _beneficiaries, ...payload } = toCreatePayload(draft);
  void _source;
  void _beneficiaries;
  return {
    ...payload,
    boardMeetingDate: draft.boardMeetingDate || null,
    secretaryName: draft.secretaryName || null,
    decisionReason: draft.decisionReason || null,
  };
}

function fromDetail(detail: ChairmanApplicationDetail): ApplicationFormState {
  return {
    ...blankApplication,
    applicationSource:
      detail.applicationSource === "Public Website" ? "Chairman Entry" : detail.applicationSource,
    requestedMembershipType: detail.requestedMembershipType,
    firstName: detail.firstName,
    middleName: detail.middleName ?? "",
    lastName: detail.lastName,
    suffix: detail.suffix ?? "",
    email: detail.email ?? "",
    contactNumber: detail.contactNumber,
    civilStatus: detail.civilStatus ?? "Single",
    placeOfBirth: detail.placeOfBirth ?? "",
    dateOfBirth: detail.dateOfBirth ?? "",
    currentAddress: detail.currentAddress,
    barangay: detail.barangay ?? "",
    municipality: detail.municipality,
    province: detail.province,
    fatherName: detail.fatherName ?? "",
    motherName: detail.motherName ?? "",
    spouseName: detail.spouseName ?? "",
    occupation: detail.occupation ?? "",
    orientationCommitmentAccepted: detail.orientationCommitmentAccepted,
    membershipFeeCommitmentAccepted: detail.membershipFeeCommitmentAccepted,
    shareSubscriptionCommitmentAccepted: detail.shareSubscriptionCommitmentAccepted,
    patronageRefundAcknowledged: detail.patronageRefundAcknowledged,
    bylawsAgreementAccepted: detail.bylawsAgreementAccepted,
    privacyConsentAccepted: detail.privacyConsentAccepted,
    applicantSignatureName: detail.applicantSignatureName,
    signedAt: detail.signedAt ? new Date(detail.signedAt).toISOString().slice(0, 16) : blankApplication.signedAt,
    signedPlace: detail.signedPlace,
    boardMeetingDate: detail.boardMeetingDate ?? "",
    secretaryName: detail.secretaryName ?? "",
    decisionReason: detail.decisionReason ?? "",
  };
}

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm text-[#123D2A] outline-none focus:border-[#1F6B43]";
