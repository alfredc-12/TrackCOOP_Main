"use client";
import { useEffect, useState } from "react";
import { Filter, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { MonitorSelect } from "@/features/finance-monitoring/MonitorFilters";
import { apiRequest } from "@/lib/api-client";
import { type Query, type OverviewOptions } from "./overview-client";
import styles from "./Overview.module.css";
export const periodOptions = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last_7_days", "Last 7 days"],
  ["last_30_days", "Last 30 days"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["this_quarter", "This quarter"],
  ["this_year", "This year"],
  ["last_year", "Last year"],
  ["custom", "Custom range"],
  ["all_time", "All time"],
];
const views = [
  ["posted", "All posted income & expenses"],
  ["income", "Income · Money In"],
  ["expense", "Expenses · Money Out"],
  ["review", "Records for review"],
  ["history", "Income/expense audit history"],
  ["adjustments", "Adjustment audit history"],
];
const names: Record<string, string> = {
  categoryId: "Category",
  source: "Source",
  search: "Search",
  posting: "Posting",
  recordStatus: "Record status",
  amountMin: "Minimum amount",
  amountMax: "Maximum amount",
  recordedBy: "Recorded by",
  approvedBy: "Approved by",
  seasonId: "Season",
  focusCategoryId: "Activity category",
  focusSource: "Activity source",
  focusStart: "Activity start",
  focusEnd: "Activity end",
  reviewKind: "Review condition",
};
export function OverviewFilters({
  query,
  apply,
  reset,
}: {
  query: Query;
  apply: (q: Query) => void;
  reset: () => void;
}) {
  const [draft, setDraft] = useState(query),
    [more, setMore] = useState(false),
    [error, setError] = useState(""),
    [options, setOptions] = useState<OverviewOptions | null>(null),
    [optionsError, setOptionsError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<OverviewOptions>("/api/financial-overview/options", {
      signal: controller.signal,
    })
      .then((v) => {
        if (!controller.signal.aborted) setOptions(v);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOptionsError(true);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if ((draft.search ?? "") === (query.search ?? "")) return;
    const timer = window.setTimeout(() => apply({ ...draft, page: "1" }), 350);
    return () => window.clearTimeout(timer);
  }, [draft, query.search, apply]);
  const set = (key: string, v: string) => setDraft((d) => ({ ...d, [key]: v }));
  const select = (
    key: string,
    label: string,
    items: Array<string | string[]>,
  ) => (
    <MonitorSelect
      label={label}
      value={draft[key] ?? ""}
      options={items}
      onChange={(v) => set(key, v)}
    />
  );
  const field = (key: string, label: string, decimal = false) => (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type={decimal ? "text" : "search"}
        inputMode={decimal ? "decimal" : undefined}
        value={draft[key] ?? ""}
        maxLength={decimal ? 15 : 190}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  const compatible = (options?.categories ?? []).filter((c) =>
    draft.view === "income"
      ? c.type !== "Expense"
      : draft.view === "expense"
        ? c.type !== "Income"
        : true,
  );
  const categoryOptions = [
    ["", "All financial categories"],
    ...compatible.map((c) => [
      c.id,
      `${c.name}${c.active ? "" : " · inactive"}`,
    ]),
  ];
  const chips = Object.entries(query).filter(
    ([key, value]) => value && names[key],
  );
  const applyDraft = () => {
    if (
      draft.period === "custom" &&
      (!draft.startDate || !draft.endDate || draft.startDate > draft.endDate)
    ) {
      setError("Choose both reporting dates in chronological order.");
      return;
    }
    setError("");
    apply({ ...draft, page: "1" });
  };
  return (
    <form
      className={styles.panel}
      aria-label="Financial Overview filters"
      onSubmit={(e) => {
        e.preventDefault();
        applyDraft();
      }}
    >
      <div className={`${styles.toolbar} mb-3`}>
        <div className={styles.actions}>
          <h2>
            <Filter className="mr-2 inline size-4" aria-hidden="true" />
            Filters
          </h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="More Overview filters"
            aria-expanded={more}
            aria-controls="overview-advanced-filters"
            onClick={() => setMore((v) => !v)}
          >
            <ChevronDown
              className={`size-4 ${more ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={reset}>
            Clear all
          </Button>
          <Button type="submit">Apply filters</Button>
        </div>
      </div>
      <div className={styles.fields}>
        {select("period", "Reporting period", periodOptions)}
        {select("view", "Transaction view", views)}
        {select("categoryId", "Financial category", categoryOptions)}
        {select("source", "Source module", [
          ["", "All sources"],
          "Manual",
          "Membership",
          "Payment",
          "Rental",
          "POS",
          "Document",
          "Other",
          ["Share Capital", "Share Capital · audit"],
        ])}
        {field("search", "Search records, category or reference")}
        {draft.period === "custom" && (
          <div className={styles.dateRange}>
            <DatePicker
              label="Reporting start"
              value={draft.startDate ?? ""}
              max={draft.endDate || undefined}
              onChange={(v) => set("startDate", v)}
            />
            <DatePicker
              label="Reporting end"
              value={draft.endDate ?? ""}
              min={draft.startDate || undefined}
              onChange={(v) => set("endDate", v)}
            />
          </div>
        )}
      </div>
      <div id="overview-advanced-filters" hidden={!more} className="mt-4">
        <div className={styles.fields}>
          {select("compare", "Compare with", [
            ["previous", "Previous equivalent period"],
            ["last_year", "Same period last year"],
            ["none", "No comparison"],
          ])}
          {select("posting", "Posting status", [
            ["", "Any posting status"],
            ["posted", "Posted"],
            ["unposted", "Unposted"],
          ])}
          {select("recordStatus", "Record status", [
            ["", "All record statuses"],
            "Active",
            "Voided",
            "Corrected",
            "Reversed",
          ])}
          {field("amountMin", "Minimum amount (PHP)", true)}
          {field("amountMax", "Maximum amount (PHP)", true)}
          {select("recordedBy", "Recorded by", [
            ["", "Any recorder"],
            ...(options?.actors ?? []).map((a) => [
              a.id,
              `${a.name} (#${a.id})`,
            ]),
          ])}
          {select("approvedBy", "Posted by", [
            ["", "Any approver"],
            ...(options?.actors ?? []).map((a) => [
              a.id,
              `${a.name} (#${a.id})`,
            ]),
          ])}
          {options?.capabilities.seasons &&
            select("seasonId", "Season", [
              ["", "All seasons"],
              ...options.seasons.map((s) => [s.id, s.name]),
            ])}
          {select("sortBy", "Sort by", [
            ["date", "Record date"],
            ["number", "Record number"],
            ["type", "Transaction type"],
            ["category", "Category"],
            ["source", "Source"],
            ["amount", "Amount"],
            ["posting", "Posting status"],
          ])}
          {select("sortDirection", "Sort direction", [
            ["desc", "Descending"],
            ["asc", "Ascending"],
          ])}
          {select("pageSize", "Rows per page", ["5", "10", "20", "50", "100"])}
        </div>
        <p className={`${styles.hint} mt-3`}>
          Transaction view, audit status and activity selections narrow the
          table. The four headline cards keep the same posted population for
          comparison. Unposted records are available under Records for review or
          audit history.
        </p>
      </div>
      {optionsError && (
        <p role="status" className={`${styles.hint} mt-3`}>
          Category and actor options could not be loaded. Refresh the page to
          retry.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {chips.length > 0 && (
        <div className={styles.chips} aria-label="Active Overview filters">
          {chips.map(([key, value]) => (
            <button
              type="button"
              key={key}
              className={styles.chip}
              aria-label={`Remove ${names[key]} filter`}
              onClick={() => apply({ ...query, [key]: "", page: "1" })}
            >
              {names[key]}:{" "}
              {key === "categoryId"
                ? (options?.categories.find((c) => c.id === value)?.name ??
                  value)
                : value}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
