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
  Download, RefreshCw, X, ChevronRight, Tractor,
  ShoppingCart, ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, Filter, Search, BarChart3,
  Calendar, Map, Settings2
} from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import Link from "next/link";
import Image from "next/image";

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

function DeltaBadge({ value, className = "", neutral = false }: { value: number; className?: string; neutral?: boolean }) {
  if (value === 0 || neutral) return <span className={`flex items-center gap-0.5 text-xs font-semibold text-[#5D6D63] ${className}`}><Minus className="size-3" /> 0%</span>;
  const up = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? "text-[#1F6B43]" : "text-red-500"} ${className}`}>
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
          {subtitle && <p className="text-[11px] text-[#5D6D63] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link href={href || "#"} className="flex items-center gap-0.5 text-[11px] font-bold text-[#1F6B43] hover:underline">
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
  "Bagong Silang","Balaytigui","Banilad","Bilaran","Biga","Bucana","Bulihan","Bundulan","Calayo","Catandaan","Cogunan","Dayap","Gabihan","Gelerang Kawayan","Nansangaan","Panilao","Papaya","Pooc","Reparo","Salaban","Talangan","Tumalim","Utod","Wawa","Poblacion","Lumbangan","Malapad na Bato",
].sort();

// ── Main Component ─────────────────────────────────────────────────────────────
export function DashboardClient() {
  const [data, setData] = useState<ChairmanDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
    return <div className="flex h-screen items-center justify-center"><RefreshCw className="size-8 animate-spin text-[#1F6B43]" /></div>;
  }
  if (error && !data) return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;

  const d = data!;
  const { metrics, memberHealth, revenueTrend, demographics, actionItems, incomeSources, shareCapitalProgress, operationsSnapshot, recentActivity } = d;

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
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[#78857d]">
            <Clock className="size-3" />
            <span>Last updated: {format(new Date(d.generatedAt), "MMM d, yyyy h:mm a")}</span>
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
            <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#123D2A]" />
            <select value={period} onChange={e => setPeriod(e.target.value)} className="appearance-none rounded-xl border border-[#CAD8CB] bg-white py-2.5 pl-9 pr-8 text-sm font-bold text-[#123D2A] shadow-sm outline-none">
              {PERIOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1F6B43]">
            <Download className="size-4" /> Export Report
          </button>
          <button className="relative rounded-full border border-[#CAD8CB] bg-white p-2.5 shadow-sm hover:bg-[#EEF2EC]">
            <Bell className="size-5 text-[#123D2A]" />
            {actionItems.length > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">{actionItems.length}</span>}
          </button>
        </div>
      </div>

      {/* ── 2. FILTER BAR ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm border border-[#CAD8CB]">
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg border border-[#EEF2EC] bg-[#F7F8F3] px-3 py-1.5 text-[12px] font-semibold text-[#123D2A] outline-none">
            {PERIOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={barangay} onChange={e => setBarangay(e.target.value)} className="rounded-lg border border-[#EEF2EC] bg-[#F7F8F3] px-3 py-1.5 text-[12px] font-semibold text-[#123D2A] outline-none">
            <option value="">All Barangays</option>
            {NASUGBU_BARANGAYS.map(b => <option key={b}>{b}</option>)}
          </select>
          <select value={memberStatus} onChange={e => setMemberStatus(e.target.value)} className="rounded-lg border border-[#EEF2EC] bg-[#F7F8F3] px-3 py-1.5 text-[12px] font-semibold text-[#123D2A] outline-none">
            <option value="">All Member Statuses</option>
            <option>Active</option>
            <option>Needs Monitoring</option>
            <option>Inactive</option>
          </select>
          <select value={incomeSource} onChange={e => setIncomeSource(e.target.value)} className="rounded-lg border border-[#EEF2EC] bg-[#F7F8F3] px-3 py-1.5 text-[12px] font-semibold text-[#123D2A] outline-none">
            <option value="">All Income Sources</option>
            <option>Product / POS Sales</option>
            <option>Equipment Rental</option>
          </select>
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
          { label: "Total Income", val: metrics.totalIncome, dlt: 18.7, icon: TrendingUp, note: "vs previous period" },
          { label: "Total Expenses", val: metrics.totalExpenses, dlt: 11.5, icon: TrendingDown, note: "vs previous period" },
          { label: "Net Surplus", val: metrics.netSurplus, dlt: 26.9, icon: BarChart3, note: "vs previous period", greenBg: true },
          { label: "Total Share Capital", val: metrics.totalShareCapital, dlt: 14.3, icon: Banknote, note: "vs previous period" },
          { label: "Total Members", val: metrics.totalMembers, dlt: 0, icon: Users, note: `${metrics.newMembersThisPeriod} new members this period`, isNum: true }
        ].map((k, i) => (
          <div key={i} className="flex flex-col justify-between rounded-2xl border border-[#CAD8CB] bg-white p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold text-[#5D6D63] mb-1">{k.label}</p>
                <p className="text-[22px] font-black text-[#123D2A]">{k.isNum ? formatNumber(k.val) : formatCurrency(k.val)}</p>
              </div>
              <div className={`rounded-full p-2.5 ${k.greenBg ? 'bg-[#1F6B43] text-white' : 'bg-[#EEF2EC] text-[#123D2A]'}`}>
                <k.icon className="size-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {k.dlt > 0 ? <DeltaBadge value={k.dlt} /> : (k.isNum ? <span className="text-[10px] font-bold text-[#1F6B43]">▲ {metrics.newMembersThisPeriod > 0 ? metrics.newMembersThisPeriod : 0}</span> : <DeltaBadge value={0} neutral />)}
              <span className="text-[10px] text-[#5D6D63]">{k.note}</span>
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
            <div className="flex gap-4 text-[11px] font-bold">
              <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-[#123D2A]"/> Income</span>
              <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-[#5D6D63]"/> Expenses</span>
            </div>
          </div>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EC" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#5D6D63", fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#5D6D63", fontSize: 10 }} tickFormatter={v => `₱${v >= 1000 ? (v / 1000) + "k" : v}`} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="income" stroke="#123D2A" strokeWidth={3} dot={{ r: 4, fill: "#123D2A", strokeWidth: 0 }} />
                <Line type="monotone" dataKey="expenses" stroke="#5D6D63" strokeWidth={3} dot={{ r: 4, fill: "#5D6D63", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income Sources */}
        <div className="w-[40%] rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[14px] font-black text-[#123D2A]">Income Sources</h2>
            <div className="flex gap-4 text-[10px] font-bold text-[#5D6D63] text-right">
              <span className="w-20">Amount</span>
              <span className="w-12">% of Income</span>
            </div>
          </div>
          <div className="flex-1 space-y-5">
            {[
              { label: "Product / POS Sales", val: operationsSnapshot.pos.totalSales, pct: 48 },
              { label: "Equipment Rental", val: operationsSnapshot.rental.totalIncome, pct: 28 },
              { label: "Other Operating Income", val: 46520, pct: 15 },
              { label: "Membership-related", val: 28360, pct: 9 }
            ].map(src => (
              <div key={src.label} className="flex items-center gap-3">
                <span className="w-[140px] text-[11px] font-semibold text-[#123D2A] leading-tight">{src.label}</span>
                <div className="flex-1 h-3 bg-[#EEF2EC] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1F6B43] rounded-full" style={{ width: `${src.pct}%` }} />
                </div>
                <div className="flex gap-4 text-right">
                  <span className="w-20 text-[11px] font-bold text-[#123D2A]">{formatCurrency(src.val)}</span>
                  <span className="w-12 text-[11px] font-bold text-[#5D6D63]">{src.pct}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[#EEF2EC] pt-3">
            <p className="text-[10px] font-bold text-[#123D2A] flex items-center gap-1.5"><span className="text-[#1F6B43]">★</span> Highest income source: Product / POS Sales</p>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Membership & Share Capital ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Membership Growth */}
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col relative">
          <SectionHeader title="Membership Growth" />
          <div className="flex flex-1 mt-2">
            <div className="w-[60%] pr-4 h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[{v:100},{v:120},{v:150},{v:190},{v:220},{v:248}]}>
                  <XAxis dataKey="name" hide />
                  <YAxis hide domain={[0, 300]} />
                  <Line type="monotone" dataKey="v" stroke="#123D2A" strokeWidth={2} dot={{ r: 3, fill: "#1F6B43" }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-1 text-[9px] font-semibold text-[#5D6D63]">
                <span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span>
              </div>
            </div>
            <div className="w-[40%] pl-4 border-l border-[#EEF2EC] flex flex-col justify-center space-y-3">
              <div>
                <p className="text-[10px] font-bold text-[#5D6D63]">Total Members</p>
                <p className="text-[16px] font-black text-[#123D2A]">{metrics.totalMembers}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#5D6D63]">New Members This Period</p>
                <p className="text-[16px] font-black text-[#123D2A]">{metrics.newMembersThisPeriod}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#5D6D63]">Membership Growth</p>
                <DeltaBadge value={6.9} />
              </div>
            </div>
          </div>
        </div>

        {/* Member Engagement */}
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <SectionHeader title="Member Engagement" />
          <div className="flex flex-1 mt-2 items-center">
            <div className="w-1/2 h-[120px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                    {healthData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Fake labels on donut matching image */}
              <span className="absolute top-[35%] left-[25%] text-[9px] font-bold text-white">32</span>
              <span className="absolute bottom-[20%] right-[30%] text-[10px] font-bold text-white">164</span>
            </div>
            <div className="w-1/2 space-y-2.5 pl-2">
              {healthData.map(h => (
                <div key={h.name} className="flex items-center justify-between text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full" style={{ backgroundColor: h.color }} />
                    <span className="text-[#5D6D63]">{h.name}</span>
                  </div>
                  <span className="text-[#123D2A]">{h.value} <span className="text-[#5D6D63] font-medium">({Math.round((h.value/metrics.totalMembers)*100)}%)</span></span>
                </div>
              ))}
              <div className="pt-2">
                <Link href="/portal/chairman/member-indicators" className="text-[10px] font-bold text-[#1F6B43] hover:underline flex items-center gap-1">View Member Indicators <ChevronRight className="size-3" /></Link>
              </div>
            </div>
          </div>
        </div>

        {/* Share Capital Progress */}
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <SectionHeader title="Share Capital Progress" />
          <div className="flex flex-1 mt-2">
            <div className="w-[35%] border-r border-[#EEF2EC] pr-4 flex flex-col justify-center">
              <p className="text-[10px] font-bold text-[#5D6D63]">Total Share Capital</p>
              <p className="text-[18px] font-black text-[#123D2A] leading-tight">{formatCurrency(metrics.totalShareCapital)}</p>
              <div className="mt-3">
                <p className="text-[9px] font-bold text-[#5D6D63] leading-tight">Share capital added this period</p>
                <p className="text-[13px] font-black text-[#123D2A]">{formatCurrency(metrics.shareCapitalThisPeriod)}</p>
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
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px] font-bold text-[#5D6D63] truncate pr-2">{s.label}</span>
                      <span className="text-[10px] font-black text-[#123D2A]">{s.val}</span>
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

      {/* ── ROW 3: Map & Operations ──────────────────────────────────────────── */}
      <div className="flex gap-4">
        {/* Barangay Map */}
        <div className="w-[33.33%] rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <SectionHeader title="Barangay Recruitment Analytics" />
          <div className="flex-1 flex gap-4 mt-2">
            <div className="w-1/2 flex flex-col relative bg-[#F7F8F3] rounded-lg border border-[#EEF2EC] overflow-hidden items-center justify-center">
              {/* Fake Map Layout */}
              <div className="absolute top-2 left-2 flex flex-col bg-white rounded shadow text-[#5D6D63] text-xs">
                <button className="px-2 py-1 border-b border-[#EEF2EC]">+</button>
                <button className="px-2 py-1">-</button>
              </div>
              <MapPin className="size-10 text-[#1F6B43] opacity-20" />
              <p className="text-[9px] font-bold text-[#1F6B43] mt-2 text-center px-4">Interactive Map Unavailable<br/>(Requires GeoJSON)</p>
              
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-[8px] font-bold text-[#5D6D63] mb-1">Member Concentration</p>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-[#5D6D63]">Low</span>
                  <div className="flex-1 h-1.5 bg-gradient-to-r from-[#EEF2EC] to-[#123D2A] rounded-full"/>
                  <span className="text-[8px] text-[#5D6D63]">High</span>
                </div>
              </div>
            </div>
            <div className="w-1/2">
              <p className="text-[10px] font-bold text-[#123D2A] mb-2">Top Barangays by Members</p>
              <div className="space-y-1.5 mb-4">
                {demographics.slice(0, 5).map((d, i) => (
                  <div key={d.barangay} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5 font-medium text-[#5D6D63]"><div className="size-3.5 rounded-full bg-[#123D2A] text-white flex items-center justify-center text-[7px] font-bold">{i+1}</div> {d.barangay}</span>
                    <span className="font-bold text-[#123D2A]">{d.totalMembers}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold text-[#123D2A] mb-2 pt-2 border-t border-[#EEF2EC]">Recruitment Insights</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px]"><span className="text-[#5D6D63]">High growth areas</span><span className="font-bold text-[#123D2A]">4</span></div>
                <div className="flex justify-between text-[9px]"><span className="text-[#5D6D63]">Moderate growth areas</span><span className="font-bold text-[#123D2A]">3</span></div>
                <div className="flex justify-between text-[9px]"><span className="text-[#5D6D63]">Low growth areas</span><span className="font-bold text-[#123D2A]">2</span></div>
              </div>
              <button className="mt-4 w-full flex items-center justify-center gap-1.5 rounded bg-[#EEF2EC] py-1.5 text-[9px] font-bold text-[#123D2A] hover:bg-[#CAD8CB]">
                <Map className="size-3" /> View Full Map Analysis
              </button>
            </div>
          </div>
        </div>

        {/* Operations Snapshot */}
        <div className="w-[66.67%] rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <SectionHeader title="Operations Snapshot" />
          <div className="flex-1 grid grid-cols-3 gap-6 mt-4">
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

      {/* ── ROW 4: Action, Planner, Activity ─────────────────────────────────── */}
      <div className="flex gap-4">
        {/* Action Center */}
        <div className="w-[33.33%] rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
          <SectionHeader title="Needs Your Attention" icon={Bell} />
          <div className="flex-1 space-y-2.5 mt-2">
            {[
              { label: "Membership Applications", count: metrics.pendingApprovals, action: "Review" },
              { label: "Members for Monitoring", count: memberHealth.needsMonitoring, action: "View" },
              { label: "Share Capital Below Minimum", count: shareCapitalProgress.belowMinimum, action: "View" },
              { label: "Overdue Rentals", count: 3, action: "Action" },
              { label: "Inventory Items Low Stock", count: operationsSnapshot.inventory.lowStock, action: "View" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold text-[#123D2A] w-4">{item.count}</span>
                  <span className="text-[11px] text-[#5D6D63]">{item.label}</span>
                </div>
                <Link href="#" className="flex items-center gap-1 text-[10px] font-bold text-[#F59E0B] hover:underline">
                  {item.action} <ChevronRight className="size-2.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="w-[66.67%] flex flex-col gap-4">
          {/* Scenario Planner */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Cooperative Scenario Planner" />
              <div className="flex gap-4 text-[10px] font-bold text-[#5D6D63] items-center">
                <span>Target Members <input type="number" value={targetMembers} onChange={e=>setTargetMembers(Number(e.target.value))} className="w-12 ml-1 text-right border-b border-[#CAD8CB] outline-none text-[#123D2A] bg-transparent"/></span>
                <span>Target Net Surplus <input type="number" value={targetSurplus} onChange={e=>setTargetSurplus(Number(e.target.value))} className="w-16 ml-1 text-right border-b border-[#CAD8CB] outline-none text-[#123D2A] bg-transparent"/></span>
                <span>Additional Contribution 
                  <select value={additionalContribution} onChange={e=>setAdditionalContribution(Number(e.target.value))} className="ml-1 outline-none text-[#123D2A] bg-transparent font-bold">
                    <option value="5000">₱5,000</option>
                    <option value="10000">₱10,000</option>
                    <option value="15000">₱15,000</option>
                  </select>
                </span>
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="w-[70%]">
                <div className="flex text-[9px] font-bold text-[#5D6D63] mb-2 pb-1 border-b border-[#EEF2EC]">
                  <span className="w-[30%]">Scenario</span>
                  <span className="w-[40%] text-center">Projected Net Surplus</span>
                  <span className="w-[30%] text-right">Change vs Current</span>
                </div>
                {[
                  { label: "Increase Members", surplus: scenarioASurplus, growth: ((scenarioASurplus - curSurplus) / curSurplus) * 100, p: pA },
                  { label: "Increase Contribution", surplus: scenarioBSurplus, growth: ((scenarioBSurplus - curSurplus) / curSurplus) * 100, p: 30 },
                  { label: "Combined Strategy", surplus: scenarioCSurplus, growth: ((scenarioCSurplus - curSurplus) / curSurplus) * 100, p: Math.min(100, pA + 30) },
                ].map(s => (
                  <div key={s.label} className="flex items-center text-[10px] py-1.5">
                    <span className="w-[30%] font-semibold text-[#5D6D63]">{s.label}</span>
                    <div className="w-[40%] flex items-center gap-2 pr-4">
                      <div className="flex-1 h-1.5 bg-[#EEF2EC] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1F6B43]" style={{ width: `${s.p}%` }}/>
                      </div>
                      <span className="font-bold text-[#123D2A] w-14 text-right">{formatCurrency(s.surplus)}</span>
                    </div>
                    <span className="w-[30%] text-right"><DeltaBadge value={Math.round(s.growth*10)/10} className="justify-end"/></span>
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

          {/* Recent Activity */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm">
            <SectionHeader title="Recent Activity" />
            <div className="space-y-3 mt-2">
              {[
                { actor: "Juan Dela Cruz", desc: "paid ₱15,000 Share Capital", time: "Today, 9:15 AM", color: "bg-blue-500" },
                { actor: "Rental booking #RT-1029", desc: "confirmed (Tractor)", time: "Today, 10:00 AM", color: "bg-amber-500" },
                { actor: "New member application", desc: "from Maria Santos", time: "Today, 11:30 AM", color: "bg-amber-500" },
                { actor: "Sales transaction #TX-5541", desc: "recorded", time: "Today, 2:30 PM", color: "bg-[#1F6B43]" },
                { actor: "Inventory updated", desc: "Corn Seeds (50kg)", time: "Today, 3:45 PM", color: "bg-[#1F6B43]" },
              ].map((act, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-3">
                    <div className={`size-2.5 rounded-full ${act.color} ring-4 ring-[#F7F8F3]`} />
                    <span className="text-[#5D6D63]"><span className="font-bold text-[#123D2A]">{act.actor}</span> {act.desc}</span>
                  </div>
                  <span className="text-[#78857d] font-medium">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
