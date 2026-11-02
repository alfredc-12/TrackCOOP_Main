"use client";

import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/Button";
import { ClassificationBadge, Pagination, SelectField } from "./RfmControls";
import { chartableRfmHistory, compareRfmSnapshots } from "./rfm-history";
import {
  date,
  downloadRfm,
  errorMessage,
  getEvidence,
  getHistory,
  memberLink,
  number,
  peso,
  type RfmFilters,
  type RfmHistory,
  type RfmMemberRow,
  type RfmSettings,
  type RfmSnapshotMetadata,
} from "./rfm-client";
import styles from "./RfmWorkspace.module.css";

export function ScoringRules({ settings }: { settings: RfmSettings }) {
  return (
    <div className="grid gap-3">
      <div
        className={styles.tableRegion}
        tabIndex={0}
        aria-label="Configured RFM thresholds"
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Configured first-match thresholds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Recency</th>
              <td>
                {settings.thresholds.recencyDays
                  .map((t) => `≤ ${number(t.max)} days: ${t.score}/5`)
                  .join(" · ")}
                ; otherwise or none: 1/5
              </td>
            </tr>
            <tr>
              <th scope="row">Frequency</th>
              <td>
                {settings.thresholds.frequencyCount
                  .map((t) => `≥ ${number(t.min)} participations: ${t.score}/5`)
                  .join(" · ")}
                ; otherwise: 1/5
              </td>
            </tr>
            <tr>
              <th scope="row">Contribution</th>
              <td>
                {settings.thresholds.contributionAmount
                  .map((t) => `≥ ${peso(t.min)}: ${t.score}/5`)
                  .join(" · ")}
                ; otherwise: 1/5
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.muted}>
        Total = R + F + C (3–15). Active: total ≥ {settings.labels.activeMin};
        Needs Monitoring: total ≥ {settings.labels.needsMonitoringMin};
        otherwise Inactive. The inactivity safeguard overrides these labels when
        frequency is zero and recency is absent or exceeds 365 days.
      </p>
      <p className={styles.muted}>
        Qualifying participation statuses:{" "}
        {settings.qualifyingParticipationStatuses.join(", ")}. Version:{" "}
        {settings.formulaVersion}.
      </p>
    </div>
  );
}
function EvidenceTables({ metadata }: { metadata: RfmSnapshotMetadata }) {
  const [participationPage, setParticipationPage] = useState(1),
    [paymentPage, setPaymentPage] = useState(1);
  const e = metadata.evidence;
  return (
    <div className="grid gap-5">
      <dl className={styles.definition}>
        <dt>Last qualifying participation</dt>
        <dd>{date(e.lastParticipation)}</dd>
        <dt>Recency calculation</dt>
        <dd>
          {metadata.rawMetrics.recencyDays === null
            ? "No qualifying participation recorded"
            : `${metadata.rawMetrics.recencyDays} days from participation to ${date(metadata.basisPeriod.end)}`}
        </dd>
        <dt>Frequency in period</dt>
        <dd>{e.frequencyInPeriod}</dd>
        <dt>Qualifying through basis (all time)</dt>
        <dd>
          {e.qualifyingAllTimeThroughBasis}; this can differ from Frequency.
        </dd>
        <dt>Validated contribution</dt>
        <dd>
          {peso(metadata.rawMetrics.contributionAmount)} from{" "}
          {e.validatedPaymentCount} eligible payments.
        </dd>
      </dl>
      <h3>Participation evidence</h3>
      <p className={styles.muted}>
        Source: member_activity_participation joined once to
        cooperative_activities. Saved source identifiers and statuses are shown
        below.
      </p>
      {e.participation.length ? (
        <>
          <div
            className={styles.tableRegion}
            tabIndex={0}
            aria-label="Saved participation evidence"
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Source / activity</th>
                  <th scope="col">Participation date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Calculation treatment</th>
                </tr>
              </thead>
              <tbody>
                {e.participation
                  .slice((participationPage - 1) * 25, participationPage * 25)
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        #{p.id} · {p.activity}
                        <small>Activity #{p.activityId}</small>
                      </td>
                      <td>{date(p.date)}</td>
                      <td>{p.status}</td>
                      <td>{p.reason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={participationPage}
            pageSize={25}
            total={e.participation.length}
            onPage={setParticipationPage}
          />
        </>
      ) : (
        <p className={styles.notice}>
          No participation records were present through this calculation’s basis
          date. This is recorded absence, not proof that activity data is
          complete.
        </p>
      )}
      <h3>Contribution evidence</h3>
      <p className={styles.muted}>
        Source: share_capital_payments through basis end. Ledger interest,
        reversals and other capital adjustments do not contribute to this RFM
        component.
      </p>
      {e.contributions.length ? (
        <>
          <div
            className={styles.tableRegion}
            tabIndex={0}
            aria-label="Saved contribution evidence"
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Payment</th>
                  <th scope="col">Date</th>
                  <th scope="col" className={styles.numeric}>
                    Amount
                  </th>
                  <th scope="col">Status / treatment</th>
                </tr>
              </thead>
              <tbody>
                {e.contributions
                  .slice((paymentPage - 1) * 25, paymentPage * 25)
                  .map((p) => (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>{date(p.date)}</td>
                      <td className={styles.numeric}>{peso(p.amount)}</td>
                      <td>
                        {p.status}
                        <small>{p.reason}</small>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={paymentPage}
            pageSize={25}
            total={e.contributions.length}
            onPage={setPaymentPage}
          />
        </>
      ) : (
        <p className={styles.notice}>
          No share-capital payment records were present through this
          calculation’s basis date. A true zero and incomplete operational
          records require human verification.
        </p>
      )}
    </div>
  );
}
export function RfmHistoryView({
  member,
  filters,
  onInspect,
}: {
  member: RfmMemberRow;
  filters: RfmFilters;
  onInspect: (row: RfmMemberRow) => void;
}) {
  const [page, setPage] = useState(1),
    [result, setResult] = useState<RfmHistory | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [exporting, setExporting] = useState(false);
  const [firstId, setFirstId] = useState(""),
    [nextId, setNextId] = useState("");
  const [series, setSeries] = useState([
    "totalScore",
    "recencyScore",
    "frequencyScore",
    "contributionScore",
  ]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getHistory(member.memberId, page, controller.signal)
        .then(setResult)
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorMessage(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [member.memberId, page, retry]);
  if (error)
    return (
      <div role="alert" className="grid gap-3">
        <p className={styles.error}>{error}</p>
        <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
          Retry history
        </Button>
      </div>
    );
  if (loading || !result) return <p role="status">Loading saved history…</p>;
  if (!result.rows.length)
    return (
      <p className={styles.notice}>
        No saved RFM calculations are available for this member.
      </p>
    );
  const rows = result.rows,
    chart = chartableRfmHistory(rows);
  const first =
      rows.find((r) => r.indicatorId === firstId) ?? rows[rows.length - 1],
    next = rows.find((r) => r.indicatorId === nextId) ?? rows[0];
  const comparison = compareRfmSnapshots(first, next);
  const options = rows.map((r) => ({
    value: r.indicatorId!,
    label: `${date(r.basisEnd)} · ${r.totalScore ?? "unscored"}/15 · #${r.indicatorId}`,
  }));
  const seriesLabels = {
    totalScore: "Total",
    recencyScore: "Recency",
    frequencyScore: "Frequency",
    contributionScore: "Contribution",
  };
  return (
    <div className="grid gap-5">
      <div className={styles.toolbar}>
        <p className={styles.muted}>
          {result.total} saved observations. Ordered by basis end; calculation
          time is shown separately.
        </p>
        <Button
          variant="secondary"
          loading={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadRfm(filters, member.memberId);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setExporting(false);
            }
          }}
        >
          Export complete history
        </Button>
      </div>
      {chart.comparable ? (
        <>
          <div className={styles.actions}>
            {Object.entries(seriesLabels).map(([key, label]) => (
              <label
                key={key}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={series.includes(key)}
                  onChange={(e) =>
                    setSeries((current) =>
                      e.target.checked
                        ? [...current, key]
                        : current.filter((k) => k !== key),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div
            className={styles.chart}
            aria-label="Comparable RFM scores by saved basis date"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart.rows} accessibilityLayer>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--coop-border, #cad8cb)"
                />
                <XAxis dataKey="basisEnd" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 15]} width={30} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {Object.entries(seriesLabels)
                  .filter(([key]) => series.includes(key))
                  .map(([key, name], index) => (
                    <Line
                      key={key}
                      dataKey={key}
                      name={name}
                      stroke="var(--coop-green, #1f6b43)"
                      strokeWidth={key === "totalScore" ? 3 : 1.5}
                      strokeDasharray={
                        key === "totalScore" ? undefined : `${2 + index * 3} 3`
                      }
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.muted}>
            Chart covers the loaded history page. One most recently computed
            observation per basis period; missing periods are not interpolated
            or invented. The table is the text alternative.
          </p>
        </>
      ) : (
        <p className={styles.notice}>
          A connected trend requires at least two distinct basis periods with
          the same preserved configuration and formula. Saved observations
          remain available below.
        </p>
      )}
      <div className={styles.filterGrid}>
        <SelectField
          label="Earlier observation"
          value={first.indicatorId!}
          options={options}
          onChange={setFirstId}
        />
        <SelectField
          label="Later observation"
          value={next.indicatorId!}
          options={options}
          onChange={setNextId}
        />
      </div>
      {comparison.comparable ? (
        <p className={styles.notice}>
          Total {comparison.total >= 0 ? "+" : ""}
          {comparison.total}; Recency {comparison.recency >= 0 ? "+" : ""}
          {comparison.recency}; Frequency {comparison.frequency >= 0 ? "+" : ""}
          {comparison.frequency}; Contribution{" "}
          {comparison.contribution >= 0 ? "+" : ""}
          {comparison.contribution}. {comparison.transition}. These are
          descriptive changes between saved periods.
        </p>
      ) : (
        <p className={styles.notice}>{comparison.reason}</p>
      )}
      <div
        className={styles.tableRegion}
        tabIndex={0}
        aria-label="Saved RFM score history"
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Basis period</th>
              <th scope="col">R / F / C</th>
              <th scope="col">Total / classification</th>
              <th scope="col">Calculated / version</th>
              <th scope="col">Inspect</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.indicatorId}>
                <td>
                  {date(row.basisEnd)}
                  <small>From {date(row.basisStart)}</small>
                </td>
                <td>
                  {row.recencyScore} / {row.frequencyScore} /{" "}
                  {row.contributionScore}
                </td>
                <td>
                  {row.totalScore ?? "—"}/15
                  <br />
                  <ClassificationBadge classification={row.classification} />
                </td>
                <td>
                  {date(row.computedAt)}
                  <small>
                    {row.computedAt} · {row.scoringVersion}
                  </small>
                  {!row.configurationFingerprint && (
                    <small>Original configuration unavailable</small>
                  )}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Inspect saved score ${row.indicatorId}`}
                    onClick={() => onInspect(row)}
                  >
                    Inspect
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={50}
        total={result.total}
        onPage={(value) => {
          setFirstId("");
          setNextId("");
          setPage(value);
        }}
      />
    </div>
  );
}
export function RfmDetails({
  row,
  filters,
  initialTab,
  onInspect,
  onRecalculate,
}: {
  row: RfmMemberRow;
  filters: RfmFilters;
  initialTab: string;
  onInspect: (row: RfmMemberRow) => void;
  onRecalculate: (row: RfmMemberRow) => void;
}) {
  const [tab, setTab] = useState(initialTab),
    [source, setSource] = useState<{
      metadata: RfmSnapshotMetadata | null;
      message: string;
    } | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!row.indicatorId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setError("");
      getEvidence(row, controller.signal)
        .then(setSource)
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorMessage(e));
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [row, retry]);
  const metadata = source?.metadata;
  return (
    <div className="grid gap-5">
      <div className={styles.toolbar}>
        <ClassificationBadge classification={row.classification} />
        <span>
          {row.totalScore === null ? "No valid score" : `${row.totalScore}/15`}
        </span>
        <Link href={memberLink(row, filters)} className={styles.scoreButton}>
          View Member Profile
        </Link>
        <Button variant="secondary" onClick={() => onRecalculate(row)}>
          Recalculate Member
        </Button>
      </div>
      <p className={styles.muted}>
        {row.memberCode} · {row.membershipType} · Official membership status:{" "}
        {row.officialMemberStatus}. RFM is an advisory engagement label.
      </p>
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className={styles.tabs} aria-label="Member RFM details">
          {[
            ["overview", "Score Overview"],
            ["evidence", "Raw Evidence"],
            ["history", "Score History"],
            ["calculation", "Calculation Information"],
          ].map(([value, label]) => (
            <Tabs.Trigger key={value} value={value}>
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="overview" className="mt-5 grid gap-5">
          <dl className={styles.definition}>
            <dt>Recency</dt>
            <dd>
              {row.recencyScore === null
                ? "Not scored"
                : `${row.recencyScore}/5 · ${row.recencyDays === null ? "No qualifying participation" : `${row.recencyDays} days`}`}
            </dd>
            <dt>Frequency</dt>
            <dd>
              {row.frequencyScore === null
                ? "Not scored"
                : `${row.frequencyScore}/5 · ${row.frequencyCount} participations in the basis period`}
            </dd>
            <dt>Contribution</dt>
            <dd>
              {row.contributionScore === null
                ? "Not scored"
                : `${row.contributionScore}/5 · ${peso(row.validatedShareCapital)} validated contributions through basis`}
            </dd>
            <dt>Lowest component(s)</dt>
            <dd>
              {row.lowestComponents.length
                ? `${row.lowestComponents.join(" and ")} ${row.lowestComponents.length > 1 ? "are tied for the lowest score" : "is the lowest-scoring component"}. This is descriptive, not a predicted outcome.`
                : "No component scores available"}
            </dd>
            <dt>Calculation basis</dt>
            <dd>
              {date(row.basisStart)} – {date(row.basisEnd)}
            </dd>
            <dt>Calculation date</dt>
            <dd>{date(row.computedAt)}</dd>
            <dt>Quality</dt>
            <dd>{row.quality}</dd>
          </dl>
          {metadata && (
            <>
              <p className={styles.notice}>{metadata.scoring.explanation}</p>
              <h3>Thresholds saved with this observation</h3>
              <ScoringRules settings={metadata.configuration} />
            </>
          )}
          {!row.indicatorId && (
            <p className={styles.notice}>
              This eligible member has no saved indicator for the selected
              context. No Inactive RFM label has been assigned.
            </p>
          )}
          {source && !metadata && (
            <p className={styles.notice}>
              The original threshold configuration is unavailable for this
              legacy observation. Its saved score remains unchanged.
            </p>
          )}
        </Tabs.Content>
        <Tabs.Content value="evidence" className="mt-5 grid gap-5">
          {metadata ? (
            <>
              <p className={styles.notice}>{source.message}</p>
              <EvidenceTables metadata={metadata} />
            </>
          ) : (
            <p className={styles.notice}>
              {row.indicatorId
                ? (source?.message ?? "Loading saved source evidence…")
                : "No calculation evidence exists for this unscored member."}
            </p>
          )}
        </Tabs.Content>
        <Tabs.Content value="history" className="mt-5">
          <RfmHistoryView
            member={row}
            filters={filters}
            onInspect={onInspect}
          />
        </Tabs.Content>
        <Tabs.Content value="calculation" className="mt-5 grid gap-5">
          <dl className={styles.definition}>
            <dt>Saved indicator ID</dt>
            <dd>{row.indicatorId ?? "None"}</dd>
            <dt>Version</dt>
            <dd>{row.scoringVersion ?? "Unavailable"}</dd>
            <dt>Configuration fingerprint</dt>
            <dd>
              {row.configurationFingerprint ??
                "Not preserved for this observation"}
            </dd>
            <dt>Run reference</dt>
            <dd>{metadata?.runId ?? "Not preserved"}</dd>
            <dt>Calculated by user ID</dt>
            <dd>{row.computedBy ?? "Not recorded"}</dd>
            <dt>Computed timestamp</dt>
            <dd>{row.computedAt ?? "Not recorded"}</dd>
            <dt>Basis</dt>
            <dd>
              {date(row.basisStart)} – {date(row.basisEnd)}
            </dd>
            <dt>Calculation age</dt>
            <dd>{number(row.calculationAgeDays, 0)} days</dd>
            <dt>Basis age</dt>
            <dd>{number(row.basisAgeDays, 0)} days</dd>
            <dt>Source freshness</dt>
            <dd>
              Not independently verified. Elapsed time alone does not prove
              staleness.
            </dd>
            <dt>Safeguard</dt>
            <dd>
              {metadata
                ? metadata.scoring.safeguardApplied
                  ? "Applied"
                  : "Not applied"
                : "Original safeguard metadata unavailable"}
            </dd>
          </dl>
          {metadata && <ScoringRules settings={metadata.configuration} />}
        </Tabs.Content>
      </Tabs.Root>
      {error && (
        <div role="alert">
          <p className={styles.error}>{error}</p>
          <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
            Retry evidence
          </Button>
        </div>
      )}
    </div>
  );
}
