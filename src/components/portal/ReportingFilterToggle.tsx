"use client";

import { ChevronDown, Filter } from "lucide-react";

export function ReportingFilterToggle({ expanded, onToggle, controls, summary, activeCount }: {
  expanded: boolean;
  onToggle: () => void;
  controls: string;
  summary: string;
  activeCount: number;
}) {
  return <h2>
    <button type="button" aria-label="Reporting filters" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}
      className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg text-left text-coop-forest outline-none focus-visible:ring-2 focus-visible:ring-coop-green/25">
      <span className="flex items-center gap-2 text-sm font-semibold"><Filter aria-hidden="true" className="size-4" />Reporting filters</span>
      <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-normal text-coop-muted">
        <span aria-label="Applied reporting period">{summary}</span>
        {activeCount > 0 ? <span className="rounded-full bg-coop-sage px-2 py-1 font-semibold text-coop-secondary">{activeCount} additional filter{activeCount === 1 ? "" : "s"}</span> : null}
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </span>
    </button>
  </h2>;
}

export function reportingDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
