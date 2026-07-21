"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
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
  Info
} from "lucide-react";
import MemberPosClient from "@/features/pos/components/MemberPosClient";

export default function MemberDashboardPage() {
  const [activeTab, setActiveTab] = useState("Dashboard");

  const navClass = (id: string) =>
    `inline-flex h-9 items-center border-b-2 px-1 text-sm font-semibold transition ${activeTab === id
      ? "border-[#1F6B43] text-[#123D2A]"
      : "border-transparent text-[#365f4a] hover:border-[#1F6B43]/55 hover:text-[#123D2A]"
    }`;

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
            <button onClick={() => setActiveTab("Activities")} className={`transition ${activeTab === "Activities" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Activities Gallery">
              <Images className="size-5" />
            </button>
            <button onClick={() => setActiveTab("Announcements")} className={`transition ${activeTab === "Announcements" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Announcements">
              <Bell className="size-5" />
            </button>
            <Link href="/login" className="flex items-center gap-2 rounded-full border border-[#123D2A]/20 bg-[#123D2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1F6B43]">
              Logout
              <LogOut className="size-4" />
            </Link>
          </div>
        </div>
      </header>

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
                      Welcome back, Pierre 👋
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
                      <h3 className="mt-2 text-3xl font-bold tracking-tight">₱25,000<span className="text-xl text-white/70">.00</span></h3>
                      <div className="mt-4 flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1 text-[#DFF5E8]"><ArrowUpRight className="h-3 w-3" /> +₱2,000 this month</span>
                      </div>
                    </div>
                    <div className="absolute right-8 top-12 z-10 w-64 rounded-2xl border border-[#E5E7EB] bg-white/90 backdrop-blur-sm p-6 shadow-lg transition-all duration-500 ease-out group-hover:translate-x-6 group-hover:translate-y-2 group-hover:rotate-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#6B7280]">Next Due Date</p>
                        <Clock className="h-5 w-5 text-[#94A3B8]" />
                      </div>
                      <h3 className="mt-2 text-xl font-bold text-[#173626]">May 15, 2026</h3>
                      <p className="mt-1 text-xs text-amber-600 font-semibold">In 7 days</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. UPGRADED STAT CARDS */}
              <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Active Loans", value: "0", icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50", trend: "No pending dues", trendColor: "text-slate-500" },
                  { label: "Pending Requests", value: "2", icon: FileText, color: "text-amber-600", bg: "bg-amber-50", trend: "Under review", trendColor: "text-amber-600" },
                  { label: "Unread Messages", value: "1", icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50", trend: "1 new from Admin", trendColor: "text-purple-600" },
                  { label: "Upcoming Events", value: "3", icon: Calendar, color: "text-green-600", bg: "bg-green-50", trend: "Next: GA Meeting", trendColor: "text-green-600" },
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
                    <button className="text-sm font-semibold text-[#2F7D57] hover:text-[#123D2A]">View All</button>
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
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600"><ArrowDownRight className="h-5 w-5" /></div>
                              <span className="font-medium text-[#173626]">Share Capital Deposit</span>
                            </div>
                          </td>
                          <td className="py-4 text-[#6B7280]">May 01, 2026</td>
                          <td className="py-4 font-bold text-[#173626]">+ ₱2,000.00</td>
                          <td className="py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Clock className="h-5 w-5" /></div>
                              <span className="font-medium text-[#173626]">Tractor Rental Request</span>
                            </div>
                          </td>
                          <td className="py-4 text-[#6B7280]">Apr 28, 2026</td>
                          <td className="py-4 font-bold text-[#173626]">- ₱5,000.00</td>
                          <td className="py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><ShoppingBag className="h-5 w-5" /></div>
                              <span className="font-medium text-[#173626]">Coop Store Purchase</span>
                            </div>
                          </td>
                          <td className="py-4 text-[#6B7280]">Apr 15, 2026</td>
                          <td className="py-4 font-bold text-[#173626]">- ₱1,250.00</td>
                          <td className="py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          </td>
                        </tr>
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
                      <h4 className="mt-2 text-5xl font-bold tracking-tight">₱25,000<span className="text-2xl text-white/70">.00</span></h4>

                      <div className="mt-8 flex flex-col sm:flex-row gap-4">
                        <button className="flex-1 rounded-xl bg-white px-6 py-3.5 font-bold text-[#123D2A] shadow-lg transition hover:bg-[#F8F6EF] hover:-translate-y-0.5 hover:shadow-xl flex items-center justify-center gap-2">
                          <TrendingUp className="h-5 w-5" /> Deposit Capital
                        </button>
                        <button className="flex-1 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-3.5 font-bold text-white transition hover:bg-white/20 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                          <Download className="h-5 w-5" /> Download Statement
                        </button>
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
                      <h3 className="mt-3 text-2xl font-bold text-[#173626]">₱1,250.00</h3>
                      <p className="mt-2 text-xs font-semibold text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> +5% vs last year</p>
                    </div>
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#1F6B43]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#6B7280]">Patronage Refund</p>
                        <Star className="h-5 w-5 text-blue-500" />
                      </div>
                      <h3 className="mt-3 text-2xl font-bold text-[#173626]">₱480.00</h3>
                      <p className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1">For year 2025</p>
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
                  {[
                    { date: "May 01, 2026", amount: "₱2,000.00", receipt: "OR-10293", status: "Verified" },
                    { date: "Apr 01, 2026", amount: "₱2,000.00", receipt: "OR-09842", status: "Verified" },
                    { date: "Mar 01, 2026", amount: "₱2,000.00", receipt: "OR-08731", status: "Verified" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:bg-white hover:shadow-sm transition">
                      <div className="flex items-center gap-4 mb-3 sm:mb-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                          <ArrowDownRight className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#173626]">Monthly Deposit</h4>
                          <p className="text-xs text-[#6B7280]">Receipt: {item.receipt}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-semibold text-[#6B7280]">{item.date}</p>
                        </div>
                        <div className="text-right">
                          <h4 className="font-bold text-[#173626]">{item.amount}</h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">{item.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ======================= ACTIVITIES TAB ======================= */}
          {activeTab === "Activities" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Header */}
              <section className="text-center mb-10">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#DFF5E8] text-[#123D2A]">
                  <Images className="h-8 w-8" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#2F7D57]">Community Gallery</h2>
                <h3 className="mt-2 text-3xl font-bold text-[#173626]">Coop Activities & Events</h3>
                <p className="mt-2 text-[#6B7280] max-w-xl mx-auto">Discover moments, milestones, and community outreach captured during our recent cooperative events.</p>
              </section>

              {/* Filters */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
                {["All Photos", "General Assembly", "Outreach", "Seminars", "Harvest Festivals"].map((filter, index) => (
                  <button
                    key={index}
                    className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${index === 0
                      ? "bg-[#123D2A] text-white shadow-md"
                      : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#2F7D57] hover:text-[#123D2A]"
                      }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Masonry Photo Grid */}
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">

                {/* Photo 1 (Large Vertical) */}
                <div className="group relative overflow-hidden rounded-3xl break-inside-avoid shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#E5E7EB]">
                  <div className="h-96 w-full bg-slate-200 relative">
                    {/* Image */}
                    <img src="https://picsum.photos/seed/assembly/800/800" alt="General Assembly" className="absolute inset-0 w-full h-full object-cover z-0" />
                    {/* Simulated Image Texture */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#123D2A]/20 to-[#2F7D57]/40 z-0 mix-blend-multiply"></div>

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 z-10">
                      <h4 className="text-xl font-bold text-white translate-y-4 group-hover:translate-y-0 transition-transform duration-300">Annual General Assembly</h4>
                      <div className="flex items-center gap-3 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                        <span className="flex items-center gap-1 text-xs text-white/80"><Calendar className="h-3 w-3" /> May 2026</span>
                        <span className="flex items-center gap-1 text-xs text-white/80"><MapPin className="h-3 w-3" /> Main Hall</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo 2 (Square) */}
                <div className="group relative overflow-hidden rounded-3xl break-inside-avoid shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#E5E7EB]">
                  <div className="h-64 w-full bg-slate-100 relative">
                    <img src="https://picsum.photos/seed/seminar/600/600" alt="Financial Literacy Seminar" className="absolute inset-0 w-full h-full object-cover z-0" />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-blue-600/40 z-0 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 z-10">
                      <h4 className="text-xl font-bold text-white translate-y-4 group-hover:translate-y-0 transition-transform duration-300">Financial Literacy Seminar</h4>
                      <div className="flex items-center gap-3 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                        <span className="flex items-center gap-1 text-xs text-white/80"><Calendar className="h-3 w-3" /> Apr 2026</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo 3 (Landscape) */}
                <div className="group relative overflow-hidden rounded-3xl break-inside-avoid shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#E5E7EB]">
                  <div className="h-56 w-full bg-slate-300 relative">
                    <img src="https://picsum.photos/seed/outreach/600/600" alt="Community Outreach" className="absolute inset-0 w-full h-full object-cover z-0" />
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-orange-500/40 z-0 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 z-10">
                      <h4 className="text-xl font-bold text-white translate-y-4 group-hover:translate-y-0 transition-transform duration-300">Community Outreach</h4>
                      <div className="flex items-center gap-3 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                        <span className="flex items-center gap-1 text-xs text-white/80"><Calendar className="h-3 w-3" /> Mar 2026</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo 4 (Square) */}
                <div className="group relative overflow-hidden rounded-3xl break-inside-avoid shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#E5E7EB]">
                  <div className="h-72 w-full bg-slate-200 relative">
                    <img src="https://picsum.photos/seed/harvest/600/600" alt="Harvest Festival" className="absolute inset-0 w-full h-full object-cover z-0" />
                    <div className="absolute inset-0 bg-gradient-to-br from-green-700/20 to-green-500/40 z-0 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 z-10">
                      <h4 className="text-xl font-bold text-white translate-y-4 group-hover:translate-y-0 transition-transform duration-300">Harvest Festival</h4>
                      <div className="flex items-center gap-3 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                        <span className="flex items-center gap-1 text-xs text-white/80"><Calendar className="h-3 w-3" /> Oct 2025</span>
                        <span className="flex items-center gap-1 text-xs text-white/80"><MapPin className="h-3 w-3" /> Farm Site</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo 5 (Tall vertical) */}
                <div className="group relative overflow-hidden rounded-3xl break-inside-avoid shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#E5E7EB]">
                  <div className="h-80 w-full bg-slate-100 relative">
                    <img src="https://picsum.photos/seed/tree/600/600" alt="Tree Planting Activity" className="absolute inset-0 w-full h-full object-cover z-0" />
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-800/20 to-pink-600/40 z-0 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 z-10">
                      <h4 className="text-xl font-bold text-white translate-y-4 group-hover:translate-y-0 transition-transform duration-300">Tree Planting Activity</h4>
                      <div className="flex items-center gap-3 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                        <span className="flex items-center gap-1 text-xs text-white/80"><Calendar className="h-3 w-3" /> Aug 2025</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo 6 (Landscape) */}
                <div className="group relative overflow-hidden rounded-3xl break-inside-avoid shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#E5E7EB]">
                  <div className="h-60 w-full bg-slate-200 relative">
                    <img src="https://picsum.photos/seed/meeting/600/600" alt="Board Meeting" className="absolute inset-0 w-full h-full object-cover z-0" />
                    <div className="absolute inset-0 bg-gradient-to-br from-[#123D2A]/30 to-black/40 z-0 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 z-10">
                      <h4 className="text-xl font-bold text-white translate-y-4 group-hover:translate-y-0 transition-transform duration-300">Board Meeting</h4>
                      <div className="flex items-center gap-3 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                        <span className="flex items-center gap-1 text-xs text-white/80"><Calendar className="h-3 w-3" /> Jul 2025</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-12 text-center">
                <button className="rounded-full bg-white border border-[#E5E7EB] px-8 py-3 font-bold text-[#173626] shadow-sm transition hover:bg-slate-50 hover:shadow-md">
                  Load More Photos
                </button>
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

                {/* LEFT COLUMN: Featured News & Secondary News */}
                <div className="lg:col-span-2 flex flex-col gap-6">

                  {/* Featured News */}
                  <div className="group relative overflow-hidden rounded-3xl bg-white shadow-sm border border-[#E5E7EB] transition-all hover:shadow-md cursor-pointer">
                    <div className="absolute top-4 left-4 z-10 rounded-full bg-[#123D2A] px-3 py-1 text-xs font-bold text-white shadow-md">
                      Featured
                    </div>
                    {/* Featured Image */}
                    <div className="h-64 w-full bg-[#e8f3ec] relative overflow-hidden">
                      <img src="https://picsum.photos/seed/announce/800/600" alt="General Assembly" className="absolute inset-0 w-full h-full object-cover z-0" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#123D2A]/80 to-transparent z-10"></div>
                      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
                    </div>

                    <div className="relative z-20 -mt-16 p-8">
                      <p className="text-sm font-bold text-white mb-3">May 10, 2026</p>
                      <h3 className="text-2xl font-bold text-[#173626] group-hover:text-[#2F7D57] transition-colors">
                        2026 Annual General Assembly: Charting Our Future Together
                      </h3>
                      <p className="mt-3 text-[#6B7280] leading-relaxed">
                        Join us for our most important event of the year. We will be discussing the cooperative&apos;s remarkable growth over the past year, distributing dividends, and voting on key initiatives for 2027. All regular members are required to attend.
                      </p>
                      <button className="mt-6 flex items-center gap-2 font-bold text-[#123D2A] hover:text-[#1F6B43] transition-colors">
                        Read Full Story <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Secondary News Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="group overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition hover:shadow-md cursor-pointer flex flex-col">
                      <div className="h-32 w-full bg-[#f1f5f9] relative">
                        <img src="https://picsum.photos/seed/tractor/400/300" alt="Tractor" className="absolute inset-0 w-full h-full object-cover" />
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <p className="text-xs font-semibold text-[#2F7D57]">April 28, 2026</p>
                        <h4 className="mt-2 text-lg font-bold text-[#173626] group-hover:text-[#123D2A] leading-snug">
                          New Tractors Available for Rent
                        </h4>
                        <p className="mt-2 text-sm text-[#6B7280] flex-1">We have added three new Kubota tractors to our rental fleet. Book early for the planting season.</p>
                      </div>
                    </div>
                    <div className="group overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition hover:shadow-md cursor-pointer flex flex-col">
                      <div className="h-32 w-full bg-[#f1f5f9] relative">
                        <img src="https://picsum.photos/seed/promo/400/300" alt="Store Promo" className="absolute inset-0 w-full h-full object-cover" />
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <p className="text-xs font-semibold text-[#2F7D57]">April 15, 2026</p>
                        <h4 className="mt-2 text-lg font-bold text-[#173626] group-hover:text-[#123D2A] leading-snug">
                          Coop Store Summer Promo
                        </h4>
                        <p className="mt-2 text-sm text-[#6B7280] flex-1">Get up to 15% discount on all organic fertilizers and seeds until the end of May.</p>
                      </div>
                    </div>
                  </div>

                  <button className="w-full rounded-2xl border border-[#E5E7EB] bg-slate-50 py-4 font-bold text-[#173626] hover:bg-slate-100 transition">
                    Load More News
                  </button>

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

                      {/* Alert: Urgent */}
                      <div className="flex items-start gap-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                        <div className="mt-0.5 shrink-0 rounded-full bg-red-100 p-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-red-900">System Maintenance</h4>
                          <p className="mt-1 text-xs text-red-700 leading-relaxed">The member portal will be down for scheduled maintenance tonight from 10:00 PM to 2:00 AM.</p>
                          <span className="mt-2 block text-[10px] font-bold uppercase text-red-500">2 hours ago</span>
                        </div>
                      </div>

                      {/* Alert: Warning */}
                      <div className="flex items-start gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <div className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-2 text-amber-600">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-amber-900">Loan Restructuring Deadline</h4>
                          <p className="mt-1 text-xs text-amber-700 leading-relaxed">Please submit your restructuring documents by Friday to avoid penalties.</p>
                          <span className="mt-2 block text-[10px] font-bold uppercase text-amber-500">Yesterday</span>
                        </div>
                      </div>

                      {/* Alert: Info */}
                      <div className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <div className="mt-0.5 shrink-0 rounded-full bg-blue-100 p-2 text-blue-600">
                          <Info className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-blue-900">New Store Items</h4>
                          <p className="mt-1 text-xs text-blue-700 leading-relaxed">High-yield corn seeds are now available at the Cooperative Store.</p>
                          <span className="mt-2 block text-[10px] font-bold uppercase text-blue-500">3 days ago</span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ======================= RENTAL TAB ======================= */}
          {activeTab === "Rental" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="text-center">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#2F7D57]">Services</h2>
                <h3 className="mt-2 text-3xl font-bold text-[#173626]">Equipment Rental</h3>
                <p className="mt-2 text-[#6B7280]">Rent farming equipment and machineries at cooperative rates.</p>

                <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-white py-16 shadow-sm">
                  <Briefcase className="h-12 w-12 text-[#94A3B8]" />
                  <h4 className="mt-4 text-lg font-bold text-[#173626]">Coming Soon</h4>
                  <p className="mt-1 text-sm text-[#6B7280]">Equipment catalog will be available shortly.</p>
                </div>
              </section>
            </div>
          )}

          {/* ======================= STORE TAB ======================= */}
          {activeTab === "Store" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MemberPosClient />
            </div>
          )}



        </div>
      </main>
      {/* FOOTER */}
      <div className="mt-20">
        <SiteFooter />
      </div>
    </div>
  );
}
