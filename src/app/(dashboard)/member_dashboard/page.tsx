"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
import RentalLandingPage from "@/app/rental/page";
import { RentalProvider } from "@/app/rental/_context/RentalProvider";
import { logout, getAuthenticatedUser } from "@/lib/auth-client";
import type { AuthUser } from "@/features/auth/types";
import { apiRequest } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { env } from "@/config/env";
import {
  Bell,
  Search,
  User,
  Wallet,
  Calendar,
  Megaphone,
  MessageSquare,
  MapPin,
  Phone,
  Mail,
  Award,
  FileText,
  CreditCard,
  Briefcase,
  ChevronDown,
  ArrowRight,
  Leaf,
  LogOut,
  Images,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  ShoppingBag,
  Tractor,
  TrendingUp,
  Download,
  PieChart,
  Star,
  ShieldCheck,
  AlertCircle,
  Info,
  X
} from "lucide-react";
import MemberPosClient from "@/features/pos/components/MemberPosClient";
import { ProfileSettings } from "./components/ProfileSettings";
import { HelpCenter } from "./components/HelpCenter";
import ActivityModal from "./components/ActivityModal";

export default function MemberDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isFetchingAnnouncements, setIsFetchingAnnouncements] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isFetchingNotifications, setIsFetchingNotifications] = useState(false);
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [ackId, setAckId] = useState<string | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [allAnnouncementsModalOpen, setAllAnnouncementsModalOpen] = useState(false);
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isFetchingDashboard, setIsFetchingDashboard] = useState(true);

  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getAuthenticatedUser()
      .then(setUser)
      .catch(console.error);

    fetch("/api/members/me/dashboard")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch dashboard");
        return res.json();
      })
      .then(setDashboardData)
      .catch(console.error)
      .finally(() => setIsFetchingDashboard(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchAnnouncements = () => {
    setIsFetchingAnnouncements(true);
    // Fetch only published announcements
    apiRequest<any[]>("/api/announcements?status=Published")
      .then((data) => setAnnouncements(data || []))
      .catch(console.error)
      .finally(() => setIsFetchingAnnouncements(false));
  };

  useEffect(() => {
    if (activeTab === "Announcements" && announcements.length === 0) {
      fetchAnnouncements();
    }
  }, [activeTab, announcements.length]);

  const confirmAcknowledge = (id: string) => {
    setAckId(id);
    setAckModalOpen(true);
  };

  const executeAcknowledge = async () => {
    if (!ackId) return;
    setIsAcknowledging(true);
    try {
      await apiRequest(`/api/announcements/${ackId}/acknowledge`, { method: "POST" });
      setAnnouncements(prev => prev.map(a => a.id === ackId ? { ...a, isAcknowledged: true } : a));
      setAckModalOpen(false);
      setAckId(null);
      setSuccessMessage("Announcement successfully acknowledged!");
      setSuccessModalOpen(true);
    } catch (error) {
      console.error("Failed to acknowledge announcement:", error);
      setSuccessMessage("Failed to acknowledge announcement. Please try again.");
      setSuccessModalOpen(true);
    } finally {
      setIsAcknowledging(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "Store") {
      setActiveTab("Store");
    }
  }, []);

  const navClass = (id: string) =>
    `inline-flex h-9 items-center border-b-2 px-1 text-sm font-semibold transition ${activeTab === id
      ? "border-[#1F6B43] text-[#123D2A]"
      : "border-transparent text-[#365f4a] hover:border-[#1F6B43]/55 hover:text-[#123D2A]"
    }`;

  async function handleLogout() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-[101vh] flex-col bg-[#F8F6EF] font-sans">
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 border-b-2 border-[#1F6B43]/55 bg-white/92 text-[#123D2A] shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          {/* Logo Section */}
          <div className="w-[250px]">
            <Link href="#" onClick={() => setActiveTab("Dashboard")} className="flex items-center gap-3">
              <span className="relative block size-14 overflow-hidden rounded-md">
                <Image
                  src="/trackcoop-logo.svg"
                  alt="TrackCOOP logo"
                  fill
                  unoptimized
                  sizes="56px"
                  className="object-contain"
                  priority
                />
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-lg font-bold tracking-[0.04em]">
                  TrackCOOP
                </span>
                <span className="block text-[11px] italic text-[#4b6b5a]">
                  Cooperative Member
                </span>
              </span>
            </Link>
          </div>

          {/* Center Nav Links */}
          <nav className="hidden items-center gap-2 lg:flex">
            <button onClick={() => setActiveTab("Dashboard")} className={navClass("Dashboard")}>Dashboard</button>
            <button onClick={() => setActiveTab("Member & Share")} className={navClass("Member & Share")}>Member & Share</button>
            <button onClick={() => setActiveTab("Rental")} className={navClass("Rental")}>Equipment Rental</button>
            <button onClick={() => setActiveTab("Store")} className={navClass("Store")}>Coop Store</button>
          </nav>

          {/* Right Actions */}
          <div className="flex w-[250px] items-center justify-end gap-4">

            {/* <button onClick={() => setActiveTab("Help")} className={`transition ${activeTab === "Help" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Help Center">
              <MessageSquare className="size-5" />
            </button> */}
            <button onClick={() => setActiveTab("Profile")} className={`transition ${activeTab === "Profile" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Profile & Settings">
              <User className="size-5" />
            </button>
            <button onClick={() => setActiveTab("Announcements")} className={`transition ${activeTab === "Announcements" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Announcements">
              <Bell className="size-5" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="flex items-center gap-2 rounded-full border border-[#123D2A]/20 bg-[#123D2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1F6B43] disabled:cursor-wait disabled:opacity-70"
            >
              {isSigningOut ? "Logging out" : "Logout"}
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <Modal
        title="All Announcements"
        description="Search and view all past and present announcements from the cooperative."
        open={allAnnouncementsModalOpen}
        onOpenChange={setAllAnnouncementsModalOpen}
        trigger={<span className="hidden"></span>}
        maxWidth="max-w-3xl"
      >
        <div className="mt-4">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title or message..."
              value={announcementSearch}
              onChange={(e) => {
                setAnnouncementSearch(e.target.value);
                setAnnouncementPage(1);
              }}
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
            />
          </div>

          <div className="flex flex-col gap-4">
            {(() => {
              const filteredAnnouncements = announcements.filter(a => (a.title + " " + a.message).toLowerCase().includes(announcementSearch.toLowerCase()));
              const itemsPerPage = 5;
              const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / itemsPerPage));
              const currentPage = Math.min(announcementPage, totalPages);
              const paginatedAnnouncements = filteredAnnouncements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

              return (
                <>
                  {paginatedAnnouncements.map((ann, i) => (
                    <div key={ann.id} className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-[#E5E7EB] transition-all hover:shadow-md flex flex-col md:flex-row">
                      <div className="md:w-1/4 h-36 md:h-auto bg-[#e8f3ec] relative overflow-hidden shrink-0">
                        {i === 0 && announcementSearch === "" && (
                          <div className="absolute top-3 left-3 z-10 rounded-full bg-[#123D2A] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                            Latest Update
                          </div>
                        )}
                        {ann.featuredImagePath && (
                          <img src={`${env.apiUrl}${ann.featuredImagePath}`} alt={ann.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                        )}
                        <div className={`absolute inset-0 bg-gradient-to-tr from-[#123D2A]/${ann.featuredImagePath ? '60' : '80'} to-transparent z-10`}></div>
                      </div>
                      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between min-w-0">
                        <div>
                          <p className="text-xs font-bold text-[#2F7D57] mb-2">
                            {new Date(ann.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </p>
                          <h3 className="text-lg md:text-xl font-bold text-[#173626] group-hover:text-[#2F7D57] transition-colors leading-tight break-all">
                            {ann.title}
                          </h3>
                          <p className={`mt-2 text-[#6B7280] leading-relaxed whitespace-pre-wrap break-all text-xs md:text-sm ${expandedIds.has(ann.id) ? "" : "line-clamp-1"}`}>
                            {ann.message}
                          </p>
                          {ann.message && ann.message.length > 120 && (
                            <button
                              onClick={() => toggleExpand(ann.id)}
                              className="mt-1 text-left text-[11px] font-bold text-[#2F7D57] hover:underline"
                            >
                              {expandedIds.has(ann.id) ? "Show Less" : "Read More"}
                            </button>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                          <span className="text-[10px] font-bold uppercase text-[#6B7280]">
                            {new Date(ann.createdAt).toLocaleString("en-US", {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                            })}
                          </span>
                          {ann.isAcknowledged ? (
                            <span className="flex items-center text-[11px] font-bold text-green-600">
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Acknowledged
                            </span>
                          ) : (
                            <button onClick={() => confirmAcknowledge(ann.id)} className="rounded-full bg-[#173626] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#122A1E]">
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredAnnouncements.length === 0 && (
                    <div className="py-12 text-center text-sm text-gray-500">
                      No announcements found matching your search.
                    </div>
                  )}

                  <div className="mt-6 relative flex items-center justify-center min-h-[40px]">
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAnnouncementPage(1)} disabled={currentPage === 1} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                          &lt;&lt;
                        </button>
                        <button onClick={() => setAnnouncementPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                          &lt;
                        </button>
                        <span className="text-sm font-semibold text-gray-600 px-4">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button onClick={() => setAnnouncementPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                          &gt;
                        </button>
                        <button onClick={() => setAnnouncementPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-md border border-gray-200 disabled:opacity-50 hover:bg-gray-50 text-[#173626] font-bold">
                          &gt;&gt;
                        </button>
                      </div>
                    )}
                    <div className="absolute right-0">
                      <Button type="button" variant="secondary" onClick={() => setAllAnnouncementsModalOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </Modal>

      <Modal
        title={successMessage.includes("Failed") ? "Error" : "Success"}
        description={successMessage}
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="primary" onClick={() => setSuccessModalOpen(false)}>
            OK
          </Button>
        </div>
      </Modal>

      <Modal
        title="Confirm Acknowledgment"
        description="Are you sure you want to mark this announcement as read? This will let the cooperative know that you have seen it."
        open={ackModalOpen}
        onOpenChange={(open) => {
          setAckModalOpen(open);
          if (!open) setAckId(null);
        }}
        trigger={<span className="hidden"></span>}
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAckModalOpen(false);
              setAckId(null);
            }}
            disabled={isAcknowledging}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={executeAcknowledge}
            disabled={isAcknowledging}
          >
            {isAcknowledging ? "Processing..." : "Yes, Acknowledge"}
          </Button>
        </div>
      </Modal>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          {/* ======================= DASHBOARD TAB ======================= */}
          {activeTab === "Dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* 1. ENHANCED WELCOME BANNER */}
              <section className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm lg:p-12 border border-[#E5E7EB]">
                <div className="absolute right-0 top-0 h-full w-2/3 bg-gradient-to-l from-[#DFF5E8]/60 via-[#DFF5E8]/10 to-transparent"></div>
                <div className="relative z-10 flex flex-col justify-between gap-12 md:flex-row md:items-center">
                  <div className="max-w-xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#F8F6EF] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#2F7D57] border border-[#DDE8D8]">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2F7D57] opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2F7D57]"></span>
                      </span>
                      Member Portal Active
                    </div>
                    <h1 className="mb-4 text-4xl font-bold tracking-tight text-[#173626] sm:text-5xl">
                      Welcome back, {user?.displayName?.split(" ")[0] || "Member"} 👋
                    </h1>
                    <p className="mb-8 text-lg text-[#6B7280] leading-relaxed">
                      Track your cooperative contributions, review the latest updates, and manage your assets with ease.
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <button onClick={() => setActiveTab("Member & Share")} className="rounded-xl bg-[#123D2A] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#123D2A]/20 transition hover:bg-[#1B4D37] hover:shadow-xl hover:-translate-y-0.5">
                        View Share Capital
                      </button>
                    </div>
                  </div>

                  {/* Interactive Floating Cards */}
                  <div className="group relative hidden h-48 w-full max-w-sm shrink-0 md:block md:w-72 cursor-default perspective-1000">
                    <div className="absolute right-0 top-0 z-20 w-64 -translate-y-4 translate-x-4 rounded-2xl bg-gradient-to-br from-[#123D2A] to-[#1a5c3f] p-6 text-white shadow-2xl transition-all duration-500 ease-out group-hover:-translate-y-8 group-hover:shadow-[0_20px_40px_-15px_rgba(18,61,42,0.5)]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white/80">Total Share Capital</p>
                        <Wallet className="h-5 w-5 text-white/50" />
                      </div>
                      <h3 className="mt-2 text-3xl font-bold tracking-tight">
                        {isFetchingDashboard ? "..." : `₱${(dashboardData?.shareCapital?.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      </h3>
                      <div className="mt-4 flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1 text-[#DFF5E8]"><ArrowUpRight className="h-3 w-3" /> Up to date</span>
                      </div>
                    </div>
                    <div className="absolute right-8 top-12 z-10 w-64 rounded-2xl border border-[#E5E7EB] bg-white/90 backdrop-blur-sm p-6 shadow-lg transition-all duration-500 ease-out group-hover:translate-x-6 group-hover:translate-y-2 group-hover:rotate-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#6B7280]">Next Due Date</p>
                        <Clock className="h-5 w-5 text-[#94A3B8]" />
                      </div>
                      <h3 className="mt-2 text-xl font-bold text-[#173626]">
                        {isFetchingDashboard ? "..." : (dashboardData?.shareCapital?.deadline ? new Date(dashboardData.shareCapital.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "None")}
                      </h3>
                      <p className="mt-1 text-xs text-amber-600 font-semibold">Keep it updated</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. UPGRADED STAT CARDS */}
              <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Capital Deposits", value: dashboardData?.stats?.deposits || "0", icon: Wallet, color: "text-blue-600", bg: "bg-blue-50", trend: "Total transactions", trendColor: "text-slate-500" },
                  { label: "Store Purchases", value: dashboardData?.stats?.purchases || "0", icon: ShoppingBag, color: "text-amber-600", bg: "bg-amber-50", trend: "Total transactions", trendColor: "text-amber-600" },
                  { label: "Active Rentals", value: dashboardData?.stats?.rentals || "0", icon: Tractor, color: "text-purple-600", bg: "bg-purple-50", trend: "Total bookings", trendColor: "text-purple-600" },
                  { label: "Announcements", value: dashboardData?.stats?.announcements || "0", icon: Calendar, color: "text-green-600", bg: "bg-green-50", trend: "Active", trendColor: "text-green-600" },
                ].map((stat, i) => (
                  <div key={i} className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-3xl font-bold tracking-tight text-[#173626]">{stat.value}</h3>
                        <p className="mt-1 text-sm font-medium text-[#6B7280]">{stat.label}</p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className={`text-xs font-semibold ${stat.trendColor}`}>{stat.trend}</p>
                    </div>
                  </div>
                ))}
              </section>

              {/* 3. QUICK ACTIONS GRID & 4. RECENT TRANSACTIONS */}
              <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">

                {/* RECENT TRANSACTIONS TABLE */}
                <section className="lg:col-span-2 rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-[#173626]">Recent Activity</h3>
                    <button onClick={() => setIsActivityModalOpen(true)} className="text-sm font-semibold text-[#2F7D57] hover:text-[#123D2A]">View All</button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[#E5E7EB] text-[#6B7280]">
                        <tr>
                          <th className="pb-3 font-semibold">Transaction</th>
                          <th className="pb-3 font-semibold">Date</th>
                          <th className="pb-3 font-semibold">Amount</th>
                          <th className="pb-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {dashboardData?.recentActivity?.length > 0 ? (
                          dashboardData.recentActivity.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.type.includes('Deposit') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {item.type.includes('Deposit') ? <ArrowDownRight className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                                  </div>
                                  <span className="font-medium text-[#173626]">{item.type}</span>
                                </div>
                              </td>
                              <td className="py-4 text-[#6B7280]">
                                {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                              </td>
                              <td className="py-4 font-bold text-[#173626]">
                                {item.type.includes('Deposit') ? '+' : '-'} ₱{Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-4">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${item.status === 'Completed' || item.status === 'Validated' ? 'bg-green-50 text-green-700 border-green-200' :
                                    item.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                  {item.status === 'Completed' || item.status === 'Validated' ? <CheckCircle2 className="h-3 w-3" /> :
                                    item.status === 'Pending' ? <Clock className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-[#6B7280]">No recent activity found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* QUICK ACTIONS */}
                <section className="flex flex-col gap-4">
                  <h3 className="mb-2 text-lg font-bold text-[#173626]">Quick Actions</h3>

                  <button onClick={() => setActiveTab("Member & Share")} className="group flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-[#1F6B43] hover:shadow-md text-left">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F6EF] text-[#123D2A] transition group-hover:bg-[#123D2A] group-hover:text-white">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#173626]">Deposit Share</h4>
                        <p className="text-xs text-[#6B7280]">Add to your capital</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#123D2A] group-hover:translate-x-1" />
                  </button>

                  <button className="group flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-[#1F6B43] hover:shadow-md text-left">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F6EF] text-[#123D2A] transition group-hover:bg-[#123D2A] group-hover:text-white">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#173626]">Apply for Loan</h4>
                        <p className="text-xs text-[#6B7280]">Low interest rates</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#123D2A] group-hover:translate-x-1" />
                  </button>

                  <button onClick={() => setActiveTab("Rental")} className="group flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-[#1F6B43] hover:shadow-md text-left">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F6EF] text-[#123D2A] transition group-hover:bg-[#123D2A] group-hover:text-white">
                        <Tractor className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#173626]">Rent Equipment</h4>
                        <p className="text-xs text-[#6B7280]">Browse machinery</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#123D2A] group-hover:translate-x-1" />
                  </button>

                  <button onClick={() => setActiveTab("Store")} className="group flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-[#1F6B43] hover:shadow-md text-left">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F6EF] text-[#123D2A] transition group-hover:bg-[#123D2A] group-hover:text-white">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#173626]">Coop Store</h4>
                        <p className="text-xs text-[#6B7280]">Buy farm inputs</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#123D2A] group-hover:translate-x-1" />
                  </button>
                </section>
              </div>

              {/* 5. CONSOLIDATED GET IN TOUCH */}
              <section className="mb-8 mt-8 flex flex-col md:flex-row items-center justify-between rounded-3xl bg-[#123D2A] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-white/10 to-transparent"></div>
                <div className="relative z-10 text-center md:text-left mb-6 md:mb-0">
                  <h3 className="text-2xl font-bold">Need assistance?</h3>
                  <p className="mt-1 text-white/80">Our support team is here to help you with your account.</p>
                </div>
                <div className="relative z-10 flex gap-4">
                  <button className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-[#123D2A] hover:bg-slate-100 transition">
                    <Phone className="h-4 w-4" /> Call Hotline
                  </button>
                  <button className="flex items-center gap-2 rounded-xl bg-white/20 px-5 py-3 font-bold text-white hover:bg-white/30 transition backdrop-blur-sm">
                    <Mail className="h-4 w-4" /> Message Us
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ======================= MEMBER & SHARE CAPITAL TAB ======================= */}
          {activeTab === "Member & Share" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="text-center mb-10">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#2F7D57]">Financial Overview</h2>
                <h3 className="mt-2 text-3xl font-bold text-[#173626]">Share Capital & Milestones</h3>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* LEFT COLUMN: Premium Passbook & Growth */}
                <div className="md:col-span-7 flex flex-col gap-6">

                  {/* Digital Passbook Card */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#123D2A] via-[#1a5c3f] to-[#123D2A] p-8 shadow-2xl text-white">
                    {/* Decorative Background Elements */}
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>
                    <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-md border border-white/20">
                          <Wallet className="h-4 w-4" /> Digital Passbook
                        </div>
                        <ShieldCheck className="h-6 w-6 text-white/50" />
                      </div>

                      <p className="text-sm font-medium text-white/80 tracking-wide">Total Share Capital</p>
                      <h4 className="mt-2 text-5xl font-bold tracking-tight">
                        {isFetchingDashboard ? "..." : `₱${(dashboardData?.shareCapital?.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      </h4>

                      <div className="mt-8 flex flex-col sm:flex-row gap-4">
                        <button className="flex-1 rounded-xl bg-white px-6 py-3.5 font-bold text-[#123D2A] shadow-lg transition hover:bg-[#F8F6EF] hover:-translate-y-0.5 hover:shadow-xl flex items-center justify-center gap-2">
                          <TrendingUp className="h-5 w-5" /> Deposit Capital
                        </button>
                        <a href="/statement" target="_blank" className="flex-1 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-3.5 font-bold text-white transition hover:bg-white/20 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                          <Download className="h-5 w-5" /> Download Statement
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Dividends & Patronage */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#1F6B43]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#6B7280]">Dividends Earned</p>
                        <PieChart className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-[#173626]">₱0.00</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Coming Soon</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1">Available at year end</p>
                    </div>
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#1F6B43]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#6B7280]">Patronage Refund</p>
                        <Star className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-[#173626]">₱0.00</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Coming Soon</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1">Based on purchases</p>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Achievements & Milestones */}
                <div className="md:col-span-5 flex flex-col gap-6">

                  {/* Achievements Panel */}
                  <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-[#173626]">Badges & Tiers</h3>
                      <span className="text-xs font-bold text-[#2F7D57] bg-[#DFF5E8] px-3 py-1 rounded-full">Gold Tier</span>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-[#173626]">Next Milestone: Platinum</span>
                        <span className="font-bold text-[#2F7D57]">50%</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#1F6B43] to-[#2F7D57] w-1/2"></div>
                      </div>
                      <p className="mt-2 text-xs text-[#6B7280]">₱25,000 more share capital needed.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center transition hover:bg-white hover:shadow-md hover:border-[#E5E7EB]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-3">
                          <Award className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-bold text-[#173626]">1 Year Member</h4>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center transition hover:bg-white hover:shadow-md hover:border-[#E5E7EB]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-3">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-bold text-[#173626]">First Loan Paid</h4>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center transition hover:bg-white hover:shadow-md hover:border-[#E5E7EB]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 mb-3">
                          <Star className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-bold text-[#173626]">Active Saver</h4>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center opacity-50 grayscale">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-400 mb-3">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-bold text-[#173626]">Loyalty (5 Yrs)</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT DEPOSITS LIST */}
              <div className="mt-8 rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
                <h3 className="text-xl font-bold text-[#173626] mb-6">Recent Capital Contributions</h3>
                <div className="space-y-4">
                  {dashboardData?.recentActivity?.filter((a: any) => a.type.includes('Deposit')).length > 0 ? (
                    dashboardData.recentActivity.filter((a: any) => a.type.includes('Deposit')).map((item: any, idx: number) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:bg-white hover:shadow-sm transition">
                        <div className="flex items-center gap-4 mb-3 sm:mb-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <ArrowDownRight className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-[#173626]">Capital Deposit</h4>
                            <p className="text-xs text-[#6B7280]">ID: {item.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                          <div className="text-left sm:text-right">
                            <p className="text-xs font-semibold text-[#6B7280]">
                              {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                            </p>
                          </div>
                          <div className="text-right">
                            <h4 className="font-bold text-[#173626]">₱{Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">{item.status}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-500 py-4">No recent contributions found.</div>
                  )}
                </div>
              </div>

            </div>
          )}



          {/* ======================= ANNOUNCEMENTS TAB ======================= */}
          {activeTab === "Announcements" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Header Banner */}
              <section className="mb-10 rounded-3xl bg-[#123D2A] px-8 py-10 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[#1F6B43]/50 to-transparent"></div>
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md mb-4 border border-white/20">
                    <Megaphone className="h-4 w-4" /> Communications Hub
                  </div>
                  <h2 className="text-3xl font-bold md:text-4xl">News & Updates</h2>
                  <p className="mt-3 text-white/80 max-w-xl text-sm md:text-base">
                    Stay informed with the latest cooperative guidelines, general assembly schedules, and urgent system alerts.
                  </p>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN: Announcements Feed */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {isFetchingAnnouncements ? (
                    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
                      <p className="text-sm font-semibold text-[#6B7280]">Loading latest announcements...</p>
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
                      <Megaphone className="mx-auto mb-3 h-8 w-8 text-[#94A3B8]" />
                      <p className="text-sm font-semibold text-[#6B7280]">No announcements found at the moment.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {announcements.slice(0, 3).map((ann, i) => (
                        <div key={ann.id} className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-[#E5E7EB] transition-all hover:shadow-md flex flex-col md:flex-row">
                          <div className="md:w-1/4 h-36 md:h-auto bg-[#e8f3ec] relative overflow-hidden shrink-0">
                            {i === 0 && (
                              <div className="absolute top-4 left-4 z-10 rounded-full bg-[#123D2A] px-3 py-1 text-xs font-bold text-white shadow-md">
                                Latest Update
                              </div>
                            )}
                            {ann.featuredImagePath && (
                              <img src={`${env.apiUrl}${ann.featuredImagePath}`} alt={ann.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                            )}
                            <div className={`absolute inset-0 bg-gradient-to-tr from-[#123D2A]/${ann.featuredImagePath ? '60' : '80'} to-transparent z-10`}></div>
                          </div>
                          <div className="flex-1 p-5 md:p-6 flex flex-col justify-between min-w-0">
                            <div>
                              <p className="text-xs font-bold text-[#2F7D57] mb-2">
                                {new Date(ann.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </p>
                              <h3 className="text-lg md:text-xl font-bold text-[#173626] group-hover:text-[#2F7D57] transition-colors leading-tight break-all">
                                {ann.title}
                              </h3>
                              <p className={`mt-2 text-[#6B7280] leading-relaxed whitespace-pre-wrap break-all text-xs md:text-sm ${expandedIds.has(ann.id) ? "" : "line-clamp-1"}`}>
                                {ann.message}
                              </p>
                              {ann.message && ann.message.length > 120 && (
                                <button
                                  onClick={() => toggleExpand(ann.id)}
                                  className="mt-1 text-left text-[11px] font-bold text-[#2F7D57] hover:underline"
                                >
                                  {expandedIds.has(ann.id) ? "Show Less" : "Read More"}
                                </button>
                              )}
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                              <span className="text-[10px] font-bold uppercase text-[#6B7280]">
                                {new Date(ann.createdAt).toLocaleString("en-US", {
                                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                                })}
                              </span>
                              {ann.isAcknowledged ? (
                                <span className="flex items-center text-[11px] font-bold text-green-600">
                                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Acknowledged
                                </span>
                              ) : (
                                <button onClick={() => confirmAcknowledge(ann.id)} className="rounded-full bg-[#173626] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#122A1E]">
                                  Acknowledge
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {announcements.length > 3 && (
                        <button
                          onClick={() => setAllAnnouncementsModalOpen(true)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-[#123D2A] transition hover:bg-gray-50 hover:shadow-sm"
                        >
                          View All Announcements
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Priority Alerts */}
                <div className="flex flex-col gap-6">

                  <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-[#173626]">Live Alerts</h3>
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                      </span>
                    </div>

                    <div className="flex flex-col gap-4">
                      {isFetchingAnnouncements ? (
                        <div className="py-8 text-center">
                          <p className="text-xs font-medium text-[#6B7280]">Loading alerts...</p>
                        </div>
                      ) : announcements.length === 0 ? (
                        <div className="py-8 text-center">
                          <p className="text-xs font-medium text-[#6B7280]">No live alerts right now.</p>
                        </div>
                      ) : (
                        announcements.slice(0, 3).map((ann, idx) => {
                          // Alternate colors for visual distinction
                          const themes = [
                            { bg: "bg-red-50", border: "border-red-100", iconBg: "bg-red-100", iconText: "text-red-600", textDark: "text-red-900", textLight: "text-red-700", timeText: "text-red-500", Icon: AlertCircle },
                            { bg: "bg-amber-50", border: "border-amber-100", iconBg: "bg-amber-100", iconText: "text-amber-600", textDark: "text-amber-900", textLight: "text-amber-700", timeText: "text-amber-500", Icon: AlertCircle },
                            { bg: "bg-blue-50", border: "border-blue-100", iconBg: "bg-blue-100", iconText: "text-blue-600", textDark: "text-blue-900", textLight: "text-blue-700", timeText: "text-blue-500", Icon: Info },
                          ];

                          const colorTheme = themes[idx % themes.length];
                          const Icon = colorTheme.Icon;

                          return (
                            <div key={ann.id} className={`flex items-start gap-4 rounded-2xl border ${colorTheme.border} ${colorTheme.bg} p-4`}>
                              <div className={`mt-0.5 shrink-0 rounded-full ${colorTheme.iconBg} p-2 ${colorTheme.iconText}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className={`text-sm font-bold ${colorTheme.textDark}`}>{ann.title}</h4>
                                <p className={`mt-1 text-xs ${colorTheme.textLight} leading-relaxed line-clamp-2`}>{ann.excerpt || ann.message}</p>
                                <span className={`mt-2 block text-[10px] font-bold uppercase ${colorTheme.timeText}`}>
                                  {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                                {!ann.isAcknowledged && (
                                  <button
                                    onClick={() => confirmAcknowledge(ann.id)}
                                    className="mt-2 text-[10px] font-bold uppercase text-[#173626] underline hover:text-[#0f2419]"
                                  >
                                    Acknowledge
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ======================= RENTAL TAB ======================= */}
          {activeTab === "Rental" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-sm mt-6">
              <RentalProvider>
                <RentalLandingPage useModals={true} />
              </RentalProvider>
            </div>
          )}

          {/* ======================= STORE TAB ======================= */}
          {activeTab === "Store" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MemberPosClient />
            </div>
          )}

          {/* ======================= PROFILE TAB ======================= */}
          {activeTab === "Profile" && (
            <ProfileSettings />
          )}

          {/* ======================= HELP CENTER TAB ======================= */}
          {/* {activeTab === "Help" && (
            <HelpCenter />
          )} */}

        </div>
      </main>
      {/* FOOTER */}
      <div className="mt-20">
        <SiteFooter />
      </div>
      <ActivityModal open={isActivityModalOpen} onOpenChange={setIsActivityModalOpen} />
    </div>
  );
}
