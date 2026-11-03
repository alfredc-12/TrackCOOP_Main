"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Eye,
  FileText,
  Info,
  RefreshCcw,
  Scale,
  ShieldAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  Metric,
  MonitorDrawer,
  MonitorPagination,
  Signal,
} from "@/features/finance-monitoring/MonitorUi";
import { MonitorSelect } from "@/features/finance-monitoring/MonitorFilters";
import { peso } from "@/features/finance-monitoring/monitor-client";
import { apiRequest } from "@/lib/api-client";
import { OverviewFilters } from "./OverviewFilters";
import {
  useOverviewQuery,
  useOverviewData,
  exportOverview,
  count,
  rangeText,
  sourceLink,
  type OverviewReport,
  type ActivityPage,
  type ActivityRecord,
  type RecordDetail,
  type CategoryTotal,
  type TrendPoint,
} from "./overview-client";
import styles from "./Overview.module.css";
type Panel = {
  kind: "income" | "expense" | "net" | "review" | "record";
  title: string;
  recordId?: string;
};
const definition =
  "Active, approved ledger income and expenses with compatible categories and valid source relationships. Capital, internal transfers, principal, capital purchases, Adjustments, duplicate or superseded postings and source conflicts are excluded. Custom compatible categories and donations remain supported. Recorded amounts do not establish cash collection or disbursement.";
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  return point ? (
    <div className={styles.tooltip}>
      <strong>{point.label}</strong>
      <p>Money In {peso(point.income)}</p>
      <p>Money Out {peso(point.expense)}</p>
      <p>Net {peso(point.net)}</p>
      <p>{count(point.records)} records</p>
      <p>
        {point.startDate} – {point.endDate}
      </p>
    </div>
  ) : null;
}
export function FinancialOverviewClient() {
  const queryState = useOverviewQuery(),
    { query, apply, patch, reset } = queryState;
  const [revision, setRevision] = useState(0),
    [panel, setPanel] = useState<Panel | null>(null),
    [exporting, setExporting] = useState(""),
    [exportError, setExportError] = useState("");
  const overview = useOverviewData<OverviewReport>("summary", query, revision),
    activity = useOverviewData<ActivityPage>("transactions", query, revision),
    report = overview.data;
  const [detail, setDetail] = useState<RecordDetail | null>(null),
    [detailError, setDetailError] = useState("");
  useEffect(() => {
    if (panel?.kind !== "record" || !panel.recordId) return;
    const controller = new AbortController();
    apiRequest<RecordDetail>(
      `/api/financial-overview/transactions/${panel.recordId}`,
      { signal: controller.signal },
    )
      .then((d) => {
        if (!controller.signal.aborted) setDetail(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setDetailError(
            e instanceof Error ? e.message : "Record details unavailable.",
          );
      });
    return () => controller.abort();
  }, [panel]);
  const openRecord = (row: ActivityRecord) => {
    setDetail(null);
    setDetailError("");
    setPanel({ kind: "record", title: row.number, recordId: row.id });
  };
  const selectActivity = (selection: Record<string, string>) => {
    setPanel(null);
    patch(selection);
    window.setTimeout(
      () =>
        document
          .getElementById("overview-activity")
          ?.focus({ preventScroll: false }),
      0,
    );
  };
  const summary = report?.summary,
    period = report
      ? rangeText(report.period.effective)
      : "Selected reporting period";
  const comparison = (kind: "income" | "expense" | "net") => {
    const change = report?.changes[kind];
    if (change?.amount === "0.00") return "No change";
    if (!change?.amount)
      return report?.period.comparisonReason ?? "No comparison";
    return `${change.amount.startsWith("-") ? "Down" : "Up"} ${peso(change.amount.replace("-", ""))}${change.percent === null ? " · % N/A" : ` (${change.percent > 0 ? "+" : ""}${change.percent}%)`}`;
  };
  const download = async (format: "pdf" | "xlsx") => {
    setExportError("");
    setExporting(format);
    try {
      await exportOverview(query, format);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting("");
    }
  };
  const ranks = (
    rows: CategoryTotal[],
    kind: "income" | "expense",
    expanded = false,
  ) => {
    const maximum = Math.max(1, ...rows.map((r) => Number(r.amount)));
    return (
      <div
        className={`${styles.rank} ${kind === "expense" ? styles.expense : ""}`}
      >
        {(expanded ? rows : rows.slice(0, 6)).map((row) => (
          <button
            type="button"
            key={row.id}
            className={styles.rankButton}
            aria-label={`View ${row.name} ${kind} records`}
            onClick={() =>
              selectActivity({
                view: kind,
                focusCategoryId: row.id,
                focusSource: "",
                focusStart: "",
                focusEnd: "",
                reviewKind: "",
              })
            }
          >
            <span>
              {row.name}
              {!row.active && (
                <small>Inactive category · historical postings</small>
              )}
              <small>
                {count(row.records)} records ·{" "}
                {row.share === null ? "N/A" : `${row.share}%`}
              </small>
            </span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.fill}
                style={{
                  display: "block",
                  width: `${(Number(row.amount) / maximum) * 100}%`,
                }}
              />
            </span>
            <strong>{peso(row.amount)}</strong>
          </button>
        ))}
        {!rows.length && (
          <p className={styles.hint}>
            No eligible posted {kind === "income" ? "income" : "expenses"} in
            this scope.
          </p>
        )}
        {!expanded && rows.length > 6 && (
          <Button
            variant="ghost"
            onClick={() =>
              setPanel({
                kind,
                title:
                  kind === "income"
                    ? "Income composition"
                    : "Expense composition",
              })
            }
          >
            View all {rows.length} categories
          </Button>
        )}
      </div>
    );
  };
  const posting = (r: ActivityRecord) =>
    r.status === "Active" ? (r.posted ? "Posted" : "Unposted") : r.status;
  const rowActions = (r: ActivityRecord) => (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={`Inspect ${r.number}`}
      title="Inspect record"
      onClick={() => openRecord(r)}
    >
      <Eye className="size-4" aria-hidden="true" />
    </button>
  );
  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow=""
        title="Financial Overview"
        description="Money In, Money Out and the records behind the operating result."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={overview.loading}
              onClick={() => setRevision((r) => r + 1)}
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              disabled={!report || Boolean(exporting)}
              onClick={() => void download("xlsx")}
            >
              <Download className="size-4" aria-hidden="true" />
              {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
            </Button>
            <Button
              variant="secondary"
              disabled={!report || Boolean(exporting)}
              onClick={() => void download("pdf")}
            >
              <FileText className="size-4" aria-hidden="true" />
              {exporting === "pdf" ? "Exporting…" : "Export PDF"}
            </Button>
          </>
        }
      />
      <OverviewFilters
        key={new URLSearchParams(query).toString()}
        query={query}
        apply={apply}
        reset={reset}
      />
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {period} · Posted records · Asia/Manila
          {report?.period.partial ? " · elapsed period" : ""}
        </p>
        <button
          type="button"
          className={`${styles.actions} text-sm font-semibold`}
          onClick={() =>
            setPanel({ kind: "net", title: "Financial basis and net result" })
          }
        >
          <Info className="size-4" aria-hidden="true" />
          Financial basis
        </button>
      </div>
      {overview.error && (
        <p role="alert" className={styles.error}>
          {overview.error}
          {report
            ? " Showing the last loaded summary; it may be out of date."
            : ""}
          <Button variant="ghost" onClick={() => setRevision((v) => v + 1)}>
            Retry Overview
          </Button>
        </p>
      )}
      {exportError && (
        <p role="alert" className={styles.error}>
          {exportError}
        </p>
      )}
      <section className={styles.kpis} aria-label="Financial Overview KPIs">
        <Metric
          title="Money In"
          value={overview.loading ? "…" : peso(summary?.income)}
          caption="Posted Operating Income"
          icon={ArrowDownLeft}
          tone="good"
          definition={definition}
          onSelect={() =>
            selectActivity({
              view: "income",
              focusCategoryId: "",
              focusSource: "",
              reviewKind: "",
            })
          }
          onInfo={() =>
            setPanel({
              kind: "income",
              title: "Money In · posted operating income",
            })
          }
        />
        <Metric
          title="Money Out"
          value={overview.loading ? "…" : peso(summary?.expense)}
          caption="Posted Operating Expenses"
          icon={ArrowUpRight}
          tone="neutral"
          definition={definition}
          onSelect={() =>
            selectActivity({
              view: "expense",
              focusCategoryId: "",
              focusSource: "",
              reviewKind: "",
            })
          }
          onInfo={() =>
            setPanel({
              kind: "expense",
              title: "Money Out · posted operating expenses",
            })
          }
        />
        <Metric
          title="Net Operating Result"
          value={overview.loading ? "…" : peso(summary?.net)}
          caption={
            summary
              ? Number(summary.net) > 0
                ? "Net Surplus"
                : Number(summary.net) < 0
                  ? "Net Deficit"
                  : "Balanced"
              : "Income minus expenses"
          }
          icon={Scale}
          tone={
            summary && Number(summary.net) < 0
              ? "danger"
              : summary && Number(summary.net) > 0
                ? "good"
                : "neutral"
          }
          definition="Posted operating income minus posted operating expenses. This is not cash on hand, bank balance or available funds."
          onSelect={() =>
            setPanel({ kind: "net", title: "Net operating result" })
          }
          onInfo={() =>
            setPanel({ kind: "net", title: "Net operating result" })
          }
        />
        <Metric
          title="Financial Records for Review"
          value={overview.loading ? "…" : count(report?.review.records)}
          caption="Unposted or record issues"
          icon={ShieldAlert}
          tone={report?.review.records ? "warning" : "neutral"}
          definition="Distinct ledger Income/Expense records with an unposted active status, incompatible classification, broken source, duplicate posting or inconsistent correction/reversal relationship. The review conditions can overlap; the headline counts each record once."
          onSelect={() =>
            selectActivity({
              view: "review",
              reviewKind: "",
              focusCategoryId: "",
              focusSource: "",
            })
          }
          onInfo={() =>
            setPanel({ kind: "review", title: "Records requiring attention" })
          }
        />
      </section>
      {report && (
        <div className={styles.comparison}>
          {comparison("income")} income · {comparison("expense")} expenses ·{" "}
          {comparison("net")} net
          {report.period.previous
            ? ` · comparison ${rangeText(report.period.previous)}`
            : ""}
        </div>
      )}
      <section className={styles.panel} aria-label="Money In vs Money Out">
        <div className={styles.toolbar}>
          <h2>Money In vs Money Out</h2>
          <div className="min-w-40">
            <MonitorSelect
              label="Trend interval"
              value={query.granularity}
              options={[
                ["month", "Monthly"],
                ["quarter", "Quarterly"],
                ["year", "Yearly"],
                ["day", "Daily · short ranges"],
              ]}
              onChange={(v) => patch({ granularity: v })}
            />
          </div>
        </div>
        <div className={styles.legend}>
          <span>
            <i style={{ background: "#1f6b43" }} />
            Income
          </span>
          <span>
            <i style={{ background: "#b27c13" }} />
            Expenses
          </span>
        </div>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={report?.trend ?? []}
              margin={{ left: 8, right: 8, top: 10, bottom: 6 }}
            >
              <CartesianGrid vertical={false} stroke="#e5ece5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={28} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  new Intl.NumberFormat("en-PH", {
                    notation: "compact",
                  }).format(v)
                }
                width={62}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                maxBarSize={72}
                name="Income"
                dataKey="income"
                fill="#1f6b43"
                isAnimationActive={false}
                onClick={(data) => {
                  const point = (data as unknown as { payload?: TrendPoint })
                    .payload;
                  if (point)
                    selectActivity({
                      view: "posted",
                      focusStart: point.startDate,
                      focusEnd: point.endDate,
                      focusCategoryId: "",
                      focusSource: "",
                      reviewKind: "",
                    });
                }}
              />
              <Bar
                maxBarSize={72}
                name="Expenses"
                dataKey="expense"
                fill="#b27c13"
                isAnimationActive={false}
                onClick={(data) => {
                  const point = (data as unknown as { payload?: TrendPoint })
                    .payload;
                  if (point)
                    selectActivity({
                      view: "posted",
                      focusStart: point.startDate,
                      focusEnd: point.endDate,
                      focusCategoryId: "",
                      focusSource: "",
                      reviewKind: "",
                    });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!report?.trend.some((p) => p.records > 0) && (
          <p className={styles.hint}>
            {overview.loading
              ? "Loading posted activity…"
              : "No eligible posted activity in this period."}
          </p>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold">
            View trend figures and period records
          </summary>
          <div className={`${styles.tableRegion} mt-3`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th className={styles.numeric}>Money In</th>
                  <th className={styles.numeric}>Money Out</th>
                  <th className={styles.numeric}>Net</th>
                  <th className={styles.numeric}>Records</th>
                </tr>
              </thead>
              <tbody>
                {report?.trend.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <button
                        type="button"
                        className={styles.recordNumber}
                        aria-label={`View activity for ${p.label}`}
                        onClick={() =>
                          selectActivity({
                            view: "posted",
                            focusStart: p.startDate,
                            focusEnd: p.endDate,
                            focusCategoryId: "",
                            focusSource: "",
                            reviewKind: "",
                          })
                        }
                      >
                        {p.label}
                      </button>
                    </td>
                    <td className={styles.numeric}>{peso(p.income)}</td>
                    <td className={styles.numeric}>{peso(p.expense)}</td>
                    <td className={styles.numeric}>{peso(p.net)}</td>
                    <td className={styles.numeric}>{count(p.records)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel} aria-label="Where Money Comes From">
          <h2>Where Money Comes From</h2>
          {ranks(report?.categories.income ?? [], "income")}
        </section>
        <section className={styles.panel} aria-label="Where Money Goes">
          <h2>Where Money Goes</h2>
          {ranks(report?.categories.expense ?? [], "expense")}
        </section>
      </div>
      <section className={styles.panel} aria-label="Financial source modules">
        <h2>Financial source modules</h2>
        <p className={`${styles.hint} mb-3`}>
          Net is recorded income less attributed expenses. It is not
          departmental profitability.
        </p>
        <div className={styles.tableRegion}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th className={styles.numeric}>Income</th>
                <th className={styles.numeric}>Expenses</th>
                <th className={styles.numeric}>Recorded net</th>
                <th className={styles.numeric}>Records</th>
              </tr>
            </thead>
            <tbody>
              {report?.sources.map((r) => (
                <tr key={r.source}>
                  <td>
                    <button
                      type="button"
                      className={styles.recordNumber}
                      aria-label={`View ${r.source} financial activity`}
                      onClick={() =>
                        selectActivity({
                          view: "posted",
                          focusSource: r.source,
                          focusCategoryId: "",
                          focusStart: "",
                          focusEnd: "",
                          reviewKind: "",
                        })
                      }
                    >
                      {r.source}
                    </button>
                  </td>
                  <td className={styles.numeric}>{peso(r.income)}</td>
                  <td className={styles.numeric}>{peso(r.expense)}</td>
                  <td className={styles.numeric}>{peso(r.net)}</td>
                  <td className={styles.numeric}>{count(r.records)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!report?.sources.length && (
          <p className={`${styles.hint} mt-3`}>
            No posted source activity matches these filters.
          </p>
        )}
      </section>
      <section
        id="overview-activity"
        tabIndex={-1}
        className={styles.panel}
        aria-label="Financial Activity"
      >
        <div className={`${styles.toolbar} mb-3`}>
          <h2>Financial Activity</h2>
          <Signal
            label={
              query.view === "posted"
                ? "Posted Income & Expenses"
                : query.view === "income"
                  ? "Income records"
                  : query.view === "expense"
                    ? "Expense records"
                    : query.view === "review"
                      ? "Records for review"
                      : query.view === "adjustments"
                        ? "Adjustment history"
                        : "Audit history"
            }
            tone="neutral"
          />
        </div>
        {activity.error && (
          <p role="alert" className={styles.error}>
            {activity.error}
          </p>
        )}
        {activity.loading && (
          <p role="status" className={styles.hint}>
            Loading financial activity…
          </p>
        )}
        {query.view !== "posted" && (
          <button
            type="button"
            className={`${styles.chip} mb-3`}
            onClick={() =>
              patch({
                view: "posted",
                posting: "",
                recordStatus: "",
                focusCategoryId: "",
                focusSource: "",
                focusStart: "",
                focusEnd: "",
                reviewKind: "",
              })
            }
          >
            Show all posted activity
          </button>
        )}
        <div
          className={`${styles.tableRegion} ${styles.desktopTable}`}
          tabIndex={0}
          role="region"
          aria-label="Financial Activity table"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Record number</th>
                <th>Transaction type</th>
                <th>Category</th>
                <th>Source</th>
                <th className={styles.numeric}>Amount</th>
                <th>Posting status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {activity.data?.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>
                    <button
                      className={styles.recordNumber}
                      type="button"
                      onClick={() => openRecord(r)}
                    >
                      {r.number}
                    </button>
                  </td>
                  <td>
                    <span className={styles.actions}>
                      {r.type === "Income" ? (
                        <ArrowDownLeft className="size-4" aria-hidden="true" />
                      ) : r.type === "Expense" ? (
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      ) : (
                        <Info className="size-4" aria-hidden="true" />
                      )}
                      {r.type === "Income"
                        ? "Money In"
                        : r.type === "Expense"
                          ? "Money Out"
                          : "Adjustment"}
                    </span>
                  </td>
                  <td>{r.category}</td>
                  <td>{r.source}</td>
                  <td className={styles.numeric}>{peso(r.amount)}</td>
                  <td>
                    <Signal
                      label={posting(r)}
                      tone={
                        r.status === "Active"
                          ? r.posted
                            ? "good"
                            : "warning"
                          : "neutral"
                      }
                    />
                    {r.review && <small>Review needed</small>}
                  </td>
                  <td>{rowActions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.mobileRows}>
          {activity.data?.items.map((r) => (
            <article key={r.id} className={styles.recordCard}>
              <div className={styles.toolbar}>
                <button
                  className={styles.recordNumber}
                  type="button"
                  onClick={() => openRecord(r)}
                >
                  {r.number}
                </button>
                <strong>{peso(r.amount)}</strong>
              </div>
              <div className={styles.toolbar}>
                <span className={styles.hint}>
                  {r.date} ·{" "}
                  {r.type === "Income"
                    ? "Money In"
                    : r.type === "Expense"
                      ? "Money Out"
                      : "Adjustment"}
                </span>
                <Signal
                  label={posting(r)}
                  tone={r.posted ? "good" : "warning"}
                />
              </div>
              <p className={styles.hint}>
                {r.category} · {r.source}
              </p>
              <div className={styles.toolbar}>
                <span className={styles.hint}>
                  {r.review
                    ? "Review needed"
                    : r.eligible
                      ? "Included in posted totals"
                      : "Audit record · excluded from posted totals"}
                </span>
                {rowActions(r)}
              </div>
            </article>
          ))}
        </div>
        {!activity.loading && !activity.data?.items.length && (
          <p role="status" className={`${styles.notice} mt-3`}>
            No financial records match this activity view. Change the filters or
            return to posted activity.
          </p>
        )}
        <MonitorPagination
          page={activity.data?.page ?? 1}
          pageSize={Number(query.pageSize)}
          total={activity.data?.total ?? 0}
          loading={activity.loading}
          onPage={(page) => patch({ page: String(page) })}
        />
      </section>
      <section
        className={styles.panel}
        aria-label="Records Requiring Attention"
      >
        <div className={styles.toolbar}>
          <h2>Records Requiring Attention</h2>
          <button
            type="button"
            className={styles.actions}
            onClick={() =>
              setPanel({ kind: "review", title: "Record verification rules" })
            }
          >
            <Info className="size-4" aria-hidden="true" />
            Definitions
          </button>
        </div>
        <div className={`${styles.actions} mt-3`}>
          {[
            ["unpostedIncome", "Unposted income"],
            ["unpostedExpense", "Unposted expenses"],
            ["classification", "Classification review"],
            ["source", "Source/posting review"],
            ["relationships", "Correction/reversal links"],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={styles.chip}
              onClick={() =>
                selectActivity({
                  view: "review",
                  reviewKind: key,
                  focusCategoryId: "",
                  focusSource: "",
                  focusStart: "",
                  focusEnd: "",
                })
              }
            >
              {label}{" "}
              {count(report?.review[key as keyof OverviewReport["review"]])}
            </button>
          ))}
          <Link
            className={styles.chip}
            href="/portal/chairman/payments?view=exceptions"
          >
            Inspect payment posting exceptions
          </Link>
        </div>
      </section>
      {summary && (
        <p className={styles.observations}>
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {Number(summary.net) > 0
            ? "Recorded posted income exceeded expenses in this period."
            : Number(summary.net) < 0
              ? "Recorded posted expenses exceeded income in this period."
              : "Recorded posted income and expenses are balanced in this period."}{" "}
          <Link
            href="/portal/chairman/financial-dashboard"
            className="font-semibold underline underline-offset-4"
          >
            Financial Analytics
          </Link>
        </p>
      )}
      <MonitorDrawer
        description="Posted financial records and supporting information. Read-only for the Chairman."
        title={panel?.title ?? "Financial details"}
        open={Boolean(panel)}
        onClose={() => setPanel(null)}
      >
        {panel && panel.kind !== "record" && (
          <>
            <p className={styles.notice}>{definition}</p>
            <dl className={styles.definition}>
              <dt>Reporting period</dt>
              <dd>{period}</dd>
              <dt>Money In</dt>
              <dd>
                {peso(summary?.income)} · {count(summary?.incomeRecords)} posted
                income records
              </dd>
              <dt>Money Out</dt>
              <dd>
                {peso(summary?.expense)} · {count(summary?.expenseRecords)}{" "}
                posted expense records
              </dd>
              <dt>Net Operating Result</dt>
              <dd>
                {peso(summary?.net)} = posted income minus posted expenses. This
                is not an available cash balance.
              </dd>
              <dt>Comparison</dt>
              <dd>
                {report?.period.previous
                  ? rangeText(report.period.previous)
                  : (report?.period.comparisonReason ?? "None")}
                . Partial periods compare the elapsed part with the
                corresponding previous window. Percentage change is N/A without
                a positive previous base.
              </dd>
              <dt>Reconciliation</dt>
              <dd>
                {report && Object.values(report.reconciliation).every(Boolean)
                  ? "Income and expense category/source totals agree with their headline totals."
                  : "Unavailable or requires review."}
              </dd>
              <dt>Review count</dt>
              <dd>
                {count(report?.review.records)} distinct records. Conditions can
                overlap. Ordinary voided history is not automatically a problem.{" "}
                {count(report?.review.excluded)} approved active records are
                excluded by their recorded classification or source
                relationship.
              </dd>
              <dt>Cash and posting limits</dt>
              <dd>
                Financial records show recorded postings. Author names and
                receipt references do not prove all cash movements; no
                historical as-posted snapshot, verified cash ledger or forecast
                is fabricated.
              </dd>
            </dl>
            <div className={styles.actions}>
              <Button
                onClick={() => {
                  setPanel(null);
                  selectActivity({ view: "income", reviewKind: "" });
                }}
              >
                View income records
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPanel(null);
                  selectActivity({ view: "expense", reviewKind: "" });
                }}
              >
                View expense records
              </Button>
            </div>
            {(panel.kind === "income" || panel.kind === "expense") && (
              <div>
                <h3>
                  {panel.kind === "income"
                    ? "Income categories"
                    : "Expense categories"}
                </h3>
                {ranks(report?.categories[panel.kind] ?? [], panel.kind, true)}
              </div>
            )}
          </>
        )}
        {panel?.kind === "record" && (
          <>
            {detailError && (
              <p role="alert" className={styles.error}>
                {detailError}
              </p>
            )}
            {!detail && !detailError && (
              <p role="status">Loading financial record…</p>
            )}
            {detail && (
              <>
                <dl className={styles.definition}>
                  <dt>Record</dt>
                  <dd>{detail.number}</dd>
                  <dt>Type</dt>
                  <dd>{detail.type}</dd>
                  <dt>Amount</dt>
                  <dd>{peso(detail.amount)}</dd>
                  <dt>Record date</dt>
                  <dd>{detail.date}</dd>
                  <dt>Category</dt>
                  <dd>
                    {detail.category} · {detail.categoryCode}
                  </dd>
                  <dt>Source</dt>
                  <dd>
                    {detail.source} · ID {detail.sourceId ?? "not recorded"}
                  </dd>
                  <dt>Posting</dt>
                  <dd>
                    {posting(detail)} ·{" "}
                    {detail.eligible ? "included" : "excluded"} from operating
                    totals
                  </dd>
                  <dt>Recorded by</dt>
                  <dd>{detail.recordedBy.name}</dd>
                  <dt>Posted by</dt>
                  <dd>{detail.approvedBy?.name ?? "Not posted"}</dd>
                  <dt>Season</dt>
                  <dd>{detail.season?.name ?? "Not recorded / unavailable"}</dd>
                  <dt>Remarks</dt>
                  <dd className="whitespace-pre-wrap">
                    {detail.remarks ?? "Not recorded"}
                  </dd>
                  <dt>Created</dt>
                  <dd>{detail.createdAt} UTC</dd>
                </dl>
                {detail.review && (
                  <p className={styles.notice}>
                    Review required:{" "}
                    {[
                      !detail.posted ? "unposted" : "",
                      detail.classificationReview
                        ? "classification/amount"
                        : "",
                      detail.sourceReview ? "source or duplicate posting" : "",
                      detail.relationshipReview
                        ? "correction/reversal linkage"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    . Monitoring does not repair the record.
                  </p>
                )}
                {detail.payment && (
                  <section>
                    <h3>Source payment</h3>
                    <p className={styles.hint}>
                      {String(detail.payment.reference)} ·{" "}
                      {String(detail.payment.status)} ·{" "}
                      {detail.payment.channel === "PayMongo"
                        ? "QRPH"
                        : String(detail.payment.channel)}{" "}
                      · {String(detail.payment.environment)}
                    </p>
                  </section>
                )}
                <div className={styles.actions}>
                  {sourceLink(detail) &&
                    (!detail.paymentReferenceId || detail.payment) && (
                      <Link className={styles.chip} href={sourceLink(detail)!}>
                        Open source records
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Link>
                    )}
                  <Link
                    className={styles.chip}
                    href={`/portal/chairman/financial-ledger?search=${encodeURIComponent(detail.number)}`}
                  >
                    Inspect Financial Ledger
                  </Link>
                </div>
                <section>
                  <h3>Correction and reversal relationships</h3>
                  {detail.related.length ? (
                    detail.related.map((r, i) => (
                      <p className={styles.hint} key={String(r.id ?? i)}>
                        <button
                          className={styles.recordNumber}
                          type="button"
                          onClick={() => {
                            setDetail(null);
                            setPanel({
                              kind: "record",
                              title: String(r.number),
                              recordId: String(r.id),
                            });
                          }}
                        >
                          {String(r.number)}
                        </button>{" "}
                        · {String(r.type)} · {String(r.status)} ·{" "}
                        {peso(String(r.amount))}
                      </p>
                    ))
                  ) : (
                    <p className={styles.hint}>
                      No linked corrections or reversals recorded.
                    </p>
                  )}
                </section>
                <section>
                  <h3>Supporting documents</h3>
                  {detail.documents.length ? (
                    detail.documents.map((d) => (
                      <Link
                        className={`${styles.chip} mr-2`}
                        key={String(d.id)}
                        href={`/portal/chairman/documents/${String(d.id)}`}
                      >
                        {String(d.title)}
                      </Link>
                    ))
                  ) : (
                    <p className={styles.hint}>
                      {detail.documentAssociationsAvailable
                        ? "No directly associated authorized documents."
                        : "This schema has no direct financial-document association; inspect authorized source receipts instead."}
                    </p>
                  )}
                  <p className={`${styles.hint} mt-2`}>{detail.evidenceNote}</p>
                </section>
                <section>
                  <h3>Recorded audit history</h3>
                  {detail.history.length ? (
                    detail.history.map((h, i) => (
                      <p key={i} className={`${styles.hint} mb-2`}>
                        {String(h.at)} UTC · {String(h.actor ?? "Unknown user")}{" "}
                        · {String(h.action)}
                        <br />
                        {String(h.description ?? "")}
                      </p>
                    ))
                  ) : (
                    <p className={styles.hint}>
                      No associated audit entries found.
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </MonitorDrawer>
    </div>
  );
}
