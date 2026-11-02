"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ClassificationBadge,
  Pagination,
  SelectField,
  classificationOptions,
} from "./RfmControls";
import { ScoringRules } from "./RfmDetails";
import {
  date,
  errorMessage,
  getRuns,
  getWorkspace,
  number,
  percent,
  type RfmComponent,
  type RfmFilters,
  type RfmRun,
  type RfmWorkspace,
} from "./rfm-client";
import styles from "./RfmWorkspace.module.css";

export const componentNames: Record<RfmComponent, string> = {
  recencyScore: "Recency",
  frequencyScore: "Frequency",
  contributionScore: "Contribution",
};
export function RfmMatrix({
  data,
  busy,
  onChange,
  onSelect,
  onExport,
}: {
  data: RfmWorkspace;
  busy: boolean;
  onChange: (patch: Partial<RfmFilters>) => void;
  onSelect: (r: number, f: number) => void;
  onExport: () => void;
}) {
  const [focused, setFocused] = useState<RfmWorkspace["matrix"][number] | null>(
    null,
  );
  const max = Math.max(...data.matrix.map((c) => c.count), 1);
  return (
    <div className="grid gap-5" aria-busy={busy}>
      <p className={styles.notice}>
        Each cell counts distinct scored members. {data.summary.scored} scored
        members in the selected population. Select a cell to apply Recency and
        Frequency filters to the main table.
      </p>
      <div className={styles.filterGrid}>
        <SelectField
          label="Matrix Contribution score"
          value={String(data.filters.contributionScore ?? "")}
          options={[
            { value: "", label: "Any Contribution score" },
            ...[1, 2, 3, 4, 5].map((n) => ({
              value: String(n),
              label: `${n}/5`,
            })),
          ]}
          onChange={(v) =>
            onChange({ contributionScore: v ? Number(v) : undefined })
          }
        />
        <SelectField
          label="Matrix classification"
          value={data.filters.classification ?? ""}
          options={classificationOptions}
          onChange={(v) =>
            onChange({
              classification: (v as RfmFilters["classification"]) || undefined,
            })
          }
        />
        <SelectField
          label="Matrix membership type"
          value={data.filters.membershipType ?? ""}
          options={[
            { value: "", label: "All membership types" },
            "Associate",
            "True Member",
          ]}
          onChange={(v) =>
            onChange({
              membershipType: (v as RfmFilters["membershipType"]) || undefined,
            })
          }
        />
        <SelectField
          label="Matrix barangay"
          value={data.filters.barangay ?? ""}
          options={[
            { value: "", label: "All barangays" },
            ...data.options.barangays,
          ]}
          onChange={(v) => onChange({ barangay: v || undefined })}
        />
        <SelectField
          label="Matrix sector"
          value={data.filters.sector ?? ""}
          options={[
            { value: "", label: "All sectors" },
            ...data.options.sectors,
          ]}
          onChange={(v) => onChange({ sector: v || undefined })}
        />
      </div>
      <p className={styles.muted}>
        Snapshot:{" "}
        {data.filters.context === "current"
          ? "Latest basis for each member (may contain mixed periods)"
          : data.filters.context === "run"
            ? `Saved run ${data.filters.runId}`
            : date(data.filters.basisEnd ?? null)}
        . Filters are shared with the main results.
      </p>
      {busy && <p role="status">Updating matrix…</p>}
      <div
        className={styles.matrix}
        aria-label="Recency by Frequency comparison matrix"
      >
        <span>R ↓ / F →</span>
        {[1, 2, 3, 4, 5].map((f) => (
          <strong key={f}>F{f}</strong>
        ))}
        {[1, 2, 3, 4, 5].map((r) => (
          <Fragment key={r}>
            <strong>R{r}</strong>
            {data.matrix
              .filter((c) => c.recency === r)
              .map((cell) => (
                <button
                  key={cell.frequency}
                  disabled={busy}
                  type="button"
                  style={{
                    background: `color-mix(in srgb, var(--coop-green, #1f6b43) ${cell.count ? 10 + (cell.count / max) * 30 : 0}%, white)`,
                  }}
                  aria-label={`Recency ${cell.recency}, Frequency ${cell.frequency}: ${cell.count} members, ${percent(cell.percentage)} of scored members`}
                  onFocus={() => setFocused(cell)}
                  onMouseEnter={() => setFocused(cell)}
                  onClick={() => onSelect(cell.recency, cell.frequency)}
                >
                  {number(cell.count, 0)}
                </button>
              ))}
          </Fragment>
        ))}
      </div>
      <div className={styles.legend}>
        <span>Members: 0</span>
        {[0, 10, 25, 40].map((amount) => (
          <i
            key={amount}
            style={{
              background: `color-mix(in srgb, var(--coop-green, #1f6b43) ${amount}%, white)`,
            }}
          />
        ))}
        <span>{max} (highest cell)</span>
      </div>
      <p aria-live="polite" className={styles.notice}>
        {focused
          ? `R${focused.recency} / F${focused.frequency}: ${focused.count} members (${percent(focused.percentage)}). Contribution scores 1–5: ${focused.contributions.join(", ")}.`
          : "Focus, hover, or select a cell to inspect its count and Contribution score distribution."}
      </p>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={() =>
            onChange({
              classification: undefined,
              contributionScore: undefined,
              recencyScore: undefined,
              frequencyScore: undefined,
              membershipType: undefined,
              barangay: undefined,
              sector: undefined,
              search: undefined,
            })
          }
        >
          Clear matrix filters
        </Button>
        <Button variant="secondary" onClick={onExport}>
          Export matrix and results
        </Button>
      </div>
      <p className={styles.muted}>
        This matrix describes recorded scores. It is not a predictive model.
      </p>
    </div>
  );
}
export function ComponentDiagnostics({
  component,
  data,
  onFilter,
}: {
  component: RfmComponent;
  data: RfmWorkspace;
  onFilter: (score: number) => void;
}) {
  const current = data.components.find((c) => c.component === component)!;
  const [basis, setBasis] = useState(""),
    [previous, setPrevious] = useState<RfmWorkspace | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!basis) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getWorkspace(
        {
          ...data.filters,
          context: "historical",
          basisEnd: basis,
          runId: undefined,
          page: 1,
        },
        controller.signal,
      )
        .then(setPrevious)
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorMessage(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [basis, data.filters]);
  const old = basis
    ? previous?.components.find((c) => c.component === component)
    : null;
  const comparable =
    previous &&
    ![data, previous].some((d) =>
      d.summary.quality.some(
        (q) =>
          ["Incompatible Version", "Requires Review"].includes(q.status) &&
          q.count > 0,
      ),
    );
  return (
    <div className="grid gap-5">
      <p className={styles.notice}>
        Average {number(current.average)} / 5 · Median {number(current.median)}{" "}
        / 5 · Low scores (1–2): {percent(current.lowPercentage)} · High scores
        (4–5): {percent(current.highPercentage)}. Denominator:{" "}
        {data.summary.scored} valid scored members.
      </p>
      <div className={styles.tableRegion}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Score</th>
              <th scope="col" className={styles.numeric}>
                Members
              </th>
              <th scope="col" className={styles.numeric}>
                Percentage
              </th>
              <th scope="col">Inspect</th>
            </tr>
          </thead>
          <tbody>
            {current.distribution.map((d) => (
              <tr key={d.score}>
                <th scope="row">{d.score}/5</th>
                <td className={styles.numeric}>{number(d.count, 0)}</td>
                <td className={styles.numeric}>{percent(d.percentage)}</td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onFilter(d.score)}
                  >
                    Filter score {d.score}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Threshold reference</h3>
      <p className={styles.muted}>
        These are the effective settings for new calculations. Inspect a member
        to see that observation’s original thresholds. Selected saved results
        may use different versions or configurations.
      </p>
      <ScoringRules settings={data.settings} />
      <SelectField
        label="Compare with saved previous basis"
        value={basis}
        options={[
          { value: "", label: "No comparison" },
          ...data.options.bases
            .filter(
              (b) =>
                b <
                (data.filters.basisEnd ??
                  data.summary.basisPeriods[0]?.end ??
                  "9999"),
            )
            .map((b) => ({ value: b, label: date(b) })),
        ]}
        onChange={setBasis}
      />
      {loading && <p role="status">Loading previous snapshot…</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {old && !loading && (
        <p className={styles.notice}>
          {date(basis)}: {previous?.summary.scored} scored members; average{" "}
          {number(old.average)}, median {number(old.median)}. Scores 1–5:{" "}
          {old.distribution.map((d) => d.count).join(", ")}.{" "}
          {comparable
            ? "Saved configurations match the effective configuration; population sizes may differ between periods."
            : "Legacy or incompatible configurations are present; this distribution is not directly comparable."}
        </p>
      )}
    </div>
  );
}
export function RfmRuns({ onSelect }: { onSelect: (run: RfmRun) => void }) {
  const [page, setPage] = useState(1),
    [result, setResult] = useState<{ rows: RfmRun[]; total: number } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getRuns(page, controller.signal)
        .then(setResult)
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorMessage(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, retry]);
  return (
    <div className="grid gap-5">
      <p className={styles.notice}>
        Runs are ordered by calculation timestamp. Engagement history is ordered
        separately by basis period. Legacy observations are grouped by exact
        timestamp, basis, and version; original run boundaries are unavailable.
      </p>
      {loading ? (
        <p role="status">Loading calculation history…</p>
      ) : error ? (
        <div role="alert">
          <p className={styles.error}>{error}</p>
          <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
            Retry calculation history
          </Button>
        </div>
      ) : !result?.rows.length ? (
        <p>No saved calculation runs are available.</p>
      ) : (
        <>
          <div
            className={styles.tableRegion}
            tabIndex={0}
            aria-label="Saved calculation runs"
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Calculated</th>
                  <th scope="col">Basis</th>
                  <th scope="col">Version / members</th>
                  <th scope="col">Review</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((run) => (
                  <tr key={`${run.id}:${run.version}`}>
                    <td>
                      {date(run.computedAt)}
                      <small>{run.computedAt}</small>
                    </td>
                    <td>
                      {date(run.basisStart)} – {date(run.basisEnd)}
                    </td>
                    <td>
                      {run.version}
                      <small>
                        {run.count} distinct members
                        {run.legacy ? " · legacy grouping" : ""}
                      </small>
                    </td>
                    <td>
                      <Button variant="ghost" onClick={() => onSelect(run)}>
                        View saved run
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={20}
            total={result.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
export function RfmQuality({
  data,
  onFilter,
}: {
  data: RfmWorkspace;
  onFilter: (quality: RfmFilters["quality"]) => void;
}) {
  const explanations: Record<string, string> = {
    Current:
      "The basis ends today and the preserved configuration matches current settings. Source freshness is not independently verified.",
    "Potentially Outdated":
      "A current-view score whose basis ends before today. This is an age-based attention flag, not proof of stale source data.",
    Historical: "An explicitly selected saved basis or run.",
    Missing:
      "No saved observation exists in the selected context. No RFM classification is assigned.",
    "Incompatible Version":
      "The saved formula or configuration fingerprint differs from current settings.",
    "Requires Review":
      "Invalid score/basis or original configuration metadata is missing. A valid legacy score can still remain scored.",
  };
  return (
    <div className="grid gap-5">
      <p className={styles.notice}>
        Coverage: {data.summary.scored} / {data.summary.eligible} eligible
        filtered members ({percent(data.summary.coverage)}). Only valid saved
        scores contribute to averages and component distributions.
      </p>
      <dl className={styles.definition}>
        <dt>Average / median</dt>
        <dd>
          {number(data.summary.average)} / {number(data.summary.median)} out of
          15
        </dd>
        <dt>Latest successful calculation</dt>
        <dd>{date(data.summary.latestCalculation)}</dd>
        <dt>Basis coverage</dt>
        <dd>
          {data.summary.basisPeriods
            .map((b) => `${date(b.end)}: ${b.count}`)
            .join("; ") || "No saved basis periods"}
        </dd>
      </dl>
      {Object.entries(explanations).map(([quality, explanation]) => (
        <div key={quality}>
          <Button
            variant="ghost"
            onClick={() => onFilter(quality as RfmFilters["quality"])}
          >
            {quality}:{" "}
            {data.summary.quality.find((q) => q.status === quality)?.count ?? 0}
          </Button>
          <p className={styles.muted}>{explanation}</p>
        </div>
      ))}
      <h3>Coverage by membership type</h3>
      <div className={styles.tableRegion}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Scored / eligible</th>
              <th scope="col">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {data.summary.byType.map((t) => (
              <tr key={t.type}>
                <th scope="row">{t.type}</th>
                <td>
                  {t.scored} / {t.eligible}
                </td>
                <td>{percent(t.coverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Scoring versions</h3>
      <p className={styles.muted}>
        {data.summary.versions
          .map((v) => `${v.version}: ${v.count}`)
          .join(" · ") || "No scored records"}
      </p>
    </div>
  );
}
// Keeps the approved primary filters available inside the comparison sheet without duplicating member administration.
export function MatrixSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      label="Search matrix members"
      name="matrix-search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
export { ClassificationBadge };
