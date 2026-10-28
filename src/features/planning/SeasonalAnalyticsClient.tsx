"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { ErrorState, LoadingSkeleton, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { DatePicker } from "@/components/ui/DatePicker";
import { ApiClientError } from "@/lib/api-client";
import { HIGH_VALUE_CROP_DEFINITION, isHighValueCropName } from "@/features/crops/high-value-crops";
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

function seasonStatusTone(status: Season["seasonStatus"]): "neutral" | "success" | "warning" {
  return status === "Active" ? "success" : status === "Draft" ? "warning" : "neutral";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.06)] ${className}`}>{children}</section>;
}

function SeasonPicker({ seasons, value, onChange }: { seasons: Season[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedSeason = seasons.find((season) => season.id === value);
  const selectedLabel = selectedSeason ? `${selectedSeason.seasonName} (${selectedSeason.seasonYear})` : "This year (all seasons)";

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
        <button type="button" role="option" aria-selected={!value} onClick={() => chooseSeason("")} className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${!value ? "bg-[#E8F3E9] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F3F8F2]"}`}>This year (all seasons)</button>
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

function Pagination({ page, pageCount, total, onPrevious, onNext }: { page: number; pageCount: number; total: number; onPrevious: () => void; onNext: () => void }) {
  if (pageCount <= 1) return null;
  return <div className="mt-3 flex shrink-0 items-center justify-between border-t border-[#E7EEE7] pt-3 text-xs font-semibold text-[#6C7A70]"><span>Showing {(page - 1) * 6 + 1}-{Math.min(page * 6, total)} of {total}</span><div className="flex gap-1"><button type="button" onClick={onPrevious} disabled={page === 1} aria-label="Previous page" className="grid size-8 place-items-center rounded-md border border-[#CAD8CB] bg-white disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button><button type="button" onClick={onNext} disabled={page === pageCount} aria-label="Next page" className="grid size-8 place-items-center rounded-md border border-[#CAD8CB] bg-white disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button></div></div>;
}

function SummaryCards({ analytics }: { analytics: SeasonalAnalytics }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Production" value={number(analytics.summary.productionQuantity)} icon={Factory} valueClassName="text-xl whitespace-nowrap tracking-tight" className="h-[7.5rem]" /><StatCard label="POS sales" value={money(analytics.summary.salesTotal)} icon={TrendingUp} valueClassName="text-xl whitespace-nowrap tracking-tight" className="h-[7.5rem]" /><StatCard label="Other income" value={money(analytics.summary.incomeTotal)} icon={CheckCircle2} valueClassName="text-xl whitespace-nowrap tracking-tight" className="h-[7.5rem]" /><StatCard label="Expenses" value={money(analytics.summary.expenseTotal)} icon={BarChart3} valueClassName="text-xl whitespace-nowrap tracking-tight" className="h-[7.5rem]" /><StatCard label="Net result" value={money(analytics.summary.netResult)} icon={analytics.summary.netResult >= 0 ? CheckCircle2 : BarChart3} valueClassName="text-xl whitespace-nowrap tracking-tight" className="h-[7.5rem]" /></div>;
}

type Props = { canManageSeasons?: boolean };
type FinancialFilter = "All" | "Income" | "Expense";
type CropValueFilter = "All" | "High-Value" | "Other";
type SeasonFormErrors = Partial<Record<"seasonName" | "seasonType" | "seasonYear" | "startDate" | "endDate", string>>;

export function SeasonalAnalyticsClient({ canManageSeasons = true }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [analytics, setAnalytics] = useState<SeasonalAnalytics | null>(null);
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [financialFilter, setFinancialFilter] = useState<FinancialFilter>("All");
  const [cropValueFilter, setCropValueFilter] = useState<CropValueFilter>("All");
  const [financialPage, setFinancialPage] = useState(1);
  const [productionPage, setProductionPage] = useState(1);
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
    productionStatus: "Recorded",
    remarks: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (seasonId = selectedSeasonId) => {
    setLoading(true);
    setError("");
    try {
      const [nextSeasons, nextAnalytics, nextProduction] = await Promise.all([
        listSeasons(),
        getSeasonalAnalytics(seasonId || undefined, seasonId ? undefined : currentYearRange()),
        listProductionRecords(seasonId || undefined),
      ]);
      setSeasons(nextSeasons);
      setAnalytics(nextAnalytics);
      setProductionRecords(nextProduction);
      setFinancialPage(1);
      setProductionPage(1);
      if (!seasonId && nextSeasons[0]) setSelectedSeasonId(nextSeasons[0].id);
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
  const filteredFinancial = useMemo(() => analytics?.financialByCategory.filter((item) => financialFilter === "All" || item.recordType === financialFilter) ?? [], [analytics?.financialByCategory, financialFilter]);
  const financialPageCount = Math.max(1, Math.ceil(filteredFinancial.length / 6));
  const visibleFinancial = filteredFinancial.slice((financialPage - 1) * 6, financialPage * 6);
  const filteredProductionByCrop = useMemo(() => analytics?.productionByCrop.filter((crop) => cropValueFilter === "All" || (cropValueFilter === "High-Value" ? isHighValueCropName(crop.cropName) : !isHighValueCropName(crop.cropName))) ?? [], [analytics?.productionByCrop, cropValueFilter]);
  const filteredProductionRecords = useMemo(() => productionRecords.filter((record) => cropValueFilter === "All" || (cropValueFilter === "High-Value" ? isHighValueCropName(record.cropName) : !isHighValueCropName(record.cropName))), [cropValueFilter, productionRecords]);
  const productionPageCount = Math.max(1, Math.ceil(filteredProductionRecords.length / 6));
  const visibleProduction = filteredProductionRecords.slice((productionPage - 1) * 6, productionPage * 6);
  const maxMonthlyValue = Math.max(...(analytics?.monthlyTrend.map((item) => Math.max(item.salesTotal, item.incomeTotal, item.expenseTotal)) ?? [1]), 1);

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
    if (!productionForm.seasonId || !productionForm.cropName.trim() || productionForm.quantityProduced <= 0) {
      toast.error("Select a season and enter a crop with a quantity greater than zero.");
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
    setFinancialPage(1);
    void load(id);
  }

  function changeFinancialFilter(filter: FinancialFilter) {
    setFinancialFilter(filter);
    setFinancialPage(1);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Operations / Analytics"
        title="Seasonal Analytics"
        description="Connect production, sales, income, and expenses to a defined season so the cooperative can compare performance by crop cycle."
        actions={
          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:flex-nowrap lg:items-center">
            <SeasonPicker seasons={seasons} value={selectedSeasonId} onChange={selectSeason} />
            {canManageSeasons ? <button type="button" onClick={() => setSeasonModal(true)} className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"><Plus className="size-4" />Create season</button> : null}
          </div>
        }
      />

      {!loading && analytics ? <SummaryCards analytics={analytics} /> : null}

      {selectedSeason ? (
        <div className="flex flex-col gap-4 rounded-lg border border-[#DDE8DD] bg-[#F7FAF5] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-[#123D2A]">{selectedSeason.seasonName}</h2><StatusBadge tone={seasonStatusTone(selectedSeason.seasonStatus)}>{selectedSeason.seasonStatus}</StatusBadge></div>
            <p className="mt-1 text-sm text-[#5D6D63]">{selectedSeason.seasonType} | {selectedSeason.startDate} to {selectedSeason.endDate} | {selectedSeason.productionRecordCount} production records</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canManageSeasons && selectedSeason.seasonStatus === "Draft" ? <button type="button" onClick={() => void changeStatus(selectedSeason.id, "activate")} className="min-h-10 rounded-md bg-[#1F6B43] px-3 text-xs font-bold text-white">Activate season</button> : null}
            {canManageSeasons && selectedSeason.seasonStatus === "Active" ? <button type="button" onClick={() => void changeStatus(selectedSeason.id, "close")} className="min-h-10 rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A]">Close season</button> : null}
            {selectedSeason.seasonStatus !== "Closed" ? <button type="button" onClick={() => openProductionModal()} className="inline-flex min-h-10 items-center rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A]"><Plus className="mr-1 size-3" />Add production</button> : null}
          </div>
        </div>
      ) : (
        <EmptyState title="Dashboard period: This year" description="No season is configured yet. The metrics below use the same This Year period as the Financial Dashboard." action={canManageSeasons ? <button type="button" onClick={() => setSeasonModal(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-xs font-bold text-white"><Plus className="size-4" />Create first season</button> : null} />
      )}

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingSkeleton /> : analytics ? <>
        <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel className="h-[24rem] min-h-0 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-[#123D2A]">Monthly performance</h2><p className="mt-1 text-sm text-[#6C7A70]">POS sales and expenses for the selected season.</p></div><span className="rounded-full bg-[#EEF2EC] px-3 py-1 text-xs font-bold text-[#1F6B43]">{analytics.summary.profitMargin.toFixed(1)}% margin</span></div>
            {analytics.monthlyTrend.length === 0 ? <div className="mt-5"><EmptyState title="No linked transactions yet" description="Add season tags to records or use dates inside the season range to populate this trend." /></div> : <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{analytics.monthlyTrend.map((item) => <div key={item.month} className="grid gap-2 sm:grid-cols-[5rem_1fr_8rem] sm:items-center"><span className="text-xs font-bold text-[#5D6D63]">{item.month}</span><div className="grid gap-1"><div className="h-2 overflow-hidden rounded-full bg-[#EEF2EC]"><div className="h-full rounded-full bg-[#1F6B43]" style={{ width: `${Math.min(100, (item.salesTotal / maxMonthlyValue) * 100)}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-[#EEF2EC]"><div className="h-full rounded-full bg-[#D8A011]" style={{ width: `${Math.min(100, (item.expenseTotal / maxMonthlyValue) * 100)}%` }} /></div></div><span className="text-right text-xs font-semibold text-[#5D6D63]">{money(item.netResult)}</span></div>)}</div>}
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-[#5D6D63]"><span><i className="mr-1 inline-block size-2 rounded-full bg-[#1F6B43]" />Sales</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#D8A011]" />Expenses</span></div>
          </Panel>
          <Panel className="h-[24rem] min-h-0 flex flex-col">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-black text-[#123D2A]">Production by crop</h2><p className="mt-1 text-sm text-[#6C7A70]">Harvest quantity and recorded production cost.</p></div><div className="flex items-center gap-2"><select title={HIGH_VALUE_CROP_DEFINITION} aria-label="Filter production by High-Value Crop classification" value={cropValueFilter} onChange={(event) => { setCropValueFilter(event.target.value as CropValueFilter); setProductionPage(1); }} className="h-9 rounded-md border border-[#CAD8CB] bg-white px-2 text-xs font-bold text-[#294B39]"><option value="All">All crops</option><option value="High-Value">High-value crops</option><option value="Other">Other crops</option></select><Factory className="size-5 text-[#1F6B43]" /></div></div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{filteredProductionByCrop.length === 0 ? <EmptyState title={analytics.productionByCrop.length === 0 ? "No production records yet" : "No crops match this filter"} description={analytics.productionByCrop.length === 0 ? "Add a crop record to see production quantity and cost by season." : "Choose another crop classification to view the available records."} action={analytics.productionByCrop.length === 0 && selectedSeason && selectedSeason.seasonStatus !== "Closed" ? <button type="button" onClick={() => openProductionModal()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A]"><Plus className="size-4" />Add production</button> : null} /> : filteredProductionByCrop.slice(0, 8).map((crop) => <div key={`${crop.cropName}-${crop.sector}`} className="flex items-center justify-between gap-3 border-b border-[#E7EEE7] py-3 text-sm"><div><p className="font-bold text-[#123D2A]">{crop.cropName}</p><p className="text-xs text-[#6C7A70]">{crop.sector} | {crop.records} record{crop.records === 1 ? "" : "s"}</p></div><div className="text-right"><p className="font-black text-[#1F6B43]">{number(crop.quantityProduced)}</p><p className="text-xs text-[#6C7A70]">{money(crop.productionCost)}</p></div></div>)}</div>
          </Panel>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[1fr_1fr]">
          <Panel className="h-[32rem] min-h-0 flex flex-col">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-black text-[#123D2A]">Financial breakdown</h2><p className="mt-1 text-sm text-[#6C7A70]">Posted records included in this season.</p></div><div className="flex rounded-md border border-[#DDE8DD] bg-[#F7FAF5] p-1 text-xs font-bold"><button type="button" onClick={() => changeFinancialFilter("All")} className={`rounded px-2.5 py-1.5 ${financialFilter === "All" ? "bg-white text-[#123D2A] shadow-sm" : "text-[#6C7A70]"}`}>All</button><button type="button" onClick={() => changeFinancialFilter("Income")} className={`rounded px-2.5 py-1.5 ${financialFilter === "Income" ? "bg-white text-[#1F6B43] shadow-sm" : "text-[#6C7A70]"}`}>Income</button><button type="button" onClick={() => changeFinancialFilter("Expense")} className={`rounded px-2.5 py-1.5 ${financialFilter === "Expense" ? "bg-white text-[#B26408] shadow-sm" : "text-[#6C7A70]"}`}>Expenses</button></div></div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{filteredFinancial.length === 0 ? <EmptyState title="No financial records" description="There are no posted records for this season and filter yet." /> : visibleFinancial.map((item) => <div key={`${item.recordType}-${item.categoryName}`} className="flex items-center justify-between gap-3 border-b border-[#E7EEE7] py-3 text-sm"><div><p className="font-bold text-[#123D2A]">{item.categoryName}</p><p className="text-xs text-[#6C7A70]">{item.recordType} | {item.records} record{item.records === 1 ? "" : "s"}</p></div><strong className={item.recordType === "Expense" ? "text-[#B26408]" : "text-[#1F6B43]"}>{money(item.amount)}</strong></div>)}</div><Pagination page={financialPage} pageCount={financialPageCount} total={filteredFinancial.length} onPrevious={() => setFinancialPage((page) => Math.max(1, page - 1))} onNext={() => setFinancialPage((page) => Math.min(financialPageCount, page + 1))} />
          </Panel>
          <Panel className="h-[32rem] min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="size-5 text-[#1F6B43]" /><div><h2 className="text-lg font-black text-[#123D2A]">Production records</h2><p className="mt-1 text-sm text-[#6C7A70]">Recent records for the selected season.</p></div></div>{productionRecords.length > 0 ? <span className="rounded-full bg-[#EEF2EC] px-2.5 py-1 text-xs font-bold text-[#1F6B43]">{productionRecords.length}</span> : null}</div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{filteredProductionRecords.length === 0 ? <EmptyState title={productionRecords.length === 0 ? "No production records yet" : "No records match this filter"} description={productionRecords.length === 0 ? "Production records added here will appear with their crop, quantity, date, and status." : "Choose another crop classification to view the available records."} action={productionRecords.length === 0 && selectedSeason && selectedSeason.seasonStatus !== "Closed" ? <button type="button" onClick={() => openProductionModal()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-xs font-bold text-white"><Plus className="size-4" />Add production</button> : null} /> : <div className="grid gap-2">{visibleProduction.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E7EEE7] bg-[#FBFCF8] p-3 text-sm"><div><p className="font-bold text-[#123D2A]">{record.cropName}</p><p className="text-xs text-[#6C7A70]">{record.sector} | {record.harvestDate ?? "No harvest date"}</p></div><div className="text-right"><p className="font-black text-[#1F6B43]">{number(record.quantityProduced)} {record.quantityUnit}</p><StatusBadge tone={record.productionStatus === "Cancelled" ? "danger" : "success"}>{record.productionStatus}</StatusBadge></div></div>)}</div>}</div><Pagination page={productionPage} pageCount={productionPageCount} total={filteredProductionRecords.length} onPrevious={() => setProductionPage((page) => Math.max(1, page - 1))} onNext={() => setProductionPage((page) => Math.min(productionPageCount, page + 1))} />
          </Panel>
        </div>
      </> : null}

      {seasonModal ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#061B11]/45 p-4 backdrop-blur-sm"><form noValidate onSubmit={saveSeason} className="w-[min(38rem,100%)] rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1F6B43]">Operations</p><h2 className="mt-1 text-2xl font-black text-[#123D2A]">Create season</h2><p className="mt-1 text-sm text-[#5D6D63]">Define the date range used to group production and financial activity.</p></div><button type="button" onClick={() => setSeasonModal(false)} aria-label="Close create season" className="grid size-9 place-items-center rounded-md border border-[#CAD8CB]"><X className="size-4" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={`grid gap-2 text-sm font-bold ${seasonFormErrors.seasonName ? "text-[#B42318]" : "text-[#294B39]"} sm:col-span-2`}>Season name<input value={seasonForm.seasonName} onChange={(event) => { setSeasonForm((current) => ({ ...current, seasonName: event.target.value })); setSeasonFormErrors((current) => ({ ...current, seasonName: undefined })); }} className={`${inputClass} ${seasonFormErrors.seasonName ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} placeholder="2026 Main Planting Season" />{seasonFormErrors.seasonName ? <p className="text-xs font-semibold text-[#B42318]">{seasonFormErrors.seasonName}</p> : null}</label><label className={`grid gap-2 text-sm font-bold ${seasonFormErrors.seasonType ? "text-[#B42318]" : "text-[#294B39]"}`}>Type<input value={seasonForm.seasonType} onChange={(event) => { setSeasonForm((current) => ({ ...current, seasonType: event.target.value })); setSeasonFormErrors((current) => ({ ...current, seasonType: undefined })); }} className={`${inputClass} ${seasonFormErrors.seasonType ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} placeholder="Main crop" />{seasonFormErrors.seasonType ? <p className="text-xs font-semibold text-[#B42318]">{seasonFormErrors.seasonType}</p> : null}</label><label className={`grid gap-2 text-sm font-bold ${seasonFormErrors.seasonYear ? "text-[#B42318]" : "text-[#294B39]"}`}>Year<input type="number" min="2000" max="2100" value={seasonForm.seasonYear} onChange={(event) => { setSeasonForm((current) => ({ ...current, seasonYear: Number(event.target.value) })); setSeasonFormErrors((current) => ({ ...current, seasonYear: undefined })); }} className={`${inputClass} ${seasonFormErrors.seasonYear ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} />{seasonFormErrors.seasonYear ? <p className="text-xs font-semibold text-[#B42318]">{seasonFormErrors.seasonYear}</p> : null}</label><DatePicker label="Start date" value={seasonForm.startDate} error={seasonFormErrors.startDate} onChange={(value) => { setSeasonForm((current) => ({ ...current, startDate: value })); setSeasonFormErrors((current) => ({ ...current, startDate: undefined })); }} min="2000-01-01" max="2100-12-31" triggerClassName={`h-11 rounded-md px-3 text-sm ${seasonFormErrors.startDate ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} /><DatePicker label="End date" value={seasonForm.endDate} error={seasonFormErrors.endDate} onChange={(value) => { setSeasonForm((current) => ({ ...current, endDate: value })); setSeasonFormErrors((current) => ({ ...current, endDate: undefined })); }} min="2000-01-01" max="2100-12-31" triggerClassName={`h-11 rounded-md px-3 text-sm ${seasonFormErrors.endDate ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} /><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Description<textarea className="min-h-20 rounded-md border border-[#CAD8CB] p-3 text-sm" value={seasonForm.description ?? ""} onChange={(event) => setSeasonForm((current) => ({ ...current, description: event.target.value }))} placeholder="What production cycle or activity does this season represent?" /></label></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setSeasonModal(false)} className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save draft"}</button></div></form></div> : null}
      {productionModal ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#061B11]/45 p-4 backdrop-blur-sm"><form onSubmit={saveProduction} className="max-h-[calc(100vh-2rem)] w-[min(42rem,100%)] overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1F6B43]">Operations</p><h2 className="mt-1 text-2xl font-black text-[#123D2A]">Add production record</h2><p className="mt-1 text-sm text-[#5D6D63]">Record harvested quantity and cost under a season.</p></div><button type="button" onClick={() => setProductionModal(false)} aria-label="Close production form" className="grid size-9 place-items-center rounded-md border border-[#CAD8CB]"><X className="size-4" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Season<select required className={inputClass} value={productionForm.seasonId} onChange={(event) => setProductionForm((current) => ({ ...current, seasonId: event.target.value }))}><option value="">Select season</option>{seasons.filter((season) => season.seasonStatus !== "Closed").map((season) => <option key={season.id} value={season.id}>{season.seasonName}</option>)}</select></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Crop name<input required className={inputClass} value={productionForm.cropName} onChange={(event) => setProductionForm((current) => ({ ...current, cropName: event.target.value }))} placeholder="Rice" /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Sector<input required className={inputClass} value={productionForm.sector} onChange={(event) => setProductionForm((current) => ({ ...current, sector: event.target.value }))} placeholder="Agriculture" /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Quantity<input required min="0.01" step="0.01" type="number" className={inputClass} value={productionForm.quantityProduced || ""} onChange={(event) => setProductionForm((current) => ({ ...current, quantityProduced: Number(event.target.value) }))} /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Unit<input required className={inputClass} value={productionForm.quantityUnit} onChange={(event) => setProductionForm((current) => ({ ...current, quantityUnit: event.target.value }))} placeholder="kg" /></label><label className="grid gap-2 text-sm font-bold text-[#294B39]">Production cost<input min="0" step="0.01" type="number" className={inputClass} value={productionForm.productionCost || ""} onChange={(event) => setProductionForm((current) => ({ ...current, productionCost: Number(event.target.value) }))} /></label><DatePicker label="Harvest date (optional)" value={productionForm.harvestDate ?? ""} onChange={(value) => setProductionForm((current) => ({ ...current, harvestDate: value || null }))} allowClear triggerClassName="h-11 rounded-md px-3 text-sm" /><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Barangay<input className={inputClass} value={productionForm.barangay ?? ""} onChange={(event) => setProductionForm((current) => ({ ...current, barangay: event.target.value }))} placeholder="Optional" /></label><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Remarks<textarea className="min-h-20 rounded-md border border-[#CAD8CB] p-3 text-sm" value={productionForm.remarks ?? ""} onChange={(event) => setProductionForm((current) => ({ ...current, remarks: event.target.value }))} /></label></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setProductionModal(false)} className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save record"}</button></div></form></div> : null}
    </div>
  );
}
