"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getChairmanDashboard,
  type ChairmanDashboardData,
  type DashboardFilters,
} from "@/features/chairman/dashboard-api";
import {
  Users, Banknote, TrendingUp, TrendingDown,
  AlertCircle, MapPin, Package, Bell,
  Download, RefreshCw, X, ChevronDown, ChevronRight, Tractor,
  ShoppingCart, ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, Filter, Search, BarChart3,
  Calendar, Map, Settings2, Clock, Activity
} from "lucide-react";
import {
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

const DemographicsMap = dynamic(() => import("./_components/DemographicsMap"), {
  ssr: false,
});
// ── Formatters ────────────────────────────────────────────────────────────────
function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(value);
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("en-PH").format(value);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#123D2A] px-3 py-1 text-xs font-semibold text-white shadow-sm">
      {label}
      <button onClick={onRemove} className="ml-0.5 rounded-full text-white/70 hover:text-white"><X className="size-3" /></button>
    </span>
  );
}

function CustomSelect({ value, onChange, options, placeholder = "Select...", className = "" }: { value: string | number, onChange: (v: any) => void, options: {label: string, value: string | number}[], placeholder?: string, className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o: any) => o.value == value)?.label || placeholder;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-full w-full items-center justify-between gap-3 rounded-lg border border-[#EEF2EC] bg-[#F7F8F3] px-3 py-1.5 text-[12px] font-semibold text-[#123D2A] outline-none hover:bg-[#EEF2EC] transition-colors shadow-sm"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[max-content] bg-white border border-[#EEF2EC] rounded-lg shadow-lg z-50 py-1 overflow-hidden whitespace-nowrap">
          {options.map((opt: any) => (
            <div 
              key={opt.value} 
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`px-3 py-2 text-[12px] cursor-pointer hover:bg-[#F7F8F3] transition-colors ${value == opt.value ? 'bg-[#EEF2EC] font-bold text-[#123D2A]' : 'text-[#5D6D63] font-medium'}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ value, className = "", neutral = false }: { value: number; className?: string; neutral?: boolean }) {
  if (value === 0 || neutral) return <span className={`flex items-center gap-0.5 text-xs font-semibold text-[#5D6D63] ${className}`}><Minus className="size-3" /> 0%</span>;
  const up = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-sm font-bold ${up ? "text-[#1F6B43]" : "text-red-500"} ${className}`}>
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? "+" : ""}{value}%
    </span>
  );
}

function SectionHeader({ title, subtitle, href, hrefLabel = "View All", icon: Icon }: { title: string; subtitle?: string; href?: string; hrefLabel?: string; icon?: any }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-[#123D2A]" />}
        <div>
          <h2 className="text-[15px] font-bold text-[#123D2A] tracking-tight">{title}</h2>
          {subtitle && <p className="text-base text-[#5D6D63] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link href={href || "#"} className="flex items-center gap-0.5 text-base font-bold text-[#1F6B43] hover:underline">
          {hrefLabel} <ChevronRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "30d", label: "Last 30 Days" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

const NASUGBU_BARANGAYS = [
  "Bagong Silang", "Balaytigui", "Banilad", "Bilaran", "Biga", "Bucana", "Bulihan", "Bundulan", "Calayo", "Catandaan", "Cogunan", "Dayap", "Gabihan", "Gelerang Kawayan", "Nansangaan", "Panilao", "Papaya", "Pooc", "Reparo", "Salaban", "Talangan", "Tumalim", "Utod", "Wawa", "Poblacion", "Lumbangan", "Malapad na Bato",
].sort();

// ── Main Component ─────────────────────────────────────────────────────────────
export function DashboardClient() {
  const [data, setData] = useState<ChairmanDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Filters
  const [period, setPeriod] = useState("year");
  const [barangay, setBarangay] = useState("");
  const [memberStatus, setMemberStatus] = useState("");
  const [incomeSource, setIncomeSource] = useState("");

  // Planner States
  const [targetMembers, setTargetMembers] = useState(300);
  const [targetSurplus, setTargetSurplus] = useState(150000);
  const [additionalContribution, setAdditionalContribution] = useState(10000);

  const activeChips: Array<{ label: string; clear: () => void }> = [];
  if (barangay) activeChips.push({ label: `Barangay: ${barangay}`, clear: () => setBarangay("") });
  if (memberStatus) activeChips.push({ label: `Status: ${memberStatus}`, clear: () => setMemberStatus("") });
  if (incomeSource) activeChips.push({ label: `Income: ${incomeSource}`, clear: () => setIncomeSource("") });

  const resetFilters = () => { setPeriod("year"); setBarangay(""); setMemberStatus(""); setIncomeSource(""); };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: DashboardFilters = {};
      if (period !== "all") filters.period = period;
      if (barangay) filters.barangay = barangay;
      if (memberStatus) filters.memberStatus = memberStatus;
      if (incomeSource) filters.incomeSource = incomeSource;
      const result = await getChairmanDashboard(filters);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [period, barangay, memberStatus, incomeSource]);

  useEffect(() => { void load(); }, [load]);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#F7F8F3] p-6 space-y-5 font-sans animate-pulse">
        <div className="flex justify-between">
          <div className="w-1/3 h-10 bg-[#EEF2EC] rounded-xl" />
          <div className="w-1/4 h-10 bg-[#EEF2EC] rounded-xl" />
        </div>
        <div className="w-full h-12 bg-[#EEF2EC] rounded-xl" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-28 bg-[#EEF2EC] rounded-2xl" />)}
        </div>
        <div className="flex gap-4">
          <div className="w-1/2 h-64 bg-[#EEF2EC] rounded-2xl" />
          <div className="w-1/2 h-64 bg-[#EEF2EC] rounded-2xl" />
        </div>
      </div>
    );
  }
  if (error && !data) return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;

  const d = data || {} as ChairmanDashboardData;
  const m = d.metrics || {} as any;
  const metrics = { totalIncome: m.totalIncome ?? 0, totalExpenses: m.totalExpenses ?? 0, netSurplus: m.netSurplus ?? 0, totalShareCapital: m.totalShareCapital ?? 0, totalMembers: m.totalMembers ?? 0, newMembersThisPeriod: m.newMembersThisPeriod ?? 0, shareCapitalThisPeriod: m.shareCapitalThisPeriod ?? 0, pendingApprovals: m.pendingApprovals ?? 0, pendingActionsCount: m.pendingActionsCount ?? 0 };
  const h = d.memberHealth || {} as any;
  const memberHealth = { active: h.active ?? 0, needsMonitoring: h.needsMonitoring ?? 0, inactive: h.inactive ?? 0 };
  const revenueTrend = d.revenueTrend || [];
  const demographics = d.demographics || [];
  const actionItems = d.actionItems || [];
  const sp = d.shareCapitalProgress || {} as any;
  const shareCapitalProgress = { reachedMinimum: sp.reachedMinimum ?? 0, belowMinimum: sp.belowMinimum ?? 0, contributingMembers: sp.contributingMembers ?? 0, reachedMaximum: sp.reachedMaximum ?? 0, totalMembers: sp.totalMembers ?? 0 };
  const os = d.operationsSnapshot || {} as any;
  const operationsSnapshot = { pos: { totalSales: os.pos?.totalSales ?? 0, transactions: os.pos?.transactions ?? 0 }, rental: { totalIncome: os.rental?.totalIncome ?? 0, completed: os.rental?.completed ?? 0, upcoming: os.rental?.upcoming ?? 0 }, inventory: { lowStock: os.inventory?.lowStock ?? 0, outOfStock: os.inventory?.outOfStock ?? 0 } };
  const recentActivity = d.recentActivity || [];
  const incomeSources = d.incomeSources || [];
  const highestIncomeSource = incomeSources.length > 0 ? incomeSources.reduce((prev: any, curr: any) => (prev.amount > curr.amount) ? prev : curr).source : "N/A";

  const healthData = [
    { name: "Active", value: memberHealth.active, color: "#1F6B43" },
    { name: "Needs Monitoring", value: memberHealth.needsMonitoring, color: "#F59E0B" },
    { name: "Inactive", value: memberHealth.inactive, color: "#DC2626" },
  ];

  // Planner Calculations based on LIVE DATA
  const curMembers = metrics.totalMembers;
  const curSurplus = metrics.netSurplus;

  const additionalNeededToHitTarget = Math.max(0, targetMembers - curMembers);
  const scenarioAMembership = curMembers + additionalNeededToHitTarget;
  const scenarioASurplus = curSurplus + (additionalNeededToHitTarget * additionalContribution);
  const pA = Math.min(100, Math.round((scenarioAMembership / targetMembers) * 100));

  const additionalMembersFromCurrent = Math.floor(additionalContribution / 1000); // rough assumption for combined
  const scenarioBSurplus = curSurplus + (curMembers * 1000); // Assume 1k extra from existing
  const scenarioCSurplus = curSurplus + (additionalNeededToHitTarget * additionalContribution) + (curMembers * 1000);

  return (
    <div className="min-h-screen bg-[#F7F8F3] p-6 space-y-5 font-sans">

      {/* ── 1. HEADER ROW ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-[26px] font-black text-[#123D2A] tracking-tight">Chairman Dashboard</h1>
          <p className="text-[12px] text-[#5D6D63] mt-1">Financial performance, membership, and cooperative operations.</p>
          <div className="flex items-center gap-1.5 mt-2 text-sm text-[#78857d]">
            <Clock className="size-3" />
            <span>Last updated: {format(new Date(d.generatedAt || Date.now()), "MMM d, yyyy h:mm a")}</span>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5D6D63]" />
            <input
              type="text"
              placeholder="Search member, transaction, payment, rental..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#CAD8CB] bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm outline-none focus:border-[#1F6B43]"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">

          <div className="relative">
            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative rounded-full border border-[#CAD8CB] bg-white p-2.5 shadow-sm hover:bg-[#EEF2EC]">
              <Bell className="size-5 text-[#123D2A]" />
              {actionItems.length > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                  {actionItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. FILTER BAR ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm border border-[#CAD8CB]">
        <div className="flex items-center gap-3">
          <CustomSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
          <CustomSelect 
            value={barangay} 
            onChange={setBarangay} 
            options={[{label: "All Barangays", value: ""}, ...NASUGBU_BARANGAYS.map(b => ({label: b, value: b}))]} 
            placeholder="All Barangays"
          />
          <CustomSelect 
            value={memberStatus} 
            onChange={setMemberStatus} 
            options={[
              {label: "All Member Statuses", value: ""},
              {label: "Active", value: "Active"},
              {label: "Needs Monitoring", value: "Needs Monitoring"},
              {label: "Inactive", value: "Inactive"}
            ]} 
            placeholder="All Member Statuses"
          />
          <CustomSelect 
            value={incomeSource} 
            onChange={setIncomeSource} 
            options={[
              {label: "All Income Sources", value: ""},
              {label: "Product / POS Sales", value: "Product / POS Sales"},
              {label: "Equipment Rental", value: "Equipment Rental"}
            ]} 
            placeholder="All Income Sources"
          />
          <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-[#123D2A] hover:bg-[#EEF2EC]">
            <Filter className="size-3.5" /> More Filters
          </button>
        </div>
        <div className="flex items-center gap-2">
          {activeChips.map(chip => <Chip key={chip.label} label={chip.label} onRemove={chip.clear} />)}
          <button onClick={resetFilters} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-[#5D6D63] hover:text-[#123D2A]">
            <RefreshCw className="size-3.5" /> Reset Filters
          </button>
        </div>
      </div>

      {/* ── 3. KPI CARDS (5 Cols) ────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Income", val: metrics.totalIncome, dlt: 0, icon: TrendingUp, note: "vs previous period" },
          { label: "Total Expenses", val: metrics.totalExpenses, dlt: 0, icon: TrendingDown, note: "vs previous period" },
          { label: "Net Surplus", val: metrics.netSurplus, dlt: 0, icon: BarChart3, note: "vs previous period", greenBg: true },
          { label: "Total Share Capital", val: metrics.totalShareCapital, dlt: 0, icon: Banknote, note: "vs previous period" },
          { label: "Total Members", val: metrics.totalMembers, dlt: 0, icon: Users, note: `${metrics.newMembersThisPeriod} new members this period`, isNum: true }
        ].map((k, i) => (
          <div key={i} className="flex flex-col justify-between rounded-2xl border border-[#CAD8CB] bg-white p-3.5 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="pr-1 min-w-0 flex-1">
                <p className="text-[11px] leading-tight font-bold text-[#5D6D63] mb-1.5 truncate">{k.label}</p>
                <p className="text-xl font-black text-[#123D2A] leading-none truncate" title={k.isNum ? formatNumber(k.val) : formatCurrency(k.val)}>{k.isNum ? formatNumber(k.val) : formatCurrency(k.val)}</p>
              </div>
              <div className={`shrink-0 rounded-full p-2 ${k.greenBg ? 'bg-[#1F6B43] text-white' : 'bg-[#EEF2EC] text-[#123D2A]'}`}>
                <k.icon className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {k.dlt > 0 ? <DeltaBadge value={k.dlt} /> : (k.isNum ? <span className="text-[10px] font-bold text-[#1F6B43]">▲ {metrics.newMembersThisPeriod > 0 ? metrics.newMembersThisPeriod : 0}</span> : <DeltaBadge value={0} neutral />)}
              <span className="text-[10px] leading-tight text-[#5D6D63]">{k.note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── ROW 1: Financial & Income Sources ────────────────────────────────── */}
      <div className="flex gap-4">
        {/* Financial Performance */}
        <div className="w-[60%] rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-black text-[#123D2A]">Financial Performance</h2>
            <div className="flex gap-4 text-base font-bold">
              <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-[#123D2A]" /> Income</span>
              <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-[#5D6D63]" /> Expenses</span>
            </div>
          </div>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#123D2A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#123D2A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5D6D63" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5D6D63" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EC" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#5D6D63", fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#5D6D63", fontSize: 10 }} tickFormatter={v => `₱${v >= 1000 ? (v / 1000) + "k" : v}`} />
                <Tooltip
                  formatter={(val: any) => formatCurrency(val as number)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #EEF2EC', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold', color: '#123D2A' }}
                />
                <Area type="monotone" dataKey="income" stroke="#123D2A" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expenses" stroke="#5D6D63" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income Sources */}
        <div className="w-[40%] rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-black text-[#123D2A]">Income Sources</h2>
            <div className="flex gap-4 text-[10px] font-bold text-[#5D6D63] text-right items-end leading-tight">
              <span className="w-20">Amount</span>
              <span className="w-10">% of<br/>Income</span>
            </div>
          </div>
          <div className="flex-1 space-y-4 flex flex-col justify-center">
            {incomeSources.map((src: any) => (
              <div key={src.source} className="flex items-center gap-3">
                <span className="w-[130px] text-xs font-bold text-[#123D2A] leading-tight truncate" title={src.source}>{src.source}</span>
                <div className="flex-1 h-2 bg-[#EEF2EC] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1F6B43] rounded-full" style={{ width: `${src.pct}%` }} />
                </div>
                <div className="flex gap-4 text-right items-center">
                  <span className="w-20 text-xs font-black text-[#123D2A] truncate" title={formatCurrency(src.amount)}>{formatCurrency(src.amount)}</span>
                  <span className="w-10 text-xs font-bold text-[#5D6D63]">{src.pct}%</span>
                </div>
              </div>
            ))}
            {incomeSources.length === 0 && (
               <div className="text-center text-xs font-medium text-[#78857d] italic py-4">No income source data available for this period.</div>
            )}
          </div>
          <div className="mt-4 border-t border-[#EEF2EC] pt-3">
            <p className="text-[11px] font-bold text-[#123D2A] flex items-center gap-1.5"><span className="text-[#1F6B43]">★</span> Highest income source: {highestIncomeSource}</p>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Membership & Share Capital ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Membership Growth */}
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col relative">
          <SectionHeader title="Membership Growth" />
          <div className="flex flex-1 mt-2">
            <div className="w-[60%] pr-4 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.membershipTrend || []} margin={{ top: 5, bottom: -10 }}>
                  <defs>
                    <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#123D2A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#123D2A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" hide />
                  <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip
                    formatter={(val: any) => val as number}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #EEF2EC', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold', color: '#123D2A' }}
                  />
                  <Area type="monotone" dataKey="members" stroke="#123D2A" strokeWidth={2} fillOpacity={1} fill="url(#colorMembers)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-1 text-xs font-semibold text-[#5D6D63]">
                {d.membershipTrend?.map(t => <span key={t.month}>{t.month.substring(0, 3)}</span>)}
              </div>
            </div>
            <div className="w-[40%] pl-4 border-l border-[#EEF2EC] flex flex-col justify-center space-y-2.5">
              <div>
                <p className="text-[11px] leading-tight font-bold text-[#5D6D63]">Total Members</p>
                <p className="text-sm font-black text-[#123D2A]">{metrics.totalMembers}</p>
              </div>
              <div>
                <p className="text-[11px] leading-tight font-bold text-[#5D6D63]">New Members This Period</p>
                <p className="text-sm font-black text-[#123D2A]">{metrics.newMembersThisPeriod}</p>
              </div>
              <div>
                <p className="text-[11px] leading-tight font-bold text-[#5D6D63] mb-0.5">Membership Growth</p>
                <DeltaBadge value={6.9} />
              </div>
            </div>
          </div>
        </div>

        {/* Member Engagement */}
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col">
          <SectionHeader title="Member Engagement" />
          <div className="flex flex-1 mt-2 items-center">
            <div className="w-1/2 h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none" labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                    if (value === 0) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
                    const angle = Number(midAngle) || 0;
                    const x = Number(cx) + radius * Math.cos(-angle * RADIAN);
                    const y = Number(cy) + radius * Math.sin(-angle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor={x > Number(cx) ? 'start' : 'end'} dominantBaseline="central" fontSize={9} fontWeight="bold">
                        {value}
                      </text>
                    );
                  }}>
                    {healthData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2.5 pl-2">
              {healthData.map(h => (
                <div key={h.name} className="flex items-center justify-between text-[11px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                    <span className="text-[#5D6D63] leading-tight">{h.name}</span>
                  </div>
                  <span className="text-[#123D2A] shrink-0 ml-2">{h.value} <span className="text-[#5D6D63] font-medium">({Math.round((h.value / metrics.totalMembers) * 100)}%)</span></span>
                </div>
              ))}
              <div className="pt-2">
                <Link href="/portal/chairman/member-indicators" className="text-[11px] font-bold text-[#1F6B43] hover:underline flex items-center gap-1">View Member Indicators <ChevronRight className="size-3" /></Link>
              </div>
            </div>
          </div>
        </div>

        {/* Share Capital Progress */}
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col">
          <SectionHeader title="Share Capital Progress" />
          <div className="flex flex-1 mt-2">
            <div className="w-[35%] border-r border-[#EEF2EC] pr-4 flex flex-col justify-center">
              <p className="text-[11px] leading-tight font-bold text-[#5D6D63] mb-0.5">Total Share Capital</p>
              <p className="text-lg font-black text-[#123D2A] leading-none">{formatCurrency(metrics.totalShareCapital)}</p>
              <div className="mt-3">
                <p className="text-[10px] font-bold text-[#5D6D63] leading-tight mb-0.5">Share capital added this period</p>
                <p className="text-sm font-black text-[#123D2A] leading-none">{formatCurrency(metrics.shareCapitalThisPeriod)}</p>
              </div>
            </div>
            <div className="w-[65%] pl-4 space-y-3 flex flex-col justify-center">
              {[
                { label: "Members with ≥ ₱10,000 minimum", val: shareCapitalProgress.reachedMinimum, color: "#123D2A", width: "90%" },
                { label: "Below minimum", val: shareCapitalProgress.belowMinimum, color: "#F59E0B", width: "30%" },
                { label: "Yet to Pay", val: shareCapitalProgress.totalMembers - shareCapitalProgress.contributingMembers, color: "#EF4444", width: "10%" },
                { label: "Reached ₱15,000 maximum", val: shareCapitalProgress.reachedMaximum, color: "#4F46E5", width: "20%" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5 items-end">
                      <span className="text-[10px] font-bold text-[#5D6D63] leading-tight pr-2">{s.label}</span>
                      <span className="text-xs font-black text-[#123D2A] shrink-0">{s.val}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#EEF2EC] rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width: s.width, backgroundColor: s.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* -- ROW 3: Map & Operations Snapshot -------------------------------------- */}
      <div className="flex gap-4">
        {/* ── LEFT COLUMN (2/3 Width) ── */}
        <div className="w-[66.67%] flex flex-col">

          {/* Barangay Map */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <SectionHeader title="Barangay Recruitment Analytics" />
            <div className="flex-1 flex gap-6 mt-4">
              <div className="w-[60%] flex flex-col relative bg-[#F7F8F3] rounded-lg border border-[#EEF2EC] overflow-hidden items-center justify-center">
                <DemographicsMap demographics={demographics} selectedBarangay={barangay} onSelectBarangay={setBarangay} />

                <div className="absolute bottom-2 left-2 right-2 pointer-events-none z-10">
                  <p className="text-sm font-bold text-[#123D2A] mb-1 drop-shadow-md bg-white/70 px-1 rounded inline-block">Member Concentration</p>
                  <div className="flex items-center gap-1 bg-white/70 p-1 rounded backdrop-blur-sm">
                    <span className="text-sm text-[#5D6D63] font-bold">Low</span>
                    <div className="flex-1 h-1.5 bg-gradient-to-r from-[#EEF2EC] to-[#123D2A] rounded-full" />
                    <span className="text-sm text-[#5D6D63] font-bold">High</span>
                  </div>
                </div>
              </div>
              <div className="w-[40%] flex flex-col justify-between">
                <div>
                  <p className="text-sm font-bold text-[#123D2A] mb-2">Top Barangays by Members</p>
                  <div className="space-y-1.5 mb-4">
                    {demographics.slice(0, 5).map((d, i) => (
                      <button
                        key={d.barangay}
                        onClick={() => setBarangay(d.barangay)}
                        className={`w-full flex items-center justify-between text-sm p-1.5 rounded transition-colors ${barangay === d.barangay ? 'bg-[#123D2A]/10' : 'hover:bg-[#F7F8F3]'}`}
                      >
                        <span className="flex items-center gap-1.5 font-medium text-[#5D6D63]"><div className="size-3.5 rounded-full bg-[#123D2A] text-white flex items-center justify-center text-[7px] font-bold">{i + 1}</div> {d.barangay}</span>
                        <span className="font-bold text-[#123D2A]">{d.totalMembers}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-sm font-bold text-[#123D2A] mb-2 pt-2 border-t border-[#EEF2EC]">Recruitment Insights</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs"><span className="text-[#5D6D63]">High growth areas</span><span className="font-bold text-[#123D2A]">4</span></div>
                    <div className="flex justify-between text-xs"><span className="text-[#5D6D63]">Moderate growth areas</span><span className="font-bold text-[#123D2A]">3</span></div>
                    <div className="flex justify-between text-xs"><span className="text-[#5D6D63]">Low growth areas</span><span className="font-bold text-[#123D2A]">2</span></div>
                  </div>
                </div>
                <button className="mt-4 w-full flex items-center justify-center gap-1.5 rounded bg-[#EEF2EC] py-1.5 text-xs font-bold text-[#123D2A] hover:bg-[#CAD8CB]">
                  <Map className="size-3" /> View Full Map Analysis
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (1/3 Width) ── */}
        <div className="w-[33.33%] flex flex-col">

          {/* Operations Snapshot */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <SectionHeader title="Operations Snapshot" />
            <div className="flex-1 flex flex-col justify-between mt-4">
              {/* POS */}
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-[#EEF2EC] pb-2">
                  <ShoppingCart className="size-4 text-[#123D2A]" />
                  <h3 className="text-[11px] font-bold text-[#123D2A]">POS / Products</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Sales</span><span className="font-bold text-[#123D2A]">{formatCurrency(operationsSnapshot.pos.totalSales)}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Transactions</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.pos.transactions}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Products Sold</span><span className="font-bold text-[#123D2A]">712</span></div>
                </div>
              </div>
              {/* Rentals */}
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-[#EEF2EC] pb-2">
                  <Tractor className="size-4 text-[#123D2A]" />
                  <h3 className="text-[11px] font-bold text-[#123D2A]">Equipment Rental</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Income</span><span className="font-bold text-[#123D2A]">{formatCurrency(operationsSnapshot.rental.totalIncome)}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Completed Rentals</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.rental.completed}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Upcoming Bookings</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.rental.upcoming}</span></div>
                </div>
              </div>
              {/* Inventory */}
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-[#EEF2EC] pb-2">
                  <Package className="size-4 text-[#123D2A]" />
                  <h3 className="text-[11px] font-bold text-[#123D2A]">Inventory</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Low-stock items</span><span className="font-bold text-red-600">{operationsSnapshot.inventory.lowStock}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Out of stock</span><span className="font-bold text-red-600">{operationsSnapshot.inventory.outOfStock}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Products available</span><span className="font-bold text-[#1F6B43]">36</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -- ROW 4: Scenario Planner & Recent Activity ---------------------------- */}
      <div className="flex gap-4 mt-4">
        {/* -- LEFT COLUMN (1/3 Width) -- */}
        <div className="w-[33.33%] flex flex-col">

          {/* Recent Activity */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <SectionHeader title="Recent Activity" icon={Activity} />
            <div className="space-y-3 mt-4 flex-1">
              {/* Real Database Activity */}
              {(recentActivity ?? []).slice(0, 5).map((act, i) => {
                let color = "bg-[#EEF2EC]";
                if (act.type === "share_capital") color = "bg-blue-500";
                if (act.type === "membership") color = "bg-amber-500";

                return (
                  <div key={i} className="flex items-center justify-between text-[11px] pb-3 border-b border-[#EEF2EC] last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`size-2.5 rounded-full ${color} ring-4 ring-[#F7F8F3] shrink-0`} />
                      <span className="text-[#5D6D63]"><span className="font-bold text-[#123D2A]">{act.actor}</span> {act.title}</span>
                    </div>
                    <span className="text-[#78857d] font-medium shrink-0 ml-2">
                      {typeof act.activityDate === 'string' ? new Date(act.activityDate).toLocaleString() : act.activityDate.toLocaleString()}
                    </span>
                  </div>
                );
              })}

              {/* Fallback Latest Activity if Database is Empty */}
              {(recentActivity ?? []).length === 0 && [
                { type: "membership", title: "New member application", actor: "Marlo Condicion", date: "Today, 9:15 AM" },
                { type: "share_capital", title: "paid ?15,000 Share Capital", actor: "Juan Dela Cruz", date: "Today, 10:00 AM" },
                { type: "membership", title: "New member application", actor: "Maria Santos", date: "Today, 11:30 AM" },
                { type: "share_capital", title: "recorded", actor: "Sales transaction #TX-5541", date: "Today, 2:30 PM" },
                { type: "inventory", title: "Corn Seeds (50kg)", actor: "Inventory updated:", date: "Today, 3:45 PM" }
              ].map((act, i) => {
                let color = act.type === "share_capital" ? "bg-blue-500" : (act.type === "membership" ? "bg-amber-500" : "bg-teal-500");
                return (
                  <div key={`mock-${i}`} className="flex items-center justify-between text-[11px] pb-3 border-b border-[#EEF2EC] last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`size-2.5 rounded-full ${color} ring-4 ring-[#F7F8F3] shrink-0`} />
                      <span className="text-[#5D6D63] leading-snug"><span className="font-bold text-[#123D2A] block">{act.actor}</span> {act.title}</span>
                    </div>
                    <span className="text-[#78857d] font-medium shrink-0 ml-2">{act.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* -- RIGHT COLUMN (2/3 Width) -- */}
        <div className="w-[66.67%] flex flex-col">

          {/* Scenario Planner */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Cooperative Scenario Planner" />
              <div className="flex gap-4 text-[10px] font-bold text-[#5D6D63] items-center">
                <span>Target Members <input type="number" value={targetMembers} onChange={e => setTargetMembers(Number(e.target.value))} className="w-12 ml-1 text-right border-b border-[#CAD8CB] outline-none text-[#123D2A] bg-transparent" /></span>
                <span>Target Net Surplus <input type="number" value={targetSurplus} onChange={e => setTargetSurplus(Number(e.target.value))} className="w-16 ml-1 text-right border-b border-[#CAD8CB] outline-none text-[#123D2A] bg-transparent" /></span>
                <span className="flex items-center gap-1.5">Additional Contribution
                  <CustomSelect 
                    value={additionalContribution} 
                    onChange={(v) => setAdditionalContribution(Number(v))} 
                    options={[
                      {label: "₱5,000", value: 5000},
                      {label: "₱10,000", value: 10000},
                      {label: "₱15,000", value: 15000}
                    ]} 
                  />
                </span>
              </div>
            </div>

            <div className="flex gap-6 flex-1">
              <div className="w-[70%] flex flex-col justify-center">
                <div className="flex text-[9px] font-bold text-[#5D6D63] mb-2 pb-1 border-b border-[#EEF2EC]">
                  <span className="w-[30%]">Scenario</span>
                  <span className="w-[40%] text-center">Projected Net Surplus</span>
                  <span className="w-[30%] text-right">Change vs Current</span>
                </div>
                {[
                  { label: "Increase Members", surplus: scenarioASurplus, growth: ((scenarioASurplus - curSurplus) / (curSurplus || 1)) * 100, p: pA },
                  { label: "Increase Contribution", surplus: scenarioBSurplus, growth: ((scenarioBSurplus - curSurplus) / (curSurplus || 1)) * 100, p: 30 },
                  { label: "Combined Strategy", surplus: scenarioCSurplus, growth: ((scenarioCSurplus - curSurplus) / (curSurplus || 1)) * 100, p: Math.min(100, pA + 30) },
                ].map(s => (
                  <div key={s.label} className="flex items-center text-[10px] py-2">
                    <span className="w-[30%] font-semibold text-[#5D6D63]">{s.label}</span>
                    <div className="w-[40%] flex items-center gap-2 pr-4">
                      <div className="flex-1 h-1.5 bg-[#EEF2EC] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1F6B43]" style={{ width: `${s.p}%` }} />
                      </div>
                      <span className="font-bold text-[#123D2A] w-14 text-right">{formatCurrency(s.surplus)}</span>
                    </div>
                    <span className="w-[30%] text-right"><DeltaBadge value={Math.round(s.growth * 10) / 10} className="justify-end" /></span>
                  </div>
                ))}
              </div>
              <div className="w-[30%] flex items-center justify-center border-l border-[#EEF2EC] pl-6">
                <div className="bg-[#F7F8F3] rounded-lg p-3 text-center border border-[#CAD8CB]">
                  <Settings2 className="size-5 text-[#1F6B43] mx-auto mb-1.5" />
                  <p className="text-[9px] text-[#5D6D63] leading-snug">Scenario results are based on current trends and user assumptions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR: Notifications ─────────────────────────────────────── */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm transition-all" onClick={() => setIsNotificationsOpen(false)}>
          <div className="w-[350px] bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#EEF2EC]">
              <h2 className="text-sm font-black text-[#123D2A] flex items-center gap-2">
                <Bell className="size-4" /> Notifications
              </h2>
              <button onClick={() => setIsNotificationsOpen(false)} className="text-[#5D6D63] hover:text-[#123D2A] p-1 rounded-md hover:bg-[#EEF2EC]">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {actionItems.length > 0 ? (
                <div className="space-y-4">
                  {actionItems.map(item => (
                    <div key={item.id} className="p-3 bg-[#F7F8F3] rounded-xl border border-[#EEF2EC]">
                      <div className="flex gap-3">
                        <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-[#123D2A]">{item.title}</p>
                          <p className="text-[10px] text-[#5D6D63] mt-1">{item.description}</p>
                          <Link href={item.href || "#"} className="text-[10px] font-bold text-[#F59E0B] hover:underline mt-2 inline-block">
                            View Details &rarr;
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[#5D6D63]">
                  <Bell className="size-8 mb-2 opacity-20" />
                  <p className="text-xs font-semibold">No new notifications</p>
                  <p className="text-sm mt-1">You're all caught up!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}