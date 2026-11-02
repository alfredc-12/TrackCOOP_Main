"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Filter } from "lucide-react";
import { count, peso, pesoCompact, type ExpenseTrend } from "./expense-client";

/** Round the top of the axis to 1, 2 or 5 times a power of ten so tick labels stay readable. */
export function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * 10 ** exponent;
}

const width = 720;
const height = 260;
const margin = { top: 14, right: 16, bottom: 34, left: 58 };

type TrendChartProps = {
  trend: ExpenseTrend | null;
  onOpenBucket: (key: string) => void;
  hasComparison: boolean;
};

export function TrendChart({ trend, onOpenBucket, hasComparison }: TrendChartProps) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const buckets = useMemo(() => trend?.buckets ?? [], [trend]);
  const model = useMemo(() => {
    const previousValues = buckets.map((bucket) => bucket.previous?.amount ?? 0);
    const max = niceMax(Math.max(...buckets.map((bucket) => bucket.amount), ...previousValues, 0));
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const x = (index: number) => margin.left + (buckets.length <= 1 ? innerWidth / 2 : (index / (buckets.length - 1)) * innerWidth);
    const y = (value: number) => margin.top + innerHeight - (value / max) * innerHeight;
    const line = (values: Array<number | null>) => {
      let path = "";
      let drawing = false;
      values.forEach((value, index) => {
        if (value === null) { drawing = false; return; }
        path += `${drawing ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
        drawing = true;
      });
      return path;
    };
    return { max, x, y, innerHeight, line };
  }, [buckets]);

  if (!buckets.length) return null;
  const current = buckets.map((bucket) => bucket.amount);
  const previous = hasComparison ? buckets.map((bucket) => bucket.previous?.amount ?? null) : [];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => model.max * fraction);
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));
  const showPoints = buckets.length <= 40;
  const activeBucket = active === null ? null : buckets[active];

  const move = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    let nearest = 0;
    let best = Infinity;
    buckets.forEach((_, index) => {
      const distance = Math.abs(model.x(index) - px);
      if (distance < best) { best = distance; nearest = index; }
    });
    setActive(nearest);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = buckets.length - 1;
    if (event.key === "ArrowRight") { event.preventDefault(); setActive((index) => Math.min(last, (index ?? -1) + 1)); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); setActive((index) => Math.max(0, (index ?? 1) - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(0); }
    else if (event.key === "End") { event.preventDefault(); setActive(last); }
    else if ((event.key === "Enter" || event.key === " ") && active !== null) { event.preventDefault(); onOpenBucket(buckets[active].key); }
    else if (event.key === "Escape") setActive(null);
  };

  const tooltipLeft = active === null ? 0 : Math.min(Math.max((model.x(active) / width) * 100, 14), 86);

  return (
    <div>
      <div
        ref={wrapper}
        role="group"
        tabIndex={0}
        aria-label="Posted expenses over time. Use the left and right arrow keys to move between periods, and Enter to open the details of the selected period."
        aria-describedby={`${id}-readout`}
        onKeyDown={onKey}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }}
        className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full touch-pan-y"
          aria-hidden="true"
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") setActive(null); }}
          onClick={() => { if (active !== null) onOpenBucket(buckets[active].key); }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={model.y(tick)} y2={model.y(tick)} stroke="#E1E8E2" strokeWidth="1" />
              <text x={margin.left - 8} y={model.y(tick) + 4} textAnchor="end" fontSize="11" fill="#5D6D63">{pesoCompact(tick)}</text>
            </g>
          ))}
          {buckets.map((bucket, index) => (index % labelEvery === 0 ? (
            <text key={bucket.key} x={model.x(index)} y={height - 12} textAnchor="middle" fontSize="11" fill="#5D6D63">{shortLabel(bucket.label, trend!.granularity)}</text>
          ) : null))}
          <path d={`${model.line(current)}L${model.x(buckets.length - 1).toFixed(1)},${model.y(0).toFixed(1)}L${model.x(0).toFixed(1)},${model.y(0).toFixed(1)}Z`} fill="#1F6B43" opacity="0.1" />
          {hasComparison ? <path d={model.line(previous)} fill="none" stroke="#8A9A8F" strokeWidth="2" strokeDasharray="5 4" /> : null}
          <path d={model.line(current)} fill="none" stroke="#1F6B43" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {active !== null ? <line x1={model.x(active)} x2={model.x(active)} y1={margin.top} y2={margin.top + model.innerHeight} stroke="#123D2A" strokeWidth="1" strokeDasharray="3 3" /> : null}
          {buckets.map((bucket, index) => (showPoints || index === active ? (
            <circle key={bucket.key} cx={model.x(index)} cy={model.y(bucket.amount)} r={index === active ? 6 : 3.5} fill={index === active ? "#123D2A" : "#1F6B43"} stroke="#fff" strokeWidth="2" />
          ) : null))}
        </svg>
        {activeBucket ? (
          <div
            role="presentation"
            style={{ left: `${tooltipLeft}%` }}
            className="pointer-events-none absolute top-1 z-10 w-56 -translate-x-1/2 rounded-lg border border-[#CAD8CB] bg-white p-2.5 text-xs leading-5 text-[#365F4A] shadow-[0_12px_28px_rgba(18,61,42,0.16)]"
          >
            <p className="font-black text-[#123D2A]">{activeBucket.label}</p>
            <p><span className="font-bold">{peso(activeBucket.amount)}</span> · {count(activeBucket.records)} {activeBucket.records === 1 ? "record" : "records"}</p>
            {activeBucket.previous ? <p>Before: {peso(activeBucket.previous.amount)}</p> : hasComparison ? <p>Before: no matching period</p> : null}
            {activeBucket.topCategory ? <p className="truncate">Largest: {activeBucket.topCategory.name}</p> : <p>No posted expenses</p>}
          </div>
        ) : null}
      </div>
      <p id={`${id}-readout`} aria-live="polite" className="mt-2 min-h-5 text-xs text-[#5D6D63]">
        {activeBucket
          ? `${activeBucket.label}: ${peso(activeBucket.amount)} from ${count(activeBucket.records)} ${activeBucket.records === 1 ? "record" : "records"}.${activeBucket.previous ? ` Comparison period: ${peso(activeBucket.previous.amount)}.` : ""} Press Enter or click to open details.`
          : "Hover, tap or use the arrow keys to read a period. Click a period to open its details."}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-[#5D6D63]">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-5 bg-[#1F6B43]" />Posted expenses</span>
        {hasComparison ? <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-[#8A9A8F]" />Comparison period</span> : null}
      </div>
      <table className="sr-only">
        <caption>Posted expenses by period</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">Posted amount</th><th scope="col">Records</th></tr></thead>
        <tbody>{buckets.map((bucket) => (<tr key={bucket.key}><th scope="row">{bucket.label}</th><td>{peso(bucket.amount)}</td><td>{bucket.records}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

function shortLabel(label: string, granularity: string) {
  if (granularity === "day") return label.replace(/, \d{4}$/, "");
  if (granularity === "week") return label.split(" - ")[0];
  return label;
}

export type BarItem = {
  key: string;
  label: string;
  amount: number;
  records: number;
  share: number | null;
  previous?: number | null;
  note?: string;
};

/** A ranked horizontal bar list. Every row is a real button so it works by keyboard and by touch. */
export function RankedBars({ items, onOpen, onFilter, filterLabel, selectedKeys = [], limit, emptyText }: {
  items: BarItem[];
  onOpen: (item: BarItem) => void;
  onFilter?: (item: BarItem) => void;
  filterLabel?: (item: BarItem) => string;
  selectedKeys?: string[];
  limit?: number;
  emptyText: string;
}) {
  if (!items.length) return <p className="rounded-md bg-[#F4F8F2] p-4 text-sm text-[#5D6D63]">{emptyText}</p>;
  const visible = limit ? items.slice(0, limit) : items;
  const max = Math.max(...visible.map((item) => Math.max(item.amount, item.previous ?? 0)), 1);
  return (
    <ol className="grid gap-2">
      {visible.map((item) => {
        const selected = selectedKeys.includes(item.key);
        return (
          <li key={item.key} className="flex items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => onOpen(item)}
              aria-label={`${item.label}: ${peso(item.amount)}${item.share !== null ? `, ${item.share}% of posted expenses` : ""}, ${item.records} ${item.records === 1 ? "record" : "records"}. Open details.`}
              className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left outline-none transition hover:bg-[#F4FAF2] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 ${selected ? "border-[#1F6B43] bg-[#F4FAF2]" : "border-[#E1E8E2] bg-white"}`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-bold text-[#123D2A]">{item.label}</span>
                <span className="shrink-0 text-sm font-black text-[#123D2A]">{peso(item.amount)}</span>
              </span>
              <span className="relative mt-1.5 block h-2 rounded-full bg-[#E9F0E9]" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#1F6B43]" style={{ width: `${Math.max((item.amount / max) * 100, item.amount > 0 ? 1.5 : 0)}%` }} />
                {item.previous !== null && item.previous !== undefined ? <span className="absolute -inset-y-0.5 w-0.5 rounded bg-[#8A9A8F]" style={{ left: `${Math.min((item.previous / max) * 100, 100)}%` }} /> : null}
              </span>
              <span className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-[#5D6D63]">
                <span>{item.share !== null ? `${item.share}% of total` : "—"} · {count(item.records)} {item.records === 1 ? "record" : "records"}</span>
                {item.previous !== null && item.previous !== undefined ? <span>Before: {peso(item.previous)}</span> : item.note ? <span>{item.note}</span> : null}
              </span>
            </button>
            {onFilter ? (
              <button
                type="button"
                onClick={() => onFilter(item)}
                aria-label={filterLabel?.(item) ?? `Show records for ${item.label}`}
                aria-pressed={selected}
                className={`grid w-11 shrink-0 place-items-center rounded-md border outline-none transition focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 ${selected ? "border-[#1F6B43] bg-[#123D2A] text-white" : "border-[#E1E8E2] bg-white text-[#365F4A] hover:bg-[#EEF2EC]"}`}
              >
                <Filter className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
