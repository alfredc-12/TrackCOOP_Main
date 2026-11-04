"use client";

import Link from "next/link";
import { BarChart3, Table2 } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { DataTable, ErrorState, StatusBadge } from "@/components/portal/PortalPrimitives";
import type { TrendPoint } from "./dashboard-api";
import {
  formatCentavosPeso,
  formatManilaMonth,
  formatPeso,
  formatPesoCompact,
  parseCentavos,
} from "./dashboard-format";
import { InfoButton } from "./InfoButton";

function niceStep(value: number) {
  if (value <= 0) return 10_000;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * 10 ** exponent;
}

const WIDTH = 820;
const HEIGHT = 300;
const MARGIN = { top: 20, right: 20, bottom: 38, left: 72 };

type TrendChartProps = {
  trend: TrendPoint[] | null;
  error?: string;
  onRetry: () => void;
};

export function TrendChart({ trend, error, onRetry }: TrendChartProps) {
  const id = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const points = useMemo(
    () =>
      (trend ?? []).map((point) => ({
        ...point,
        label: formatManilaMonth(point.month),
        incomeCents: parseCentavos(point.income),
        expenseCents: parseCentavos(point.expenses),
        netCents: parseCentavos(point.net),
      })),
    [trend],
  );

  const model = useMemo(() => {
    const maxPositive = Math.max(
      ...points.flatMap((point) => [point.incomeCents, point.expenseCents, Math.max(0, point.netCents)]),
      0,
    );
    const minNegative = Math.min(...points.map((point) => Math.min(0, point.netCents)), 0);
    const top = niceStep(maxPositive || 10_000);
    const bottom = minNegative < 0 ? -niceStep(Math.abs(minNegative)) : 0;
    const span = Math.max(top - bottom, 1);

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const slotWidth = points.length > 0 ? innerWidth / points.length : innerWidth;
    const barWidth = Math.min(24, Math.max(8, slotWidth * 0.28));

    const centerX = (index: number) => MARGIN.left + slotWidth * (index + 0.5);
    const y = (cents: number) => MARGIN.top + ((top - cents) / span) * innerHeight;
    const zeroY = y(0);

    const netPath = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${centerX(index).toFixed(1)},${y(point.netCents).toFixed(1)}`)
      .join("");

    const ticks: number[] = [];
    if (bottom < 0) {
      ticks.push(bottom, Math.round(bottom / 2), 0, Math.round(top / 2), top);
    } else {
      ticks.push(0, Math.round(top * 0.25), Math.round(top * 0.5), Math.round(top * 0.75), top);
    }

    return { top, bottom, slotWidth, barWidth, centerX, y, zeroY, netPath, ticks, innerHeight };
  }, [points]);

  if (error) {
    return (
      <section aria-label="Income and expense trends">
        <ErrorState message={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!trend) {
    return (
      <section aria-label="Income and expense trends" className="h-80 animate-pulse rounded-xl bg-[#E7F2E4]" />
    );
  }

  const allZero = points.every((point) => point.incomeCents === 0 && point.expenseCents === 0);
  const activePoint = activeIndex !== null ? points[activeIndex] : null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!points.length) return;
    const last = points.length - 1;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(last, (index ?? -1) + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, (index ?? 1) - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(last);
    } else if (event.key === "Escape") {
      setActiveIndex(null);
    }
  };

  return (
    <section
      aria-labelledby="trend-heading"
      className="min-w-0 rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="trend-heading" className="text-base font-black text-[#123D2A]">
              Monthly Operating Income, Expenses &amp; Net Surplus
            </h2>
            <InfoButton label="Monthly financial trend">
              Shows monthly posted operating income (green bars), posted operating expenses (gold bars), and net operating surplus (forest line). Deficit months dip below the ₱0.00 baseline. Share-capital contributions and test-mode payments are excluded.
            </InfoButton>
          </div>
          <p className="mt-0.5 text-xs text-[#5D6D63]">
            Compare monthly revenue, operating costs, and net surplus across the reporting window.
            {allZero ? " No posted operating income or expenses were recorded in these months." : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={viewMode === "chart"}
            onClick={() => setViewMode("chart")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition ${
              viewMode === "chart"
                ? "border-[#123D2A] bg-[#123D2A] text-white"
                : "border-[#CAD8CB] bg-[#F7F8F3] text-[#123D2A] hover:border-[#1F6B43]"
            }`}
          >
            <BarChart3 className="size-3.5" aria-hidden="true" />
            Chart
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition ${
              viewMode === "table"
                ? "border-[#123D2A] bg-[#123D2A] text-white"
                : "border-[#CAD8CB] bg-[#F7F8F3] text-[#123D2A] hover:border-[#1F6B43]"
            }`}
          >
            <Table2 className="size-3.5" aria-hidden="true" />
            Table
          </button>
        </div>
      </div>

      {/* Accessible Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#294B39]">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-xs bg-[#1F6B43]" />
          Operating Income
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-xs bg-[#D8A011]" />
          Operating Expenses
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 bg-[#123D2A]" />
          Net Operating Surplus / (Deficit)
        </span>
      </div>

      {viewMode === "chart" ? (
        <div className="mt-4">
          <div
            role="group"
            tabIndex={0}
            aria-label="Monthly operating income, expenses, and net surplus chart. Use left and right arrow keys to inspect each month."
            aria-describedby={`${id}-readout`}
            onKeyDown={handleKeyDown}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setActiveIndex(null);
            }}
            className="overflow-x-auto rounded-lg border border-[#EEF2EC] bg-[#FAFBF8] p-2 outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40"
          >
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="block h-auto w-full"
              aria-hidden="true"
              onMouseLeave={() => setActiveIndex(null)}
            >
              {model.ticks.map((tick) => {
                const y = model.y(tick);
                const isZero = tick === 0;
                return (
                  <g key={tick}>
                    <line
                      x1={MARGIN.left}
                      x2={WIDTH - MARGIN.right}
                      y1={y}
                      y2={y}
                      stroke={isZero ? "#8A9A8F" : "#E1E8E2"}
                      strokeWidth={isZero ? "1.5" : "1"}
                    />
                    <text
                      x={MARGIN.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill={tick < 0 ? "#9A392A" : "#5D6D63"}
                    >
                      {formatPesoCompact(tick)}
                    </text>
                  </g>
                );
              })}

              {points.map((point, index) => {
                const cx = model.centerX(index);
                const incomeTop = model.y(point.incomeCents);
                const incomeHeight = Math.max(point.incomeCents > 0 ? 2 : 0, model.zeroY - incomeTop);
                const expenseTop = model.y(point.expenseCents);
                const expenseHeight = Math.max(point.expenseCents > 0 ? 2 : 0, model.zeroY - expenseTop);
                const isActive = activeIndex === index;

                return (
                  <g
                    key={point.month}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => setActiveIndex(index)}
                    className="cursor-pointer"
                  >
                    {isActive ? (
                      <rect
                        x={cx - model.slotWidth / 2 + 2}
                        y={MARGIN.top}
                        width={model.slotWidth - 4}
                        height={model.innerHeight}
                        fill="#EEF6EC"
                        rx="6"
                      />
                    ) : null}
                    <rect
                      x={cx - model.barWidth - 2}
                      y={incomeTop}
                      width={model.barWidth}
                      height={incomeHeight}
                      fill="#1F6B43"
                      rx="3"
                    />
                    <rect
                      x={cx + 2}
                      y={expenseTop}
                      width={model.barWidth}
                      height={expenseHeight}
                      fill="#D8A011"
                      rx="3"
                    />
                    <text
                      x={cx}
                      y={HEIGHT - 12}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isActive ? "700" : "500"}
                      fill="#123D2A"
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}

              {model.netPath ? (
                <path
                  d={model.netPath}
                  fill="none"
                  stroke="#123D2A"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {points.map((point, index) => {
                const cx = model.centerX(index);
                const cy = model.y(point.netCents);
                const negative = point.netCents < 0;
                return (
                  <circle
                    key={`${point.month}-dot`}
                    cx={cx}
                    cy={cy}
                    r={activeIndex === index ? 5.5 : 3.5}
                    fill={negative ? "#9A392A" : "#123D2A"}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
          </div>

          <div
            id={`${id}-readout`}
            aria-live="polite"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8E2] bg-[#F7F8F3] px-3.5 py-2.5 text-xs text-[#294B39]"
          >
            {activePoint ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <strong className="font-black text-[#123D2A]">{activePoint.label}</strong>
                <span>
                  Income:{" "}
                  <strong className="font-bold tabular-nums text-[#1F6B43]">
                    {formatPeso(activePoint.income)}
                  </strong>
                </span>
                <span>
                  Expenses:{" "}
                  <strong className="font-bold tabular-nums text-[#8A6200]">
                    {formatPeso(activePoint.expenses)}
                  </strong>
                </span>
                <span>
                  Net:{" "}
                  <strong
                    className={`font-bold tabular-nums ${
                      activePoint.netCents < 0 ? "text-[#9A392A]" : "text-[#123D2A]"
                    }`}
                  >
                    {formatCentavosPeso(activePoint.netCents)}
                  </strong>{" "}
                  ({activePoint.netCents < 0 ? "Deficit" : activePoint.netCents > 0 ? "Surplus" : "Break-even"})
                </span>
              </div>
            ) : (
              <span>
                Hover, tap, or use the left and right arrow keys on the chart to inspect a month&apos;s exact peso figures.
              </span>
            )}
            <Link
              href="/portal/bookkeeper/financial-ledger"
              className="font-bold text-[#1F6B43] hover:text-[#123D2A]"
            >
              Inspect ledger records →
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <DataTable>
            <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-xs">
              <thead className="bg-[#F7F8F3] font-bold uppercase tracking-wider text-[#5D6D63]">
                <tr>
                  <th scope="col" className="px-4 py-3">Month</th>
                  <th scope="col" className="px-4 py-3 text-right">Operating Income</th>
                  <th scope="col" className="px-4 py-3 text-right">Operating Expenses</th>
                  <th scope="col" className="px-4 py-3 text-right">Net Operating Surplus</th>
                  <th scope="col" className="px-4 py-3 text-center">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                {points.map((point) => (
                  <tr key={point.month} className="hover:bg-[#F7F8F3]">
                    <th scope="row" className="px-4 py-3 font-bold text-[#123D2A]">{point.label}</th>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPeso(point.income)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPeso(point.expenses)}</td>
                    <td
                      className={`px-4 py-3 text-right font-black tabular-nums ${
                        point.netCents < 0 ? "text-[#9A392A]" : "text-[#123D2A]"
                      }`}
                    >
                      {formatPeso(point.net)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge
                        tone={point.netCents < 0 ? "danger" : point.netCents > 0 ? "success" : "neutral"}
                      >
                        {point.netCents < 0 ? "Deficit" : point.netCents > 0 ? "Surplus" : "Break-even"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </div>
      )}

      {/* Always-present screen-reader summary table when in chart mode */}
      {viewMode === "chart" ? (
        <table className="sr-only">
          <caption>Monthly operating income, expenses, and net surplus</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Operating income</th>
              <th scope="col">Operating expenses</th>
              <th scope="col">Net operating surplus</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th scope="row">{point.label}</th>
                <td>{formatPeso(point.income)}</td>
                <td>{formatPeso(point.expenses)}</td>
                <td>{formatPeso(point.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

