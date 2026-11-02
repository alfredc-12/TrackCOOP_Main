"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import {
  defaultFilters,
  type RfmFilters,
  type RfmWorkspace,
} from "./rfm-client";
import styles from "./RfmWorkspace.module.css";

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const items = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <StyledSelect
        id={id}
        aria-label={label}
        disabled={disabled}
        value={items.find((item) => item.value === value)?.label ?? value}
        options={items.map((item) => item.label)}
        onChange={(label) => {
          const item = items.find((item) => item.label === label);
          if (item) onChange(item.value);
        }}
      />
    </div>
  );
}
const any = (label = "All") => ({ value: "", label });
export const classificationOptions = [
  any("All classifications"),
  "Active",
  "Needs Monitoring",
  "Inactive",
  "Not Yet Scored",
];
export function AdvancedFilters({
  filters,
  data,
  onApply,
}: {
  filters: RfmFilters;
  data: RfmWorkspace;
  onApply: (filters: RfmFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const change = (key: keyof RfmFilters, value: unknown) =>
    setDraft((current) => ({
      ...current,
      [key]: value === "" ? undefined : value,
    }));
  const scoreOptions = [
    any("Any score"),
    ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` })),
  ];
  const numericFields: Array<[keyof RfmFilters, string, number]> = [
    ["minScore", "Minimum total score", 15],
    ["maxScore", "Maximum total score", 15],
    ["minRecency", "Minimum recency days", 1000000],
    ["maxRecency", "Maximum recency days", 1000000],
    ["minFrequency", "Minimum participation count", 1000000],
    ["maxFrequency", "Maximum participation count", 1000000],
    ["minContribution", "Minimum contribution (PHP)", 1e12],
    ["maxContribution", "Maximum contribution (PHP)", 1e12],
  ];
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ ...draft, page: 1 });
      }}
      className="grid gap-5"
    >
      <p className={styles.muted}>
        Filters apply to the table, KPIs, component distributions, matrix, and
        full Excel report.
      </p>
      <div className={styles.filterGrid}>
        <SelectField
          label="Barangay"
          value={draft.barangay ?? ""}
          options={[any(), ...data.options.barangays]}
          onChange={(v) => change("barangay", v)}
        />
        <SelectField
          label="Agricultural sector"
          value={draft.sector ?? ""}
          options={[any(), ...data.options.sectors]}
          onChange={(v) => change("sector", v)}
        />
        <SelectField
          label="Official membership status"
          value={draft.officialStatus ?? ""}
          options={[any(), "Active", "Inactive"]}
          onChange={(v) => change("officialStatus", v)}
        />
        <SelectField
          label="Calculation quality"
          value={draft.quality ?? ""}
          options={[
            any(),
            "Current",
            "Potentially Outdated",
            "Historical",
            "Missing",
            "Incompatible Version",
            "Requires Review",
          ]}
          onChange={(v) => change("quality", v)}
        />
        <SelectField
          label="Scoring version"
          value={draft.version ?? ""}
          options={[any(), ...data.options.versions]}
          onChange={(v) => change("version", v)}
        />
        {(["recencyScore", "frequencyScore", "contributionScore"] as const).map(
          (key, index) => (
            <SelectField
              key={key}
              label={`${["Recency", "Frequency", "Contribution"][index]} score`}
              value={String(draft[key] ?? "")}
              options={scoreOptions}
              onChange={(v) => change(key, v ? Number(v) : undefined)}
            />
          ),
        )}
        {numericFields.map(([key, label, max]) => (
          <Input
            key={key}
            label={label}
            name={key}
            type="number"
            min={key.includes("Score") ? 3 : 0}
            max={max}
            step={key.includes("Contribution") ? ".01" : 1}
            value={draft[key] === undefined ? "" : String(draft[key])}
            onChange={(event) =>
              change(
                key,
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
          />
        ))}
      </div>
      <p className={styles.muted}>
        Sector is the recorded primary sector. A multiple-sector relationship is
        not available in this schema. Score filters exclude unscored records.
      </p>
      <div className={styles.actions}>
        <Button type="submit">Apply filters</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setDraft({
              ...defaultFilters(),
              context: draft.context,
              basisEnd: draft.basisEnd,
              runId: draft.runId,
            })
          }
        >
          Reset advanced filters
        </Button>
      </div>
    </form>
  );
}
export function ClassificationBadge({
  classification,
}: {
  classification: string | null;
}) {
  return (
    <span className={styles.badge} data-classification={classification}>
      {classification ?? "Not Yet Scored"}
    </span>
  );
}
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="RFM pagination" className={styles.pagination}>
      <p className={styles.muted}>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`
          : "0"}{" "}
        of {total.toLocaleString("en-PH")}
      </p>
      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => onPage(1)}
        >
          First
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className={styles.muted}>
          {page} / {pages}
        </span>
        <Button
          type="button"
          variant="secondary"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label="Last page"
          disabled={page >= pages}
          onClick={() => onPage(pages)}
        >
          Last
        </Button>
      </div>
    </nav>
  );
}
