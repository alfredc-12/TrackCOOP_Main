"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Filter,
  History,
  Leaf,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Play,
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Children, Fragment, isValidElement, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import type { AuthUser } from "@/features/auth/types";
import { ApiClientError } from "@/lib/api-client";
import { getAuthenticatedUser } from "@/lib/auth-client";
import {
  addApplicationBeneficiary,
  addApplicationRequirement,
  applicationDocumentViewUrl,
  approveApplication,
  createChairmanApplication,
  deleteApplicationBeneficiary,
  deleteApplicationDocument,
  deleteApplicationRequirement,
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
type HistoryQuery = { page: number; pageSize: number; search: string; sourceModule: HistorySource; date: string };
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
  | { type: "delete-document"; documentId: string; label: string }
  | { type: "delete-requirement"; requirementId: string; label: string };

function requirementTone(status: RequirementStatus) {
  if (status === "Verified" || status === "Waived") return "success";
  if (status === "Rejected") return "danger";
  if (status === "Submitted") return "warning";
  return "neutral";
}

export function MembersClient() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("applications");
  const [summary, setSummary] = useState<ChairmanApplicationSummary>(emptySummary);
  const [applications, setApplications] = useState<ChairmanApplicationListItem[]>([]);
  const [detailsById, setDetailsById] = useState<DetailMap>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState<ChairmanApplicationListQuery>(defaultQuery);
  const [requirementCompletion, setRequirementCompletion] = useState("All");
  const [applicationBarangays, setApplicationBarangays] = useState<string[]>([]);
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
  const [historyQuery, setHistoryQuery] = useState<HistoryQuery>({
    page: 1,
    pageSize: 10,
    search: "",
    sourceModule: "All",
    date: "",
  });
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const selectedDetail = selectedId ? detailsById[selectedId] ?? null : null;

  useEffect(() => {
    let active = true;

    getAuthenticatedUser()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .catch(() => {
        if (active) setCurrentUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

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

  const loadApplicationBarangays = useCallback(async () => {
    try {
      const barangays: Array<string | null | undefined> = [];
      let page = 1;
      let total = 0;

      do {
        const result = await listChairmanApplications({
          ...defaultQuery,
          page,
          pageSize: 100,
        });
        barangays.push(...result.applications.map((application) => application.barangay));
        total = result.total;
        page += 1;
      } while ((page - 1) * 100 < total);

      setApplicationBarangays(groupBarangays(barangays));
    } catch {
      setApplicationBarangays([]);
    }
  }, []);

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
    const timeoutId = window.setTimeout(() => {
      void loadApplicationBarangays();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadApplicationBarangays]);

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
      if (requirementCompletion !== "All" && detail) {
        const completed = requirementProgress(detail).isComplete;
        if (requirementCompletion === "Complete" && !completed) return false;
        if (requirementCompletion === "Incomplete" && completed) return false;
      }
      return true;
    });
  }, [applications, detailsById, requirementCompletion]);

  const barangayOptions = useMemo(
    () => groupBarangays([
      ...applicationBarangays,
      ...applications.map((application) => application.barangay),
      ...Object.values(detailsById).map((detail) => detail.barangay),
      ...members.map((member) => member.barangay),
    ]),
    [applicationBarangays, applications, detailsById, members],
  );

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

    if (confirmAction.type === "delete-requirement") {
      void runMutation("Requirement removed.", async () => {
        await deleteApplicationRequirement(confirmAction.requirementId);
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
      <div className="flex flex-col gap-5 border-b border-[#CAD8CB] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.34em] text-[#D99A0B]">People</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-[#123D2A] sm:text-4xl">Members</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">
            Membership applications, accepted-member records, and official status history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {activeTab !== "history" ? (
            <Button
              type="button"
              onClick={() => activeTab === "directory" ? setMemberFormOpen(true) : setPaperOpen(true)}
              className="h-11 rounded-md bg-[#123D2A] px-4 text-white shadow-[0_10px_24px_rgba(18,61,42,0.16)] hover:bg-[#1F6B43]"
            >
              {activeTab === "directory" ? <Plus className="size-4" aria-hidden="true" /> : <FilePlus2 className="size-4" aria-hidden="true" />}
              {activeTab === "directory" ? "Create Manual Member" : "Encode Paper Application"}
            </Button>
          ) : null}
            <Button
              type="button"
              onClick={() => {
                if (activeTab === "directory") void loadDirectory();
                else if (activeTab === "history") void loadUnifiedHistory();
                else void loadApplications();
              }}
              className="h-11 rounded-md border border-[#CAD8CB] bg-white px-4 text-[#123D2A] shadow-[0_10px_22px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC]"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
        </div>
      </div>

      <div className="-mt-2 flex flex-wrap gap-8 border-b border-[#CAD8CB]">
        {[
          ["applications", "Applications"],
          ["directory", "Member Directory"],
          ["history", "Status History"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as TabKey)}
            className={`border-b-2 px-0 py-3 text-sm font-black transition ${
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ApplicationMetricCard label="Submitted" value={summary.submitted} icon={FileText} />
            <ApplicationMetricCard label="Under Review" value={summary.underReview} icon={ClipboardCheck} />
            <ApplicationMetricCard label="Needs Info" value={summary.needsInformation} icon={Send} />
            <ApplicationMetricCard label="Approved" value={summary.approved} icon={CheckCircle2} />
            <ApplicationMetricCard label="Rejected" value={summary.rejected} icon={X} />
          </div>

          <ApplicationFilters
            query={query}
            requirementCompletion={requirementCompletion}
            barangayOptions={barangayOptions}
            setQuery={setQuery}
            setRequirementCompletion={setRequirementCompletion}
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
                query={query}
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
          barangayOptions={barangayOptions}
          query={memberQuery}
          total={memberTotal}
          isLoading={isMemberLoading}
          error={memberError}
          setQuery={setMemberQuery}
          onOpen={async (memberId) => {
            try {
              const detail = await getMemberDetail(memberId);
              setSelectedMember(detail);
            } catch (caught) {
              toast.error(caught instanceof ApiClientError ? caught.message : "Failed to load member details.");
            }
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
        currentUser={currentUser}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onRefresh={() => selectedDetail ? refreshDetail(selectedDetail.id) : Promise.resolve(null)}
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
        onRefresh={async (id) => { await refreshMemberDetail(id); }}
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
  barangayOptions,
  query,
  total,
  isLoading,
  error,
  setQuery,
  onOpen,
}: {
  summary: DirectoryMemberSummary;
  members: MemberProfile[];
  barangayOptions: string[];
  query: MemberListQuery;
  total: number;
  isLoading: boolean;
  error: string;
  setQuery: (updater: (current: MemberListQuery) => MemberListQuery) => void;
  onOpen: (memberId: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ApplicationMetricCard label="Members" value={summary.total} icon={UsersRound} />
        <ApplicationMetricCard label="Active" value={summary.active} icon={UserCheck} />
        <ApplicationMetricCard label="Associates" value={summary.associate} icon={WalletCards} />
        <ApplicationMetricCard label="True Members" value={summary.trueMember} icon={ShieldCheck} />
      </div>

      <MemberFilters query={query} barangayOptions={barangayOptions} setQuery={setQuery} />

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
          <MemberResponsiveList members={members} query={query} total={total} setQuery={setQuery} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}

function MemberFilters({
  query,
  barangayOptions,
  setQuery,
}: {
  query: MemberListQuery;
  barangayOptions: string[];
  setQuery: (updater: (current: MemberListQuery) => MemberListQuery) => void;
}) {
  const updateQuery = (patch: Partial<MemberListQuery>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };

  return (
    <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-3 shadow-[0_10px_24px_rgba(18,61,42,0.04)] sm:p-4">
      <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
        <Filter className="size-4" aria-hidden="true" />
        Filters
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.45fr_0.9fr_0.9fr_0.9fr_0.9fr]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
          <input
            value={query.search ?? ""}
            onChange={(event) => updateQuery({ search: event.target.value })}
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-white pl-10 pr-3 text-sm font-semibold text-[#123D2A] outline-none transition placeholder:font-normal placeholder:text-[#7D8C82] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10"
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
        <Select value={query.barangay ?? "All"} onChange={(value) => updateQuery({ barangay: value === "All" ? undefined : value })}>
          <option value="All">All barangays</option>
          {barangayOptions.map((barangay) => <option key={barangay}>{barangay}</option>)}
        </Select>
        <Select value={query.sortDirection ?? "desc"} onChange={(value) => setQuery((current) => ({ ...current, sortDirection: value as "asc" | "desc", page: 1 }))}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </Select>
      </div>
    </section>
  );
}

function MemberResponsiveList({
  members,
  query,
  total,
  setQuery,
  onOpen,
}: {
  members: MemberProfile[];
  query: MemberListQuery;
  total: number;
  setQuery: (updater: (current: MemberListQuery) => MemberListQuery) => void;
  onOpen: (memberId: string) => Promise<void>;
}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const direction = query.sortDirection ?? "desc";
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min((page - 1) * pageSize + members.length, total);
  const sortBy = (field: NonNullable<MemberListQuery["sortBy"]>) => {
    setQuery((current) => ({
      ...current,
      sortBy: field,
      sortDirection: current.sortBy === field && (current.sortDirection ?? "desc") === "desc" ? "asc" : "desc",
      page: 1,
    }));
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-white shadow-[0_16px_34px_rgba(18,61,42,0.06)]">
      <div className="hidden lg:block">
        <table className="min-w-full table-fixed divide-y divide-[#E2E8E2] text-left text-xs">
            <thead className="bg-[#FBFCF8] text-[0.68rem] uppercase tracking-[0.12em] text-[#5D6D63]">
              <tr>
                <SortableHeader className="w-[26%]" label="Member" active={query.sortBy === "fullName"} direction={direction} onClick={() => sortBy("fullName")} />
                <SortableHeader className="w-[12%]" label="Type" />
                <SortableHeader className="w-[13%]" label="Barangay" />
                <SortableHeader className="w-[14%]" label="Status" />
                <SortableHeader className="w-[17%]" label="Account" />
                <SortableHeader className="w-[11%]" label="Created" active={query.sortBy === "createdAt"} direction={direction} onClick={() => sortBy("createdAt")} />
                <th className="w-[7%] px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#0F241A]">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-[#FBFCF8]">
                  <td className="px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-xs font-black text-[#123D2A]">
                        {applicationInitials(member.fullName)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#123D2A]">{member.fullName}</p>
                        <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-[#6C7A70]">{member.memberCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold">{member.membershipType}</td>
                  <td className="px-5 py-3 text-sm font-semibold">{member.barangay ?? "Unspecified"}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={memberStatusTone(member.officialMemberStatus)}>{member.officialMemberStatus}</StatusBadge>
                  </td>
                  <td className="px-5 py-3">
                    {member.linkedUserEmail ? (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#123D2A]">{member.linkedUserEmail}</p>
                        <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-[#6C7A70]">{member.linkedUserUsername ?? member.linkedUserStatus ?? "Linked"}</p>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-[#6C7A70]">Unlinked</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold leading-5">{formatSubmittedDate(member.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button type="button" className="h-8 rounded-md bg-[#123D2A] px-3 text-xs font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)] hover:bg-[#1F6B43]" onClick={() => void onOpen(member.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      <div className="grid divide-y divide-[#EEF2EC] lg:hidden">
        {members.map((member) => (
          <article key={member.id} className="bg-white p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-sm font-black text-[#123D2A]">
                  {applicationInitials(member.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-black text-[#123D2A]">{member.fullName}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6C7A70]">{member.memberCode}</p>
                </div>
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

      <div className="flex flex-col gap-3 border-t border-[#E7EEE5] bg-[#FBFCF8] px-5 py-4 text-sm font-semibold text-[#5D6D63] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {start}-{end} of {total} members
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" disabled={page <= 1} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: 1 }))} aria-label="First page">
            <ChevronsLeft className="size-4" />
          </Button>
          <Button type="button" disabled={page <= 1} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#123D2A] text-sm font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)]" aria-current="page">
            {page}
          </span>
          <Button type="button" disabled={page >= maxPage} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: Math.min(maxPage, (current.page ?? 1) + 1) }))} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" disabled={page >= maxPage} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: maxPage }))} aria-label="Last page">
            <ChevronsRight className="size-4" />
          </Button>
          <div className="w-40 shrink-0">
            <Select value={String(pageSize)} onChange={(value) => setQuery((current) => ({ ...current, pageSize: Number(value), page: 1 }))}>
              <option value="5">5 per page</option>
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
            </Select>
          </div>
        </div>
      </div>
    </section>
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
  onRefresh: (memberId: string) => Promise<void>;
}) {
  const [step, setStep] = useState<number>(1);
  if (!member) return null;

  const memberDetailSteps = ["Profile", "Status & Type", "Capital Progress", "Cooperative Activity"];
  const capitalPercent = member.shareCapital.fullRequirement > 0
    ? Math.min(100, Math.round((member.shareCapital.validatedTotal / member.shareCapital.fullRequirement) * 100))
    : 0;

  return (
    <FormDialog
      open={Boolean(member)}
      onOpenChange={onOpenChange}
      title={
        <span className="flex min-w-0 items-center gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#123D2A] text-white shadow-[0_12px_28px_rgba(18,61,42,0.22)]">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 truncate text-xl font-black sm:text-2xl">{member.memberCode} - {member.fullName}</span>
        </span>
      }
      description="Member profile, official status, linked account, share capital progress, and recent cooperative activity."
      contentClassName="w-[min(74rem,calc(100vw-2rem))] p-4 sm:p-5"
    >
      <MemberDetailStepper currentStep={step} steps={memberDetailSteps} onStepChange={setStep} />

      <div className="grid gap-4 border-t border-[#CAD8CB] pt-4">
        {step === 1 && (
        <>
        <MemberActionBar
          member={member}
          onEdit={onEdit}
          onStatus={onStatus}
          onAccountAction={onAccountAction}
          onRefresh={onRefresh}
        />
        <MemberOverviewSection member={member} />
        <ShareCapitalProgressSection member={member} capitalPercent={capitalPercent} />
        </>
        )}

        {step === 2 && (
        <>
          <MemberStatusSummarySection member={member} />
          <MemberStatusHistorySection member={member} />
        </>
        )}

        {step === 3 && (
        <>
          <ShareCapitalProgressSection member={member} capitalPercent={capitalPercent} />
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
        </>
        )}

        {step === 4 && (
        <section className="grid gap-4 lg:grid-cols-2">
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
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[#CAD8CB] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" className="h-10 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm text-[#123D2A] shadow-[0_8px_18px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>Close</Button>
        <div className="flex justify-end gap-2">
          {step > 1 && (
            <Button type="button" className="h-10 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm text-[#123D2A] shadow-[0_8px_18px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC]" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {step < 4 && (
            <Button type="button" className="h-10 rounded-md bg-[#123D2A] px-5 text-sm text-white shadow-[0_12px_24px_rgba(18,61,42,0.22)] hover:bg-[#1F6B43]" onClick={() => setStep(s => s + 1)}>
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </FormDialog>
  );
}

function MemberDetailStepper({
  currentStep,
  steps,
  onStepChange,
}: {
  currentStep: number;
  steps: string[];
  onStepChange: (step: number) => void;
}) {
  return (
    <ol className="my-4 flex flex-col gap-2 lg:flex-row lg:items-center">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isComplete = currentStep > stepNumber;

        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => onStepChange(stepNumber)}
              className="group flex min-w-0 items-center gap-2 rounded-md py-1 pr-2 text-left outline-none transition focus:ring-2 focus:ring-[#1F6B43]/20"
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-black ${
                  isActive || isComplete
                    ? "border-[#123D2A] bg-[#123D2A] text-white"
                    : "border-[#CAD8CB] bg-white text-[#5D6D63]"
                }`}
              >
                {stepNumber}
              </span>
              <span className={`min-w-0 truncate text-xs font-black sm:text-sm ${isActive ? "text-[#123D2A]" : "text-[#5D6D63] group-hover:text-[#123D2A]"}`}>
                {label}
              </span>
            </button>
            {index < steps.length - 1 ? <span className="hidden h-px min-w-6 flex-1 bg-[#CAD8CB] lg:block" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function MemberActionBar({
  member,
  onEdit,
  onStatus,
  onAccountAction,
  onRefresh,
}: {
  member: MemberDetail;
  onEdit: (member: MemberDetail) => void;
  onStatus: (member: MemberDetail) => void;
  onAccountAction: (action: MemberAccountAction) => void;
  onRefresh: (memberId: string) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-[#CAD8CB] bg-white p-2.5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MemberDialogActionButton icon={Pencil} label="Edit" primary onClick={() => onEdit(member)} />
        <MemberDialogActionButton icon={ShieldCheck} label="Update Status / Type" onClick={() => onStatus(member)} />
        <MemberDialogActionButton icon={Printer} label="Print Profile" onClick={() => window.print()} />
        <MemberDialogActionButton icon={RefreshCcw} label="Refresh" onClick={() => void onRefresh(member.id)} />
        {member.userId ? (
          <MemberDialogActionButton icon={Unlink} label="Unlink Account" danger onClick={() => onAccountAction({ type: "unlink", member })} />
        ) : (
          <MemberDialogActionButton icon={Link2} label="Link Account" onClick={() => onAccountAction({ type: "link", member })} />
        )}
      </div>
    </section>
  );
}

function MemberDialogActionButton({
  icon: Icon,
  label,
  primary = false,
  danger = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={`h-11 justify-center rounded-md px-3 text-xs font-black shadow-[0_8px_18px_rgba(18,61,42,0.06)] ${
        primary
          ? "bg-[#123D2A] text-white hover:bg-[#1F6B43]"
          : danger
            ? "border border-red-300 bg-white text-red-700 hover:bg-red-50"
            : "border border-[#CAD8CB] bg-white text-[#123D2A] hover:bg-[#EEF2EC]"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

function MemberDialogSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-3 shadow-[0_12px_30px_rgba(18,61,42,0.05)] sm:p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#EEF8EF] text-[#123D2A]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h3 className="text-base font-black text-[#123D2A]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function MemberOverviewSection({ member }: { member: MemberDetail }) {
  return (
    <MemberDialogSection title="Member Overview" icon={UserCheck}>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <MemberInfoCard label="Official Status" value={member.officialMemberStatus} icon={ShieldCheck} />
        <MemberInfoCard label="Membership Type" value={member.membershipType} icon={UsersRound} />
        <MemberInfoCard label="Approval" value={member.approvalStatus} icon={CheckCircle2} />
        <MemberInfoCard label="Contact" value={member.contactNumber ?? "Not provided"} icon={Phone} />
        <MemberInfoCard label="Barangay" value={member.barangay ?? "Unspecified"} icon={MapPin} />
        <MemberInfoCard label="Municipality" value={`${member.municipality}, ${member.province}`} icon={Building2} />
        <MemberInfoCard label="Sector" value={member.sector ?? "Not provided"} icon={Leaf} />
        <MemberInfoCard
          label="Linked Account"
          value={member.linkedUserEmail ? `${member.linkedUserEmail} (${member.linkedUserStatus ?? "Unknown"})` : "Unlinked"}
          icon={Link2}
          className="lg:col-span-2"
        />
        <MemberInfoCard label="Email" value={member.email ?? "Not provided"} icon={Mail} className="lg:col-span-2" />
      </div>
    </MemberDialogSection>
  );
}

function ShareCapitalProgressSection({
  member,
  capitalPercent,
}: {
  member: MemberDetail;
  capitalPercent: number;
}) {
  return (
    <MemberDialogSection title="Share-Capital Progress" icon={WalletCards}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,28rem)] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[#DDE8D8]">
              <div className="h-full rounded-full bg-[#1F6B43]" style={{ width: `${capitalPercent}%` }} />
            </div>
            <span className="shrink-0 text-base font-black text-[#123D2A]">{capitalPercent}%</span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#365F4A]">
            <strong className="text-[#123D2A]">{formatCurrency(member.shareCapital.validatedTotal)}</strong> validated of{" "}
            <strong className="text-[#123D2A]">{formatCurrency(member.shareCapital.fullRequirement)}</strong> required for True Member.
          </p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <MemberInfoCard label="Pending" value={formatCurrency(member.shareCapital.pendingTotal)} icon={WalletCards} />
          <MemberInfoCard label="Allowed Remaining" value={formatCurrency(member.shareCapital.remainingAllowed)} icon={WalletCards} />
        </div>
      </div>
    </MemberDialogSection>
  );
}

function MemberStatusSummarySection({ member }: { member: MemberDetail }) {
  return (
    <MemberDialogSection title="Status & Type" icon={ShieldCheck}>
      <div className="grid gap-2.5 md:grid-cols-3">
        <MemberInfoCard label="Official Status" value={member.officialMemberStatus} icon={ShieldCheck} />
        <MemberInfoCard label="Membership Type" value={member.membershipType} icon={UsersRound} />
        <MemberInfoCard label="Approval" value={member.approvalStatus} icon={CheckCircle2} />
        {member.latestIndicator ? (
          <>
            <MemberInfoCard label="Latest Indicator" value={member.latestIndicator.statusLabel} icon={ClipboardCheck} />
            <MemberInfoCard label="Score" value={String(member.latestIndicator.totalScore)} icon={History} />
            <MemberInfoCard label="Computed" value={formatDate(member.latestIndicator.computedAt)} icon={CalendarDays} />
            <p className="rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-4 text-sm leading-6 text-[#294B39] md:col-span-3">
              {member.latestIndicator.basisSummary ?? "No basis summary recorded."}
            </p>
          </>
        ) : (
          <p className="rounded-md border border-dashed border-[#CAD8CB] bg-[#F7F8F3] p-4 text-sm text-[#5D6D63] md:col-span-3">
            No indicator has been calculated for this member yet.
          </p>
        )}
      </div>
    </MemberDialogSection>
  );
}

function MemberStatusHistorySection({ member }: { member: MemberDetail }) {
  return (
    <MemberDialogSection title="Member Status History" icon={History}>
      <ol className="grid max-h-[24rem] gap-3 overflow-y-auto pr-1">
        {member.statusHistory.length === 0 ? (
          <li className="rounded-md border border-dashed border-[#CAD8CB] bg-[#F7F8F3] p-3 text-sm text-[#5D6D63]">
            No member status history yet.
          </li>
        ) : (
          member.statusHistory.map((entry) => (
            <li key={entry.id} className="rounded-md border border-[#CAD8CB] bg-[#FBFCF8] p-3 text-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#6C7A70]">Status Change</p>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                    <HistoryStatusPill status={formatMemberStatusSnapshot(entry.oldMembershipType, entry.oldOfficialStatus, "New")} />
                    <ChevronRight className="size-4 shrink-0 text-[#1F6B43]" aria-hidden="true" />
                    <HistoryStatusPill status={formatMemberStatusSnapshot(entry.newMembershipType, entry.newOfficialStatus, "No change")} />
                  </div>
                </div>
                <p className="shrink-0 text-sm font-black text-[#123D2A]">{formatDate(entry.changedAt)}</p>
              </div>
              <p className="mt-3 break-words border-t border-[#E7EEE5] pt-3 leading-6 text-[#5D6D63]">
                {entry.reason ?? "No reason recorded."}
              </p>
            </li>
          ))
        )}
      </ol>
    </MemberDialogSection>
  );
}

function MemberInfoCard({
  label,
  value,
  icon: Icon,
  className = "",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 rounded-md border border-[#CAD8CB] bg-[#FBFCF8] p-3 pr-12 ${className}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#5D6D63]">{label}</p>
      <p className="mt-1.5 break-words text-sm font-black leading-5 text-[#123D2A]">{value}</p>
      <span className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-[#DDE8D8] bg-[#EEF8EF] text-[#123D2A]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
}

function formatMemberStatusSnapshot(
  membershipType: string | null | undefined,
  officialStatus: string | null | undefined,
  fallback: string,
) {
  const snapshot = [membershipType, officialStatus].filter(Boolean).join(" / ");
  return snapshot || fallback;
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
  const [step, setStep] = useState<number>(1);

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
      <div className="mb-4 flex items-center justify-between border-b border-[#CAD8CB] pb-4">
        <h2 className="text-lg font-bold text-[#123D2A]">
          Step {step} of 3: {step === 1 ? "Basic Info" : step === 2 ? "Demographics" : "Membership Info"}
        </h2>
      </div>

      {step === 1 && (
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Member code" value={draft.memberCode} onChange={(value) => setDraft((current) => ({ ...current, memberCode: value }))} />
        <TextInput label="Full name" value={draft.fullName} onChange={(value) => setDraft((current) => ({ ...current, fullName: value }))} />
        <TextInput label="Contact number" value={draft.contactNumber} onChange={(value) => setDraft((current) => ({ ...current, contactNumber: value }))} />
        <TextInput label="Email" value={draft.email} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
      </div>
      )}

      {step === 2 && (
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Barangay" value={draft.barangay} onChange={(value) => setDraft((current) => ({ ...current, barangay: value }))} />
        <TextInput label="Sector" value={draft.sector} onChange={(value) => setDraft((current) => ({ ...current, sector: value }))} />
        <TextInput label="Municipality" value={draft.municipality} onChange={(value) => setDraft((current) => ({ ...current, municipality: value }))} />
        <TextInput label="Province" value={draft.province} onChange={(value) => setDraft((current) => ({ ...current, province: value }))} />
      </div>
      )}

      {step === 3 && (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
          Membership type
          <Select value={draft.membershipType} onChange={(value) => setDraft((current) => ({ ...current, membershipType: value as MembershipType }))}>
            {membershipTypes.map((type) => <option key={type}>{type}</option>)}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
          Official Status
          <Select value={draft.officialMemberStatus} onChange={(value) => setDraft((current) => ({ ...current, officialMemberStatus: value as OfficialMemberStatus }))}>
            {officialMemberStatuses.map((status) => <option key={status}>{status}</option>)}
          </Select>
        </label>
        <TextInput label="Application date" type="date" value={draft.applicationDate} onChange={(value) => setDraft((current) => ({ ...current, applicationDate: value }))} />
        <TextInput label="Share-capital deadline" type="date" value={draft.shareCapitalDeadline} onChange={(value) => setDraft((current) => ({ ...current, shareCapitalDeadline: value }))} />
        <label className="grid gap-2 text-sm font-semibold text-[#294B39] md:col-span-2">
          Notes
          <textarea className="min-h-28 rounded-md border border-[#CAD8CB] bg-white p-3 text-sm outline-none focus:border-[#1F6B43]" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
        </label>
      </div>
      )}

      <div className="mt-6 flex justify-between border-t border-[#CAD8CB] pt-4">
        <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {step < 3 && (
            <Button type="button" className="bg-[#123D2A] px-6 text-white hover:bg-[#1F6B43]" onClick={() => setStep(s => s + 1)}>
              Next
            </Button>
          )}
          {step === 3 && (
            <Button type="button" disabled={isSaving} className="bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]" onClick={() => void save()}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Save
            </Button>
          )}
        </div>
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
  query: HistoryQuery;
  total: number;
  isLoading: boolean;
  error: string;
  setQuery: (updater: (current: HistoryQuery) => HistoryQuery) => void;
}) {
  const updateQuery = (patch: Partial<typeof query>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-3 shadow-[0_10px_24px_rgba(18,61,42,0.04)] sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
              <Filter className="size-4" aria-hidden="true" />
              Filters
            </div>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="relative block min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
            <input
              value={query.search}
              onChange={(event) => updateQuery({ search: event.target.value })}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-white pl-10 pr-3 text-sm font-semibold text-[#123D2A] outline-none transition placeholder:font-normal placeholder:text-[#7D8C82] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10"
              placeholder="Search history"
              type="search"
            />
          </label>
          <Select value={query.sourceModule} onChange={(value) => updateQuery({ sourceModule: value as HistorySource })}>
            <option value="All">All sources</option>
            {["Application", "Member", "Account"].map((source) => <option key={source}>{source}</option>)}
          </Select>
          <DatePicker
            label="Filter history by date"
            value={query.date}
            onChange={(date) => updateQuery({ date })}
            placeholder="Filter by date"
            hideLabel
            triggerClassName="h-11 rounded-md border-[#CAD8CB] px-3 text-sm focus:ring-[#1F6B43]/10"
            allowClear
            clearLabel="Clear date filter"
          />
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No status history found" description="Application, member, and linked account status changes will appear here." />
      ) : (
        <>
          <HistoryResponsiveList entries={entries} />
          <SimplePagination
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            noun="history records"
            setPage={(page) => setQuery((current) => ({ ...current, page }))}
            pageSizeOptions={[10, 20, 50]}
            onPageSizeChange={(pageSize) => setQuery((current) => ({ ...current, pageSize, page: 1 }))}
          />
        </>
      )}
    </div>
  );
}

function ApplicationMetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#EEF7ED] text-[#1F6B43]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#6C7A70]">{label}</p>
          <p className="mt-1 text-2xl font-black leading-none text-[#123D2A]">{value}</p>
        </div>
      </div>
    </article>
  );
}

function ApplicationFilters({
  query,
  requirementCompletion,
  barangayOptions,
  setQuery,
  setRequirementCompletion,
}: {
  query: ChairmanApplicationListQuery;
  requirementCompletion: string;
  barangayOptions: string[];
  setQuery: (updater: (current: ChairmanApplicationListQuery) => ChairmanApplicationListQuery) => void;
  setRequirementCompletion: (value: string) => void;
}) {
  const updateQuery = (patch: Partial<ChairmanApplicationListQuery>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };

  return (
    <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-3 shadow-[0_10px_24px_rgba(18,61,42,0.04)] sm:p-4">
      <div className="flex items-center gap-2 text-sm font-black text-[#123D2A]">
        <Filter className="size-4" aria-hidden="true" />
        Filters
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.45fr_0.85fr_0.85fr_0.85fr_0.85fr_0.95fr]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
          <input
            value={query.search ?? ""}
            onChange={(event) => updateQuery({ search: event.target.value })}
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-white pl-10 pr-3 text-sm font-semibold text-[#123D2A] outline-none transition placeholder:font-normal placeholder:text-[#7D8C82] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10"
            placeholder="Search application"
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
        <Select value={query.barangay ?? "All"} onChange={(value) => updateQuery({ barangay: value === "All" ? undefined : value })}>
          <option value="All">All barangays</option>
          {barangayOptions.map((barangay) => <option key={barangay}>{barangay}</option>)}
        </Select>
        <Select value={requirementCompletion} onChange={setRequirementCompletion}>
          <option value="All">All requirements</option>
          <option value="Complete">Complete</option>
          <option value="Incomplete">Incomplete</option>
        </Select>
      </div>
    </section>
  );
}

function SortableHeader({
  label,
  className = "",
  onClick,
  active = false,
  direction = "desc",
}: {
  label: string;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  direction?: "asc" | "desc";
}) {
  const content = (
    <span className="inline-flex items-center gap-1">
      {label}
      <ChevronDown
        className={`size-3.5 transition ${active && direction === "asc" ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </span>
  );

  return (
    <th
      className={`px-5 py-4 ${className}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`text-left uppercase tracking-[0.12em] transition hover:text-[#123D2A] ${active ? "text-[#123D2A]" : ""}`}
        >
          {content}
        </button>
      ) : content}
    </th>
  );
}

function RequirementProgress({ progress }: { progress: ReturnType<typeof requirementProgress> | null }) {
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const complete = total > 0 && completed === total;

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className="w-9 shrink-0 text-xs font-semibold text-[#123D2A]">
          {progress ? `${completed} / ${total}` : "..."}
        </span>
        <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[#E8E8E5]">
          <span
            className={`block h-full rounded-full ${complete ? "bg-[#44B870]" : "bg-[#F6B21A]"}`}
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>
    </div>
  );
}

function HistoryResponsiveList({ entries }: { entries: UnifiedStatusHistoryEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpanded = (entryId: string) => {
    setExpandedId((current) => current === entryId ? null : entryId);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-white shadow-[0_16px_34px_rgba(18,61,42,0.06)]">
      <div className="hidden lg:block">
        <table className="min-w-full table-fixed divide-y divide-[#E2E8E2] text-left text-xs">
          <thead className="bg-[#FBFCF8] text-[0.68rem] uppercase tracking-[0.12em] text-[#5D6D63]">
            <tr>
              <th className="w-[32%] px-5 py-4">Record</th>
              <th className="w-[28%] px-5 py-4">Status Change</th>
              <th className="w-[18%] px-5 py-4">Changed By</th>
              <th className="w-[14%] px-5 py-4">Date</th>
              <th className="w-[8%] px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2EC] text-[#0F241A]">
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                <tr className="hover:bg-[#FBFCF8]">
                  <td className="px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <HistorySourceIconMark source={entry.sourceModule} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-black text-[#123D2A]">{entry.subjectName}</p>
                          <StatusBadge tone="neutral">{entry.sourceModule}</StatusBadge>
                        </div>
                        <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-[#6C7A70]">{entry.subjectCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <HistoryStatusChange oldStatus={entry.oldStatus ?? "New"} newStatus={entry.newStatus} />
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold">{entry.actor ?? "System"}</td>
                  <td className="px-5 py-3 text-sm font-semibold leading-5">{formatDate(entry.changedAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      aria-label={expandedId === entry.id ? "Collapse status details" : "Expand status details"}
                      aria-expanded={expandedId === entry.id}
                      className="ml-auto flex size-8 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-[#123D2A] transition hover:border-[#CAD8CB] hover:bg-[#EEF2EC]"
                      onClick={() => toggleExpanded(entry.id)}
                    >
                      <ChevronDown className={`size-4 transition ${expandedId === entry.id ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
                {expandedId === entry.id ? (
                  <tr className="bg-[#FBFCF8]">
                    <td colSpan={5} className="px-5 pb-4 pt-0">
                      <div className="rounded-md border border-[#E2E8E2] bg-white p-4 text-sm leading-6 text-[#5D6D63]">
                        <p className="mb-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#5D6D63]">Reason</p>
                        {entry.reason?.trim() || "No reason recorded."}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-0 divide-y divide-[#EEF2EC] lg:hidden">
        {entries.map((entry) => (
          <HistoryEntryCard
            key={entry.id}
            entry={entry}
            expanded={expandedId === entry.id}
            onToggle={() => toggleExpanded(entry.id)}
          />
        ))}
      </div>
    </section>
  );
}

function HistorySourceIconMark({ source }: { source: UnifiedStatusHistoryEntry["sourceModule"] }) {
  const SourceIcon = getHistorySourceIcon(source);

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-[#123D2A]">
      <SourceIcon className="size-4" aria-hidden="true" />
    </span>
  );
}

function HistoryEntryCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: UnifiedStatusHistoryEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const SourceIcon = getHistorySourceIcon(entry.sourceModule);
  const actor = entry.actor ?? "System";
  const reason = entry.reason?.trim() || "No reason recorded.";

  return (
    <article className="grid gap-4 bg-white p-4">
      <div className="flex min-w-0 gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-[#123D2A]">
          <SourceIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-black tracking-normal text-[#003B2C]">{entry.subjectName}</h3>
            <StatusBadge tone="neutral">{entry.sourceModule}</StatusBadge>
          </div>
          <p className="mt-1 break-words text-sm font-semibold text-[#5D6D63]">{entry.subjectCode}</p>
        </div>
      </div>

      <div className="rounded-md border border-[#DCE7D9] bg-[#FBFCF8] px-3 py-3">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#6C7A70]">Status Change</p>
        <HistoryStatusChange oldStatus={entry.oldStatus ?? "New"} newStatus={entry.newStatus} className="mt-2" />
      </div>

      <div className="grid gap-2 text-sm text-[#5D6D63]">
        <span className="inline-flex items-center gap-2 font-bold text-[#123D2A]">
          <CalendarDays className="size-4 text-[#1F6B43]" aria-hidden="true" />
          {formatDate(entry.changedAt)}
        </span>
        <span className="inline-flex items-center gap-2">
          <UserCheck className="size-4 text-[#6C7A70]" aria-hidden="true" />
          {actor}
        </span>
      </div>

      <Button
        type="button"
        aria-expanded={expanded}
        className="h-9 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-black text-[#123D2A] hover:bg-[#EEF2EC]"
        onClick={onToggle}
      >
        Details
        <ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </Button>

      {expanded ? (
        <p className="break-words border-t border-[#EEF2EC] pt-3 text-sm leading-6 text-[#5D6D63]">{reason}</p>
      ) : null}
    </article>
  );
}

function HistoryStatusChange({
  oldStatus,
  newStatus,
  className = "",
}: {
  oldStatus: string;
  newStatus: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <HistoryStatusPill status={oldStatus} />
      <ChevronRight className="size-4 shrink-0 text-[#1F6B43]" aria-hidden="true" />
      <HistoryStatusPill status={newStatus} />
    </div>
  );
}

function HistoryStatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex min-w-0 max-w-full items-center rounded-full px-3 py-1 text-xs font-black ${getHistoryStatusTone(status)}`}>
      <span className="truncate">{status}</span>
    </span>
  );
}

function getHistorySourceIcon(source: UnifiedStatusHistoryEntry["sourceModule"]) {
  if (source === "Application") return FileText;
  if (source === "Member") return UsersRound;
  return Link2;
}

function getHistoryStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("approved") || normalized.includes("active") || normalized.includes("confirmed")) {
    return "bg-[#D9F2D8] text-[#006B3F]";
  }
  if (normalized.includes("reject") || normalized.includes("inactive") || normalized.includes("cancel")) {
    return "bg-[#FDE2DE] text-[#9F1D1D]";
  }
  if (normalized.includes("review") || normalized.includes("pending") || normalized.includes("need")) {
    return "bg-[#FFEFC2] text-[#8A5C00]";
  }
  if (normalized.includes("submit") || normalized.includes("new")) {
    return "bg-[#DDEEFF] text-[#14517A]";
  }
  return "bg-[#EEF2EC] text-[#294B39]";
}

function ApplicationStatusPill({ status }: { status: MembershipApplicationStatus }) {
  const config =
    status === "Approved"
      ? { className: "bg-[#DDF4E4] text-[#1F6B43]", icon: CheckCircle2 }
      : status === "Submitted"
        ? { className: "bg-[#DDF0FF] text-[#1470A8]", icon: FileText }
        : status === "Needs Information"
          ? { className: "bg-[#FFF2CC] text-[#946600]", icon: Send }
          : status === "Rejected" || status === "Withdrawn"
            ? { className: "bg-[#FFE6E0] text-[#9A392A]", icon: X }
            : { className: "bg-[#FFF0D7] text-[#A46400]", icon: ClipboardCheck };
  const Icon = config.icon;

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-black ${config.className}`}>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{status}</span>
    </span>
  );
}

function applicationInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}

function formatSubmittedDate(value: string) {
  const date = new Date(value);
  return (
    <>
      <span className="block">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date)}</span>
      <span className="block text-[0.7rem] font-medium text-[#5D6D63]">{new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(date)}</span>
    </>
  );
}

function ApplicationsResponsiveList({
  applications,
  detailsById,
  onSelect,
  query,
  total,
  setQuery,
}: {
  applications: ChairmanApplicationListItem[];
  detailsById: DetailMap;
  onSelect: (id: string) => void;
  query: ChairmanApplicationListQuery;
  total: number;
  setQuery: (updater: (current: ChairmanApplicationListQuery) => ChairmanApplicationListQuery) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / query.pageSize));
  const start = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const end = Math.min((query.page - 1) * query.pageSize + applications.length, total);

  return (
    <section className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-white shadow-[0_16px_34px_rgba(18,61,42,0.06)]">
      <div className="hidden lg:block">
        <table className="min-w-full table-fixed divide-y divide-[#E2E8E2] text-left text-xs">
            <thead className="bg-[#FBFCF8] text-[0.68rem] uppercase tracking-[0.12em] text-[#5D6D63]">
              <tr>
                <SortableHeader className="w-[24%]" label="Applicant" />
                <SortableHeader className="w-[11%]" label="Type" />
                <SortableHeader className="w-[12%]" label="Barangay" />
                <SortableHeader
                  className="w-[13%]"
                  label="Submitted"
                  active={query.sortBy === "submittedAt"}
                  direction={query.sortDirection}
                  onClick={() => setQuery((current) => ({
                    ...current,
                    sortBy: "submittedAt",
                    sortDirection: current.sortBy === "submittedAt" && current.sortDirection === "desc" ? "asc" : "desc",
                    page: 1,
                  }))}
                />
                <SortableHeader className="w-[15%]" label="Requirements" />
                <SortableHeader className="w-[15%]" label="Status" />
                <th className="w-[10%] px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#0F241A]">
              {applications.map((application) => {
                const detail = detailsById[application.id];
                const progress = detail ? requirementProgress(detail) : null;
                return (
                  <tr key={application.id} className="hover:bg-[#FBFCF8]">
                    <td className="px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-xs font-black text-[#123D2A]">
                          {applicationInitials(application.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#123D2A]">{application.fullName}</p>
                          <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-[#6C7A70]">{application.applicationCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold">{application.requestedMembershipType}</td>
                    <td className="px-5 py-3 text-sm font-semibold">{application.barangay ?? "Unspecified"}</td>
                    <td className="px-5 py-3 text-sm font-semibold leading-5">{formatSubmittedDate(application.submittedAt)}</td>
                    <td className="px-5 py-3">
                      <RequirementProgress progress={progress} />
                    </td>
                    <td className="px-5 py-3"><ApplicationStatusPill status={application.applicationStatus} /></td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        type="button"
                        onClick={() => onSelect(application.id)}
                        className="h-8 rounded-md bg-[#123D2A] px-3 text-xs font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)] hover:bg-[#1F6B43]"
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      <div className="grid divide-y divide-[#EEF2EC] lg:hidden">
        {applications.map((application) => {
          const detail = detailsById[application.id];
          const progress = detail ? requirementProgress(detail) : null;
          return (
            <article key={application.id} className="bg-white p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-sm font-black text-[#123D2A]">
                    {applicationInitials(application.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words font-black text-[#123D2A]">{application.fullName}</p>
                    <p className="mt-1 text-xs font-semibold text-[#6C7A70]">{application.applicationCode}</p>
                  </div>
                </div>
                <ApplicationStatusPill status={application.applicationStatus} />
              </div>
              <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 text-sm text-[#294B39]">
                <Info label="Type" value={application.requestedMembershipType} />
                <Info label="Barangay" value={application.barangay ?? "Unspecified"} />
                <Info label="Submitted" value={formatDate(application.submittedAt)} />
                <div className="min-w-0 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6C7A70]">Requirements</p>
                  <div className="mt-2"><RequirementProgress progress={progress} /></div>
                </div>
              </dl>
              <Button
                type="button"
                onClick={() => onSelect(application.id)}
                className="mt-4 h-10 w-full rounded-md bg-[#123D2A] text-white hover:bg-[#1F6B43]"
              >
                Review Application
              </Button>
            </article>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-[#E7EEE5] bg-[#FBFCF8] px-5 py-4 text-sm font-semibold text-[#5D6D63] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {start}-{end} of {total} applications
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" disabled={query.page <= 1} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: 1 }))} aria-label="First page">
            <ChevronsLeft className="size-4" />
          </Button>
          <Button type="button" disabled={query.page <= 1} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#123D2A] text-sm font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)]" aria-current="page">
            {query.page}
          </span>
          <Button type="button" disabled={query.page >= maxPage} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: Math.min(maxPage, current.page + 1) }))} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" disabled={query.page >= maxPage} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#6C7A70] hover:bg-[#EEF2EC] disabled:opacity-45" onClick={() => setQuery((current) => ({ ...current, page: maxPage }))} aria-label="Last page">
            <ChevronsRight className="size-4" />
          </Button>
          <div className="w-40 shrink-0">
            <Select value={String(query.pageSize)} onChange={(value) => setQuery((current) => ({ ...current, pageSize: Number(value), page: 1 }))}>
              <option value="5">5 per page</option>
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
            </Select>
          </div>
        </div>
      </div>
    </section>
  );
}

function ApplicationDetailDialog({
  detail,
  open,
  isMutating,
  currentUser,
  onOpenChange,
  onRefresh,
  onPrint,
  onConfirmAction,
  runMutation,
  setActivationResult,
}: {
  detail: ChairmanApplicationDetail | null;
  open: boolean;
  isMutating: boolean;
  currentUser: AuthUser | null;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<ChairmanApplicationDetail | null>;
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
  const [approvalDecisionDraft, setApprovalDecisionDraft] = useState<{ applicationId: string | null; decisionReason: string }>({
    applicationId: null,
    decisionReason: "",
  });
  const [documentType, setDocumentType] = useState<MembershipDocumentType>("Valid ID");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [previewDocument, setPreviewDocument] = useState<ChairmanApplicationDetail["documents"][number] | null>(null);
  const [step, setStep] = useState<number>(1);

  if (!detail) return null;

  const progress = requirementProgress(detail);
  const canStartReview = detail.applicationStatus === "Submitted";
  const startReviewLabel = detail.applicationStatus === "Under Review" ? "Under Review" : "Start Review";
  const documentById = new Map(detail.documents.map((document) => [document.id, document]));
  const addedRequirementTypes = new Set(detail.requirements.map((requirement) => requirement.requirementType));
  const availableRequirementTypes = requirementTypes.filter((type) => !addedRequirementTypes.has(type));
  const addRequirementType = availableRequirementTypes.includes(requirementDraft.requirementType)
    ? requirementDraft.requirementType
    : availableRequirementTypes[0] ?? "Other";
  const approvalDate = getTodayInputDate();
  const approvedBy = currentUser?.displayName ?? "Current chairman";
  const accountEmail = detail.email ?? null;
  const approvalDecisionReason = approvalDecisionDraft.applicationId === detail.id
    ? approvalDecisionDraft.decisionReason
    : detail.decisionReason ?? "";
  const openDocument = (document: ChairmanApplicationDetail["documents"][number]) => {
    setPreviewDocument(document);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex w-full min-w-0 flex-col gap-4 pr-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="break-words text-3xl font-black leading-tight text-[#123D2A]">{detail.applicationCode}</p>
            <p className="mt-2 break-words text-xl font-semibold text-[#0F241A]">{detail.fullName}</p>
            <p className="mt-2 text-sm font-medium leading-6 text-[#5D6D63]">
              Review application details, requirements, and decision actions.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 pt-1 lg:items-end">
            <ApplicationStatusPill status={detail.applicationStatus} />
            <RequirementProgressBadge progress={progress} />
          </div>
        </div>
      }
      contentClassName="w-[min(68rem,calc(100vw-2rem))] p-5 sm:p-8"
    >
      <div className="grid min-w-0 gap-5 border-t border-[#CAD8CB] pt-5">
        {step === 1 && (
        <>
        <div className="flex min-w-0 flex-wrap gap-3">
          <ActionButton
            icon={Play}
            label={startReviewLabel}
            primary={canStartReview}
            disabled={!canStartReview}
            onClick={() => onConfirmAction({ type: "transition", action: "start-review", label: "Start review" })}
          />
          <ActionButton icon={Send} label="Request Info" onClick={() => onConfirmAction({ type: "transition", action: "request-information", label: "Request information" })} />
          <ActionButton icon={X} label="Reject" danger onClick={() => onConfirmAction({ type: "transition", action: "reject", label: "Reject application" })} />
          <ActionButton icon={Archive} label="Withdraw" danger onClick={() => onConfirmAction({ type: "transition", action: "withdraw", label: "Withdraw application" })} />
          <ActionButton icon={Download} label="Print PDF" onClick={() => void onPrint(detail)} />
        </div>

        <ApplicantSummary detail={detail} />

        <Commitments detail={detail} />

        <ReviewSection index={3} title="Requirements Review">
          <div className="hidden grid-cols-[minmax(12rem,1fr)_12rem_minmax(14rem,1fr)_8rem] border-b border-[#E7EEE5] px-4 pb-3 text-xs font-black text-[#6C7A70] md:grid">
            <span>Requirement</span>
            <span>Status</span>
            <span>Remarks</span>
            <span className="text-center">Action</span>
          </div>
          <div className="grid">
            {detail.requirements.map((requirement) => (
              <RequirementRow
                key={requirement.id}
                requirement={requirement}
                canDelete={!isProtectedRequirement(detail, requirement.requirementType)}
                linkedDocument={requirement.documentId ? documentById.get(requirement.documentId) ?? null : null}
                onDelete={() => onConfirmAction({ type: "delete-requirement", requirementId: requirement.id, label: "Remove requirement" })}
                onViewDocument={openDocument}
                onSave={(requirementStatus, remarks) =>
                  runMutation("Requirement updated.", async () => {
                    await updateApplicationRequirement(requirement.id, { requirementStatus, remarks });
                    await onRefresh();
                  })
                }
              />
            ))}
            <div className="mt-2 grid gap-3 rounded-md border border-dashed border-[#B9CABD] p-3 md:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)_5rem]">
              <Select value={addRequirementType} onChange={(value) => setRequirementDraft((current) => ({ ...current, requirementType: value as RequirementType }))}>
                {availableRequirementTypes.length > 0
                  ? availableRequirementTypes.map((type) => <option key={type}>{type}</option>)
                  : <option value={addRequirementType}>All requirements added</option>}
              </Select>
              <input className={inputClass} placeholder="Remarks" value={requirementDraft.remarks} onChange={(event) => setRequirementDraft((current) => ({ ...current, remarks: event.target.value }))} />
              <Button
                type="button"
                disabled={availableRequirementTypes.length === 0}
                className="h-11 rounded-md bg-[#123D2A] text-white hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:bg-[#8A9A91]"
                onClick={() => void runMutation("Requirement added.", async () => {
                  await addApplicationRequirement(detail.id, {
                    requirementType: addRequirementType,
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
        </ReviewSection>
        </>
        )}

        {step === 2 && (
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
        )}

        {step === 3 && (
        <Panel title="Documents">
          <div className="grid gap-2">
            {detail.documents.map((document) => (
              <div key={document.id} className="flex flex-col gap-2 rounded-md border border-[#CAD8CB] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    type="button"
                    aria-label={`View ${document.documentType}`}
                    title={`View ${document.documentType}`}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] hover:bg-[#EEF2EC]"
                    onClick={() => openDocument(document)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <p className="min-w-0 break-words text-sm text-[#294B39]">
                    <strong>{document.documentType}</strong> - {document.originalFileName}
                  </p>
                </div>
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
        )}

        {step === 4 && (
        <>
        <Panel title="Status Timeline">
          <ol className="grid max-h-[22rem] gap-3 overflow-y-auto pr-2">
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

        <Panel title="Final Approval">
          <Button
            type="button"
            disabled={isMutating}
            className="h-11 bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]"
            onClick={() => setApprovalConfirmOpen(true)}
          >
            <UserCheck className="size-4" />
            Approve and Convert
          </Button>
        </Panel>
        </>
        )}
      </div>

      <div className="mt-6 flex justify-between border-t border-[#CAD8CB] pt-4">
        <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>Close</Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {step < 4 && (
            <Button type="button" className="bg-[#123D2A] px-6 text-white hover:bg-[#1F6B43]" onClick={() => setStep(s => s + 1)}>
              Next
            </Button>
          )}
        </div>
      </div>

      <ApprovalConfirmDialog
        open={approvalConfirmOpen}
        onOpenChange={setApprovalConfirmOpen}
        isMutating={isMutating}
        approvalDate={approvalDate}
        approvedBy={approvedBy}
        accountEmail={accountEmail}
        decisionReason={approvalDecisionReason}
        onDecisionReasonChange={(value) => setApprovalDecisionDraft({ applicationId: detail.id, decisionReason: value })}
        onConfirm={() => {
          setApprovalConfirmOpen(false);
          void runMutation("Application approved and converted.", async () => {
            const result = await approveApplication(
              detail.id,
              buildApprovalInput({
                boardMeetingDate: approvalDate,
                secretaryName: approvedBy,
                decisionReason: approvalDecisionReason,
                accountEmail,
              }),
            );
            setActivationResult(result);
            await onRefresh();
          });
        }}
      />
      <FormDialog
        open={Boolean(previewDocument)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewDocument(null);
        }}
        title={previewDocument?.documentType ?? "Document"}
        description={previewDocument?.originalFileName}
        contentClassName="w-[min(58rem,calc(100vw-2rem))] p-4 sm:p-5"
      >
        {previewDocument ? (
          <div className="grid gap-3">
            <div className="h-[min(70vh,42rem)] overflow-hidden rounded-md border border-[#CAD8CB] bg-[#F7F8F3]">
              <iframe
                title={`${previewDocument.documentType} preview`}
                src={applicationDocumentViewUrl(previewDocument.id)}
                className="h-full w-full bg-white"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="h-10 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-black text-[#123D2A] hover:bg-[#EEF2EC]"
                onClick={() => window.open(applicationDocumentViewUrl(previewDocument.id), "_blank", "noopener,noreferrer")}
              >
                Open in new tab
              </Button>
            </div>
          </div>
        ) : null}
      </FormDialog>
    </FormDialog>
  );
}

function ApprovalConfirmDialog({
  open,
  onOpenChange,
  isMutating,
  approvalDate,
  approvedBy,
  accountEmail,
  decisionReason,
  onDecisionReasonChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMutating: boolean;
  approvalDate: string;
  approvedBy: string;
  accountEmail: string | null;
  decisionReason: string;
  onDecisionReasonChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Approve and Convert"
      description="TrackCOOP will finalize the application using these generated approval details."
      contentClassName="w-[min(34rem,calc(100vw-2rem))]"
    >
      <div className="grid gap-4 border-t border-[#CAD8CB] pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Approval Date" value={formatLongDate(approvalDate)} />
          <Info label="Approved By" value={approvedBy} />
          <Info
            label="Account Email"
            value={accountEmail ?? "No portal account will be created"}
          />
        </div>

        <label className="grid gap-2 text-sm font-bold text-[#294B39]">
          Decision note optional
          <textarea
            value={decisionReason}
            onChange={(event) => onDecisionReasonChange(event.target.value)}
            placeholder="Add an approval note if needed"
            rows={4}
            className="min-h-28 w-full resize-y rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 py-3 text-sm font-medium text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          />
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-[#E7EEE5] pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className="h-11 border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isMutating}
            className="h-11 bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:bg-[#8A9A91]"
            onClick={onConfirm}
          >
            <UserCheck className="size-4" />
            {isMutating ? "Approving..." : "Approve and Convert"}
          </Button>
        </div>
      </div>
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
  const [step, setStep] = useState<number>(1);

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
      <div className="mb-4 flex items-center justify-between border-b border-[#CAD8CB] pb-4">
        <h2 className="text-lg font-bold text-[#123D2A]">
          Step {step} of 4: {step === 1 ? "Basic Details" : step === 2 ? "Demographics & Location" : step === 3 ? "Family & Signature" : "Agreements"}
        </h2>
      </div>

      {step === 1 && (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
          Source
          <Select value={draft.applicationSource} onChange={(value) => setDraft((current) => ({ ...current, applicationSource: value as ApplicationFormState["applicationSource"] }))}>
            <option value="Chairman Entry">Chairman Entry</option>
            <option value="Imported Paper Form">Imported Paper Form</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
          Requested Type
          <Select value={draft.requestedMembershipType} onChange={(value) => setDraft((current) => ({ ...current, requestedMembershipType: value as RequestedMembershipType }))}>
            {requestedMembershipTypes.map((type) => <option key={type}>{type}</option>)}
          </Select>
        </label>
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
      </div>
      )}

      {step === 2 && (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
          Civil status
          <Select value={draft.civilStatus ?? "Single"} onChange={(value) => setDraft((current) => ({ ...current, civilStatus: value as ApplicationFormState["civilStatus"] }))}>
            {civilStatuses.map((status) => <option key={status}>{status}</option>)}
          </Select>
        </label>
        <TextInput label="Place of birth" value={draft.placeOfBirth ?? ""} onChange={(value) => setDraft((current) => ({ ...current, placeOfBirth: value }))} />
        <TextInput label="Date of birth" type="date" value={draft.dateOfBirth ?? ""} onChange={(value) => setDraft((current) => ({ ...current, dateOfBirth: value }))} />
        <TextInput label="Current address" value={draft.currentAddress} onChange={(value) => setDraft((current) => ({ ...current, currentAddress: value }))} className="md:col-span-2" />
        <TextInput label="Barangay" value={draft.barangay ?? ""} onChange={(value) => setDraft((current) => ({ ...current, barangay: value }))} />
        <TextInput label="Municipality" value={draft.municipality} onChange={(value) => setDraft((current) => ({ ...current, municipality: value }))} />
        <TextInput label="Province" value={draft.province} onChange={(value) => setDraft((current) => ({ ...current, province: value }))} />
      </div>
      )}

      {step === 3 && (
      <div className="grid gap-4 md:grid-cols-2">
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
      )}

      {step === 4 && (
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
      )}

      <div className="mt-6 flex justify-between border-t border-[#CAD8CB] pt-4">
        <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => onOpenChange(false)}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" className="border border-[#CAD8CB] bg-white px-4 text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {step < 4 && (
            <Button type="button" className="bg-[#123D2A] px-6 text-white hover:bg-[#1F6B43]" onClick={() => setStep(s => s + 1)}>
              Next
            </Button>
          )}
          {step === 4 && (
            <Button type="button" disabled={isSaving} className="bg-[#123D2A] px-4 text-white hover:bg-[#1F6B43]" onClick={() => void save()}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Save
            </Button>
          )}
        </div>
      </div>
    </FormDialog>
  );
}

function RequirementRow({
  requirement,
  canDelete,
  linkedDocument,
  onSave,
  onDelete,
  onViewDocument,
}: {
  requirement: ChairmanApplicationDetail["requirements"][number];
  canDelete: boolean;
  linkedDocument?: ChairmanApplicationDetail["documents"][number] | null;
  onSave: (status: RequirementStatus, remarks: string | null) => Promise<void>;
  onDelete: () => void;
  onViewDocument: (document: ChairmanApplicationDetail["documents"][number]) => void;
}) {
  const [status, setStatus] = useState<RequirementStatus>(requirement.requirementStatus);
  const [remarks, setRemarks] = useState(requirement.remarks ?? "");

  return (
    <div className="grid gap-3 border-b border-[#E7EEE5] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(12rem,1fr)_12rem_minmax(14rem,1fr)_8rem] md:items-center">
      <div className="min-w-0">
        <p className="break-words text-sm font-black text-[#0F241A]">{requirement.requirementType}</p>
        <div className="mt-1 md:hidden">
          <RequirementStatusMini status={requirement.requirementStatus} />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {linkedDocument ? (
          <Button
            type="button"
            aria-label={`View ${linkedDocument.documentType}`}
            title={`View ${linkedDocument.documentType}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] hover:bg-[#EEF2EC]"
            onClick={() => onViewDocument(linkedDocument)}
          >
            <Eye className="size-4" />
          </Button>
        ) : null}
        <Select value={status} onChange={(value) => setStatus(value as RequirementStatus)}>
          {requirementStatuses.map((nextStatus) => <option key={nextStatus}>{nextStatus}</option>)}
        </Select>
      </div>
      <input className={inputClass} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Remarks" />
      <div className="flex gap-2">
        <Button type="button" className="h-10 flex-1 rounded-md border border-[#1F6B43] bg-white px-3 text-sm font-black text-[#123D2A] hover:bg-[#EEF2EC]" onClick={() => void onSave(status, remarks || null)}>
          Save
        </Button>
        {canDelete ? (
          <Button
            type="button"
            aria-label={`Remove ${requirement.requirementType}`}
            className="h-10 rounded-md border border-red-200 bg-white px-3 text-sm font-black text-red-700 hover:bg-red-50"
            onClick={onDelete}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
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
  noun,
  setPage,
  pageSizeOptions,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  setPage: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min((page - 1) * pageSize + pageSize, total);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[#CAD8CB] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm font-black text-[#365F4A]">
        Showing {start}-{end} of {total} {noun}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={page <= 1} className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60" onClick={() => setPage(1)}>
          <ChevronsLeft className="size-4" />
        </Button>
        <Button type="button" disabled={page <= 1} className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60" onClick={() => setPage(Math.max(1, page - 1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="grid size-10 place-items-center rounded-md bg-[#123D2A] text-sm font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)]">
          {page}
        </span>
        <Button type="button" disabled={page >= maxPage} className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60" onClick={() => setPage(Math.min(maxPage, page + 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <Button type="button" disabled={page >= maxPage} className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60" onClick={() => setPage(maxPage)}>
          <ChevronsRight className="size-4" />
        </Button>
        {onPageSizeChange && pageSizeOptions ? (
          <div className="ml-1 w-44">
            <Select value={String(pageSize)} onChange={(value) => onPageSizeChange(Number(value))}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option} per page</option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ApplicantSummary({ detail }: { detail: ChairmanApplicationDetail }) {
  return (
    <ReviewSection index={1} title="Applicant Summary">
      <div className="grid divide-y divide-[#E7EEE5]">
        <div className="grid gap-4 py-4 first:pt-0 md:grid-cols-3 md:divide-x md:divide-[#E7EEE5]">
          <SummaryCell label="Source" value={detail.applicationSource} />
          <SummaryCell label="Requested Type" value={detail.requestedMembershipType} />
          <SummaryCell label="Email" value={detail.email ?? "Not provided"} />
        </div>
        <div className="grid gap-4 py-4 md:grid-cols-3 md:divide-x md:divide-[#E7EEE5]">
          <SummaryCell label="Contact" value={detail.contactNumber} />
          <SummaryCell label="Civil Status" value={detail.civilStatus ?? "Not provided"} />
          <SummaryCell label="Birth" value={[detail.placeOfBirth, detail.dateOfBirth].filter(Boolean).join(" / ") || "Not provided"} />
        </div>
        <div className="grid gap-4 py-4 md:grid-cols-3 md:divide-x md:divide-[#E7EEE5]">
          <SummaryCell label="Address" value={detail.currentAddress} />
          <SummaryCell label="Barangay" value={detail.barangay ?? "Unspecified"} />
          <SummaryCell label="Parents" value={[detail.fatherName, detail.motherName].filter(Boolean).join(" / ") || "Not provided"} />
        </div>
        <div className="grid gap-4 py-4 last:pb-0 md:grid-cols-3 md:divide-x md:divide-[#E7EEE5]">
          <SummaryCell label="Spouse / Occupation" value={[detail.spouseName, detail.occupation].filter(Boolean).join(" / ") || "Not provided"} />
          <SummaryCell label="Signature" value={`${detail.applicantSignatureName} at ${detail.signedPlace}`} />
          <SummaryCell label="Signed At" value={formatDate(detail.signedAt)} />
        </div>
      </div>
    </ReviewSection>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 md:px-5 first:md:pl-0 last:md:pr-0">
      <p className="text-xs font-semibold text-[#6C7A70]">{label}</p>
      <p className="mt-1 break-words text-sm font-black leading-6 text-[#0F241A]">{value}</p>
    </div>
  );
}

function ReviewSection({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4">
      <h3 className="text-lg font-black uppercase tracking-normal text-[#123D2A]">
        {index}. {title}
      </h3>
      <div className="mt-4 border-t border-[#E7EEE5] pt-4">{children}</div>
    </section>
  );
}

function RequirementProgressBadge({ progress }: { progress: ReturnType<typeof requirementProgress> }) {
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <span className="inline-flex items-center gap-3 rounded-md border border-[#CAD8CB] bg-white px-3 py-2 text-sm font-bold text-[#123D2A]">
      Requirements {progress.completed}/{progress.total}
      <span
        className="grid size-6 place-items-center rounded-full"
        style={{ background: `conic-gradient(#44B870 ${percent}%, #E7EEE5 0)` }}
        aria-hidden="true"
      >
        <span className="size-4 rounded-full bg-white" />
      </span>
    </span>
  );
}

function RequirementStatusMini({ status }: { status: RequirementStatus }) {
  const toneClass =
    requirementTone(status) === "success"
      ? "bg-[#DDF4E4] text-[#1F6B43]"
      : requirementTone(status) === "warning"
        ? "bg-[#FFF2CC] text-[#946600]"
        : requirementTone(status) === "danger"
          ? "bg-[#FFE6E0] text-[#9A392A]"
          : "bg-[#EEF2EC] text-[#365F4A]";

  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${toneClass}`}>{status}</span>;
}

function Commitments({ detail }: { detail: ChairmanApplicationDetail }) {
  return (
    <ReviewSection index={2} title="Commitments">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Orientation", detail.orientationCommitmentAccepted],
          ["Membership fee", detail.membershipFeeCommitmentAccepted],
          ["Share agreement", detail.shareSubscriptionCommitmentAccepted],
          ["Patronage provisions", detail.patronageRefundAcknowledged],
          ["Bylaws", detail.bylawsAgreementAccepted],
          ["Privacy consent", detail.privacyConsentAccepted],
        ].map(([label, accepted]) => (
          <div key={String(label)} className="flex min-w-0 items-center gap-3 rounded-md border border-[#CAD8CB] bg-white p-3 text-sm">
            <CheckCircle2 className={`size-5 shrink-0 ${accepted ? "text-[#1F6B43]" : "text-[#9A392A]"}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#0F241A]">{label}</p>
              <p className={`mt-1 text-[0.68rem] font-black ${accepted ? "text-[#1F6B43]" : "text-[#9A392A]"}`}>
                {accepted ? "Accepted" : "Missing"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ReviewSection>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-3">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#123D2A]">{title}</h3>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

function ActionButton({
  icon: Icon,
  label,
  primary = false,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-11 rounded-md px-4 text-sm font-black disabled:cursor-not-allowed disabled:border-[#D9E2D8] disabled:bg-[#EEF2EC] disabled:text-[#8A9A91] disabled:shadow-none disabled:hover:bg-[#EEF2EC] ${
        primary
          ? "bg-[#123D2A] text-white shadow-[0_10px_22px_rgba(18,61,42,0.18)] hover:bg-[#1F6B43]"
          : danger
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
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];

    const props = child.props as {
      value?: string | number;
      children?: React.ReactNode;
      disabled?: boolean;
    };
    const label = extractOptionLabel(props.children);

    return [{
      value: props.value === undefined ? label : String(props.value),
      label,
      disabled: Boolean(props.disabled),
    }];
  });
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="group inline-flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-white px-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43]/55 hover:bg-[#FBFCF8] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={options.length === 0}
        >
          <span className="min-w-0 truncate">{selectedOption?.label ?? "Select"}</span>
          <ChevronDown className="size-4 shrink-0 text-[#365F4A] transition group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-[80] max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border border-[#DDE8D8] bg-white p-2 shadow-2xl shadow-[#123D2A]/14"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              disabled={option.disabled}
              onSelect={(event) => {
                event.preventDefault();
                if (!option.disabled) onChange(option.value);
              }}
              className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition ${
                option.value === value
                  ? "bg-[#EAF3E8] text-[#123D2A]"
                  : "text-[#365F4A] hover:bg-[#EAF3E8] hover:text-[#123D2A] focus:bg-[#EAF3E8] focus:text-[#123D2A]"
              } data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50`}
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

function extractOptionLabel(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(extractOptionLabel).join("");
  if (isValidElement(value)) {
    return extractOptionLabel((value.props as { children?: React.ReactNode }).children);
  }
  return "";
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

function isProtectedRequirement(detail: ChairmanApplicationDetail, requirementType: RequirementType) {
  if (["Orientation/Seminar", "Associate Membership Fee", "Signed Application"].includes(requirementType)) {
    return true;
  }
  return detail.requestedMembershipType === "True Member" && requirementType === "Initial Share Capital";
}

function groupBarangays(values: Array<string | null | undefined>) {
  const grouped = new Map<string, string>();

  values.forEach((value) => {
    const barangay = value?.trim();
    if (!barangay) return;
    const key = barangay.toLocaleLowerCase("en-PH");
    if (!grouped.has(key)) grouped.set(key, barangay);
  });

  return Array.from(grouped.values()).sort((first, second) =>
    first.localeCompare(second, "en-PH", { sensitivity: "base" }),
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLongDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getTodayInputDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildApprovalInput({
  boardMeetingDate,
  secretaryName,
  decisionReason,
  accountEmail,
}: {
  boardMeetingDate: string;
  secretaryName: string;
  decisionReason: string;
  accountEmail: string | null;
}): ApprovalInput {
  return {
    boardMeetingDate,
    secretaryName,
    decisionReason: decisionReason.trim() || "Approved and converted.",
    createMemberPortalAccount: Boolean(accountEmail),
    accountEmail,
    username: null,
  };
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
