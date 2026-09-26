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

// Dashboard values must come from the live API/database.
const USE_PRESENTATION_DASHBOARD_DATA = false;

function getPresentationDashboardData(filters: DashboardFilters): ChairmanDashboardData {
  const generatedAt = new Date().toISOString();
  const demographics = [
    { barangay: "Poblacion", totalMembers: 58, activeMembers: 49, needsMonitoring: 6, inactiveMembers: 3 },
    { barangay: "Wawa", totalMembers: 42, activeMembers: 36, needsMonitoring: 4, inactiveMembers: 2 },
    { barangay: "Bucana", totalMembers: 35, activeMembers: 29, needsMonitoring: 5, inactiveMembers: 1 },
    { barangay: "Calayo", totalMembers: 31, activeMembers: 25, needsMonitoring: 4, inactiveMembers: 2 },
    { barangay: "Banilad", totalMembers: 27, activeMembers: 21, needsMonitoring: 4, inactiveMembers: 2 },
    { barangay: "Lumbangan", totalMembers: 23, activeMembers: 19, needsMonitoring: 3, inactiveMembers: 1 },
    { barangay: "Tumalim", totalMembers: 19, activeMembers: 15, needsMonitoring: 3, inactiveMembers: 1 },
    { barangay: "Papaya", totalMembers: 14, activeMembers: 11, needsMonitoring: 2, inactiveMembers: 1 },
  ];

  return {
    generatedAt,
    filters: {
      period: filters.period ?? "year",
      barangay: filters.barangay ?? null,
      memberStatus: filters.memberStatus ?? null,
      memberType: null,
    },
    metrics: {
      totalMembers: 249,
      newMembersThisPeriod: 18,
      totalMembersGrowth: 7.8,
      totalShareCapital: 3125000,
      shareCapitalThisPeriod: 284000,
      totalShareCapitalGrowth: 9.4,
      pendingApprovals: 12,
      pendingActionsCount: 17,
      totalPosSales: 428750,
      totalPosSalesGrowth: 12.5,
      totalRentalIncome: 183500,
      totalIncome: 612250,
      totalExpenses: 218900,
      netSurplus: 393350,
      posTransactions: 386,
    },
    memberHealth: {
      active: 204,
      needsMonitoring: 32,
      inactive: 13,
    },
    shareCapitalProgress: {
      total: 3125000,
      thisPeriod: 284000,
      contributingMembers: 221,
      reachedMinimum: 187,
      reachedMaximum: 64,
      belowMinimum: 62,
      totalMembers: 249,
    },
    revenueTrend: [
      { month: "Jan", income: 248000, expenses: 116000 },
      { month: "Feb", income: 276000, expenses: 128500 },
      { month: "Mar", income: 301500, expenses: 137800 },
      { month: "Apr", income: 329000, expenses: 146200 },
      { month: "May", income: 374000, expenses: 158900 },
      { month: "Jun", income: 396500, expenses: 171000 },
      { month: "Jul", income: 438250, expenses: 184750 },
      { month: "Aug", income: 462800, expenses: 191300 },
      { month: "Sep", income: 612250, expenses: 218900 },
    ],
    membershipTrend: [
      { month: "Jan", members: 198 },
      { month: "Feb", members: 205 },
      { month: "Mar", members: 213 },
      { month: "Apr", members: 219 },
      { month: "May", members: 226 },
      { month: "Jun", members: 232 },
      { month: "Jul", members: 239 },
      { month: "Aug", members: 244 },
      { month: "Sep", members: 249 },
    ],
    incomeSources: [
      { source: "Product / POS Sales", amount: 428750, pct: 70 },
      { source: "Equipment Rental", amount: 183500, pct: 30 },
    ],
    demographics,
    operationsSnapshot: {
      pos: { totalSales: 428750, transactions: 386, productsSold: 712 },
      rental: { totalIncome: 183500, completed: 41, pending: 9, upcoming: 14 },
      inventory: {
        lowStock: 7,
        outOfStock: 2,
        alerts: [
          { productId: "PRD-001", productName: "Rice 25kg", stock: 8 },
          { productId: "PRD-018", productName: "Corn Seeds 50kg", stock: 5 },
        ],
      },
    },
    inventoryAlerts: [
      { productId: "PRD-001", productName: "Rice 25kg", stock: 8 },
      { productId: "PRD-018", productName: "Corn Seeds 50kg", stock: 5 },
    ],
    recentTransactions: [
      { id: "TX-1024", memberName: "Maria Santos", amount: 15000, date: generatedAt, reference: "Share Capital" },
      { id: "TX-1025", memberName: "Juan Dela Cruz", amount: 2850, date: generatedAt, reference: "POS Sale" },
      { id: "TX-1026", memberName: "Rafael Mendoza", amount: 9000, date: generatedAt, reference: "Rental" },
    ],
    actionItems: [
      {
        id: "pending-applications",
        type: "Approval",
        title: "12 membership applications pending",
        description: "Review submitted requirements and approve qualified applicants.",
        date: generatedAt,
        module: "Members",
        href: "/portal/chairman/members/applications",
        severity: "warning",
      },
      {
        id: "low-stock-products",
        type: "Notification",
        title: "7 products need restocking",
        description: "Inventory has several products below the reorder level.",
        date: generatedAt,
        module: "Inventory",
        href: "/portal/chairman/inventory",
        severity: "warning",
      },
      {
        id: "upcoming-rentals",
        type: "Notification",
        title: "14 upcoming equipment bookings",
        description: "Check schedules and availability before confirming new rental requests.",
        date: generatedAt,
        module: "Rentals",
        href: "/portal/chairman/rentals/bookings",
        severity: "info",
      },
    ],
    recentActivity: [
      {
        type: "membership",
        title: "submitted a membership application",
        actor: "Marlo Condicion",
        reference: "APP-2026-041",
        activityDate: generatedAt,
        href: "/portal/chairman/members/applications",
      },
      {
        type: "share_capital",
        title: "paid share capital",
        actor: "Maria Santos",
        reference: "SC-2026-118",
        activityDate: generatedAt,
        href: "/portal/chairman/share-capital",
      },
      {
        type: "rental",
        title: "reserved equipment rental",
        actor: "Rafael Mendoza",
        reference: "RNT-2026-029",
        activityDate: generatedAt,
        href: "/portal/chairman/rentals/bookings",
      },
      {
        type: "pos",
        title: "completed a product purchase",
        actor: "Ana Reyes",
        reference: "POS-2026-5541",
        activityDate: generatedAt,
        href: "/portal/chairman/pos",
      },
      {
        type: "inventory",
        title: "updated low-stock inventory",
        actor: "Bookkeeper",
        reference: "INV-2026-017",
        activityDate: generatedAt,
        href: "/portal/chairman/inventory",
      },
    ],
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function DashboardClient({ mode = "member" }: { mode?: "member" | "financial" }) {
  const [data, setData] = useState<ChairmanDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isNotificationsOpen]);

  // Filters
  const [period, setPeriod] = useState("year");
  const [barangay, setBarangay] = useState("");
  const [mapBarangay, setMapBarangay] = useState("");
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
      if (USE_PRESENTATION_DASHBOARD_DATA) {
        setData(getPresentationDashboardData(filters));
        return;
      }
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-[#EEF2EC] rounded-2xl" />)}
        </div>
        <div className="flex gap-4">
          <div className="w-1/2 h-64 bg-[#EEF2EC] rounded-2xl" />
          <div className="w-1/2 h-64 bg-[#EEF2EC] rounded-2xl" />
        </div>
      </div>
    );
  }
  if (error && !data) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8F3] p-6">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800" role="alert">
        <p className="font-bold">Unable to load dashboard data.</p>
        <p className="mt-1 text-sm">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-full bg-[#123D2A] px-5 py-2 text-sm font-bold text-white hover:bg-[#1F6B43]">Retry</button>
      </div>
    </div>
  );

  const d = data || {} as ChairmanDashboardData;
  const m = d.metrics || {} as any;
  const metrics = { totalIncome: m.totalIncome ?? 0, totalExpenses: m.totalExpenses ?? 0, netSurplus: m.netSurplus ?? 0, totalShareCapital: m.totalShareCapital ?? 0, totalMembers: m.totalMembers ?? 0, newMembersThisPeriod: m.newMembersThisPeriod ?? 0, shareCapitalThisPeriod: m.shareCapitalThisPeriod ?? 0, pendingApprovals: m.pendingApprovals ?? 0, pendingActionsCount: m.pendingActionsCount ?? 0 };
  const h = d.memberHealth || {} as any;
  const memberHealth = { active: h.active ?? 0, needsMonitoring: h.needsMonitoring ?? 0, inactive: h.inactive ?? 0 };
  const revenueTrend = d.revenueTrend || [];
  const demographics = d.demographics || [];
  const sectorColumns = Array.from(new Set(demographics.flatMap((item) => item.sectorCounts?.map((sector) => sector.sector) ?? [])));
  const selectedMapBarangay = demographics.find((item) => item.barangay === mapBarangay);
  const actionItems = d.actionItems || [];
  const sp = d.shareCapitalProgress || {} as any;
  const shareCapitalProgress = { reachedMinimum: sp.reachedMinimum ?? 0, belowMinimum: sp.belowMinimum ?? 0, contributingMembers: sp.contributingMembers ?? 0, reachedMaximum: sp.reachedMaximum ?? 0, totalMembers: sp.totalMembers ?? 0 };
  const os = d.operationsSnapshot || {} as any;
  const operationsSnapshot = { pos: { totalSales: os.pos?.totalSales ?? 0, transactions: os.pos?.transactions ?? 0, productsSold: os.pos?.productsSold ?? 0 }, rental: { totalIncome: os.rental?.totalIncome ?? 0, completed: os.rental?.completed ?? 0, upcoming: os.rental?.upcoming ?? 0 }, inventory: { lowStock: os.inventory?.lowStock ?? 0, outOfStock: os.inventory?.outOfStock ?? 0 } };
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
  const scenarioRows = [
    { label: "Increase Members", surplus: scenarioASurplus, growth: ((scenarioASurplus - curSurplus) / (curSurplus || 1)) * 100, p: pA },
    { label: "Increase Contribution", surplus: scenarioBSurplus, growth: ((scenarioBSurplus - curSurplus) / (curSurplus || 1)) * 100, p: 30 },
    { label: "Combined Strategy", surplus: scenarioCSurplus, growth: ((scenarioCSurplus - curSurplus) / (curSurplus || 1)) * 100, p: Math.min(100, pA + 30) },
  ];
  const dashboardKpis = mode === "financial"
    ? [
        { label: "Total Income", val: metrics.totalIncome, icon: TrendingUp, note: "Current period", isNum: false, greenBg: false, href: "/portal/chairman/finance" },
        { label: "Total Expenses", val: metrics.totalExpenses, icon: TrendingDown, note: "Current period", isNum: false, greenBg: false, href: "/portal/chairman/finance" },
        { label: "Net Surplus", val: metrics.netSurplus, icon: BarChart3, note: "Income less expenses", isNum: false, greenBg: true, href: "/portal/chairman/finance" },
        { label: "Total Share Capital", val: metrics.totalShareCapital, icon: Banknote, note: "Recorded share capital", isNum: false, greenBg: false, href: "/portal/chairman/share-capital" },
      ]
    : [
        { label: "Total Members", val: metrics.totalMembers, icon: Users, note: `${metrics.newMembersThisPeriod} new this period`, isNum: true, greenBg: false, href: "/portal/chairman/members" },
        { label: "Active Members", val: memberHealth.active, icon: Users, note: `${memberHealth.needsMonitoring} need monitoring`, isNum: true, greenBg: false, href: "/portal/chairman/member-indicators" },
        { label: "Pending Approvals", val: metrics.pendingApprovals, icon: Activity, note: "Applications for review", isNum: true, greenBg: false, href: "/portal/chairman/members" },
        { label: "POS Transactions", val: operationsSnapshot.pos.transactions, icon: ShoppingCart, note: "Current period", isNum: true, greenBg: false, href: "/portal/chairman/pos" },
      ];

  return (
    <div className="min-h-screen bg-[#F7F8F3] p-6 space-y-5 font-sans">

      {/* ── 1. HEADER ROW ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-[26px] font-black text-[#123D2A] tracking-tight">{mode === "financial" ? "Financial Dashboard" : "Member Dashboard"}</h1>
          <p className="text-[12px] text-[#5D6D63] mt-1">{mode === "financial" ? "Income, expenses, surplus, and share-capital performance." : "Membership growth, engagement, recruitment, and cooperative operations."}</p>
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
                  {actionItems.length + recentActivity.length}
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((k, i) => (
          <Link key={i} href={k.href} className="flex min-h-[132px] flex-col justify-between rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-[#1F6B43] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/30">
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
              {k.isNum ? <span className="text-[10px] font-bold text-[#1F6B43]">Live data</span> : <DeltaBadge value={0} neutral />}
              <span className="text-[10px] leading-tight text-[#5D6D63]">{k.note}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── ROW 1: Financial & Income Sources ────────────────────────────────── */}
      {mode === "financial" ? <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Financial Performance */}
        <div className="min-w-0 rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
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
        <div className="min-w-0 rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm flex flex-col">
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
      </div> : null}

      {/* ── ROW 2: Membership & Share Capital ────────────────────────────────── */}
      <div className={`grid grid-cols-1 gap-5 ${mode === "financial" ? "lg:grid-cols-2" : "lg:grid-cols-2"}`}>
        {/* Membership Growth */}
        <div className={`${mode === "financial" ? "hidden" : ""} rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col relative`}>
          <SectionHeader title="Membership Growth" />
          <div className="mt-3 flex min-h-[210px] flex-1 items-stretch">
            <div className="flex w-[60%] min-w-0 flex-col pr-4">
              <div className="h-[170px] min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.membershipTrend || []} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#123D2A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#123D2A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#5D6D63", fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(month) => String(month).substring(0, 3)}
                    padding={{ left: 0, right: 0 }}
                    height={22}
                  />
                  <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip
                    formatter={(val: any) => val as number}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #EEF2EC', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold', color: '#123D2A' }}
                  />
                  <Area type="monotone" dataKey="members" stroke="#123D2A" strokeWidth={2} fillOpacity={1} fill="url(#colorMembers)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex w-[40%] min-w-0 flex-col justify-center space-y-3 border-l border-[#EEF2EC] pl-4">
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
        <div className={`${mode === "financial" ? "hidden" : ""} rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col`}>
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
                  <Tooltip
                    formatter={(value, name) => [`${value} members`, name]}
                    contentStyle={{ borderRadius: 10, border: "1px solid #CAD8CB", fontSize: 12, fontWeight: 700 }}
                  />
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
        <div className={`${mode === "member" ? "hidden" : ""} rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col`}>
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
        {mode === "financial" ? <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
          <SectionHeader title="Operations Snapshot" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#DDE8D8] p-3"><p className="border-b border-[#EEF2EC] pb-2 text-[11px] font-bold text-[#123D2A]">POS / Products</p><div className="mt-2 space-y-1.5 text-[11px]"><div className="flex justify-between"><span>Sales</span><b>{formatCurrency(operationsSnapshot.pos.totalSales)}</b></div><div className="flex justify-between"><span>Transactions</span><b>{operationsSnapshot.pos.transactions}</b></div><div className="flex justify-between"><span>Products Sold</span><b>{operationsSnapshot.pos.productsSold}</b></div></div></div>
            <div className="rounded-xl border border-[#DDE8D8] p-3"><p className="border-b border-[#EEF2EC] pb-2 text-[11px] font-bold text-[#123D2A]">Equipment Rental</p><div className="mt-2 space-y-1.5 text-[11px]"><div className="flex justify-between"><span>Income</span><b>{formatCurrency(operationsSnapshot.rental.totalIncome)}</b></div><div className="flex justify-between"><span>Completed</span><b>{operationsSnapshot.rental.completed}</b></div><div className="flex justify-between"><span>Upcoming</span><b>{operationsSnapshot.rental.upcoming}</b></div></div></div>
            <div className="rounded-xl border border-[#DDE8D8] p-3"><p className="border-b border-[#EEF2EC] pb-2 text-[11px] font-bold text-[#123D2A]">Inventory</p><div className="mt-2 space-y-1.5 text-[11px]"><div className="flex justify-between"><span>Low stock</span><b className="text-red-600">{operationsSnapshot.inventory.lowStock}</b></div><div className="flex justify-between"><span>Out of stock</span><b className="text-red-600">{operationsSnapshot.inventory.outOfStock}</b></div><div className="flex justify-between"><span>Available</span><b className="text-[#1F6B43]">View</b></div></div></div>
          </div>
        </div> : null}
      </div>

      {/* -- ROW 3: Map & Operations Snapshot -------------------------------------- */}
      {mode === "member" ? <div className="grid gap-5 lg:grid-cols-1">
        {/* ── LEFT COLUMN (2/3 Width) ── */}
        <div className="min-w-0 flex flex-col">

          {/* Barangay Map */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <SectionHeader title="Barangay Recruitment Analytics" />
            <div className="flex-1 flex gap-6 mt-4">
              <div className="w-[60%] flex flex-col relative bg-[#F7F8F3] rounded-lg border border-[#EEF2EC] overflow-hidden items-center justify-center">
                <DemographicsMap demographics={demographics} selectedBarangay={mapBarangay} onSelectBarangay={setMapBarangay} />

                <div className="absolute bottom-2 left-2 right-2 pointer-events-none z-10">
                  <p className="text-sm font-bold text-[#123D2A] mb-1 drop-shadow-md bg-white/70 px-1 rounded inline-block">Member Density</p>
                  <div className="flex items-center gap-1 bg-white/70 p-1 rounded backdrop-blur-sm">
                    <span className="text-sm text-[#5D6D63] font-bold">Low</span>
                    <div className="flex-1 h-1.5 bg-gradient-to-r from-[#22c55e] via-[#eab308] via-[#f97316] to-[#dc2626] rounded-full" />
                    <span className="text-sm text-[#5D6D63] font-bold">High</span>
                  </div>
                </div>
              </div>
              <div className="w-[40%] flex flex-col justify-between">
                <div>
                  <p className="text-sm font-bold text-[#123D2A] mb-2">Top Barangays by Members</p>
                  <div className="mb-4 overflow-x-auto rounded-lg border border-[#DDE8D8]">
                    <table className="w-full min-w-[420px] text-[10px]">
                      <thead className="bg-[#F7F8F3] text-left text-[#5D6D63]">
                        <tr>
                          <th className="sticky left-0 z-10 bg-[#F7F8F3] px-2 py-2 text-left font-bold">Barangay</th>
                          {sectorColumns.map((sector) => <th key={sector} className="px-2 py-2 text-right font-bold">{sector}</th>)}
                          <th className="px-2 py-2 text-right font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demographics.slice(0, 10).map((d) => {
                          const sectorCount = (sector: string) => d.sectorCounts?.find((item) => item.sector === sector)?.count ?? 0;
                          return (
                            <tr key={d.barangay} className={`border-t border-[#EEF2EC] ${mapBarangay === d.barangay ? 'bg-[#123D2A]/10' : ''}`}>
                              <td className="sticky left-0 z-10 border-r border-[#EEF2EC] bg-white px-2 py-2 font-semibold text-[#365F4A]">{d.barangay}</td>
                              {sectorColumns.map((sector) => <td key={sector} className="px-2 py-2 text-right">{sectorCount(sector)}</td>)}
                              <td className="px-2 py-2 text-right font-bold text-[#123D2A]">{d.totalMembers}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {selectedMapBarangay ? (
                    <div className="mb-4 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#123D2A]">{selectedMapBarangay.barangay}</p>
                        <button type="button" onClick={() => setMapBarangay("")} className="text-[10px] font-bold text-[#5D6D63] underline">Clear</button>
                      </div>
                      <p className="mt-1 text-[11px] text-[#5D6D63]">{selectedMapBarangay.totalMembers} total members</p>
                      <div className="mt-2 space-y-0.5 text-[11px] text-[#365F4A]">
                        {selectedMapBarangay.sectorCounts?.map((item) => (
                          <div key={item.sector} className="flex justify-between"><span>{item.sector}</span><strong>{item.count}</strong></div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="text-sm font-bold text-[#123D2A] mb-2 pt-2 border-t border-[#EEF2EC]">Recruitment Insights</p>
                  <div className="space-y-1">
                    <p className="text-xs leading-5 text-[#5D6D63]">Growth insights are based on the live member and barangay records shown above.</p>
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
        <div className="min-w-0 flex flex-col">

          {/* Operations Snapshot (layout moved below Recent Activity) */}
          <div className="hidden rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
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
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Products Sold</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.pos.productsSold}</span></div>
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
                  <div className="flex justify-between text-[11px]"><span className="text-[#5D6D63] font-semibold">Products available</span><span className="font-bold text-[#1F6B43]">View inventory</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> : null}

      {/* -- ROW 4: Scenario Planner & Recent Activity ---------------------------- */}
      <div className={`mt-5 grid gap-5 ${mode === "member" ? "lg:grid-cols-[1.35fr_1fr]" : "lg:grid-cols-1"}`}>
        {false ? <div className="min-w-0 flex flex-col">
          <div className="flex h-full flex-col rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
            <SectionHeader title="Operations Snapshot" />
            <div className="mt-3 grid flex-1 gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
              <div className="rounded-xl border border-[#DDE8D8] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 border-b border-[#EEF2EC] pb-2"><ShoppingCart className="size-4 text-[#123D2A]" /><h3 className="text-[11px] font-bold text-[#123D2A]">POS / Products</h3></div>
                <div className="space-y-1.5 text-[11px]"><div className="flex justify-between rounded-lg bg-[#F7F8F3] px-2.5 py-1.5"><span className="font-semibold text-[#5D6D63]">Sales</span><span className="font-bold text-[#123D2A]">{formatCurrency(operationsSnapshot.pos.totalSales)}</span></div><div className="flex justify-between px-2.5"><span className="font-semibold text-[#5D6D63]">Transactions</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.pos.transactions}</span></div><div className="flex justify-between px-2.5"><span className="font-semibold text-[#5D6D63]">Products Sold</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.pos.productsSold}</span></div></div>
              </div>
              <div className="rounded-xl border border-[#DDE8D8] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 border-b border-[#EEF2EC] pb-2"><Tractor className="size-4 text-[#123D2A]" /><h3 className="text-[11px] font-bold text-[#123D2A]">Equipment Rental</h3></div>
                <div className="space-y-1.5 text-[11px]"><div className="flex justify-between px-2.5"><span className="font-semibold text-[#5D6D63]">Income</span><span className="font-bold text-[#123D2A]">{formatCurrency(operationsSnapshot.rental.totalIncome)}</span></div><div className="flex justify-between px-2.5"><span className="font-semibold text-[#5D6D63]">Completed Rentals</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.rental.completed}</span></div><div className="flex justify-between rounded-lg bg-[#F7F8F3] px-2.5 py-1.5"><span className="font-semibold text-[#5D6D63]">Upcoming Bookings</span><span className="font-bold text-[#123D2A]">{operationsSnapshot.rental.upcoming}</span></div></div>
              </div>
              <div className="rounded-xl border border-[#DDE8D8] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 border-b border-[#EEF2EC] pb-2"><Package className="size-4 text-[#123D2A]" /><h3 className="text-[11px] font-bold text-[#123D2A]">Inventory</h3></div>
                <div className="space-y-1.5 text-[11px]"><div className="flex justify-between px-2.5"><span className="font-semibold text-[#5D6D63]">Low-stock items</span><span className="font-bold text-red-600">{operationsSnapshot.inventory.lowStock}</span></div><div className="flex justify-between px-2.5"><span className="font-semibold text-[#5D6D63]">Out of stock</span><span className="font-bold text-red-600">{operationsSnapshot.inventory.outOfStock}</span></div><div className="flex justify-between rounded-lg bg-[#EEF7EF] px-2.5 py-1.5"><span className="font-semibold text-[#5D6D63]">Products available</span><span className="font-bold text-[#1F6B43]">View inventory</span></div></div>
              </div>
            </div>
          </div>
        </div> : null}
        {/* -- LEFT COLUMN (1/3 Width) -- */}
        <div className="hidden">

          {/* Recent Activity */}
          <div className="hidden rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <SectionHeader title="Recent Activity" icon={Activity} />
            <div className="space-y-3 mt-4 flex-1">
              {/* Real Database Activity */}
              {(recentActivity ?? []).slice(0, 5).map((act, i) => {
                let color = "bg-[#EEF2EC]";
                if (act.type === "share_capital") color = "bg-blue-500";
                if (act.type === "membership") color = "bg-amber-500";

                return (
                  <Link key={i} href={act.href || "#"} className="flex items-center justify-between rounded-lg px-1 text-[11px] pb-3 border-b border-[#EEF2EC] last:border-0 last:pb-0 hover:bg-[#F7F8F3] focus:outline-none focus:ring-2 focus:ring-[#1F6B43]/30">
                    <div className="flex items-center gap-3">
                      <div className={`size-2.5 rounded-full ${color} ring-4 ring-[#F7F8F3] shrink-0`} />
                      <span className="text-[#5D6D63]"><span className="font-bold text-[#123D2A]">{act.actor}</span> {act.title}</span>
                    </div>
                    <span className="text-[#78857d] font-medium shrink-0 ml-2">
                      {typeof act.activityDate === 'string' ? new Date(act.activityDate).toLocaleString() : act.activityDate.toLocaleString()}
                    </span>
                  </Link>
                );
              })}

              {(recentActivity ?? []).length === 0 ? (
                <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-[#CAD8CB] text-center text-xs text-[#78857d]">
                  No recent activity recorded for this period.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* -- FINANCIAL-ONLY SCENARIO PLANNER -- */}
        <div className={`${mode === "member" ? "hidden" : "min-w-0"} flex flex-col`}>

          {/* Scenario Planner */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
             <div className="flex items-center justify-between gap-4 mb-4">
               <h2 className="whitespace-nowrap text-[14px] font-black text-[#123D2A]">Cooperative Scenario Planner</h2>
               <div className="flex shrink-0 items-center gap-4 whitespace-nowrap text-[10px] font-bold text-[#5D6D63]">
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
                {scenarioRows.map(s => (
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
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/20 backdrop-blur-sm transition-all" onClick={() => setIsNotificationsOpen(false)}>
          <div className="h-full w-full max-w-[350px] overflow-hidden bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#EEF2EC]">
              <h2 className="text-sm font-black text-[#123D2A] flex items-center gap-2">
                <Bell className="size-4" /> Notifications
              </h2>
              <button onClick={() => setIsNotificationsOpen(false)} className="text-[#5D6D63] hover:text-[#123D2A] p-1 rounded-md hover:bg-[#EEF2EC]">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {actionItems.length > 0 || recentActivity.length > 0 ? (
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
                  {recentActivity.slice(0, 8).map((activity, index) => (
                    <Link key={`activity-${index}`} href={activity.href || "#"} className="block rounded-xl border border-[#EEF2EC] bg-white p-3 transition hover:bg-[#F7F8F3]">
                      <div className="flex gap-3">
                        <Activity className="mt-0.5 size-4 shrink-0 text-[#1F6B43]" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-[#123D2A]">{activity.actor}</p>
                          <p className="mt-1 text-[10px] text-[#5D6D63]">{activity.title}</p>
                          <p className="mt-1 text-[10px] text-[#78857d]">{typeof activity.activityDate === "string" ? new Date(activity.activityDate).toLocaleString() : activity.activityDate.toLocaleString()}</p>
                        </div>
                      </div>
                    </Link>
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
