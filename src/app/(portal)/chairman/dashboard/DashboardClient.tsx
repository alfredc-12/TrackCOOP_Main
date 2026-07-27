"use client";

import { useState, useEffect } from "react";
import { getChairmanDashboard, type ChairmanDashboardData } from "@/features/chairman/dashboard-api";
import { 
  Users, 
  Banknote, 
  FileText, 
  TrendingUp,
  AlertCircle,
  MapPin,
  Package,
  CreditCard
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { format } from "date-fns";
import Link from "next/link";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-PH").format(value);
}

function GrowthIndicator({ growth, period }: { growth: number; period: string }) {
  const label = period === "year" ? "vs last year" : "vs last period";
  if (growth === 0) return <span className="mt-1 block text-xs font-semibold text-[#5D6D63]">0% {label}</span>;
  
  const isPositive = growth > 0;
  return (
    <span className={`mt-1 block text-xs font-semibold ${isPositive ? 'text-[#1F6B43]' : 'text-red-500'}`}>
      {isPositive ? '+' : ''}{growth}% {label}
    </span>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<ChairmanDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        const dashboardData = await getChairmanDashboard(period === "all" ? undefined : period);
        if (mounted) {
          setData(dashboardData);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to load dashboard data");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [period]);

  useEffect(() => {
    if (isNotificationsModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isNotificationsModalOpen]);

  if (isLoading && !data) {
    return <div className="p-8 text-center text-[#5D6D63]">Loading dashboard data...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Failed to load dashboard.</div>;
  }

  const { 
    metrics, 
    memberHealth, 
    revenueTrend, 
    demographics, 
    inventoryAlerts, 
    recentTransactions, 
    actionItems 
  } = data;

  const healthData = [
    { name: "Active", value: memberHealth.active, color: "#1F6B43" },
    { name: "Needs Monitoring", value: memberHealth.needsMonitoring, color: "#EAB308" },
    { name: "Inactive", value: memberHealth.inactive, color: "#EF4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-end">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-[#CAD8CB] bg-white px-4 py-2 text-sm font-medium text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-1 focus:ring-[#1F6B43]"
        >
          <option value="all">All Time</option>
          <option value="year">This Year</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#EEF2EC] p-3 text-[#123D2A]">
              <Users className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#5D6D63]">Total Active Members</p>
              <p className="text-2xl font-bold text-[#123D2A]">{formatNumber(metrics.totalMembers)}</p>
              <GrowthIndicator growth={metrics.totalMembersGrowth} period={period} />
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#EEF2EC] p-3 text-[#123D2A]">
              <Banknote className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#5D6D63]">Total Share Capital</p>
              <p className="text-2xl font-bold text-[#123D2A]">{formatCurrency(metrics.totalShareCapital)}</p>
              <GrowthIndicator growth={metrics.totalShareCapitalGrowth} period={period} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#EEF2EC] p-3 text-[#123D2A]">
              <FileText className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#5D6D63]">Pending Approvals</p>
              <p className="text-2xl font-bold text-[#123D2A]">{formatNumber(metrics.pendingApprovals)}</p>
              <GrowthIndicator growth={metrics.pendingApprovalsGrowth} period={period} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#EEF2EC] p-3 text-[#123D2A]">
              <TrendingUp className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#5D6D63]">Total POS Sales</p>
              <p className="text-2xl font-bold text-[#123D2A]">{formatCurrency(metrics.totalPosSales)}</p>
              <GrowthIndicator growth={metrics.totalPosSalesGrowth} period={period} />
            </div>
          </div>
        </div>
      </div>

      {/* Widgets Grid (3 per row) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Member Health */}
        <div className="flex h-[400px] flex-col rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#123D2A]">Member Health</h3>
            <span className="rounded-full bg-[#EEF2EC] px-3 py-1 text-xs font-semibold text-[#123D2A]">Total: {formatNumber(metrics.totalMembers)}</span>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#123D2A', fontWeight: 500 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demographics Bar Chart */}
        <div className="flex h-[400px] flex-col rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#123D2A]">Top Barangays</h3>
            <div className="rounded-full bg-[#EEF2EC] p-2 text-[#1F6B43]">
              <MapPin className="size-4" />
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demographics} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#EEF2EC" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="barangay" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#5D6D63', fontSize: 12 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#F7F8F3' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#123D2A', fontWeight: 600 }}
                />
                <Bar dataKey="totalMembers" name="Members" fill="#1F6B43" radius={[0, 4, 4, 0]} barSize={24}>
                  {demographics.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#123D2A' : '#1F6B43'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="flex h-[400px] flex-col rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-bold text-[#123D2A]">Income vs Expenses</h3>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#123D2A" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#123D2A" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EC" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#5D6D63', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#5D6D63', fontSize: 12 }}
                  tickFormatter={(value) => `₱${value >= 1000 ? value / 1000 + 'k' : value}`}
                />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 600 }}
                  cursor={{ stroke: '#CAD8CB', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px' }} />
                <Area type="monotone" dataKey="income" name="Total Income" stroke="#123D2A" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expenses" name="Total Expenses" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Inventory */}
        <div className="flex h-[400px] flex-col rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="mb-6 flex shrink-0 items-center justify-between">
            <h3 className="text-lg font-bold text-[#123D2A]">Low Stock Inventory</h3>
            <div className="rounded-full bg-[#EEF2EC] p-2 text-[#EAB308]">
              <Package className="size-4" />
            </div>
          </div>
          {inventoryAlerts.length === 0 ? (
            <p className="text-sm text-[#5D6D63]">All items are well stocked.</p>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden">
              {inventoryAlerts.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-lg border border-[#EEF2EC] p-4 transition-colors hover:border-[#CAD8CB]">
                  <div>
                    <h4 className="font-bold text-[#123D2A]">{item.productName}</h4>
                    <p className="text-xs text-[#5D6D63]">SKU: {item.productId}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-[#FEF08A]/30 px-3 py-1 text-sm font-bold text-[#A16207]">
                      {item.stock} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions Feed */}
        <div className="flex h-[400px] flex-col rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <div className="mb-6 flex shrink-0 items-center gap-2">
            <CreditCard className="size-5 text-[#1F6B43]" />
            <h3 className="text-lg font-bold text-[#123D2A]">Recent Share Capital</h3>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-[#5D6D63]">No recent payments found.</p>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border-b border-[#EEF2EC] pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#123D2A]">{tx.memberName}</span>
                    <span className="text-xs text-[#5D6D63]">{format(new Date(tx.date), "MMM d, yyyy")}</span>
                  </div>
                  <div className="font-bold text-[#1F6B43]">
                    +{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Items */}
        <div className="flex h-[400px] flex-col rounded-xl border border-[#CAD8CB] bg-white p-6 shadow-sm">
          <h3 className="mb-6 shrink-0 text-lg font-bold text-[#123D2A]">Action Items & Notifications</h3>
          {actionItems.length === 0 ? (
            <p className="text-sm text-[#5D6D63]">No pending action items.</p>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-hidden">
                {actionItems.slice(0, 3).map((item) => (
                  <Link 
                    href="/chairman/members" 
                    key={item.id} 
                    className="flex items-start gap-4 rounded-lg border border-[#EEF2EC] bg-[#F7F8F3] p-4 transition-colors hover:border-[#1F6B43] hover:bg-white"
                  >
                    <div className="mt-0.5 shrink-0 rounded-full bg-[#EAB308]/20 p-2 text-[#EAB308]">
                      <AlertCircle className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-[#123D2A]">{item.title}</h4>
                      <p className="truncate text-xs text-[#5D6D63]">{item.description}</p>
                    </div>
                    <div className="shrink-0 text-xs text-[#5D6D63]">
                      {format(new Date(item.date), "MMM d, yyyy")}
                    </div>
                  </Link>
                ))}
              </div>
              {actionItems.length > 3 && (
                <div className="mt-4 shrink-0 border-t border-[#EEF2EC] pt-4 text-center">
                  <button 
                    onClick={() => setIsNotificationsModalOpen(true)}
                    className="text-sm font-bold text-[#1F6B43] hover:underline"
                  >
                    View all {actionItems.length} notifications
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notifications Modal */}
      {isNotificationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EEF2EC] p-6">
              <h2 className="text-xl font-bold text-[#123D2A]">All Notifications</h2>
              <button 
                onClick={() => setIsNotificationsModalOpen(false)}
                className="text-[#5D6D63] hover:text-[#123D2A]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {actionItems.map((item) => (
                  <Link 
                    href="/chairman/members" 
                    key={item.id} 
                    onClick={() => setIsNotificationsModalOpen(false)}
                    className="flex items-start gap-4 rounded-lg border border-[#EEF2EC] bg-[#F7F8F3] p-4 transition-colors hover:border-[#1F6B43] hover:bg-white"
                  >
                    <div className="mt-0.5 shrink-0 rounded-full bg-[#EAB308]/20 p-2 text-[#EAB308]">
                      <AlertCircle className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-[#123D2A]">{item.title}</h4>
                      <p className="truncate text-xs text-[#5D6D63]">{item.description}</p>
                    </div>
                    <div className="shrink-0 text-xs text-[#5D6D63]">
                      {format(new Date(item.date), "MMM d, yyyy")}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}