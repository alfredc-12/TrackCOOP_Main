"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Filter, RefreshCcw, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  ErrorState,
  LoadingSkeleton,
} from "@/components/portal/PortalPrimitives";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  AdvancedFilters,
  ClassificationBadge,
  Pagination,
  SelectField,
  classificationOptions,
} from "./RfmControls";
import {
  ComponentDiagnostics,
  MatrixSearch,
  RfmMatrix,
  RfmQuality,
  RfmRuns,
  componentNames,
} from "./RfmAnalysisDrawers";
import { RfmDetails, ScoringRules } from "./RfmDetails";
import { RfmRecalculation } from "./RfmRecalculation";
import {
  date,
  defaultFilters,
  downloadRfm,
  errorMessage,
  filtersFromParams,
  getWorkspace,
  memberLink,
  number,
  percent,
  peso,
  rfmParams,
  type RfmComponent,
  type RfmFilters,
  type RfmMemberRow,
  type RfmWorkspace as WorkspaceData,
} from "./rfm-client";
import styles from "./RfmWorkspace.module.css";

type Panel =
  | { kind: "guide" | "matrix" | "quality" | "filters" | "columns" | "runs" }
  | { kind: "component"; component: RfmComponent }
  | { kind: "member"; row: RfmMemberRow; tab: string };
const optionalColumns = {
  memberCode: "Member code",
  membershipType: "Membership type",
  officialMemberStatus: "Official status",
  barangay: "Barangay",
  sector: "Sector",
  scoringVersion: "Score version",
  basis: "Basis start / end",
  lastParticipation: "Last participation",
  evidence: "Evidence counts through basis",
  computedBy: "Calculated by",
};
const sorts: Array<{ value: RfmFilters["sortBy"]; label: string }> = [
  { value: "fullName", label: "Member name" },
  { value: "totalScore", label: "Total score" },
  { value: "recencyScore", label: "Recency score" },
  { value: "frequencyScore", label: "Frequency score" },
  { value: "contributionScore", label: "Contribution score" },
  { value: "computedAt", label: "Calculation date" },
  { value: "recencyDays", label: "Recency days" },
  { value: "frequencyCount", label: "Frequency count" },
  { value: "validatedShareCapital", label: "Contribution amount" },
];
function optionalValue(column: string, row: RfmMemberRow): ReactNode {
  if (column === "basis")
    return `${date(row.basisStart)} – ${date(row.basisEnd)}`;
  if (column === "lastParticipation") return date(row.lastParticipation);
  if (column === "evidence")
    return row.participationEvidenceCount != null ||
      row.paymentEvidenceCount != null
      ? `${number(row.participationEvidenceCount ?? null, 0)} participations (all time); ${number(row.paymentEvidenceCount ?? null, 0)} validated payments`
      : "Counts not preserved";
  return String(row[column as keyof RfmMemberRow] ?? "—");
}
export function RfmWorkspace() {
  const params = useSearchParams();
  const [filters, setFilters] = useState(() =>
    filtersFromParams(new URLSearchParams(params.toString())),
  );
  const [search, setSearch] = useState(filters.search ?? ""),
    [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null),
    [recalculateOpen, setRecalculateOpen] = useState(false),
    [recalculateMember, setRecalculateMember] = useState<RfmMemberRow | null>(
      null,
    );
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState(""),
    [columns, setColumns] = useState<string[]>([]);
  const opener = useRef<HTMLElement | null>(null),
    recalculationTrigger = useRef<HTMLDivElement | null>(null);
  const requestSequence = useRef(0);
  useEffect(() => {
    const pop = () => {
      const next = filtersFromParams(
        new URLSearchParams(window.location.search),
      );
      setFilters(next);
      setSearch(next.search ?? "");
    };
    window.addEventListener("popstate", pop);
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("trackcoop.rfm.columns") ?? "[]",
        );
        if (Array.isArray(saved))
          setColumns(saved.filter((c) => c in optionalColumns));
      } catch {
        /* Preferences are optional. */
      }
    }, 0);
    return () => {
      window.removeEventListener("popstate", pop);
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setFilters((current) =>
          current.search === (search.trim() || undefined)
            ? current
            : { ...current, search: search.trim() || undefined, page: 1 },
        ),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController(),
      sequence = ++requestSequence.current;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${rfmParams(filters)}`,
    );
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getWorkspace(filters, controller.signal)
        .then((result) => {
          if (sequence === requestSequence.current) setData(result);
        })
        .catch((e) => {
          if (
            !controller.signal.aborted &&
            sequence === requestSequence.current
          ) {
            setError(errorMessage(e));
            setData(null);
          }
        })
        .finally(() => {
          if (
            !controller.signal.aborted &&
            sequence === requestSequence.current
          )
            setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filters, revision]);
  const update = (patch: Partial<RfmFilters>) => {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
    if ("search" in patch) setSearch(patch.search ?? "");
  };
  const open = (next: Panel) => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setRecalculateOpen(false);
    setPanel(next);
  };
  const recalculate = (member: RfmMemberRow | null) => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPanel(null);
    setRecalculateMember(member);
    setRecalculateOpen(true);
  };
  const closeAndFilter = (patch: Partial<RfmFilters>) => {
    update(patch);
    setPanel(null);
  };
  async function exportAll(memberId?: string) {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      await downloadRfm(filters, memberId);
    } catch (e) {
      setExportError(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }
  function toggleColumn(key: string) {
    const next = columns.includes(key)
      ? columns.filter((c) => c !== key)
      : [...columns, key];
    setColumns(next);
    try {
      localStorage.setItem("trackcoop.rfm.columns", JSON.stringify(next));
    } catch {
      /* Keep in-memory preferences when storage is unavailable. */
    }
  }
  const title =
    panel?.kind === "member"
      ? panel.row.fullName
      : panel?.kind === "component"
        ? `${componentNames[panel.component]} diagnostics`
        : {
            guide: "RFM Scoring Guide",
            matrix: "Compare RFM Components",
            quality: "Scoring Coverage & Data Quality",
            filters: "More Filters",
            columns: "Table Columns",
            runs: "Calculation History",
          }[panel?.kind ?? "guide"];
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) =>
      ![
        "page",
        "pageSize",
        "sortBy",
        "sortDirection",
        "context",
        "basisEnd",
        "runId",
      ].includes(key) &&
      value !== undefined &&
      value !== "",
  );
  const s = data?.summary;
  const scoredPercentage = (count: number) =>
    s?.scored ? percent((count / s.scored) * 100) : "—";
  function rowActions(row: RfmMemberRow) {
    return (
      <div className={styles.rowActions}>
        <button
          type="button"
          onClick={() => open({ kind: "member", row, tab: "overview" })}
        >
          Inspect RFM
        </button>
        <button
          type="button"
          onClick={() => open({ kind: "member", row, tab: "history" })}
        >
          History
        </button>
        <button type="button" onClick={() => recalculate(row)}>
          Recalculate
        </button>
        <Link href={memberLink(row, filters)}>View Profile</Link>
      </div>
    );
  }
  return (
    <div className={styles.workspace} aria-busy={loading}>
      <a href="#rfm-results" className="sr-only focus:not-sr-only">
        Skip to member indicator results
      </a>
      <PageHeader
        eyebrow=""
        title="Member Indicators"
        description="Review, verify, and monitor RFM-inspired member engagement indicators."
        actions={
          <>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => setRevision((v) => v + 1)}
            >
              <RefreshCcw size={16} aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              loading={exporting}
              disabled={!data || loading}
              onClick={() => void exportAll()}
            >
              <Download size={16} aria-hidden="true" />
              Export Excel
            </Button>
            <Button variant="secondary" onClick={() => open({ kind: "guide" })}>
              Scoring Guide
            </Button>
            <div ref={recalculationTrigger}>
              <Modal
                open={recalculateOpen}
                onOpenChange={(value) => {
                  if (value) {
                    setPanel(null);
                    setRecalculateMember(null);
                  }
                  setRecalculateOpen(value);
                  if (!value)
                    window.setTimeout(() => {
                      if (opener.current?.isConnected) opener.current.focus();
                    }, 0);
                }}
                title={
                  recalculateMember
                    ? "Recalculate Selected Member"
                    : "Recalculate Eligible Population"
                }
                description="Preview the server calculation, review its basis, and confirm before saving results."
                trigger={
                  <Button
                    onClick={() => {
                      opener.current =
                        recalculationTrigger.current?.querySelector("button") ??
                        null;
                      setRecalculateMember(null);
                      setPanel(null);
                    }}
                  >
                    Recalculate Indicators
                  </Button>
                }
                maxWidth="max-w-3xl"
              >
                <RfmRecalculation
                  key={`${recalculateOpen}:${recalculateMember?.memberId ?? "all"}`}
                  member={recalculateMember}
                  onComplete={() => setRevision((v) => v + 1)}
                />
              </Modal>
            </div>
          </>
        }
      />
      <div className={styles.context}>
        <span>
          <strong>Context:</strong>{" "}
          {filters.context === "current"
            ? "Latest Current Scores"
            : filters.context === "historical"
              ? `Historical Snapshot · ${date(filters.basisEnd ?? null)}`
              : "Saved Calculation Run"}
        </span>
        <span>
          <strong>Latest calculation:</strong>{" "}
          {date(s?.latestCalculation ?? null)}
        </span>
        <span>
          <strong>Effective version:</strong>{" "}
          {data?.settings.formulaVersion ?? "Loading…"}
        </span>
        {s && (
          <span>
            <strong>Coverage:</strong> {s.scored} / {s.eligible} (
            {percent(s.coverage)}) · {s.notScored} without a valid selected
            score
          </span>
        )}
      </div>
      {data && (
        <>
          <div className={styles.kpis} aria-label="Filtered RFM summary">
            <button
              type="button"
              className={styles.kpi}
              aria-pressed={filters.minScore === 3 && !filters.classification}
              onClick={() =>
                update({
                  classification: undefined,
                  minScore: 3,
                  maxScore: undefined,
                })
              }
            >
              <span>Scored Members</span>
              <strong>{number(s!.scored, 0)}</strong>
              <small>
                {percent(s!.coverage)} of {s!.eligible} eligible filtered
                members
              </small>
            </button>
            <button
              type="button"
              className={styles.kpi}
              aria-pressed={filters.classification === "Active"}
              onClick={() =>
                update({
                  classification: "Active",
                  minScore: undefined,
                  maxScore: undefined,
                })
              }
            >
              <span>Active</span>
              <strong>{number(s!.active, 0)}</strong>
              <small>{scoredPercentage(s!.active)} of scored members</small>
            </button>
            <button
              type="button"
              className={styles.kpi}
              aria-pressed={filters.classification === "Needs Monitoring"}
              onClick={() =>
                update({
                  classification: "Needs Monitoring",
                  minScore: undefined,
                  maxScore: undefined,
                })
              }
            >
              <span>Needs Monitoring</span>
              <strong>{number(s!.needsMonitoring, 0)}</strong>
              <small>
                {scoredPercentage(s!.needsMonitoring)} of scored members
              </small>
            </button>
            <button
              type="button"
              className={styles.kpi}
              aria-pressed={filters.classification === "Inactive"}
              onClick={() =>
                update({
                  classification: "Inactive",
                  minScore: undefined,
                  maxScore: undefined,
                })
              }
            >
              <span>Inactive</span>
              <strong>{number(s!.inactive, 0)}</strong>
              <small>
                {scoredPercentage(s!.inactive)} of scored members · advisory
              </small>
            </button>
            <button
              type="button"
              className={styles.kpi}
              aria-pressed={filters.classification === "Not Yet Scored"}
              onClick={() =>
                update({
                  classification: "Not Yet Scored",
                  minScore: undefined,
                  maxScore: undefined,
                  recencyScore: undefined,
                  frequencyScore: undefined,
                  contributionScore: undefined,
                })
              }
            >
              <span>Not Yet Scored</span>
              <strong>{number(s!.notScored, 0)}</strong>
              <small>Eligible members without a valid selected snapshot</small>
            </button>
          </div>
          <div className={styles.toolbar}>
            <p className={styles.muted}>
              All measures follow the active filters. Eligible: approved members
              with official status Active or Inactive. RFM never changes
              official status.
            </p>
            <Button variant="ghost" onClick={() => open({ kind: "quality" })}>
              Coverage & Data Quality
            </Button>
          </div>
        </>
      )}
      <section className={styles.panel} aria-label="RFM filters">
        <div className={styles.filters}>
          <Input
            name="rfm-search"
            label="Search Member"
            placeholder="Member name or code"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectField
            label="RFM Classification"
            value={filters.classification ?? ""}
            options={classificationOptions}
            onChange={(v) =>
              update({
                classification:
                  (v as RfmFilters["classification"]) || undefined,
              })
            }
          />
          <SelectField
            label="Membership Type"
            value={filters.membershipType ?? ""}
            options={[
              { value: "", label: "All membership types" },
              "Associate",
              "True Member",
            ]}
            onChange={(v) =>
              update({
                membershipType:
                  (v as RfmFilters["membershipType"]) || undefined,
              })
            }
          />
          <SelectField
            label="Calculation Basis"
            value={filters.context}
            options={[
              { value: "current", label: "Latest Current Scores" },
              { value: "historical", label: "Historical Snapshot" },
              { value: "run", label: "Calculation History" },
            ]}
            onChange={(v) => {
              if (v === "run") open({ kind: "runs" });
              else
                update({
                  context: v as RfmFilters["context"],
                  basisEnd:
                    v === "historical"
                      ? (data?.options.bases[0] ??
                        new Date().toISOString().slice(0, 10))
                      : undefined,
                  runId: undefined,
                });
            }}
          />
          {filters.context === "historical" && (
            <Input
              label="Saved historical basis end"
              name="historical-basis"
              type="date"
              value={filters.basisEnd ?? ""}
              onChange={(event) =>
                update({ basisEnd: event.target.value || undefined })
              }
            />
          )}
          <SelectField
            label="Score Range"
            value={
              filters.minScore === undefined && filters.maxScore === undefined
                ? "all"
                : `${filters.minScore ?? ""}:${filters.maxScore ?? ""}`
            }
            options={[
              { value: "all", label: "Any score / unscored" },
              { value: "3:6", label: "3–6 total" },
              { value: "7:11", label: "7–11 total" },
              { value: "12:15", label: "12–15 total" },
              ...(filters.minScore !== undefined ||
              filters.maxScore !== undefined
                ? [
                    {
                      value: `${filters.minScore ?? ""}:${filters.maxScore ?? ""}`,
                      label: `${filters.minScore ?? "3"}–${filters.maxScore ?? "15"} selected`,
                    },
                  ]
                : []),
            ]}
            onChange={(v) => {
              const [min, max] = v.split(":");
              update({
                minScore: v === "all" ? undefined : Number(min),
                maxScore: v === "all" ? undefined : Number(max),
              });
            }}
          />
        </div>
        <div className={`${styles.toolbar} mt-4`}>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              disabled={!data}
              onClick={() => open({ kind: "filters" })}
            >
              <Filter size={16} aria-hidden="true" />
              More Filters
            </Button>
            {search && (
              <Button
                variant="ghost"
                onClick={() => update({ search: undefined })}
              >
                Clear search
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(defaultFilters());
                setSearch("");
              }}
            >
              Reset all filters
            </Button>
          </div>
          <p className={styles.muted}>
            {filters.context === "current"
              ? "Latest saved basis per member; mixed periods are disclosed below."
              : "Browsing saved results only. Changing this context does not recalculate."}
          </p>
        </div>
        {activeFilters.length > 0 && (
          <div className={styles.chips} aria-label="Active filters">
            {activeFilters.map(([key, value]) => (
              <button
                type="button"
                className={styles.chip}
                key={key}
                aria-label={`Remove ${key} filter`}
                onClick={() => update({ [key]: undefined })}
              >
                {key.replace(/([A-Z])/g, " $1")}: {String(value)}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>
      {error ? (
        <ErrorState message={error} onRetry={() => setRevision((v) => v + 1)} />
      ) : !data ? (
        <LoadingSkeleton />
      ) : (
        <>
          <section
            className={styles.panel}
            aria-label="RFM Component Diagnostics"
          >
            <div className={styles.toolbar}>
              <h2>RFM Component Diagnostics</h2>
              <Button
                variant="secondary"
                onClick={() => open({ kind: "matrix" })}
              >
                Compare RFM Components
              </Button>
            </div>
            <p className={`${styles.muted} mb-4`}>
              Scores 1–5 across {data.summary.scored} valid scored members.
              Select a component to inspect its distribution.
            </p>
            <div className={styles.diagnostics}>
              {data.components.map((c) => {
                const max = Math.max(...c.distribution.map((d) => d.count), 1);
                return (
                  <button
                    key={c.component}
                    type="button"
                    className={styles.diagnostic}
                    onClick={() =>
                      open({ kind: "component", component: c.component })
                    }
                    aria-label={`Inspect ${componentNames[c.component]} diagnostics`}
                  >
                    <h3>{componentNames[c.component]}</h3>
                    <p className={styles.muted}>
                      Average {number(c.average)}/5 · Low{" "}
                      {percent(c.lowPercentage)}
                    </p>
                    <div className={styles.bars} aria-hidden="true">
                      {c.distribution.map((d) => (
                        <span
                          key={d.score}
                          className={styles.bar}
                          style={{ height: `${(d.count / max) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className={styles.barLabels} aria-hidden="true">
                      {c.distribution.map((d) => (
                        <span key={d.score}>
                          {d.score}: {d.count}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          <section
            className={styles.panel}
            aria-label="Member indicator results"
            id="rfm-results"
          >
            <div className={styles.toolbar}>
              <div>
                <h2>Member Indicator Results</h2>
                <p className={styles.muted}>
                  {data.total} matching eligible members · Average{" "}
                  {number(data.summary.average)} / 15 · Median{" "}
                  {number(data.summary.median)} / 15
                </p>
              </div>
              <div className={styles.actions}>
                <Button variant="ghost" onClick={() => open({ kind: "runs" })}>
                  Calculation History
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "columns" })}
                >
                  Columns
                </Button>
                <Button variant="ghost" onClick={() => window.print()}>
                  Print Summary
                </Button>
              </div>
            </div>
            <div className={`${styles.toolbar} my-4`}>
              <div className={styles.actions}>
                <SelectField
                  label="Sort by"
                  value={filters.sortBy}
                  options={sorts}
                  onChange={(v) =>
                    update({ sortBy: v as RfmFilters["sortBy"] })
                  }
                />
                <SelectField
                  label="Sort direction"
                  value={filters.sortDirection}
                  options={[
                    { value: "asc", label: "Ascending" },
                    { value: "desc", label: "Descending" },
                  ]}
                  onChange={(v) =>
                    update({ sortDirection: v as RfmFilters["sortDirection"] })
                  }
                />
                <SelectField
                  label="Page size"
                  value={String(filters.pageSize)}
                  options={["10", "20", "50", "100"]}
                  onChange={(v) => update({ pageSize: Number(v) })}
                />
              </div>
              {loading && (
                <p role="status" className={styles.muted}>
                  Updating saved results…
                </p>
              )}
            </div>
            {data.summary.basisPeriods.length > 1 && (
              <p className={`${styles.notice} mb-4`}>
                Mixed basis periods:{" "}
                {data.summary.basisPeriods
                  .map((b) => `${date(b.end)} (${b.count} members)`)
                  .join("; ")}
                . Select Historical Snapshot for an exact shared basis.
              </p>
            )}
            {filters.context === "historical" && data.summary.scored === 0 && (
              <p className={`${styles.notice} mb-4`}>
                No valid saved calculation is available for the selected basis
                and filters. Eligible members remain Not Yet Scored in this
                historical context; current scores are not substituted.
              </p>
            )}
            {!data.rows.length ? (
              <div className={styles.notice} role="status">
                <h3>
                  {filters.context === "historical"
                    ? "No matching saved calculation"
                    : "No matching eligible members"}
                </h3>
                <p>
                  Review the filters or choose another saved basis. Historical
                  results are never substituted with today’s scores.
                </p>
              </div>
            ) : (
              <>
                <div
                  className={`${styles.tableRegion} ${styles.desktopTable}`}
                  tabIndex={0}
                  role="region"
                  aria-label="Member RFM indicator table"
                >
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Member</th>
                        <th scope="col">RFM Classification</th>
                        <th scope="col" className={styles.numeric}>
                          Score
                        </th>
                        <th scope="col" className={styles.numeric}>
                          Recency
                        </th>
                        <th scope="col" className={styles.numeric}>
                          Frequency
                        </th>
                        <th scope="col" className={styles.numeric}>
                          Contribution
                        </th>
                        <th scope="col">Calculated / freshness</th>
                        {columns.map((key) => (
                          <th scope="col" key={key}>
                            {
                              optionalColumns[
                                key as keyof typeof optionalColumns
                              ]
                            }
                          </th>
                        ))}
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.memberId}>
                          <td>
                            <button
                              type="button"
                              className={styles.name}
                              onClick={() =>
                                open({ kind: "member", row, tab: "overview" })
                              }
                            >
                              {row.fullName}
                            </button>
                            <small>{row.memberCode}</small>
                          </td>
                          <td>
                            <button
                              type="button"
                              aria-label={`Filter ${row.classification ?? "Not Yet Scored"}`}
                              onClick={() =>
                                update({
                                  classification:
                                    row.classification ?? "Not Yet Scored",
                                })
                              }
                            >
                              <ClassificationBadge
                                classification={row.classification}
                              />
                            </button>
                          </td>
                          <td className={styles.numeric}>
                            <button
                              type="button"
                              className={styles.scoreButton}
                              aria-label={`Explain score for ${row.fullName}`}
                              onClick={() =>
                                open({ kind: "member", row, tab: "overview" })
                              }
                            >
                              {row.totalScore === null
                                ? "—"
                                : `${row.totalScore}/15`}
                            </button>
                          </td>
                          <td className={styles.numeric}>
                            {row.recencyScore === null
                              ? "—"
                              : `${row.recencyScore}/5`}
                            <small>
                              {row.totalScore === null
                                ? "Not scored"
                                : row.recencyDays === null
                                  ? "No participation"
                                  : `${row.recencyDays} days`}
                            </small>
                          </td>
                          <td className={styles.numeric}>
                            {row.frequencyScore === null
                              ? "—"
                              : `${row.frequencyScore}/5`}
                            <small>
                              {row.frequencyCount === null
                                ? "Not scored"
                                : `${row.frequencyCount} participations`}
                            </small>
                          </td>
                          <td className={styles.numeric}>
                            {row.contributionScore === null
                              ? "—"
                              : `${row.contributionScore}/5`}
                            <small>
                              {peso(row.validatedShareCapital)} validated
                            </small>
                          </td>
                          <td>
                            {date(row.computedAt)}
                            <small>{row.quality}</small>
                            <small>Basis {date(row.basisEnd)}</small>
                          </td>
                          {columns.map((column) => (
                            <td key={column}>{optionalValue(column, row)}</td>
                          ))}
                          <td>{rowActions(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.mobileCards}>
                  {data.rows.map((row) => (
                    <article className={styles.mobileCard} key={row.memberId}>
                      <div className={styles.toolbar}>
                        <button
                          type="button"
                          className={styles.name}
                          onClick={() =>
                            open({ kind: "member", row, tab: "overview" })
                          }
                        >
                          {row.fullName}
                        </button>
                        <ClassificationBadge
                          classification={row.classification}
                        />
                      </div>
                      <p className={styles.muted}>
                        {row.memberCode} ·{" "}
                        {row.totalScore === null
                          ? "Not Yet Scored"
                          : `${row.totalScore}/15`}
                      </p>
                      <dl className={styles.definition}>
                        <dt>Recency</dt>
                        <dd>
                          {row.recencyScore ?? "—"}/5 ·{" "}
                          {row.totalScore === null
                            ? "Not scored"
                            : row.recencyDays === null
                              ? "No recorded participation"
                              : `${row.recencyDays} days`}
                        </dd>
                        <dt>Frequency</dt>
                        <dd>
                          {row.frequencyScore ?? "—"}/5 ·{" "}
                          {row.frequencyCount ?? "—"} participations
                        </dd>
                        <dt>Contribution</dt>
                        <dd>
                          {row.contributionScore ?? "—"}/5 ·{" "}
                          {peso(row.validatedShareCapital)}
                        </dd>
                      </dl>
                      {columns.length > 0 && <dl className={styles.definition}>{columns.map(column => <Fragment key={column}><dt>{optionalColumns[column as keyof typeof optionalColumns]}</dt><dd>{optionalValue(column, row)}</dd></Fragment>)}</dl>}
                      <p className={styles.muted}>
                        {row.quality} · Calculated {date(row.computedAt)} ·
                        Basis {date(row.basisEnd)}
                      </p>
                      {rowActions(row)}
                    </article>
                  ))}
                </div>
              </>
            )}
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={(page) => update({ page })}
            />
          </section>
        </>
      )}
      {exportError && (
        <div role="alert" className={styles.error}>
          {exportError}
          <Button variant="secondary" onClick={() => void exportAll()}>
            Retry export
          </Button>
        </div>
      )}
      <p className={styles.muted}>
        RFM labels support human review. They do not certify official membership
        status.{" "}
        <Link
          className={styles.scoreButton}
          href="/portal/chairman/members?tab=directory"
        >
          Member Management
        </Link>{" "}
        handles profiles and administrative actions.{" "}
        <Link className={styles.scoreButton} href="/portal/chairman/dashboard">
          Member Analytics Dashboard
        </Link>{" "}
        covers broader membership trends.
      </p>
      <Dialog.Root
        open={panel !== null}
        onOpenChange={(value) => {
          if (!value) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={styles.drawer}
            data-side={panel?.kind === "matrix" ? "left" : "right"}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (opener.current?.isConnected) opener.current.focus();
            }}
          >
            <header className={styles.drawerHeader}>
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description className={styles.muted}>
                  {panel?.kind === "member"
                    ? "Saved scoring observations and the evidence behind them."
                    : "Inspect RFM results without changing official member records."}
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close RFM drawer">
                <X size={20} aria-hidden="true" />
              </Dialog.Close>
            </header>
            <div className={styles.drawerBody}>
              {panel?.kind === "guide" && (
                <>
                  <p className={styles.notice}>
                    RFM is advisory. Recency and Frequency use qualifying
                    cooperative participation; Contribution uses validated
                    non-reversal share-capital payments through the basis end,
                    excluding ledger interest and adjustments.
                  </p>
                  {data ? (
                    <ScoringRules settings={data.settings} />
                  ) : (
                    <p>Load the workspace to retrieve effective thresholds.</p>
                  )}
                  <h3>Saved periods and historical settings</h3>
                  <p className={styles.muted}>
                    Current Scores selects each member’s latest saved basis end,
                    followed by computation time and ID. Historical Snapshot
                    uses the exact requested basis; Calculation History selects
                    an actual saved run. Mixed basis periods are disclosed. Old
                    records without preserved configuration or evidence remain
                    visible with explicit limitations.
                  </p>
                  <h3>Repeated calculations</h3>
                  <p className={styles.muted}>
                    Identical member/basis/configuration/evidence results are
                    skipped. Changed results append new observations. Older
                    historical calculations cannot replace later current-basis
                    scores. All calculations retain an actor, run reference, and
                    audit entry.
                  </p>
                </>
              )}
              {panel?.kind === "member" && (
                <RfmDetails
                  key={`${panel.row.memberId}:${panel.row.indicatorId}:${panel.tab}`}
                  row={panel.row}
                  filters={filters}
                  initialTab={panel.tab}
                  onInspect={(row) =>
                    setPanel({ kind: "member", row, tab: "overview" })
                  }
                  onRecalculate={recalculate}
                />
              )}
              {data && panel?.kind === "filters" && (
                <AdvancedFilters
                  filters={filters}
                  data={data}
                  onApply={(next) => {
                    setFilters(next);
                    setSearch(next.search ?? "");
                    setPanel(null);
                  }}
                />
              )}
              {data && panel?.kind === "matrix" && (
                <>
                  <MatrixSearch value={search} onChange={setSearch} />
                  <RfmMatrix
                    data={data}
                    busy={loading}
                    onChange={update}
                    onSelect={(recencyScore, frequencyScore) =>
                      closeAndFilter({ recencyScore, frequencyScore })
                    }
                    onExport={() => void exportAll()}
                  />
                </>
              )}
              {data && panel?.kind === "component" && (
                <ComponentDiagnostics
                  data={data}
                  component={panel.component}
                  onFilter={(score) =>
                    closeAndFilter({ [panel.component]: score })
                  }
                />
              )}
              {data && panel?.kind === "quality" && (
                <RfmQuality
                  data={data}
                  onFilter={(quality) => closeAndFilter({ quality })}
                />
              )}
              {panel?.kind === "runs" && (
                <RfmRuns
                  onSelect={(run) =>
                    closeAndFilter({
                      context: "run",
                      runId: run.id,
                      basisEnd: run.basisEnd ?? undefined,
                      version: run.version,
                    })
                  }
                />
              )}
              {panel?.kind === "columns" && (
                <>
                  <p className={styles.muted}>
                    Core RFM columns stay visible. Optional columns are
                    remembered in this browser.
                  </p>
                  {Object.entries(optionalColumns).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex min-h-11 items-center gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={columns.includes(key)}
                        onChange={() => toggleColumn(key)}
                      />
                      {label}
                    </label>
                  ))}
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {data && (
        <section className={styles.printReport} aria-label="Print RFM summary">
          <h1>TrackCOOP · Member Indicators</h1>
          <p>
            Advisory engagement summary. Not an official membership-status
            certification.
          </p>
          <p>
            Generated {data.generatedAt} · Context: {filters.context} · Filters:{" "}
            {JSON.stringify(filters)}
          </p>
          <table>
            <thead>
              <tr>
                <th>Eligible</th>
                <th>Scored</th>
                <th>Coverage</th>
                <th>Active</th>
                <th>Needs Monitoring</th>
                <th>Inactive</th>
                <th>Not Yet Scored</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{data.summary.eligible}</td>
                <td>{data.summary.scored}</td>
                <td>{percent(data.summary.coverage)}</td>
                <td>{data.summary.active}</td>
                <td>{data.summary.needsMonitoring}</td>
                <td>{data.summary.inactive}</td>
                <td>{data.summary.notScored}</td>
              </tr>
            </tbody>
          </table>
          <p>
            Average {number(data.summary.average)}; median{" "}
            {number(data.summary.median)}. Basis periods:{" "}
            {data.summary.basisPeriods
              .map((b) => `${b.end} (${b.count})`)
              .join("; ")}
            .
          </p>
          <h2>
            Current results page ({data.rows.length} of {data.total}; use Excel
            for complete results)
          </h2>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>R / F / C</th>
                <th>Total</th>
                <th>RFM</th>
                <th>Basis</th>
                <th>Calculated</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.memberId}>
                  <td>
                    {row.fullName} · {row.memberCode}
                  </td>
                  <td>
                    {row.recencyScore ?? "—"} / {row.frequencyScore ?? "—"} /{" "}
                    {row.contributionScore ?? "—"}
                  </td>
                  <td>{row.totalScore ?? "—"}</td>
                  <td>{row.classification ?? "Not Yet Scored"}</td>
                  <td>{row.basisEnd ?? "—"}</td>
                  <td>{date(row.computedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
