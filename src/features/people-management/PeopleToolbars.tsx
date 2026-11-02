"use client";

import type { ComponentType } from "react";
import { CheckCircle2, ClipboardCheck, FileText, History, Link2, Mail, ShieldCheck, UserCheck, UsersRound, WalletCards } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import type {
  HistoryActorOptions,
  MemberListQuery,
  MemberSummary,
  UnifiedStatusHistorySummary,
} from "@/features/chairman/people-api";
import { PRIMARY_SECTOR_OPTIONS } from "@/features/membership/sector-options";
import {
  membershipApplicationSources,
  requestedMembershipTypes,
  type ChairmanApplicationListQuery,
  type ChairmanApplicationSummary,
} from "@/features/membership-applications/membership-application-types";
import {
  DateRangeFilter,
  FilterPanel,
  FilterSelect,
  InlineNote,
  KpiGrid,
  MoreFilters,
  ResultSummary,
  SearchableFilterSelect,
  SearchField,
  SupportStats,
} from "./PeopleFilterUi";
import {
  UNSPECIFIED,
  applicationChips,
  applicationMoreFilterCount,
  applicationStatusChoice,
  applicationStatusChoices,
  approvalStatusList,
  describeDateRange,
  historyChangeTypeChoices,
  historyChips,
  historyMoreFilterCount,
  historyRangeChoices,
  historyRangeError,
  historySources,
  manilaToday,
  resolveHistoryRange,
  memberAccountLinkChoices,
  memberChips,
  memberMoreFilterCount,
  membershipTypeList,
  officialStatusList,
  requirementCompletionChoices,
  validateDateRange,
  type HistoryQueryState,
} from "./people-filters";
import {
  buildApplicationKpis,
  buildDirectoryKpis,
  buildDirectorySupportStats,
  buildHistoryKpis,
  type KpiSpec,
} from "./people-kpis";

type Icon = ComponentType<{ className?: string }>;

const applicationIcons: Record<string, Icon> = { total: FileText, review: ClipboardCheck, info: Mail, payment: WalletCards, approved: CheckCircle2 };
const directoryIcons: Record<string, Icon> = { approved: UsersRound, active: UserCheck, associate: WalletCards, true: ShieldCheck };
const historyIcons: Record<string, Icon> = { total: History, application: FileText, member: UserCheck, account: Link2 };

export const emptyApplicationSummary: ChairmanApplicationSummary = {
  total: 0, submitted: 0, underReview: 0, needsInformation: 0, paymentRequired: 0, paymentConfirmed: 0,
  approved: 0, rejected: 0, withdrawn: 0, forReview: 0, paymentStage: 0, overallTotal: 0,
};

export const emptyDirectorySummary: MemberSummary = {
  total: 0, pendingApproval: 0, needsInformation: 0, rejected: 0, approved: 0, associate: 0, trueMember: 0, active: 0, inactive: 0, suspended: 0,
  approvedMembers: { total: 0, active: 0, inactive: 0, suspended: 0, terminated: 0, pendingOfficial: 0, associate: 0, trueMember: 0, unlinked: 0 },
  overallTotal: 0,
};

export const emptyHistorySummary: UnifiedStatusHistorySummary = { total: 0, application: 0, member: 0, account: 0, distinctSubjects: 0, overallTotal: 0 };

/** Case-insensitive distinct barangays plus the reserved "Unspecified" option, keeping any selected value selectable. */
export function buildBarangayOptions(names: string[], hasUnspecified: boolean, selected?: string) {
  const seen = new Map<string, string>();
  for (const name of names) {
    const clean = name.trim();
    if (clean && clean.toLowerCase() !== UNSPECIFIED.toLowerCase() && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean);
  }
  if (selected && selected.toLowerCase() !== UNSPECIFIED.toLowerCase() && !seen.has(selected.toLowerCase())) seen.set(selected.toLowerCase(), selected);
  const options = Array.from(seen.values())
    .sort((first, second) => first.localeCompare(second, "en-PH", { sensitivity: "base" }))
    .map((name) => ({ value: name, label: name }));
  if (hasUnspecified || selected?.toLowerCase() === UNSPECIFIED.toLowerCase()) options.push({ value: UNSPECIFIED, label: "No barangay recorded" });
  return options;
}

// ---------------------------------------------------------------- Applications

export function ApplicationsToolbar({ summary, summaryError, summaryLoading, onRetrySummary, query, total, loading, barangays, update }: {
  summary: ChairmanApplicationSummary | null;
  summaryError: string;
  summaryLoading: boolean;
  onRetrySummary: () => void;
  query: ChairmanApplicationListQuery;
  /** Total applications matching every filter, from the list endpoint. */
  total: number;
  loading: boolean;
  barangays: Array<{ value: string; label: string }>;
  update: (patch: Partial<ChairmanApplicationListQuery>) => void;
}) {
  const chips = applicationChips(query);
  const statusChoice = applicationStatusChoice(query);
  const range = validateDateRange(query.submittedFrom, query.submittedTo);
  const clearAll: Partial<ChairmanApplicationListQuery> = {
    search: "", status: "All", statuses: [], requestedMembershipType: "All", applicationSource: "All", barangay: undefined,
    submittedFrom: undefined, submittedTo: undefined, requirementCompletion: "All",
  };

  return (
    <>
      <KpiGrid
        specs={buildApplicationKpis(summary ?? emptyApplicationSummary, query)}
        icons={applicationIcons}
        onSelect={update}
        onClear={update}
        loading={summaryLoading && !summary}
        error={summaryError}
        onRetry={onRetrySummary}
        columns="sm:grid-cols-2 xl:grid-cols-5"
        scopeNote={summary ? (chips.some((chip) => chip.key !== "status")
          ? `Figures describe the ${summary.total.toLocaleString("en-PH")} applications matching your search and filters.`
          : `Figures cover all ${summary.total.toLocaleString("en-PH")} applications.`) : undefined}
      />
      <FilterPanel chips={chips} onRemoveChip={(chip) => update(chip.clear)} onClearAll={() => update(clearAll)}>
        <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-[1.5fr_1.2fr_0.8fr_0.9fr]">
          <div className="lg:col-span-2 xl:col-span-1">
            <SearchField label="Search applications" value={query.search ?? ""} onCommit={(search) => update({ search })} placeholder="Search code, name, email or phone" />
          </div>
          <FilterSelect
            label="Status"
            value={statusChoice?.value ?? "custom"}
            onChange={(value) => update({ statuses: applicationStatusChoices.find((choice) => choice.value === value)?.statuses ?? [], status: "All" })}
            options={[
              ...applicationStatusChoices.map((choice) => ({ value: choice.value, label: choice.label })),
              ...(statusChoice ? [] : [{ value: "custom", label: (query.statuses ?? []).join(" or ") }]),
            ]}
          />
          <FilterSelect
            label="Type"
            value={query.requestedMembershipType ?? "All"}
            onChange={(requestedMembershipType) => update({ requestedMembershipType })}
            options={[{ value: "All", label: "All types" }, ...requestedMembershipTypes.map((type) => ({ value: type, label: type }))]}
          />
          <FilterSelect
            label="Source"
            value={query.applicationSource ?? "All"}
            onChange={(applicationSource) => update({ applicationSource })}
            options={[{ value: "All", label: "All sources" }, ...membershipApplicationSources.map((source) => ({ value: source, label: source }))]}
          />
        </div>
        <MoreFilters activeCount={applicationMoreFilterCount(query)}>
          <SearchableFilterSelect label="Barangay" value={query.barangay ?? ""} allLabel="All barangays" options={barangays} onChange={(barangay) => update({ barangay: barangay || undefined })} />
          <DateRangeFilter label="Submitted" from={query.submittedFrom} to={query.submittedTo} onChange={({ from, to }) => update({ submittedFrom: from, submittedTo: to })} error={range} />
          <div className="grid min-w-0 gap-2">
            <FilterSelect
              label="Requirements"
              value={query.requirementCompletion ?? "All"}
              onChange={(requirementCompletion) => update({ requirementCompletion })}
              options={requirementCompletionChoices}
            />
            <InlineNote>Complete means every document and ID requirement before payment is Verified or Waived, counted across all applications.</InlineNote>
          </div>
        </MoreFilters>
      </FilterPanel>
      <ResultSummary total={total} overall={summary?.overallTotal} noun="applications" filtered={chips.length > 0} loading={loading} />
    </>
  );
}

// ---------------------------------------------------------------- Member directory

export function DirectoryToolbar({ summary, summaryError, summaryLoading, onRetrySummary, query, total, loading, barangays, update }: {
  summary: MemberSummary | null;
  summaryError: string;
  summaryLoading: boolean;
  onRetrySummary: () => void;
  query: MemberListQuery;
  total: number;
  loading: boolean;
  barangays: Array<{ value: string; label: string }>;
  update: (patch: Partial<MemberListQuery>) => void;
}) {
  const chips = memberChips(query);
  const range = validateDateRange(query.approvedFrom, query.approvedTo);
  const current = summary ?? emptyDirectorySummary;
  const clearAll: Partial<MemberListQuery> = {
    search: "", approvalStatus: "All", officialMemberStatus: "All", membershipType: "All", barangay: undefined, sector: undefined,
    accountLink: "all", approvedFrom: undefined, approvedTo: undefined,
  };
  const sectors = [...PRIMARY_SECTOR_OPTIONS.map((sector) => ({ value: sector, label: sector })), { value: UNSPECIFIED, label: "No sector recorded" }];
  if (query.sector && !sectors.some((sector) => sector.value === query.sector)) sectors.unshift({ value: query.sector, label: query.sector });

  return (
    <>
      <KpiGrid
        specs={buildDirectoryKpis(current, query) as Array<KpiSpec<MemberListQuery>>}
        icons={directoryIcons}
        onSelect={update}
        onClear={update}
        loading={summaryLoading && !summary}
        error={summaryError}
        onRetry={onRetrySummary}
        scopeNote={summary ? (chips.some((chip) => !["approval", "official", "type"].includes(chip.key))
          ? `Figures describe the ${summary.total.toLocaleString("en-PH")} profiles matching your search and filters. Percentages use approved members as the base.`
          : `Figures cover all ${summary.total.toLocaleString("en-PH")} member profiles. Percentages use approved members as the base.`) : undefined}
      />
      {summary ? <SupportStats stats={buildDirectorySupportStats(current, query)} onSelect={update} /> : null}
      <FilterPanel chips={chips} onRemoveChip={(chip) => update(chip.clear)} onClearAll={() => update(clearAll)}>
        <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1.2fr_0.9fr]">
          <div className="lg:col-span-2 xl:col-span-1">
            <SearchField label="Search members" value={query.search ?? ""} onCommit={(search) => update({ search })} placeholder="Search name, member code or email" />
          </div>
          <FilterSelect
            label="Official status"
            value={query.officialMemberStatus ?? "All"}
            onChange={(officialMemberStatus) => update({ officialMemberStatus })}
            options={[{ value: "All", label: "All statuses" }, ...officialStatusList.map((status) => ({ value: status, label: status }))]}
          />
          <FilterSelect
            label="Type"
            value={query.membershipType ?? "All"}
            onChange={(membershipType) => update({ membershipType })}
            options={[{ value: "All", label: "All types" }, ...membershipTypeList.map((type) => ({ value: type, label: type }))]}
          />
          <SearchableFilterSelect label="Barangay" value={query.barangay ?? ""} allLabel="All barangays" options={barangays} onChange={(barangay) => update({ barangay: barangay || undefined })} />
          <FilterSelect
            label="Order"
            value={query.sortDirection ?? "desc"}
            onChange={(sortDirection) => update({ sortDirection })}
            options={[{ value: "desc", label: "Descending" }, { value: "asc", label: "Ascending" }]}
          />
        </div>
        <MoreFilters activeCount={memberMoreFilterCount(query)}>
          <FilterSelect
            label="Approval"
            value={query.approvalStatus ?? "All"}
            onChange={(approvalStatus) => update({ approvalStatus })}
            options={[{ value: "All", label: "All approval statuses" }, ...approvalStatusList.map((status) => ({ value: status, label: status }))]}
          />
          <SearchableFilterSelect label="Primary sector" value={query.sector ?? ""} allLabel="All sectors" options={sectors} onChange={(sector) => update({ sector: sector || undefined })} />
          <div className="grid min-w-0 gap-2">
            <FilterSelect
              label="User account"
              value={query.accountLink ?? "all"}
              onChange={(accountLink) => update({ accountLink })}
              options={memberAccountLinkChoices}
            />
            <InlineNote>A linked account that is still Pending counts as linked.</InlineNote>
          </div>
          <DateRangeFilter label="Approved" from={query.approvedFrom} to={query.approvedTo} onChange={({ from, to }) => update({ approvedFrom: from, approvedTo: to })} error={range} />
        </MoreFilters>
      </FilterPanel>
      <ResultSummary total={total} overall={summary?.overallTotal} noun="member profiles" filtered={chips.length > 0} loading={loading} />
    </>
  );
}

// ---------------------------------------------------------------- Status history

export function HistoryToolbar({ summary, summaryError, summaryLoading, onRetrySummary, query, total, loading, actors, update }: {
  summary: UnifiedStatusHistorySummary | null;
  summaryError: string;
  summaryLoading: boolean;
  onRetrySummary: () => void;
  query: HistoryQueryState;
  total: number;
  loading: boolean;
  actors: HistoryActorOptions | null;
  update: (patch: Partial<HistoryQueryState>) => void;
}) {
  const chips = historyChips(query, (id) => actors?.actors.find((actor) => actor.id === id)?.name);
  const rangeError = historyRangeError(query);
  const clearAll: Partial<HistoryQueryState> = { search: "", sourceModule: "All", range: "all", date: "", from: "", to: "", actorId: "", changeType: "all" };
  const today = manilaToday();
  const resolved = resolveHistoryRange(query, today);
  const actorOptions = (actors?.actors ?? []).map((actor) => ({ value: actor.id, label: `${actor.name} (${actor.total})` }));
  if (query.actorId && query.actorId !== "none" && !actorOptions.some((option) => option.value === query.actorId)) actorOptions.unshift({ value: query.actorId, label: `User ${query.actorId}` });
  const unknownActor = actors?.withoutActor ? [{ value: "none", label: `No recorded actor (${actors.withoutActor})` }] : [{ value: "none", label: "No recorded actor" }];

  return (
    <>
      <KpiGrid
        specs={buildHistoryKpis(summary ?? emptyHistorySummary, query)}
        icons={historyIcons}
        onSelect={update}
        onClear={update}
        loading={summaryLoading && !summary}
        error={summaryError}
        onRetry={onRetrySummary}
        scopeNote={summary ? `Counts are status-change events, not people. ${chips.some((chip) => chip.key !== "source") ? "They match your search and filters." : `They cover all ${summary.total.toLocaleString("en-PH")} recorded events.`}` : undefined}
      />
      <FilterPanel chips={chips} onRemoveChip={(chip) => update(chip.clear)} onClearAll={() => update(clearAll)}>
        <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
          <div className="lg:col-span-2 xl:col-span-1">
            <SearchField label="Search status history" value={query.search} onCommit={(search) => update({ search })} placeholder="Search name, code, status or actor" />
          </div>
          <FilterSelect label="Source" value={query.sourceModule} onChange={(sourceModule) => update({ sourceModule })} options={historySources.map((source) => ({ value: source, label: source === "All" ? "All sources" : source }))} />
          <FilterSelect label="Date" value={query.range} onChange={(range) => update({ range })} options={historyRangeChoices} />
        </div>
        {query.range === "custom" ? (
          <DateRangeFilter label="Changed between" from={query.from || undefined} to={query.to || undefined} onChange={({ from, to }) => update({ from: from ?? "", to: to ?? "" })} error={rangeError} />
        ) : null}
        {query.range === "date" ? (
          <div className="max-w-xs">
            <DatePicker label="Changed on" value={query.date} max={today} onChange={(date) => update({ date })} placeholder="Choose a date" allowClear clearLabel="Clear exact date" triggerClassName="h-11 rounded-md border-[#CAD8CB] px-3 text-sm focus:ring-[#1F6B43]/10" />
          </div>
        ) : null}
        {query.range !== "all" && query.range !== "custom" && query.range !== "date" ? (
          <InlineNote>{describeDateRange(resolved.from, resolved.to)} (Asia/Manila dates, inclusive).</InlineNote>
        ) : null}
        <MoreFilters activeCount={historyMoreFilterCount(query)}>
          <FilterSelect label="Change type" value={query.changeType} onChange={(changeType) => update({ changeType })} options={historyChangeTypeChoices} />
          <SearchableFilterSelect label="Changed by" value={query.actorId} allLabel="Anyone" options={actorOptions} extra={unknownActor} onChange={(actorId) => update({ actorId })} />
          <InlineNote>“No recorded actor” means the system did not store who made the change. It does not mean the change was automatic.</InlineNote>
        </MoreFilters>
      </FilterPanel>
      <ResultSummary total={total} overall={summary?.overallTotal} noun="status changes" filtered={chips.length > 0} loading={loading} />
    </>
  );
}
