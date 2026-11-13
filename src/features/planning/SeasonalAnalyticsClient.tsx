"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  ChevronDown,
  ClipboardList,
  Coins,
  Database,
  Minus,
  Plus,
  Sprout,
  Wheat,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { ErrorState, FormDialog, LoadingSkeleton, PaginationControls, StatusBadge } from "@/components/portal/PortalPrimitives";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { ApiClientError } from "@/lib/api-client";
import { getHighValueCropNames, HIGH_VALUE_CROP_NAMES, isHighValueCropName as isHighValueCropNameFromList } from "@/features/crops/high-value-crops";
import {
  createProductionRecord,
  createSeason,
  getSeasonalAnalytics,
  listProductionRecords,
  listSeasons,
  updateSeasonStatus,
  type ProductionRecord,
  type ProductionRecordInput,
  type Season,
  type SeasonInput,
  type SeasonalAnalytics,
} from "./planning-api";

const inputClass = "h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20";
const productionUnitOptions = ["kg", "g", "ton", "bag", "sack", "bottle", "liter", "piece", "crate", "tray", "box", "bundle", "bunch", "basket"];

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function previousYearRange() {
  const year = new Date().getFullYear() - 1;
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric" }).format(new Date(`${value}-01T00:00:00`));
}

function monthKeys(startDate: string, endDate: string) {
  const cursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00`);
  const keys: string[] = [];
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function signedPercentage(value: number | null) {
  if (value === null) return "New";
  if (Math.abs(value) < 0.05) return "No change";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function seasonStatusTone(status: Season["seasonStatus"]): "neutral" | "success" | "warning" {
  return status === "Active" ? "success" : status === "Draft" ? "warning" : "neutral";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.06)] ${className}`}>{children}</section>;
}

function SeasonPicker({ seasons, value, onChange, includeAll = true }: { seasons: Season[]; value: string; onChange: (value: string) => void; includeAll?: boolean }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedSeason = seasons.find((season) => season.id === value);
  const selectedLabel = selectedSeason ? `${selectedSeason.seasonName} (${selectedSeason.seasonYear})` : includeAll ? "This year (all seasons)" : "Select season";

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function chooseSeason(seasonId: string) {
    onChange(seasonId);
    setOpen(false);
  }

  return (
    <div ref={pickerRef} className="relative w-full min-w-0 shrink-0 sm:w-[16rem]">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`${inputClass} flex items-center justify-between gap-3 text-left font-normal`}>
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-[#123D2A] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div role="listbox" aria-label="Season options" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
        {includeAll ? <button type="button" role="option" aria-selected={!value} onClick={() => chooseSeason("")} className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${!value ? "bg-[#E8F3E9] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F3F8F2]"}`}>This year (all seasons)</button> : null}
        {seasons.map((season) => {
          const isSelected = season.id === value;
          return <button key={season.id} type="button" role="option" aria-selected={isSelected} onClick={() => chooseSeason(season.id)} className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${isSelected ? "bg-[#E8F3E9] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F3F8F2]"}`}>{season.seasonName} ({season.seasonYear})</button>;
        })}
      </div> : null}
    </div>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-[#CFE0D0] bg-[#F7FAF5] px-5 py-8 text-center">
      <div>
        <div className="mx-auto grid size-10 place-items-center rounded-full bg-[#E8F3E9] text-[#1F6B43]"><ClipboardList className="size-5" /></div>
        <p className="mt-3 text-sm font-black text-[#123D2A]">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#6C7A70]">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function Pagination({ page, pageCount, total, onPage, pageSize = 6, alwaysVisible = false }: { page: number; pageCount: number; total: number; onPage: (page: number) => void; pageSize?: number; alwaysVisible?: boolean }) {
  if (pageCount <= 1 && !alwaysVisible) return null;
  return <PaginationControls currentPage={page} totalPages={pageCount} totalItems={total} itemName="records" onPageChange={onPage} pageSize={pageSize} className="mt-3 border-t border-[#E7EEE7] pt-3 text-xs" />;
}

function ProductionCropRow({ crop, index, totalQuantity, cropNames }: { crop: SeasonalAnalytics["productionByCrop"][number]; index: number; totalQuantity: number; cropNames: readonly string[] }) {
  const share = (crop.quantityProduced / Math.max(totalQuantity, 1)) * 100;
  const costPerUnit = crop.quantityProduced > 0 ? crop.productionCost / crop.quantityProduced : 0;
  return <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(5rem,auto)] gap-4 border-b border-[#E7EEE7] py-3 text-sm last:border-b-0"><span className="grid size-6 place-items-center rounded-full bg-[#E8F3E9] text-xs font-black text-[#1F6B43]">{index + 1}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-[#123D2A]">{crop.cropName}</p>{isHighValueCropNameFromList(crop.cropName, cropNames) ? <span className="rounded-full bg-[#FFF3D6] px-2 py-0.5 text-[0.65rem] font-black text-[#9A6700]">High-value</span> : null}</div><p className="text-xs text-[#6C7A70]">{crop.sector} · {crop.records} record{crop.records === 1 ? "" : "s"} · {number(share)}% of quantity</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF2EC]"><div className="h-full rounded-full bg-[#1F6B43]" style={{ width: `${Math.min(100, share)}%` }} /></div></div><div className="min-w-[5rem] text-right"><p className="font-black text-[#1F6B43]">{number(crop.quantityProduced)}</p><p className="text-xs text-[#6C7A70]">{money(crop.productionCost)}</p><p className="text-[0.65rem] text-[#6C7A70]">{money(costPerUnit)}/unit</p></div></div>;
}

function SeasonalKpiCard({ label, value, icon: Icon, change, detail, highlight = false }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; change: number | null; detail: string; highlight?: boolean }) {
  const hasComparison = change !== null;
  const isPositive = hasComparison && change > 0;
  const isNegative = hasComparison && change < 0;
  const ChangeIcon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;
  const changeLabel = !hasComparison ? "No comparison" : Math.abs(change) < 0.05 ? "No change" : `${isPositive ? "Up" : "Down"} ${Math.abs(change).toFixed(1)}%`;
  const changeClass = isPositive ? "bg-[#E8F3E9] text-[#1F6B43]" : isNegative ? "bg-[#FFF3D6] text-[#9A6700]" : "bg-[#EEF2EC] text-[#5D6D63]";

  return <article data-primary-kpi={highlight ? "true" : undefined} className="flex h-full min-h-[12rem] flex-col rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.06)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold leading-5 text-[#123D2A]">{label}</p><p className="mt-4 truncate text-2xl font-black leading-none tracking-tight text-[#123D2A]">{value}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#EEF6EC] text-[#1F6B43]"><Icon className="size-4" aria-hidden="true" /></span></div><div className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${changeClass}`}><ChangeIcon className="size-3.5" aria-hidden="true" />{changeLabel}</div><p className="mt-2 text-xs leading-5 text-[#5D6D63]">{detail}</p></article>;
}

function SummaryCards({ analytics, comparisonAnalytics, comparisonLabel }: { analytics: SeasonalAnalytics; comparisonAnalytics: SeasonalAnalytics | null; comparisonLabel: string }) {
  const harvestedRecords = analytics.productionByCrop.reduce((total, crop) => total + crop.records, 0);
  const averageCostPerUnit = analytics.summary.productionQuantity > 0 ? analytics.summary.productionCost / analytics.summary.productionQuantity : 0;
  const comparisonHasData = Boolean(comparisonAnalytics && (comparisonAnalytics.summary.productionQuantity > 0 || comparisonAnalytics.summary.productionCost > 0 || comparisonAnalytics.productionByCrop.length > 0));
  const previousRecords = comparisonHasData ? comparisonAnalytics?.productionByCrop.reduce((total, crop) => total + crop.records, 0) ?? 0 : null;
  const previousQuantity = comparisonHasData ? comparisonAnalytics?.summary.productionQuantity ?? 0 : null;
  const previousCost = comparisonHasData ? comparisonAnalytics?.summary.productionCost ?? 0 : null;
  const previousAverageCost = previousQuantity && previousQuantity > 0 ? previousCost! / previousQuantity : 0;
  const comparisonText = comparisonHasData ? `Comparison ${number(previousQuantity ?? 0)} units · ${comparisonLabel}` : `No comparable harvest records · ${comparisonLabel}`;
  const change = (current: number, previous: number | null) => comparisonHasData && previous !== null ? percentageChange(current, previous) : null;

  return <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-5"><SeasonalKpiCard label="Recorded harvest quantity" value={number(analytics.summary.productionQuantity)} icon={Wheat} change={change(analytics.summary.productionQuantity, previousQuantity)} detail={comparisonText} highlight /><SeasonalKpiCard label="Harvest records" value={number(harvestedRecords)} icon={ClipboardList} change={change(harvestedRecords, previousRecords)} detail={comparisonHasData ? `Comparison ${number(previousRecords ?? 0)} records · ${comparisonLabel}` : `No comparable records · ${comparisonLabel}`} /><SeasonalKpiCard label="Crop types recorded" value={number(analytics.productionByCrop.length)} icon={Sprout} change={change(analytics.productionByCrop.length, comparisonHasData ? comparisonAnalytics?.productionByCrop.length ?? 0 : null)} detail={comparisonHasData ? `Comparison ${number(comparisonAnalytics?.productionByCrop.length ?? 0)} crop types · ${comparisonLabel}` : `No comparable crop mix · ${comparisonLabel}`} /><SeasonalKpiCard label="Recorded production cost" value={money(analytics.summary.productionCost)} icon={Coins} change={change(analytics.summary.productionCost, previousCost)} detail={comparisonHasData ? `Comparison ${money(previousCost ?? 0)} · harvested records only` : `No comparable production cost · ${comparisonLabel}`} /><SeasonalKpiCard label="Average cost / unit" value={averageCostPerUnit > 0 ? money(averageCostPerUnit) : "—"} icon={Calculator} change={comparisonHasData ? percentageChange(averageCostPerUnit, previousAverageCost) : null} detail={comparisonHasData ? `Comparison ${previousAverageCost > 0 ? money(previousAverageCost) : "—"} · production cost ÷ harvested quantity` : `No comparable unit cost · ${comparisonLabel}`} /></div>;
}

function InsightCard({ label, value, detail, tone = "green" }: { label: string; value: string; detail: string; tone?: "green" | "gold" | "red" }) {
  const toneClass = tone === "gold" ? "text-[#B26408]" : tone === "red" ? "text-[#B42318]" : "text-[#1F6B43]";
  return <div className="flex h-full flex-col rounded-md border border-[#DDE8DD] bg-[#FBFCF8] p-4"><p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#6C7A70]">{label}</p><p className={`mt-2 truncate text-base font-black ${toneClass}`}>{value}</p><p className="mt-1 text-xs leading-5 text-[#6C7A70]">{detail}</p></div>;
}

function ComparisonMetric({ label, current, previous, currentValue, previousValue }: { label: string; current: number; previous: number; currentValue: string; previousValue: string }) {
  const change = percentageChange(current, previous);
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;
  return <div className="flex h-full flex-col rounded-md border border-[#DDE8DD] bg-[#FBFCF8] p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.1em] text-[#6C7A70]">{label}</p><Icon className={`size-4 ${isPositive ? "text-[#1F6B43]" : isNegative ? "text-[#B26408]" : "text-[#6C7A70]"}`} /></div><p className="mt-2 text-lg font-black text-[#123D2A]">{currentValue}</p><p className="mt-1 text-xs text-[#6C7A70]">Previous: {previousValue}</p><p className={`mt-2 text-xs font-black ${isPositive ? "text-[#1F6B43]" : isNegative ? "text-[#B26408]" : "text-[#6C7A70]"}`}>{signedPercentage(change)} vs previous</p></div>;
}

type Props = { canManageSeasons?: boolean };
type CropValueFilter = "All" | "High-Value" | "Other";
type SeasonFormErrors = Partial<Record<"seasonName" | "seasonType" | "seasonYear" | "startDate" | "endDate", string>>;

export function SeasonalAnalyticsClient({ canManageSeasons = true }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [analytics, setAnalytics] = useState<SeasonalAnalytics | null>(null);
  const [comparisonAnalytics, setComparisonAnalytics] = useState<SeasonalAnalytics | null>(null);
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [cropValueFilter, setCropValueFilter] = useState<CropValueFilter>("All");
  const [highValueCropNames, setHighValueCropNames] = useState<readonly string[]>(HIGH_VALUE_CROP_NAMES);
  const [productionPage, setProductionPage] = useState(1);
  const [productionSummaryPage, setProductionSummaryPage] = useState(1);
  const [productionCropModal, setProductionCropModal] = useState(false);
  const [productionCropSearch, setProductionCropSearch] = useState("");
  const [productionCropPage, setProductionCropPage] = useState(1);
  const [seasonModal, setSeasonModal] = useState(false);
  const [productionModal, setProductionModal] = useState(false);
  const [seasonForm, setSeasonForm] = useState<SeasonInput>({
    seasonName: "",
    seasonType: "Main crop",
    seasonYear: new Date().getFullYear(),
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: `${new Date().getFullYear()}-12-31`,
    description: "",
  });
  const [seasonFormErrors, setSeasonFormErrors] = useState<SeasonFormErrors>({});
  const [productionForm, setProductionForm] = useState<ProductionRecordInput>({
    seasonId: "",
    memberId: null,
    barangay: "",
    sector: "Agriculture",
    cropName: "",
    areaPlanted: null,
    areaUnit: "hectare",
    quantityProduced: 0,
    quantityUnit: "kg",
    productionCost: 0,
    harvestDate: today(),
    productionStatus: "Harvested",
    remarks: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isHighValueCropName = useCallback(
    (cropName: string, cropNames = highValueCropNames) =>
      isHighValueCropNameFromList(cropName, cropNames),
    [highValueCropNames],
  );

  useEffect(() => {
    const controller = new AbortController();
    void getHighValueCropNames(controller.signal)
      .then((names) => { if (names.length) setHighValueCropNames(names); })
      .catch(() => { /* Keep the approved fallback list when the reference endpoint is unavailable. */ });
    return () => controller.abort();
  }, []);

  const load = useCallback(async (seasonId = selectedSeasonId) => {
    setLoading(true);
    setError("");
    try {
      const nextSeasons = await listSeasons();
      const selected = seasonId ? nextSeasons.find((season) => season.id === seasonId) ?? null : null;
      const period = selected ? undefined : currentYearRange();
      const comparisonSeason = selected
        ? [...nextSeasons].filter((season) => season.startDate < selected.startDate).sort((left, right) => right.startDate.localeCompare(left.startDate))[0] ?? null
        : null;
      const [nextAnalytics, nextProduction, nextComparison] = await Promise.all([
        getSeasonalAnalytics(seasonId || undefined, period),
        listProductionRecords(seasonId || undefined, period, "Harvested"),
        comparisonSeason ? getSeasonalAnalytics(comparisonSeason.id) : getSeasonalAnalytics(undefined, previousYearRange()),
      ]);
      setSeasons(nextSeasons);
      setAnalytics(nextAnalytics);
      setComparisonAnalytics(nextComparison);
      setProductionRecords(nextProduction);
      setProductionPage(1);
      setProductionSummaryPage(1);
      setProductionCropPage(1);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Seasonal analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId]);

  // Loading the selected season synchronizes the page with the analytics API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const selectedSeason = useMemo(() => seasons.find((season) => season.id === selectedSeasonId) ?? analytics?.season ?? null, [analytics?.season, seasons, selectedSeasonId]);
  const coverage = useMemo(() => selectedSeason ? { startDate: selectedSeason.startDate, endDate: selectedSeason.endDate } : currentYearRange(), [selectedSeason]);
  const coverageLabel = selectedSeason ? `${dateLabel(coverage.startDate)} – ${dateLabel(coverage.endDate)}` : `This year · ${dateLabel(coverage.startDate)} – ${dateLabel(coverage.endDate)}`;
  const allFilteredProductionByCrop = useMemo(() => analytics?.productionByCrop.filter((crop) => cropValueFilter === "All" || (cropValueFilter === "High-Value" ? isHighValueCropName(crop.cropName, highValueCropNames) : !isHighValueCropName(crop.cropName, highValueCropNames))) ?? [], [analytics?.productionByCrop, cropValueFilter, highValueCropNames, isHighValueCropName]);
  const filteredProductionByCrop = allFilteredProductionByCrop;
  const productionSummaryPageSize = 6;
  const productionSummaryPageCount = Math.max(1, Math.ceil(filteredProductionByCrop.length / productionSummaryPageSize));
  const visibleSummaryProductionCrops = filteredProductionByCrop.slice((productionSummaryPage - 1) * productionSummaryPageSize, productionSummaryPage * productionSummaryPageSize);
  const searchedProductionByCrop = useMemo(() => {
    const query = productionCropSearch.trim().toLowerCase();
    if (!query) return allFilteredProductionByCrop;
    return allFilteredProductionByCrop.filter((crop) => `${crop.cropName} ${crop.sector}`.toLowerCase().includes(query));
  }, [allFilteredProductionByCrop, productionCropSearch]);
  const productionCropPageCount = Math.max(1, Math.ceil(searchedProductionByCrop.length / 5));
  const visibleProductionCrops = searchedProductionByCrop.slice((productionCropPage - 1) * 5, productionCropPage * 5);
  const filteredProductionRecords = useMemo(() => productionRecords.filter((record) => record.productionStatus === "Harvested" && Boolean(record.harvestDate) && (cropValueFilter === "All" || (cropValueFilter === "High-Value" ? isHighValueCropName(record.cropName, highValueCropNames) : !isHighValueCropName(record.cropName, highValueCropNames)))), [cropValueFilter, highValueCropNames, isHighValueCropName, productionRecords]);
  const productionPageCount = Math.max(1, Math.ceil(filteredProductionRecords.length / 6));
  const visibleProduction = filteredProductionRecords.slice((productionPage - 1) * 6, productionPage * 6);
  const monthlyRows = useMemo(() => {
    const byMonth = new Map((analytics?.monthlyTrend ?? []).map((item) => [item.month, item]));
    return monthKeys(coverage.startDate, coverage.endDate).map((month) => byMonth.get(month) ?? { month, productionQuantity: 0, productionCost: 0, salesTotal: 0, incomeTotal: 0, expenseTotal: 0, netResult: 0 });
  }, [analytics?.monthlyTrend, coverage.endDate, coverage.startDate]);
  const maxMonthlyValue = Math.max(...monthlyRows.map((item) => item.productionQuantity), 1);
  const productionTotalRecords = useMemo(() => analytics?.productionByCrop.reduce((total, item) => total + item.records, 0) ?? 0, [analytics?.productionByCrop]);
  const topCrop = filteredProductionByCrop[0] ?? null;
  const peakHarvestMonth = monthlyRows.reduce((best, item) => item.productionQuantity > best.productionQuantity ? item : best, monthlyRows[0] ?? { month: "", productionQuantity: 0, productionCost: 0, salesTotal: 0, incomeTotal: 0, expenseTotal: 0, netResult: 0 });
  const comparisonHasData = Boolean(comparisonAnalytics && (comparisonAnalytics.summary.productionQuantity > 0 || comparisonAnalytics.summary.productionCost > 0 || comparisonAnalytics.productionByCrop.length > 0));

  function openProductionModal(seasonId = selectedSeason?.id ?? "") {
    setProductionForm((current) => ({ ...current, seasonId }));
    setProductionModal(true);
  }

  async function saveSeason(event: FormEvent) {
    event.preventDefault();
    const nextErrors: SeasonFormErrors = {};
    if (!seasonForm.seasonName.trim()) nextErrors.seasonName = "Season name is required.";
    if (!seasonForm.seasonType.trim()) nextErrors.seasonType = "Season type is required.";
    if (!Number.isFinite(seasonForm.seasonYear) || seasonForm.seasonYear < 2000 || seasonForm.seasonYear > 2100) nextErrors.seasonYear = "Enter a year from 2000 to 2100.";
    if (!seasonForm.startDate) nextErrors.startDate = "Start date is required.";
    if (!seasonForm.endDate) nextErrors.endDate = "End date is required.";
    if (seasonForm.startDate && seasonForm.endDate && seasonForm.endDate < seasonForm.startDate) {
      nextErrors.endDate = "End date must be on or after the start date.";
    }
    setSeasonFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Complete the highlighted season fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const created = await createSeason({ ...seasonForm, seasonName: seasonForm.seasonName.trim(), description: seasonForm.description?.trim() || null });
      toast.success("Season created as draft.");
      setSeasonModal(false);
      setSeasonFormErrors({});
      setSelectedSeasonId(created.id);
      await load(created.id);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Season could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProduction(event: FormEvent) {
    event.preventDefault();
    if (!productionForm.seasonId || !productionForm.cropName.trim() || productionForm.quantityProduced <= 0 || !productionForm.harvestDate) {
      toast.error("Select a season, enter a crop and quantity, and provide the harvest date.");
      return;
    }
    const productionSeason = seasons.find((season) => season.id === productionForm.seasonId);
    if (productionSeason && (productionForm.harvestDate < productionSeason.startDate || productionForm.harvestDate > productionSeason.endDate)) {
      toast.error("Harvest date must fall within the selected season.");
      return;
    }
    setSaving(true);
    try {
      await createProductionRecord({ ...productionForm, cropName: productionForm.cropName.trim(), barangay: productionForm.barangay?.trim() || null, remarks: productionForm.remarks?.trim() || null });
      toast.success("Production record added.");
      setProductionModal(false);
      await load(productionForm.seasonId);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Production record could not be added.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, action: "activate" | "close") {
    try {
      await updateSeasonStatus(id, action);
      toast.success(action === "activate" ? "Season activated." : "Season closed.");
      await load(id);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Season status could not be updated.");
    }
  }

  function selectSeason(id: string) {
    setSelectedSeasonId(id);
    void load(id);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={canManageSeasons ? "Operations / Analytics" : undefined}
        title="Seasonal Analytics"
        description="Review actual harvested production by crop cycle, including quantity, production cost, and harvest timing."
        actions={
          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:flex-nowrap lg:items-center">
            <SeasonPicker seasons={seasons} value={selectedSeasonId} onChange={selectSeason} />
            {canManageSeasons ? <button type="button" onClick={() => setSeasonModal(true)} className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"><Plus className="size-4" />Create season</button> : null}
          </div>
        }
      />

      {!loading && analytics ? <SummaryCards analytics={analytics} comparisonAnalytics={comparisonAnalytics} comparisonLabel={selectedSeason ? "previous season" : "previous year"} /> : null}

      {selectedSeason ? (
        <div className="flex flex-col gap-4 rounded-lg border border-[#DDE8DD] bg-[#F7FAF5] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-[#123D2A]">{selectedSeason.seasonName}</h2><StatusBadge tone={seasonStatusTone(selectedSeason.seasonStatus)}>{selectedSeason.seasonStatus}</StatusBadge></div>
            <p className="mt-1 text-sm text-[#5D6D63]">{selectedSeason.seasonType} | {selectedSeason.startDate} to {selectedSeason.endDate} | {selectedSeason.productionRecordCount} harvested records</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canManageSeasons && selectedSeason.seasonStatus === "Draft" ? <button type="button" onClick={() => void changeStatus(selectedSeason.id, "activate")} className="min-h-10 rounded-md bg-[#1F6B43] px-3 text-xs font-bold text-white">Activate season</button> : null}
            {canManageSeasons && selectedSeason.seasonStatus === "Active" ? <button type="button" onClick={() => void changeStatus(selectedSeason.id, "close")} className="min-h-10 rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A]">Close season</button> : null}
            {selectedSeason.seasonStatus !== "Closed" ? <button type="button" onClick={() => openProductionModal()} className="inline-flex min-h-10 items-center rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A]"><Plus className="mr-1 size-3" />Add production</button> : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-[#CFE0D0] bg-[#F7FAF5] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-[#123D2A]">This year · all seasons</h2><StatusBadge tone="neutral">Date-based view</StatusBadge></div><p className="mt-1 text-sm text-[#5D6D63]">The dashboard uses the current calendar year and combines records linked to a season with records that fall inside the selected date range.</p></div>{canManageSeasons ? <button type="button" onClick={() => setSeasonModal(true)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-3 text-xs font-bold text-white"><Plus className="size-4" />Create season</button> : null}</div>
      )}

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingSkeleton /> : analytics ? <>
        <Panel className="harvest-coverage-panel bg-[#F7FAF5]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E8F3E9] text-[#1F6B43]"><Database className="size-5" /></div><div><h2 className="text-lg font-black text-[#123D2A]">Harvest data coverage</h2><p className="mt-1 text-sm text-[#5D6D63]">Descriptive harvest results for {coverageLabel}. Only harvested records inside the selected coverage period are included in these metrics.</p></div></div><div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><div className="rounded-md bg-white px-3 py-2"><p className="text-[0.65rem] font-black uppercase tracking-wide text-[#6C7A70]">Harvested</p><p className="mt-1 font-black text-[#123D2A]">{number(productionTotalRecords)} records</p></div><div className="rounded-md bg-white px-3 py-2"><p className="text-[0.65rem] font-black uppercase tracking-wide text-[#6C7A70]">Crop types</p><p className="mt-1 font-black text-[#123D2A]">{number(analytics.productionByCrop.length)}</p></div><div className="rounded-md bg-white px-3 py-2"><p className="text-[0.65rem] font-black uppercase tracking-wide text-[#6C7A70]">Quantity</p><p className="mt-1 font-black text-[#123D2A]">{number(analytics.summary.productionQuantity)}</p></div><div className="rounded-md bg-white px-3 py-2"><p className="text-[0.65rem] font-black uppercase tracking-wide text-[#6C7A70]">Cost / unit</p><p className="mt-1 font-black text-[#123D2A]">{analytics.summary.productionQuantity ? money(analytics.summary.productionCost / analytics.summary.productionQuantity) : "—"}</p></div></div></div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-[#123D2A]">Harvest insights</h2><p className="mt-1 text-sm text-[#6C7A70]">What was harvested during the selected season or period.</p></div><StatusBadge tone={analytics.summary.productionQuantity > 0 ? "success" : "neutral"}>{analytics.summary.productionQuantity > 0 ? "Harvest recorded" : "No harvest yet"}</StatusBadge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><InsightCard label="Top crop by quantity" value={topCrop?.cropName ?? "No crop data"} detail={topCrop ? `${number(topCrop.quantityProduced)} harvested units · ${number((topCrop.quantityProduced / Math.max(analytics.summary.productionQuantity, 1)) * 100)}% of total quantity` : "Add harvested records to identify the leading crop."} /><InsightCard label="Peak harvest month" value={peakHarvestMonth.productionQuantity ? monthLabel(peakHarvestMonth.month) : "No harvest data"} detail={peakHarvestMonth.productionQuantity ? `${number(peakHarvestMonth.productionQuantity)} harvested units in this month` : "No harvested records were found in this period."} /><InsightCard label="Highest-cost crop" value={analytics.productionByCrop.slice().sort((left, right) => right.productionCost - left.productionCost)[0]?.cropName ?? "No crop data"} detail={analytics.productionByCrop.length ? `${money(analytics.productionByCrop.slice().sort((left, right) => right.productionCost - left.productionCost)[0].productionCost)} recorded production cost` : "Production cost will appear with harvest records."} /><InsightCard label="Crop diversity" value={`${analytics.productionByCrop.length} crop type${analytics.productionByCrop.length === 1 ? "" : "s"}`} detail={`${number(productionTotalRecords)} harvested record${productionTotalRecords === 1 ? "" : "s"} in this coverage period.`} tone="gold" /><InsightCard label="Average cost per unit" value={analytics.summary.productionQuantity ? money(analytics.summary.productionCost / analytics.summary.productionQuantity) : "—"} detail="Production cost divided by total harvested quantity." tone="gold" /></div></Panel>
          <Panel><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-[#123D2A]">Harvest comparison</h2><p className="mt-1 text-sm text-[#6C7A70]">Current harvest performance compared with the previous comparable period.</p></div><span className="rounded-full bg-[#EEF2EC] px-3 py-1 text-xs font-bold text-[#1F6B43]">{selectedSeason ? "Previous season" : "Previous year"}</span></div>{comparisonHasData && comparisonAnalytics ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><ComparisonMetric label="Harvested quantity" current={analytics.summary.productionQuantity} previous={comparisonAnalytics.summary.productionQuantity} currentValue={number(analytics.summary.productionQuantity)} previousValue={number(comparisonAnalytics.summary.productionQuantity)} /><ComparisonMetric label="Production cost" current={analytics.summary.productionCost} previous={comparisonAnalytics.summary.productionCost} currentValue={money(analytics.summary.productionCost)} previousValue={money(comparisonAnalytics.summary.productionCost)} /><ComparisonMetric label="Harvest records" current={productionTotalRecords} previous={comparisonAnalytics.productionByCrop.reduce((total, crop) => total + crop.records, 0)} currentValue={number(productionTotalRecords)} previousValue={number(comparisonAnalytics.productionByCrop.reduce((total, crop) => total + crop.records, 0))} /><ComparisonMetric label="Crop types" current={analytics.productionByCrop.length} previous={comparisonAnalytics.productionByCrop.length} currentValue={number(analytics.productionByCrop.length)} previousValue={number(comparisonAnalytics.productionByCrop.length)} /></div> : <EmptyState title="No comparable harvest records" description="Create another season or record another year of harvests to compare production performance." />}</Panel>
        </div>

        <div className="seasonal-analytics-layout grid items-stretch gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="contents">
          <Panel className="min-h-0"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-[#123D2A]">Monthly harvest performance</h2><p className="mt-1 text-sm text-[#6C7A70]">Harvested quantity and production cost by month.</p></div><span className="rounded-full bg-[#EEF2EC] px-3 py-1 text-xs font-bold text-[#1F6B43]">{analytics.summary.productionQuantity ? `${money(analytics.summary.productionCost)} total cost` : "No harvest yet"}</span></div><div className="mt-4 overflow-x-auto"><div className="min-w-[49rem]"><div className="grid grid-cols-[5.5rem_minmax(9rem,1fr)_7rem_7.5rem_6.5rem] gap-3 border-b border-[#DDE8DD] px-2 pb-2 text-[0.65rem] font-black uppercase tracking-wide text-[#6C7A70]"><span>Month</span><span>Harvest volume</span><span className="text-right">Harvested</span><span className="text-right">Production cost</span><span className="text-right">Cost / unit</span></div><div className="divide-y divide-[#E7EEE7]">{monthlyRows.map((item) => <div key={item.month} className="grid grid-cols-[5.5rem_minmax(9rem,1fr)_7rem_7.5rem_6.5rem] items-center gap-3 px-2 py-3 text-xs"><span className="font-bold text-[#5D6D63]">{monthLabel(item.month)}</span><div className="h-2 overflow-hidden rounded-full bg-[#EEF2EC]"><div className="h-full rounded-full bg-[#1F6B43]" style={{ width: `${Math.min(100, (item.productionQuantity / maxMonthlyValue) * 100)}%` }} /></div><span className="text-right font-semibold text-[#1F6B43]">{number(item.productionQuantity)}</span><span className="text-right font-semibold text-[#B26408]">{money(item.productionCost)}</span><span className="text-right font-semibold text-[#123D2A]">{item.productionQuantity ? money(item.productionCost / item.productionQuantity) : "—"}</span></div>)}</div></div></div><div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-[#5D6D63]"><span><i className="mr-1 inline-block size-2 rounded-full bg-[#1F6B43]" />Harvested quantity</span><span className="text-[#6C7A70]">Production cost is shown in the adjacent column.</span></div></Panel>
          <Panel className="min-h-0"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-black text-[#123D2A]">Production by crop</h2><p className="mt-1 text-sm text-[#6C7A70]">Ranked quantity, share, and cost efficiency.</p></div><div className="flex items-center gap-2"><StyledSelect aria-label="Filter production by High-Value Crop classification" value={cropValueFilter === "All" ? "All crops" : cropValueFilter === "High-Value" ? "High-value crops" : "Other crops"} options={["All crops", "High-value crops", "Other crops"]} onChange={(value) => { setCropValueFilter(value === "All crops" ? "All" : value === "High-value crops" ? "High-Value" : "Other"); setProductionPage(1); setProductionSummaryPage(1); }} className="h-9 text-xs" /></div></div><div className="mt-4 min-h-0">{filteredProductionByCrop.length === 0 ? <EmptyState title={analytics.productionByCrop.length === 0 ? "No production records yet" : "No crops match this filter"} description={analytics.productionByCrop.length === 0 ? "Add a crop record to see production quantity and cost by season." : "Choose another crop classification to view the available records."} action={analytics.productionByCrop.length === 0 && selectedSeason && selectedSeason.seasonStatus !== "Closed" ? <button type="button" onClick={() => openProductionModal()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A]"><Plus className="size-4" />Add production</button> : null} /> : <div className="divide-y divide-[#E7EEE7]">{visibleSummaryProductionCrops.map((crop, index) => { const share = (crop.quantityProduced / Math.max(analytics.summary.productionQuantity, 1)) * 100; const costPerUnit = crop.quantityProduced > 0 ? crop.productionCost / crop.quantityProduced : 0; return <div key={`${crop.cropName}-${crop.sector}`} className="grid grid-cols-[1.5rem_1fr_auto] gap-3 py-3 text-sm"><span className="grid size-6 place-items-center rounded-full bg-[#E8F3E9] text-xs font-black text-[#1F6B43]">{(productionSummaryPage - 1) * productionSummaryPageSize + index + 1}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-[#123D2A]">{crop.cropName}</p>{isHighValueCropName(crop.cropName) ? <span className="rounded-full bg-[#FFF3D6] px-2 py-0.5 text-[0.65rem] font-black text-[#9A6700]">High-value</span> : null}</div><p className="text-xs text-[#6C7A70]">{crop.sector} · {crop.records} record{crop.records === 1 ? "" : "s"} · {number(share)}% of quantity</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF2EC]"><div className="h-full rounded-full bg-[#1F6B43]" style={{ width: `${Math.min(100, share)}%` }} /></div></div><div className="text-right"><p className="font-black text-[#1F6B43]">{number(crop.quantityProduced)}</p><p className="text-xs text-[#6C7A70]">{money(crop.productionCost)}</p><p className="text-[0.65rem] text-[#6C7A70]">{money(costPerUnit)}/unit</p></div></div>; })}</div>}</div><Pagination page={productionSummaryPage} pageCount={productionSummaryPageCount} total={filteredProductionByCrop.length} onPage={setProductionSummaryPage} pageSize={productionSummaryPageSize} alwaysVisible={filteredProductionByCrop.length > 0} /></Panel>
        </div>

        <div className="contents">
          <Panel className="h-[32rem] min-h-0 flex flex-col"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><div><h2 className="text-lg font-black text-[#123D2A]">Production records</h2><p className="mt-1 text-sm text-[#6C7A70]">Included records for {coverageLabel.toLowerCase()}.</p></div></div>{filteredProductionRecords.length > 0 ? <span className="rounded-full bg-[#EEF2EC] px-2.5 py-1 text-xs font-bold text-[#1F6B43]">{filteredProductionRecords.length}</span> : null}</div><div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{filteredProductionRecords.length === 0 ? <EmptyState title="No production records yet" description="Production records added here will appear with their crop, quantity, date, and status." action={selectedSeason && selectedSeason.seasonStatus !== "Closed" ? <button type="button" onClick={() => openProductionModal()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-xs font-bold text-white"><Plus className="size-4" />Add production</button> : null} /> : <div className="grid gap-2">{visibleProduction.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E7EEE7] bg-[#FBFCF8] p-3 text-sm"><div><p className="font-bold text-[#123D2A]">{record.cropName}</p><p className="text-xs text-[#6C7A70]">{record.sector} · {record.harvestDate ?? "No harvest date"}</p></div><div className="text-right"><p className="font-black text-[#1F6B43]">{number(record.quantityProduced)} {record.quantityUnit}</p><StatusBadge tone={record.productionStatus === "Cancelled" ? "danger" : "success"}>{record.productionStatus}</StatusBadge></div></div>)}</div>}</div><Pagination page={productionPage} pageCount={productionPageCount} total={filteredProductionRecords.length} onPage={setProductionPage} alwaysVisible={filteredProductionRecords.length > 0} /></Panel>
        </div>
        </div>
      </> : null}

      <FormDialog
        open={productionCropModal}
        onOpenChange={(open) => {
          setProductionCropModal(open);
          if (!open) {
            setProductionCropSearch("");
            setProductionCropPage(1);
          }
        }}
        title="Production by crop"
        description="Search and review every crop recorded for the selected season or period."
        contentClassName="w-[min(54rem,calc(100vw-2rem))]"
      >
        <div className="grid gap-4">
          <Input
            id="production-crop-search"
            name="productionCropSearch"
            type="search"
            label="Search crops"
            placeholder="Search by crop name or sector..."
            value={productionCropSearch}
            onChange={(event) => {
              setProductionCropSearch(event.target.value);
              setProductionCropPage(1);
            }}
          />
          {searchedProductionByCrop.length === 0 ? (
            <EmptyState
              title={allFilteredProductionByCrop.length === 0 ? "No crop records yet" : "No crops match your search"}
              description={allFilteredProductionByCrop.length === 0 ? "Production records added for this period will appear here." : "Try another crop name or sector."}
            />
          ) : (
            <>
              <div className="max-h-[28rem] overflow-y-auto rounded-md border border-[#DDE8DD] bg-[#FBFCF8] px-3">
                {visibleProductionCrops.map((crop, index) => (
                  <ProductionCropRow
                    key={`${crop.cropName}-${crop.sector}`}
                    crop={crop}
                    index={(productionCropPage - 1) * 5 + index}
                    totalQuantity={analytics?.summary.productionQuantity ?? 0}
                    cropNames={highValueCropNames}
                  />
                ))}
              </div>
              <PaginationControls
                currentPage={productionCropPage}
                totalPages={productionCropPageCount}
                totalItems={searchedProductionByCrop.length}
                itemName="crops"
                onPageChange={setProductionCropPage}
                pageSize={5}
                className="mt-0 border-t border-[#E7EEE7] pt-4"
              />
            </>
          )}
        </div>
      </FormDialog>

      {seasonModal ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#061B11]/45 p-4 backdrop-blur-sm"><form noValidate onSubmit={saveSeason} className="w-[min(38rem,100%)] rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1F6B43]">Operations</p><h2 className="mt-1 text-2xl font-black text-[#123D2A]">Create season</h2><p className="mt-1 text-sm text-[#5D6D63]">Define the date range used to group harvested production.</p></div><button type="button" onClick={() => setSeasonModal(false)} aria-label="Close create season" className="grid size-9 place-items-center rounded-md border border-[#CAD8CB]"><X className="size-4" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={`grid gap-2 text-sm font-bold ${seasonFormErrors.seasonName ? "text-[#B42318]" : "text-[#294B39]"} sm:col-span-2`}>Season name<input value={seasonForm.seasonName} onChange={(event) => { setSeasonForm((current) => ({ ...current, seasonName: event.target.value })); setSeasonFormErrors((current) => ({ ...current, seasonName: undefined })); }} className={`${inputClass} ${seasonFormErrors.seasonName ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} placeholder="2026 Main Planting Season" />{seasonFormErrors.seasonName ? <p className="text-xs font-semibold text-[#B42318]">{seasonFormErrors.seasonName}</p> : null}</label><label className={`grid gap-2 text-sm font-bold ${seasonFormErrors.seasonType ? "text-[#B42318]" : "text-[#294B39]"}`}>Type<input value={seasonForm.seasonType} onChange={(event) => { setSeasonForm((current) => ({ ...current, seasonType: event.target.value })); setSeasonFormErrors((current) => ({ ...current, seasonType: undefined })); }} className={`${inputClass} ${seasonFormErrors.seasonType ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} placeholder="Main crop" />{seasonFormErrors.seasonType ? <p className="text-xs font-semibold text-[#B42318]">{seasonFormErrors.seasonType}</p> : null}</label><label className={`grid gap-2 text-sm font-bold ${seasonFormErrors.seasonYear ? "text-[#B42318]" : "text-[#294B39]"}`}>Year<input type="number" min="2000" max="2100" value={seasonForm.seasonYear} onChange={(event) => { setSeasonForm((current) => ({ ...current, seasonYear: Number(event.target.value) })); setSeasonFormErrors((current) => ({ ...current, seasonYear: undefined })); }} className={`${inputClass} ${seasonFormErrors.seasonYear ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} />{seasonFormErrors.seasonYear ? <p className="text-xs font-semibold text-[#B42318]">{seasonFormErrors.seasonYear}</p> : null}</label><DatePicker label="Start date" value={seasonForm.startDate} error={seasonFormErrors.startDate} onChange={(value) => { setSeasonForm((current) => ({ ...current, startDate: value })); setSeasonFormErrors((current) => ({ ...current, startDate: undefined })); }} min="2000-01-01" max="2100-12-31" triggerClassName={`h-11 rounded-md px-3 text-sm ${seasonFormErrors.startDate ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} /><DatePicker label="End date" value={seasonForm.endDate} error={seasonFormErrors.endDate} onChange={(value) => { setSeasonForm((current) => ({ ...current, endDate: value })); setSeasonFormErrors((current) => ({ ...current, endDate: undefined })); }} min="2000-01-01" max="2100-12-31" triggerClassName={`h-11 rounded-md px-3 text-sm ${seasonFormErrors.endDate ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} /><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Description<textarea className="min-h-20 rounded-md border border-[#CAD8CB] p-3 text-sm" value={seasonForm.description ?? ""} onChange={(event) => setSeasonForm((current) => ({ ...current, description: event.target.value }))} placeholder="What production cycle or activity does this season represent?" /></label></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setSeasonModal(false)} className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save draft"}</button></div></form></div> : null}
      {productionModal ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#061B11]/45 p-4 backdrop-blur-sm"><form onSubmit={saveProduction} className="max-h-[calc(100vh-2rem)] w-[min(42rem,100%)] overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1F6B43]">Operations</p><h2 className="mt-1 text-2xl font-black text-[#123D2A]">Add harvest record</h2><p className="mt-1 text-sm text-[#5D6D63]">Record the actual harvested quantity and cost under a season.</p></div><button type="button" onClick={() => setProductionModal(false)} aria-label="Close production form" className="grid size-9 place-items-center rounded-md border border-[#CAD8CB]"><X className="size-4" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Season<SeasonPicker seasons={seasons.filter((season) => season.seasonStatus !== "Closed")} value={productionForm.seasonId} onChange={(value) => setProductionForm((current) => ({ ...current, seasonId: value }))} includeAll={false} /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Crop name<input required className={inputClass} value={productionForm.cropName} onChange={(event) => setProductionForm((current) => ({ ...current, cropName: event.target.value }))} placeholder="Rice" /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Sector<input required className={inputClass} value={productionForm.sector} onChange={(event) => setProductionForm((current) => ({ ...current, sector: event.target.value }))} placeholder="Agriculture" /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Quantity<input required min="0.01" step="0.01" type="number" className={inputClass} value={productionForm.quantityProduced || ""} onChange={(event) => setProductionForm((current) => ({ ...current, quantityProduced: Number(event.target.value) }))} /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Unit<StyledSelect aria-label="Production unit" value={productionForm.quantityUnit} options={productionUnitOptions} onChange={(value) => setProductionForm((current) => ({ ...current, quantityUnit: value }))} /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Production cost<input min="0" step="0.01" type="number" className={inputClass} value={productionForm.productionCost || ""} onChange={(event) => setProductionForm((current) => ({ ...current, productionCost: Number(event.target.value) }))} /></label><DatePicker label="Harvest date" value={productionForm.harvestDate ?? ""} onChange={(value) => setProductionForm((current) => ({ ...current, harvestDate: value || null }))} triggerClassName="h-11 rounded-md px-3 text-sm" /><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Barangay<input className={inputClass} value={productionForm.barangay ?? ""} onChange={(event) => setProductionForm((current) => ({ ...current, barangay: event.target.value }))} placeholder="Optional" /></label><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Remarks<textarea className="min-h-20 rounded-md border border-[#CAD8CB] p-3 text-sm" value={productionForm.remarks ?? ""} onChange={(event) => setProductionForm((current) => ({ ...current, remarks: event.target.value }))} /></label></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setProductionModal(false)} className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save harvest"}</button></div></form></div> : null}
    </div>
  );
}
