"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import * as Select from "@radix-ui/react-select";
import * as Tabs from "@radix-ui/react-tabs";
import SiteFooter from "@/components/layout/SiteFooter";
import RentalLandingPage from "@/app/rental/page";
import { RentalProvider } from "@/app/rental/_context/RentalProvider";
import { logout, getAuthenticatedUser } from "@/lib/auth-client";
import type { AuthUser } from "@/features/auth/types";
import { apiRequest } from "@/lib/api-client";
import { expressFetch } from "@/lib/express-api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { resolveUploadUrl } from "@/lib/upload-url";
import {
  Bell,
  Search,
  User,
  UserPlus,
  Wallet,
  Calendar,
  Megaphone,
  MessageSquare,
  Inbox,
  MapPin,
  Phone,
  Mail,
  FileText,
  Briefcase,
  ChevronDown,
  ArrowRight,
  Leaf,
  LogOut,
  Images,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  Check,
  ShoppingBag,
  Store,
  Tractor,
  Printer,
  RefreshCw,
  PieChart,
  ShieldCheck,
  AlertCircle,
  Info,
  X,
  Link2,
  Copy,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Share2
} from "lucide-react";
import { MemberShareOverview } from "@/features/member-share-capital/MemberShareOverview";
import MemberPosClient from "@/features/pos/components/MemberPosClient";
import { MemberRequestsClient } from "@/app/(portal)/member/requests/MemberRequestsClient";
import { ProfileSettings } from "./components/ProfileSettings";
import { HelpCenter } from "./components/HelpCenter";
import {
  getMemberPatronage,
  type MemberPatronageSummary,
} from "@/features/patronage/patronage-api";
import {
  addDividendToShareCapital,
  getMemberDividends,
  requestDividendWithdrawal,
} from "@/features/member-share-capital/api";
import type { DividendWithdrawalMethod, MemberDividend } from "@/features/member-share-capital/types";

function getPreview(content?: string | null) {
  if (!content) return "";
  const plainText = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (plainText.length <= 140) return plainText;
  return `${plainText.slice(0, 140).trim()}...`;
}

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function referralStage(item: { status?: string; applicationStatus?: string }) {
  if (item.status === "Successful") return 3;
  if (["Rejected", "Cancelled"].includes(String(item.status))) return 2;
  if (["Approved", "Payment Confirmed"].includes(String(item.applicationStatus))) return 2;
  return 1;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

type FinancialPeriod = "year" | "month" | "30d" | "all" | "custom";

type FinancialCategoryItem = {
  category: string;
  amount: number;
  recordCount?: number;
};

type FinancialCategorySelection = FinancialCategoryItem & {
  kind: "Income" | "Expense";
  total: number;
};

const FINANCIAL_PERIOD_LABELS: Record<FinancialPeriod, string> = {
  year: "This Year",
  month: "This Month",
  "30d": "Last 30 Days",
  all: "All records",
  custom: "Choose dates",
};

export default function MemberDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isFetchingAnnouncements, setIsFetchingAnnouncements] = useState(false);
  const [announcementLoadError, setAnnouncementLoadError] = useState(false);
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
  
  const [readMoreModalOpen, setReadMoreModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isReferralCodeCopied, setIsReferralCodeCopied] = useState(false);
  const [isReferralLinkCopied, setIsReferralLinkCopied] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [restoreModalStack, setRestoreModalStack] = useState<{readMore: boolean, viewAll: boolean}>({readMore: false, viewAll: false});

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isFetchingDashboard, setIsFetchingDashboard] = useState(true);
  const [dashboardLoadError, setDashboardLoadError] = useState(false);
  const [financialView, setFinancialView] = useState("personal");
  const [financialPeriod, setFinancialPeriod] = useState<FinancialPeriod>("year");
  const [financialStartDate, setFinancialStartDate] = useState("");
  const [financialEndDate, setFinancialEndDate] = useState("");
  const [financialDefinitionsOpen, setFinancialDefinitionsOpen] = useState(false);
  const [selectedFinancialCategory, setSelectedFinancialCategory] = useState<FinancialCategorySelection | null>(null);
  const [financialCategoryPage, setFinancialCategoryPage] = useState(1);
  const [patronageData, setPatronageData] = useState<MemberPatronageSummary | null>(null);
  const [isFetchingPatronage, setIsFetchingPatronage] = useState(true);
  const [patronageLoadError, setPatronageLoadError] = useState(false);
  const [memberDividends, setMemberDividends] = useState<MemberDividend[]>([]);
  const [isFetchingDividends, setIsFetchingDividends] = useState(true);
  const [dividendLoadError, setDividendLoadError] = useState(false);
  const [actionDividend, setActionDividend] = useState<MemberDividend | null>(null);
  const [dividendAction, setDividendAction] = useState<"withdraw" | "capital" | null>(null);
  const [dividendActionBusy, setDividendActionBusy] = useState(false);
  const [dividendActionError, setDividendActionError] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState<DividendWithdrawalMethod>("Cash");
  const [withdrawalProvider, setWithdrawalProvider] = useState("");
  const [withdrawalAccountName, setWithdrawalAccountName] = useState("");
  const [withdrawalAccountNumber, setWithdrawalAccountNumber] = useState("");
  const [withdrawalQrCode, setWithdrawalQrCode] = useState<string | null>(null);
  const [withdrawalQrFileName, setWithdrawalQrFileName] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);

  const shareCapitalTotal = Math.max(0, Number(dashboardData?.shareCapital?.total) || 0);
  const referralCode = String(dashboardData?.referrals?.code || "");
  const referralLink = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/membership/apply?ref=${encodeURIComponent(referralCode)}`
    : "";
  const financialTransparency = dashboardData?.financialTransparency;
  const financialIncomeTotal = Number(financialTransparency?.incomeTotal || 0);
  const financialExpenseTotal = Number(financialTransparency?.expenseTotal || 0);
  const financialIncomeItems = (financialTransparency?.incomeByCategory || []) as FinancialCategoryItem[];
  const financialExpenseItems = (financialTransparency?.expenseByCategory || []) as FinancialCategoryItem[];
  const memberFinancialSummary = dashboardData?.memberFinancialSummary;
  const memberIncomeItems = (memberFinancialSummary?.incomeByCategory || []) as FinancialCategoryItem[];
  const memberExpenseItems = (memberFinancialSummary?.expenseByCategory || []) as FinancialCategoryItem[];
  const financialComparison = financialTransparency?.comparison as { label: string; incomeTotal: number; expenseTotal: number; netTotal: number } | null | undefined;
  const financialGeneratedAt = financialTransparency?.generatedAt ? new Date(financialTransparency.generatedAt) : null;
  const financialCategoryPageSize = 6;
  const financialCategoryPageCount = Math.max(
    1,
    Math.ceil(Math.max(
      financialIncomeItems.filter((item) => Number(item.amount) > 0).length,
      financialExpenseItems.filter((item) => Number(item.amount) > 0).length,
    ) / financialCategoryPageSize),
  );
  const safeFinancialCategoryPage = Math.min(financialCategoryPage, financialCategoryPageCount);

  function financialComparisonMeta(current: number, previous: number, kind: "income" | "expense" | "net") {
    if (!financialComparison) return { label: "No previous-period comparison", className: "text-[#6C7A70]" };
    const delta = current - previous;
    if (previous === 0) {
      return delta === 0
        ? { label: "No change from previous period", className: "text-[#6C7A70]" }
        : { label: "New activity this period", className: kind === "expense" ? "text-[#A15C16]" : "text-[#1F6B43]" };
    }
    const percentage = Math.abs((delta / previous) * 100);
    const favorable = kind === "expense" ? delta <= 0 : delta >= 0;
    return {
      label: `${delta >= 0 ? "↑" : "↓"} ${percentage.toFixed(1)}% vs ${financialComparison.label.toLowerCase()}`,
      className: favorable ? "text-[#1F6B43]" : "text-[#B42318]",
    };
  }

  const printFinancialReport = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print the financial report.");
      return;
    }
    const categoryRows = [
      ...financialIncomeItems.filter((item) => Number(item.amount) > 0).map((item) => `<tr><td>Income</td><td>${escapeHtml(item.category)}</td><td class="income">${escapeHtml(formatPeso(Number(item.amount)))}</td></tr>`),
      ...financialExpenseItems.filter((item) => Number(item.amount) > 0).map((item) => `<tr><td>Expense</td><td>${escapeHtml(item.category)}</td><td class="expense">${escapeHtml(formatPeso(Number(item.amount)))}</td></tr>`),
    ].join("");
    printWindow.document.write(`<!doctype html><html><head><title>TrackCOOP Financial Transparency</title><style>body{font-family:Arial,sans-serif;color:#173626;padding:32px}h1{margin:0 0 6px}p{color:#657169}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.card{border:1px solid #dce6dd;border-radius:12px;padding:14px;background:#f8fbf8}.label{font-size:11px;text-transform:uppercase;color:#6c7a70;font-weight:bold}.value{font-size:20px;font-weight:800;margin-top:8px}.income{color:#1f6b43}.expense{color:#a15c16}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5ebe6}th{background:#eef4ef;font-size:12px;text-transform:uppercase;color:#52705e}td:last-child,th:last-child{text-align:right}@media print{body{padding:0}}</style></head><body><h1>Financial transparency</h1><p>Cooperative-wide posted income and expenses · ${escapeHtml(FINANCIAL_PERIOD_LABELS[financialPeriod])}</p><p>Generated: ${escapeHtml(financialGeneratedAt?.toLocaleString("en-PH") || new Date().toLocaleString("en-PH"))}</p><div class="summary"><div class="card"><div class="label">Money received</div><div class="value income">${escapeHtml(formatPeso(financialIncomeTotal))}</div></div><div class="card"><div class="label">Money spent</div><div class="value expense">${escapeHtml(formatPeso(financialExpenseTotal))}</div></div><div class="card"><div class="label">Income minus spending</div><div class="value">${escapeHtml(formatPeso(financialIncomeTotal - financialExpenseTotal))}</div></div></div><table><thead><tr><th>Type</th><th>Category</th><th>Amount</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="3">No posted financial records.</td></tr>'}</tbody></table><p>This report shows records checked and approved by the cooperative. Members’ Share Capital payments are kept separate from income. Income minus spending is not a bank balance.</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const refreshDashboard = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsFetchingDashboard(true);
    try {
      const params = new URLSearchParams({ period: financialPeriod });
      if (financialPeriod === "custom" && financialStartDate && financialEndDate) {
        params.set("startDate", financialStartDate);
        params.set("endDate", financialEndDate);
      }
      const response = await expressFetch(`/api/members/me/dashboard?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to refresh dashboard");
      setDashboardData(await response.json());
      setDashboardLoadError(false);
    } catch (error) {
      console.error(error);
      setDashboardLoadError(true);
    } finally {
      setIsFetchingDashboard(false);
    }
  }, [financialEndDate, financialPeriod, financialStartDate]);

  const refreshMemberDividends = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsFetchingDividends(true);
    try {
      setMemberDividends(await getMemberDividends());
      setDividendLoadError(false);
    } catch (error) {
      console.error(error);
      setDividendLoadError(true);
    } finally {
      setIsFetchingDividends(false);
    }
  }, []);

  const refreshMemberPatronage = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsFetchingPatronage(true);
    try {
      setPatronageData(await getMemberPatronage());
      setPatronageLoadError(false);
    } catch {
      setPatronageLoadError(true);
    } finally {
      setIsFetchingPatronage(false);
    }
  }, []);

  useEffect(() => {
    getAuthenticatedUser()
      .then(setUser)
      .catch(console.error);

    const dashboardRefreshTimer = window.setTimeout(() => {
      void refreshDashboard();
    }, 0);
    const dividendRefreshTimer = window.setTimeout(() => {
      void refreshMemberDividends();
    }, 0);

    const patronageRefreshTimer = window.setTimeout(() => { void refreshMemberPatronage(); }, 0);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshDashboard({ silent: true });
        void refreshMemberDividends({ silent: true });
        void refreshMemberPatronage({ silent: true });
      }
    };
    const interval = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("trackcoop:patronage-updated", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(dashboardRefreshTimer);
      window.clearTimeout(dividendRefreshTimer);
      window.clearTimeout(patronageRefreshTimer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("trackcoop:patronage-updated", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshDashboard, refreshMemberDividends, refreshMemberPatronage]);

  function resetDividendAction() {
    setActionDividend(null);
    setDividendAction(null);
    setDividendActionError("");
    setWithdrawalMethod("Cash");
    setWithdrawalProvider("");
    setWithdrawalAccountName("");
    setWithdrawalAccountNumber("");
    setWithdrawalQrCode(null);
    setWithdrawalQrFileName("");
  }

  function openDividendAction(dividend: MemberDividend, action: "withdraw" | "capital") {
    if (dividendActionBusy) return;
    setActionDividend(dividend);
    setDividendAction(action);
    setDividendActionError("");
    if (action === "withdraw") {
      setWithdrawalMethod("Cash");
      setWithdrawalProvider("");
      setWithdrawalAccountName("");
      setWithdrawalAccountNumber("");
      setWithdrawalQrCode(null);
      setWithdrawalQrFileName("");
    }
  }

  async function executeDividendAction() {
    if (!actionDividend || !dividendAction || dividendActionBusy) return;
    setDividendActionBusy(true);
    setDividendActionError("");
    try {
      if (dividendAction === "withdraw") {
        await requestDividendWithdrawal(actionDividend.id, {
          withdrawalMethod,
          withdrawalProvider: withdrawalMethod === "Online Transfer" ? withdrawalProvider : null,
          withdrawalAccountName: withdrawalMethod === "Online Transfer" ? withdrawalAccountName : null,
          withdrawalAccountNumber: withdrawalMethod === "Online Transfer" ? withdrawalAccountNumber : null,
          withdrawalQrCode: withdrawalMethod === "Online Transfer" ? withdrawalQrCode : null,
        });
        toast.success("Withdrawal request submitted.");
      } else {
        await addDividendToShareCapital(actionDividend.id);
        toast.success("Dividend added to Share Capital.");
      }
      resetDividendAction();
      await Promise.all([refreshMemberDividends({ silent: true }), refreshDashboard({ silent: true })]);
    } catch (error) {
      setDividendActionError(error instanceof Error ? error.message : "Unable to process this Annual Interest action.");
    } finally {
      setDividendActionBusy(false);
    }
  }

  function handleWithdrawalQrCode(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setDividendActionError("QR code must be a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 400 * 1024) {
      setDividendActionError("QR code image must be 400 KB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setWithdrawalQrCode(typeof reader.result === "string" ? reader.result : null);
      setWithdrawalQrFileName(file.name);
      setDividendActionError("");
    };
    reader.readAsDataURL(file);
  }

  const fetchAnnouncements = () => {
    setIsFetchingAnnouncements(true);
    setAnnouncementLoadError(false);
    // Fetch only published announcements
    apiRequest<any[]>("/api/announcements?status=Published")
      .then((data) => setAnnouncements(data || []))
      .catch((error) => {
        console.error(error);
        setAnnouncementLoadError(true);
      })
      .finally(() => setIsFetchingAnnouncements(false));
  };

  useEffect(() => {
    if (activeTab === "Announcements" && announcements.length === 0) {
      fetchAnnouncements();
    }
  }, [activeTab, announcements.length]);

  useEffect(() => {
    if (activeTab !== "Announcements") return;
    const interval = window.setInterval(fetchAnnouncements, 30_000);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (readMoreModalOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setReadMoreModalOpen(false);
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener('keydown', handleEsc);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [readMoreModalOpen]);

  const handleRestoreModals = () => {
    if (restoreModalStack.viewAll) setAllAnnouncementsModalOpen(true);
    if (restoreModalStack.readMore) {
      setTimeout(() => setReadMoreModalOpen(true), 50);
    }
    setRestoreModalStack({readMore: false, viewAll: false});
  };

  const confirmAcknowledge = (id: string, source: "readMore" | "viewAll" | "none" = "none") => {
    setRestoreModalStack({
      readMore: readMoreModalOpen,
      viewAll: allAnnouncementsModalOpen
    });
    
    setReadMoreModalOpen(false);
    setAllAnnouncementsModalOpen(false);
    
    setAckId(id);
    setAckModalOpen(true);
  };

  const executeAcknowledge = async () => {
    if (!ackId || isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      await apiRequest(`/api/announcements/${ackId}/acknowledge`, { method: "POST" });
      setAnnouncements(prev => prev.map(a => a.id === ackId ? { ...a, isAcknowledged: true } : a));
      if (selectedAnnouncement && selectedAnnouncement.id === ackId) {
        setSelectedAnnouncement({ ...selectedAnnouncement, isAcknowledged: true });
      }
      fetchAnnouncements();
      refreshDashboard();
      setAckModalOpen(false);
      setAckId(null);
      setSuccessMessage("Announcement successfully acknowledged!");
      setSuccessModalOpen(true);
    } catch (error) {
      console.error("Failed to acknowledge announcement:", error);
      toast.error("Unable to acknowledge announcement. Please try again.");
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
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-3 sm:px-8">
          {/* Logo Section */}
          <div className="shrink-0 xl:w-[210px]">
            <Link href="#" onClick={() => setActiveTab("Dashboard")} className="flex items-center gap-3">
              <span className="relative block size-10 overflow-hidden rounded-md sm:size-14">
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
          <nav aria-label="Member navigation" className="hidden items-center gap-1 xl:flex">
            <button onClick={() => setActiveTab("Dashboard")} className={navClass("Dashboard")}>Dashboard</button>
            <button onClick={() => setActiveTab("Member & Share")} className={navClass("Member & Share")}>Member & Share</button>
            <button onClick={() => setActiveTab("Financial")} className={navClass("Financial")}>Financial</button>
            <button onClick={() => setActiveTab("Rental")} className={navClass("Rental")}>Equipment Rental</button>
            <button onClick={() => setActiveTab("Store")} className={navClass("Store")}>Coop Store</button>
          </nav>

          {/* Right Actions */}
          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-3">

            {/* <button onClick={() => setActiveTab("Help")} className={`transition ${activeTab === "Help" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Help Center">
              <MessageSquare className="size-5" />
            </button> */}
            <button onClick={() => setActiveTab("Profile")} className={`transition ${activeTab === "Profile" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Profile & Settings">
              <User className="size-5" />
            </button>
            <button onClick={() => setActiveTab("Announcements")} className={`transition ${activeTab === "Announcements" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="Announcements">
              <Bell className="size-5" />
            </button>
            <button onClick={() => setActiveTab("Requests")} className={`transition ${activeTab === "Requests" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="My Requests">
              <Inbox className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setReferralModalOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-10 items-center gap-2 rounded-full border border-[#A9C9B1] bg-[#EAF3E8] px-3 py-2.5 text-xs font-bold text-[#1F6B43] transition hover:bg-[#DCEEDC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43] focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
            >
              <UserPlus className="hidden size-4 sm:block" aria-hidden="true" />
              Refer a Friend
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="flex items-center gap-2 rounded-full border border-[#123D2A]/20 bg-[#123D2A] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1F6B43] sm:px-5 sm:text-sm disabled:cursor-wait disabled:opacity-70"
            >
              {isSigningOut ? "Logging out" : "Logout"}
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav aria-label="Mobile member navigation" className="flex gap-1 overflow-x-auto border-t border-[#DDE8D8] px-4 py-2 xl:hidden">
          {[
            { value: "Dashboard", label: "Dashboard" },
            { value: "Member & Share", label: "Member & Share" },
            { value: "Financial", label: "Financial" },
            { value: "Rental", label: "Equipment Rental" },
            { value: "Store", label: "Coop Store" },
          ].map((item) => (
            <button key={item.value} type="button" onClick={() => setActiveTab(item.value)} aria-current={activeTab === item.value ? "page" : undefined} className={`shrink-0 ${navClass(item.value)}`}>{item.label}</button>
          ))}
        </nav>
      </header>
      <Modal
        title="All Announcements"
        description="Search and view all past and present announcements from the cooperative."
        open={allAnnouncementsModalOpen}
        onOpenChange={(open) => {
          if (!open && readMoreModalOpen) return;
          setAllAnnouncementsModalOpen(open);
        }}
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
                    <div 
                      key={ann.id} 
                      className="group relative overflow-hidden rounded-xl bg-white shadow-sm border border-[#E5E7EB] transition-all hover:shadow-md flex cursor-pointer"
                      onClick={() => {
                        setSelectedAnnouncement(ann);
                        setReadMoreModalOpen(true);
                      }}
                    >
                      <div className="w-24 sm:w-32 bg-[#e8f3ec] relative overflow-hidden shrink-0">
                        {i === 0 && announcementSearch === "" && (
                          <div className="absolute top-2 left-2 z-10 rounded-full bg-[#123D2A] px-2 py-0.5 text-[8px] font-bold text-white shadow-md">
                            Latest
                          </div>
                        )}
                        {ann.featuredImagePath ? (
                          <img src={resolveUploadUrl(ann.featuredImagePath)} alt={ann.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)] z-0">
                            <Megaphone className="h-6 w-6 text-[#1F6B43]/20" />
                          </div>
                        )}
                        <div className={`absolute inset-0 bg-gradient-to-tr from-[#123D2A]/${ann.featuredImagePath ? '60' : '20'} to-transparent z-10`}></div>
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] font-bold text-[#2F7D57]">
                              {new Date(ann.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                            </p>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-[#173626] group-hover:text-[#2F7D57] transition-colors leading-tight break-all line-clamp-1">
                            {ann.title}
                          </h3>
                          <p className="mt-1 text-[#6B7280] leading-snug text-xs line-clamp-2">
                            {getPreview(ann.message)}
                          </p>
                          <p className="mt-2 text-left text-[11px] font-bold text-[#2F7D57] group-hover:underline">
                            Read More
                          </p>
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
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmAcknowledge(ann.id, "viewAll");
                              }} 
                              className="rounded-full bg-[#173626] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#122A1E]"
                            >
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

                  <div className="mt-8 relative flex items-center justify-center min-h-[40px]">
                    {totalPages > 1 && (
                      <div className="flex items-center gap-3 bg-[#F8FDF9] py-2 px-3 rounded-xl border border-[#EAF3E8]">
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => setAnnouncementPage(1)} 
                            disabled={currentPage === 1} 
                            className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-[#173626] disabled:opacity-50 disabled:hover:bg-white"
                          >
                            <ChevronsLeft className="size-4" />
                          </button>
                          <button 
                            onClick={() => setAnnouncementPage(prev => Math.max(1, prev - 1))} 
                            disabled={currentPage === 1} 
                            className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-[#173626] disabled:opacity-50 disabled:hover:bg-white"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-3 px-3">
                          <span className="text-[15px] font-bold text-[#03291d]">
                            Page {currentPage} of {totalPages}
                          </span>
                          <span className="text-gray-300 font-bold">•</span>
                          <span className="text-[15px] font-bold text-[#03291d]">
                            {filteredAnnouncements.length} announcements
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => setAnnouncementPage(prev => Math.min(totalPages, prev + 1))} 
                            disabled={currentPage === totalPages} 
                            className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-[#173626] disabled:opacity-50 disabled:hover:bg-white"
                          >
                            <ChevronRight className="size-4" />
                          </button>
                          <button 
                            onClick={() => setAnnouncementPage(totalPages)} 
                            disabled={currentPage === totalPages} 
                            className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-[#173626] disabled:opacity-50 disabled:hover:bg-white"
                          >
                            <ChevronsRight className="size-4" />
                          </button>
                        </div>
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
        title="Success!"
        description={successMessage}
        open={successModalOpen}
        onOpenChange={(open) => {
          setSuccessModalOpen(open);
          if (!open) handleRestoreModals();
        }}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="primary" onClick={() => {
            setSuccessModalOpen(false);
            handleRestoreModals();
          }}>
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
          if (!open) {
            setAckId(null);
            handleRestoreModals();
          }
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
              handleRestoreModals();
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

      <Modal
        title={dividendAction === "withdraw" ? "Request Annual Interest withdrawal?" : "Add Annual Interest to Share Capital?"}
        description={actionDividend ? `${formatPeso(actionDividend.amount)} from ${actionDividend.declarationName}` : undefined}
        open={Boolean(actionDividend && dividendAction)}
        onOpenChange={(open) => {
          if (!open && !dividendActionBusy) {
            setActionDividend(null);
            setDividendAction(null);
            setDividendActionError("");
          }
        }}
        trigger={<span className="hidden"></span>}
      >
        {dividendAction === "withdraw" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-4 text-sm text-[#365F4A]">
              Choose how you want to receive the Annual Interest. The Bookkeeper will review the request and record the payout.
            </div>
            <fieldset>
              <legend className="text-sm font-bold text-[#294B39]">Payout method</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["Cash", "Online Transfer"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setWithdrawalMethod(method)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition ${withdrawalMethod === method ? "border-[#123D2A] bg-[#123D2A] text-white" : "border-[#CAD8CB] text-[#123D2A] hover:bg-[#F3F7F1]"}`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </fieldset>
            {withdrawalMethod === "Online Transfer" ? (
              <div className="space-y-3 rounded-lg border border-[#DDE8D8] bg-[#F7FAF5] p-4">
                <label className="block text-sm font-bold text-[#294B39]">
                  Provider
                  <Select.Root value={withdrawalProvider || undefined} onValueChange={setWithdrawalProvider}>
                    <Select.Trigger aria-label="Provider" className="mt-1 flex h-11 w-full items-center justify-between rounded-md border border-[#CAD8CB] bg-white px-3 text-left font-normal text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 data-[placeholder]:text-[#6C7A70]">
                      <Select.Value placeholder="Select provider" />
                      <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content position="popper" sideOffset={6} className="z-[120] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.18)]">
                        <Select.Viewport>
                          {["GCash", "Maya", "Bank Transfer"].map((provider) => (
                            <Select.Item key={provider} value={provider} className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                              <Select.ItemText>{provider}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </label>
                <label className="block text-sm font-bold text-[#294B39]">
                  Account name
                  <input value={withdrawalAccountName} onChange={(event) => setWithdrawalAccountName(event.target.value)} placeholder="Name registered on the account" className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" />
                </label>
                <label className="block text-sm font-bold text-[#294B39]">
                  Account number / mobile number
                  <input value={withdrawalAccountNumber} onChange={(event) => setWithdrawalAccountNumber(event.target.value)} placeholder="Optional if a QR code is uploaded" className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" />
                </label>
                <label className="block text-sm font-bold text-[#294B39]">
                  QR code <span className="font-normal text-[#6C7A70]">(optional)</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleWithdrawalQrCode(event.target.files?.[0])} className="mt-1 block w-full rounded-md border border-[#CAD8CB] bg-white p-2 text-sm font-normal" />
                </label>
                {withdrawalQrFileName ? <p className="text-xs font-semibold text-[#2F7D57]">QR attached: {withdrawalQrFileName}</p> : null}
                <p className="text-xs text-[#6C7A70]">Provide either an account/mobile number or a QR code. These details are visible only to the Bookkeeper.</p>
              </div>
            ) : (
              <p className="rounded-lg border border-[#DDE8D8] bg-[#F7FAF5] p-3 text-sm text-[#42594B]">Cash withdrawals will be claimed through the cooperative office after Bookkeeper processing.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-4 text-sm text-[#365F4A]">
            This amount will be added immediately to your Share Capital balance. No Bookkeeper approval is required.
          </div>
        )}
        {dividendActionError ? (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {dividendActionError}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={dividendActionBusy}
            onClick={() => {
            resetDividendAction();
            }}
          >
            {dividendAction === "capital" ? "No, cancel" : "Cancel"}
          </Button>
          <Button type="button" variant="primary" loading={dividendActionBusy} disabled={dividendAction === "withdraw" && withdrawalMethod === "Online Transfer" && (!withdrawalProvider.trim() || !withdrawalAccountName.trim() || (!withdrawalAccountNumber.trim() && !withdrawalQrCode))} onClick={() => void executeDividendAction()}>
            {dividendAction === "withdraw" ? "Confirm withdrawal" : "Yes, add to Share Capital"}
          </Button>
        </div>
      </Modal>


      <Modal
        title="Category details"
        description={selectedFinancialCategory ? `${selectedFinancialCategory.kind} · ${FINANCIAL_PERIOD_LABELS[financialPeriod]}` : undefined}
        maxWidth="max-w-md"
        open={Boolean(selectedFinancialCategory)}
        onOpenChange={(open) => {
          if (!open) setSelectedFinancialCategory(null);
        }}
        trigger={<span className="hidden"></span>}
      >
        {selectedFinancialCategory ? (
          <div className="mt-2 space-y-4">
            <div className="rounded-xl border border-[#DDE8D8] bg-[#F8FBF8] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Category</p>
              <h3 className="mt-1 break-words text-xl font-black text-[#173626]">{selectedFinancialCategory.category}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Amount</p><p className="mt-1 text-lg font-black text-[#1F6B43]">{formatPeso(Number(selectedFinancialCategory.amount))}</p></div>
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Part of the total</p><p className="mt-1 text-lg font-black text-[#123D2A]">{selectedFinancialCategory.total > 0 ? `${((Number(selectedFinancialCategory.amount) / selectedFinancialCategory.total) * 100).toFixed(1)}%` : "0.0%"}</p></div>
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Approved records</p><p className="mt-1 text-lg font-black text-[#123D2A]">{Number(selectedFinancialCategory.recordCount || 0).toLocaleString("en-PH")}</p></div>
            </div>
            <p className="rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-3 text-sm leading-relaxed text-[#5D6D63]">
              This total comes from records checked and approved by the cooperative for your chosen dates. Other members’ private payment details are not shown.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Member referral program"
        description="Share your referral code and track invited applicants."
        maxWidth="max-w-4xl"
        open={referralModalOpen}
        onOpenChange={setReferralModalOpen}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-2 space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#CFE4D4] bg-gradient-to-br from-[#F2FAF3] to-[#FFF9EC] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#1F6B43]">Your referral code</p>
              <p className="mt-2 break-all text-2xl font-black tracking-wider text-[#123D2A]">
                {referralCode || "Loading..."}
              </p>
              <p className="mt-2 text-xs text-[#5D6D63]">{dashboardData?.referrals?.rewardPolicyEnabled === false ? "Referral rewards are currently disabled." : `${Number(dashboardData?.referrals?.rewardPerSuccessfulReferral || 0)} ${dashboardData?.referrals?.rewardLabel || "referral credits"} per successful referral. Tracking only unless the cooperative approves a separate redemption policy.`}</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={!referralCode}
                onClick={async () => {
                  if (!referralCode) return;
                  try {
                    await navigator.clipboard.writeText(referralCode);
                    setIsReferralCodeCopied(true);
                    toast.success("Referral code copied.");
                    window.setTimeout(() => setIsReferralCodeCopied(false), 1800);
                  } catch {
                    toast.error("Unable to copy the referral code.");
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#A9C9B1] bg-white px-4 py-2.5 text-sm font-bold text-[#123D2A] transition hover:bg-[#F4FAF4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isReferralCodeCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {isReferralCodeCopied ? "Copied" : "Copy code"}
              </button>
              <button
                type="button"
                disabled={!referralLink}
                onClick={async () => {
                  if (!referralLink) return;
                  try {
                    await navigator.clipboard.writeText(referralLink);
                    setIsReferralLinkCopied(true);
                    toast.success("Referral link copied.");
                    window.setTimeout(() => setIsReferralLinkCopied(false), 1800);
                  } catch {
                    toast.error("Unable to copy the referral link.");
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isReferralLinkCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
                {isReferralLinkCopied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                disabled={!referralLink}
                onClick={async () => {
                  if (!referralLink) return;
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: "Join our cooperative", text: "Use my referral link to apply for membership.", url: referralLink });
                    } else {
                      await navigator.clipboard.writeText(referralLink);
                      toast.success("Referral link copied. You can now share it.");
                    }
                  } catch (error) {
                    if (error instanceof Error && error.name !== "AbortError") toast.error("Unable to share the referral link.");
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#A9C9B1] bg-white px-4 py-2.5 text-sm font-bold text-[#123D2A] transition hover:bg-[#F4FAF4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Share2 className="size-4" />
                Share
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Invitation link</p>
            <p className="mt-2 break-all rounded-xl bg-[#F7FAF7] px-3 py-2 text-xs font-semibold text-[#365F4A]">
              {referralLink || "Preparing your referral link..."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Total referrals</p>
              <p className="mt-2 text-2xl font-black text-[#173626]">{Number(dashboardData?.referrals?.total || 0)}</p>
            </div>
            <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Pending</p>
              <p className="mt-2 text-2xl font-black text-amber-700">{Number(dashboardData?.referrals?.pending || 0)}</p>
            </div>
            <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Successful</p>
              <p className="mt-2 text-2xl font-black text-[#1F6B43]">{Number(dashboardData?.referrals?.successful || 0)}</p>
            </div>
            <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">{dashboardData?.referrals?.rewardLabel || "Referral credits"}</p>
              <p className="mt-2 text-2xl font-black text-[#123D2A]">{Number(dashboardData?.referrals?.rewardCredits || 0)}</p>
              <p className="mt-1 text-[11px] text-[#6C7A70]">{dashboardData?.referrals?.rewardPolicyEnabled === false ? "Policy disabled" : `${Number(dashboardData?.referrals?.rewardPerSuccessfulReferral || 0)} per successful referral`}</p>
            </div>
          </div>

          {dashboardData?.referrals?.items?.length ? (
            <div className="overflow-x-auto rounded-2xl border border-[#DDE8D8] bg-white">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-[#F7FAF7] text-xs uppercase tracking-wider text-[#6C7A70]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Applicant</th>
                    <th className="px-4 py-3 font-bold">Application</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EC]">
                  {dashboardData.referrals.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-[#173626]">{item.applicantName || "Applicant"}</td>
                      <td className="px-4 py-3 text-[#6C7A70]">{item.applicationCode}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "Successful" ? "bg-green-50 text-green-700" : item.status === "Pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                          {item.status}
                        </span>
                        <p className="mt-1 text-[11px] text-[#6C7A70]">Application: {item.applicationStatus || "Submitted"}</p>
                        <div className="mt-2 flex max-w-[150px] items-center gap-1" aria-label={`Referral progress: ${item.status}`}>
                          {[1, 2, 3].map((step) => (
                            <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= referralStage(item) ? (item.status === "Rejected" || item.status === "Cancelled" ? "bg-[#B42318]" : "bg-[#1F6B43]") : "bg-[#E6EEE7]"}`} />
                          ))}
                        </div>
                        <p className="mt-1 text-[10px] text-[#7A887E]">Submitted · Review · Successful</p>
                      </td>
                      <td className="px-4 py-3 text-[#6C7A70]">{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#BFD9C5] bg-white/70 p-5 text-center text-sm font-semibold text-[#6C7A70]">
              No referrals yet. Share your code to start tracking invitations.
            </p>
          )}
        </div>
      </Modal>

      <main className="flex-1">
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${activeTab === "Financial" || activeTab === "Member & Share" ? "py-3" : "py-8"}`}>

          {/* ======================= DASHBOARD TAB ======================= */}
          {activeTab === "Dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {dashboardData?.isLinked === false ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-[#CAD8CB] bg-white p-12 text-center shadow-sm">
                  <div className="mb-6 rounded-full bg-[#F8F6EF] p-4 text-[#2F7D57]">
                    <Link2 className="h-12 w-12" />
                  </div>
                  <h2 className="mb-3 text-2xl font-bold text-[#173626]">Account Not Yet Linked</h2>
                  <p className="max-w-md text-[#6C7A70] leading-relaxed">
                    Welcome! Your account is active, but it hasn't been linked to your cooperative records yet. Please ask the Chairman or Bookkeeper to link your profile to view your data.
                  </p>
                </div>
              ) : (
                <>
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

              {/* 4. QUICK ACTIONS GRID & 5. RECENT TRANSACTIONS */}
              <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">

                {/* RECENT TRANSACTIONS TABLE */}
                <section className="lg:col-span-2 rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-[#173626]">Recent Activity</h3>
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
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.type.includes('Withdrawal') ? 'bg-red-50 text-red-600' : item.type.includes('Deposit') || item.type.includes('Share Capital') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {item.type.includes('Withdrawal') ? <ArrowUpRight className="h-5 w-5" /> : item.type.includes('Deposit') || item.type.includes('Share Capital') ? <ArrowDownLeft className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                                  </div>
                                  <span className="font-medium text-[#173626]">{item.type}</span>
                                </div>
                              </td>
                              <td className="py-4 text-[#6B7280]">
                                {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                              </td>
                              <td className={`relative py-4 font-bold ${item.amount == null ? 'text-transparent after:absolute after:left-4 after:top-1/2 after:-translate-y-1/2 after:text-[#9CA3AF] after:content-["—"]' : item.type.includes('Withdrawal') ? 'text-red-700' : item.type.includes('Deposit') || item.type.includes('Share Capital') ? 'text-green-700' : 'text-[#173626]'}`}>
                                {item.amount == null ? '—' : `${item.type.includes('Withdrawal') ? '-' : item.type.includes('Deposit') || item.type.includes('Share Capital') ? '+' : '-'} ₱${Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                              </td>
                              <td className="py-4">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${item.status === 'Completed' || item.status === 'Validated' || item.status === 'Paid' || item.status === 'Acknowledged' || item.status === 'Withdrawn' ? 'bg-green-50 text-green-700 border-green-200' :
                                    item.status === 'Pending' || item.status === 'Not Acknowledged' || item.status === 'Withdrawal Requested' || item.status === 'Capitalization Requested' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                  {item.status === 'Completed' || item.status === 'Validated' || item.status === 'Paid' || item.status === 'Acknowledged' || item.status === 'Withdrawn' ? <CheckCircle2 className="h-3 w-3" /> :
                                    item.status === 'Pending' || item.status === 'Withdrawal Requested' || item.status === 'Capitalization Requested' ? <Clock className="h-3 w-3" /> : <X className="h-3 w-3" />}
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

                  <button onClick={() => setActiveTab("Requests")} className="group flex w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-[#1F6B43] hover:shadow-md text-left">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F6EF] text-[#123D2A] transition group-hover:bg-[#123D2A] group-hover:text-white">
                        <Inbox className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#173626]">My Requests</h4>
                        <p className="text-xs text-[#6B7280]">Submit & track inquiries</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#123D2A] group-hover:translate-x-1" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setReferralModalOpen(true)}
                    className="group flex w-full items-center justify-between rounded-2xl border border-[#CFE4D4] bg-gradient-to-r from-[#F2FAF3] to-[#FFF9EC] p-4 text-left shadow-sm transition hover:border-[#1F6B43] hover:shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F3E7] text-[#1F6B43] transition group-hover:bg-[#123D2A] group-hover:text-white">
                        <Link2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#173626]">Member Referrals</h4>
                        <p className="text-xs text-[#6B7280]">
                          {Number(dashboardData?.referrals?.successful || 0)} successful · {Number(dashboardData?.referrals?.pending || 0)} pending
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#123D2A]" />
                  </button>

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
              </>
              )}
            </div>
          )}

          {/* ======================= FINANCIAL TAB ======================= */}
          {activeTab === "Financial" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" aria-labelledby="financial-heading">
              <Tabs.Root value={financialView} onValueChange={setFinancialView}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2F7D57]">Financial</p>
                <h2 id="financial-heading" className="mt-1 text-2xl font-bold text-[#173626]">Your money at a glance</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Your records and the cooperative’s money, clearly explained.</p>
                </div>
                <Tabs.List aria-label="Financial sections" className="flex shrink-0 gap-1 rounded-2xl lg:w-[420px] border border-[#DDE8D8] bg-white p-2">
                  <Tabs.Trigger value="personal" className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-[#52705D] outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43] data-[state=active]:bg-[#123D2A] data-[state=active]:text-white"><Wallet className="size-4 shrink-0" />My money</Tabs.Trigger>
                  <Tabs.Trigger value="cooperative" className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-[#52705D] outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43] data-[state=active]:bg-[#123D2A] data-[state=active]:text-white"><PieChart className="size-4 shrink-0" />Cooperative money</Tabs.Trigger>
                </Tabs.List>
              </div>
              {dashboardData?.isLinked === false ? (
                <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Please ask the cooperative office to connect your account to your member record.</p>
              ) : null}


                <Tabs.Content value="personal" className="rounded-3xl border border-[#DDE8D8] bg-[#FFFCF5] p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43] sm:p-5">
                  {dashboardLoadError ? <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">We could not get the latest amounts. Please press Update to try again.</p> : null}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-[#173626]"><Wallet className="size-5 text-[#2F7D57]" />Your earnings and spending</h3>
                        <p className="mt-1 text-sm text-[#6B7280]">Only your records with the cooperative.</p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div><p className="mb-1 text-xs font-semibold text-[#42594B]">Choose dates</p>
                  <Select.Root value={financialPeriod} onValueChange={(value) => setFinancialPeriod(value as FinancialPeriod)}>
                    <Select.Trigger aria-label="My money period" className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-[#CAD8CB] bg-white px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 sm:w-48">
                      <Select.Value />
                      <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content position="popper" sideOffset={6} className="z-[120] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.18)]">
                        <Select.Viewport>
                          {(["year", "month", "30d", "all", "custom"] as FinancialPeriod[]).map((period) => (
                            <Select.Item key={period} value={period} className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                              <Select.ItemText>{FINANCIAL_PERIOD_LABELS[period]}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                        </div>
                    <button type="button" onClick={() => void refreshDashboard()} disabled={isFetchingDashboard} className="inline-flex items-center gap-2 min-h-11 rounded-lg border border-[#CAD8CB] bg-white px-4 py-2 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-60"><RefreshCw className={`size-4 ${isFetchingDashboard ? "animate-spin" : ""}`} />Update</button>
                      </div>
                    </div>

                {financialPeriod === "custom" ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-[#DDE8D8] bg-white p-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-[#294B39]">Start date<input type="date" value={financialStartDate} onChange={(event) => setFinancialStartDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#CAD8CB] px-3 font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
                    <label className="text-sm font-bold text-[#294B39]">End date<input type="date" value={financialEndDate} onChange={(event) => setFinancialEndDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#CAD8CB] px-3 font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
                    {financialStartDate && financialEndDate && financialStartDate > financialEndDate ? <p className="sm:col-span-2 text-xs font-semibold text-red-700">End date must be on or after the start date.</p> : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "What you earned", help: "Interest, patronage refund, and other earnings.", value: memberFinancialSummary?.totalEarnings, className: "text-[#1F6B43]", icon: ArrowDownLeft },
                    { label: "What you paid", help: "Purchases, rentals, and other charges.", value: memberFinancialSummary?.totalExpenses, className: "text-[#A15C16]", icon: ArrowUpRight },
                    { label: "Earnings minus payments", help: "Earnings less payments. Not a cash balance.", value: memberFinancialSummary?.netResult, className: "text-[#123D2A]", icon: Wallet },
                    { label: "Share Capital payments", help: "Added in these dates. Not earnings or total balance.", value: memberFinancialSummary?.shareCapitalContributions, className: "text-[#52705D]", icon: Leaf },
                  ].map((summary) => (
                    <div key={summary.label} className="rounded-2xl border border-[#DDE8D8] bg-gradient-to-br from-white to-[#EFF7F0] p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#42594B]">{summary.label}</p>
                        <summary.icon className={`h-4 w-4 ${summary.className}`} />
                      </div>
                      <p className={`mt-2 text-2xl font-black tracking-tight ${summary.className}`}>{isFetchingDashboard ? "..." : formatPeso(Number(summary.value || 0))}</p>
                      <p className="mt-1 text-sm leading-snug text-[#5D6D63]">{summary.help}</p>
                    </div>
                  ))}
                </div>

                <div className="grid items-start gap-3 lg:grid-cols-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                  {[
                    { title: "Where my earnings came from", items: memberIncomeItems, color: "bg-[#1F6B43]", amountClass: "text-[#1F6B43]", empty: "No earnings recorded for these dates." },
                    { title: "What I paid for", items: memberExpenseItems, color: "bg-[#A15C16]", amountClass: "text-[#A15C16]", empty: "No payments recorded for these dates." },
                  ].map((group) => (
                    <section key={group.title} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                      <h4 className="text-sm font-bold text-[#173626]">
                        {group.title}
                      </h4>
                      <div className="mt-2 max-h-32 overflow-y-auto divide-y divide-[#EEF2EC]">
                        {group.items.length ? group.items.map((item) => (
                          <div key={item.category} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                            <span className="min-w-0 break-words font-medium text-[#42594B]">{item.category}</span>
                            <span className={`shrink-0 font-bold ${group.amountClass}`}>{formatPeso(Number(item.amount))}</span>
                          </div>
                        )) : <p className="py-3 text-sm text-[#6B7280]">{group.empty}</p>}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-[#173626]">Recent payments &amp; earnings</h4>
                    <span className="text-[11px] font-semibold text-[#6C7A70]">Latest 5</span>
                  </div>
                  <div className="mt-2 max-h-32 overflow-y-auto divide-y divide-[#EEF2EC]">
                    {memberFinancialSummary?.transactions?.length ? memberFinancialSummary.transactions.slice(0, 5).map((transaction: { id: string; type: "Income" | "Expense"; category: string; description: string; amount: number; date: string | Date }) => (
                      <div key={`${transaction.id}-${transaction.date}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#42594B]">{transaction.description}</p>
                          <p className="text-xs text-[#6C7A70]">{transaction.category} · {new Date(transaction.date).toLocaleDateString("en-PH")}</p>
                        </div>
                        <span className={`shrink-0 font-bold ${transaction.type === "Income" ? "text-[#1F6B43]" : "text-[#A15C16]"}`}>{transaction.type === "Income" ? "+" : "-"}{formatPeso(Number(transaction.amount || 0))}</span>
                      </div>
                    )) : <p className="py-3 text-sm text-[#6B7280]">No payments or earnings recorded for these dates.</p>}
                  </div>
                </div>

                </div>

                <p className="rounded-xl border border-[#DDE8D8] bg-white p-3 text-xs leading-relaxed text-[#5D6D63]">
                  Your Share Capital payments are separate from earnings. Farm and household records outside the cooperative are not included.
                </p>
                </div>
                </Tabs.Content>
                <Tabs.Content value="cooperative" className="rounded-3xl border border-[#DDE8D8] bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43] sm:p-4">
                  <div className="space-y-2">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-[#173626]">Cooperative earnings and spending</h3>
                        <p className="mt-1 text-sm text-[#6B7280]">For the whole cooperative, separate from your personal money.</p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div><p className="mb-1 text-xs font-semibold text-[#42594B]">Choose dates</p>
            <Select.Root value={financialPeriod} onValueChange={(value) => setFinancialPeriod(value as FinancialPeriod)}>
              <Select.Trigger aria-label="Choose dates" className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-[#CAD8CB] bg-white px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 sm:w-48">
                <Select.Value />
                <Select.Icon><ChevronDown className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position="popper" sideOffset={6} className="z-[120] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-[#CAD8CB] bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.18)]">
                  <Select.Viewport>
                    <Select.Item value="year" className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                      <Select.ItemText>This Year</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="month" className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                      <Select.ItemText>This Month</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="30d" className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                      <Select.ItemText>Last 30 Days</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="all" className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                      <Select.ItemText>All records</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="custom" className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                      <Select.ItemText>Choose dates</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
                        </div>
            <div className="flex flex-wrap gap-2">
              <a href="/statement" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center min-h-11 rounded-lg border border-[#CAD8CB] bg-white px-4 py-2 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]">View full report</a>
              <button type="button" onClick={() => void refreshDashboard()} className="inline-flex items-center gap-2 min-h-11 rounded-lg border border-[#CAD8CB] bg-white px-4 py-2 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-60" disabled={isFetchingDashboard}><RefreshCw className={`size-4 ${isFetchingDashboard ? "animate-spin" : ""}`} /> Update</button>
              <button type="button" onClick={printFinancialReport} className="inline-flex items-center gap-2 min-h-11 rounded-lg bg-[#123D2A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1F6B43]"><Printer className="size-4" /> Print or save report</button>
            </div>
                      </div>
                    </div>
          {dashboardLoadError ? (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">We could not get the latest amounts.</p>
                <p className="mt-1">The amounts shown may be old. Please press Update to try again.</p>
              </div>
            </div>
          ) : null}


          {financialPeriod === "custom" ? (
            <div className="grid gap-3 rounded-xl border border-[#DDE8D8] bg-white p-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-[#294B39]">Start date<input type="date" value={financialStartDate} onChange={(event) => setFinancialStartDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#CAD8CB] px-3 font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
              <label className="text-sm font-bold text-[#294B39]">End date<input type="date" value={financialEndDate} onChange={(event) => setFinancialEndDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#CAD8CB] px-3 font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
              {financialStartDate && financialEndDate && financialStartDate > financialEndDate ? <p className="sm:col-span-2 text-xs font-semibold text-red-700">End date must be on or after the start date.</p> : null}
            </div>
          ) : null}

          {financialDefinitionsOpen ? (
            <div className="rounded-xl border border-[#DDE8D8] bg-[#F8F6EF] p-4 text-xs leading-relaxed text-[#5D6D63]">
              <p className="font-bold text-[#294B39]">A simple guide</p>
              <p className="mt-1">Last updated: {financialGeneratedAt && !Number.isNaN(financialGeneratedAt.getTime()) ? financialGeneratedAt.toLocaleString("en-PH") : "Not available"}</p>
              <ul className="mt-2 space-y-1.5">
                <li><span className="font-bold text-[#173626]">Money received:</span> income checked and approved by the cooperative. Members’ Share Capital payments are not included.</li>
                <li><span className="font-bold text-[#173626]">Money spent:</span> expenses checked and approved by the cooperative for your chosen dates.</li>
                <li><span className="font-bold text-[#173626]">Income minus spending:</span> money received less money spent. For example, ₱1,000 received minus ₱600 spent gives ₱400. This does not show cash available to withdraw.</li>
              </ul>
            </div>
          ) : null}

          {isFetchingDashboard && !dashboardData ? (
            <div className="grid gap-4" role="status" aria-label="Loading financial transparency">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                {["income", "expenses", "net"].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-[#E5E7EB] bg-[#F3F7F3]" />)}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {["income", "expenses"].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl border border-[#E5E7EB] bg-[#F8FBF8]" />)}
              </div>
            </div>
          ) : (
            <>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Money received", help: "Income recorded by the cooperative.", value: financialIncomeTotal, previous: financialComparison?.incomeTotal, kind: "income" as const, className: "text-[#1F6B43]" },
              { label: "Money spent", help: "Expenses paid by the cooperative.", value: financialExpenseTotal, previous: financialComparison?.expenseTotal, kind: "expense" as const, className: "text-[#A15C16]" },
              { label: "Income minus spending", help: "Income less spending. Not a bank balance.", value: financialTransparency?.netTotal, previous: financialComparison?.netTotal, kind: "net" as const, className: "text-[#123D2A]" },
            ].map((summary) => (
              <div key={summary.label} className="min-w-0 rounded-xl border border-[#E5E7EB] bg-[#F8FBF8] p-3">
                <p className="text-sm font-bold text-[#42594B]">{summary.label}</p>
                <p className={`mt-1 whitespace-nowrap text-xl font-black ${summary.className}`}>{isFetchingDashboard && !dashboardData ? "..." : formatPeso(Number(summary.value || 0))}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#5D6D63]">{summary.help}</p>
                <details className="mt-1 text-sm text-[#365F4A]">
                  <summary className="cursor-pointer py-1 font-semibold">Compare with earlier dates</summary>
                  <p className={`mt-1 ${financialComparisonMeta(Number(summary.value || 0), Number(summary.previous || 0), summary.kind).className}`}>
                    {financialComparisonMeta(Number(summary.value || 0), Number(summary.previous || 0), summary.kind).label}
                  </p>
                </details>
              </div>
            ))}
          </div>

          {!dashboardLoadError && financialIncomeTotal === 0 && financialExpenseTotal === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CAD8CB] bg-[#FBFCFA] px-5 py-8 text-center">
              <FileText className="size-8 text-[#7A9A84]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[#294B39]">No records for these dates</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#6C7A70]">Try choosing different dates, or ask the cooperative office about missing records.</p>
            </div>
          ) : null}

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {[
              { title: "Where the money came from", kind: "Income" as const, items: financialIncomeItems, total: financialIncomeTotal, empty: "No income recorded for these dates.", color: "bg-[#1F6B43]", amountClass: "text-[#1F6B43]" },
              { title: "What the money was spent on", kind: "Expense" as const, items: financialExpenseItems, total: financialExpenseTotal, empty: "No spending recorded for these dates.", color: "bg-[#A15C16]", amountClass: "text-[#A15C16]" },
            ].map((group) => {
              const visibleItems = group.items.filter((item) => Number(item.amount) > 0);
              const pagedItems = visibleItems.slice((safeFinancialCategoryPage - 1) * financialCategoryPageSize, safeFinancialCategoryPage * financialCategoryPageSize);
              return (
                <div key={group.title} className="min-w-0 rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-[#173626]">{group.title}</h4>
                    <span className="text-[11px] font-semibold text-[#6C7A70]">Select an item to learn more</span>
                  </div>
                  <div className="mt-1 max-h-24 overflow-y-auto divide-y divide-[#EEF2EC]">
                    {visibleItems.length ? pagedItems.map((item) => {
                      const percentage = group.total > 0 ? (Number(item.amount) / group.total) * 100 : 0;
                      return (
                        <button
                          key={item.category}
                          type="button"
                          onClick={() => setSelectedFinancialCategory({ ...item, kind: group.kind, total: group.total })}
                          className="group w-full py-2 text-left text-sm outline-none transition hover:bg-[#F8FBF8] focus-visible:ring-2 focus-visible:ring-[#1F6B43]"
                          aria-label={`View details for ${group.kind.toLowerCase()} category ${item.category}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <span className="min-w-0 break-words font-medium text-[#42594B]">{item.category}</span>
                            <div className="shrink-0 text-right">
                              <span className={`whitespace-nowrap font-bold ${group.amountClass}`}>{formatPeso(Number(item.amount))}</span>
                              <span className="ml-2 text-xs font-bold text-[#6C7A70]">{percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF2EC]" aria-hidden="true"><div className={`h-full rounded-full ${group.color}`} style={{ width: `${Math.min(100, percentage)}%` }} /></div>
                          <span className="sr-only">See details</span>
                        </button>
                      );
                    }) : <p className="py-3 text-sm text-[#6B7280]">{group.empty}</p>}
                  </div>
                </div>
              );
            })}
          </div>

            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] px-3 py-2 text-xs text-[#5D6D63]">
            <p>Approved records only. Members’ Share Capital payments are separate from income.</p>
            <button type="button" onClick={() => setFinancialDefinitionsOpen((open) => !open)} aria-expanded={financialDefinitionsOpen} className="inline-flex min-h-7 items-center gap-1 font-semibold text-[#2F7D57] hover:underline"><Info className="size-4" />What do these amounts mean?</button>
          </div>

          {financialCategoryPageCount > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-[#DDE8D8] pt-2">
              <span className="text-xs font-bold text-[#6C7A70]">Page {safeFinancialCategoryPage} of {financialCategoryPageCount}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFinancialCategoryPage((page) => Math.max(1, page - 1))} disabled={safeFinancialCategoryPage === 1} className="rounded-lg border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#365F4A] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <button type="button" onClick={() => setFinancialCategoryPage((page) => Math.min(financialCategoryPageCount, page + 1))} disabled={safeFinancialCategoryPage === financialCategoryPageCount} className="rounded-lg border border-[#8FB49A] bg-[#F5FAF5] px-3 py-2 text-xs font-bold text-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
          ) : null}
        </div>
                </Tabs.Content>
              </Tabs.Root>
            </section>
          )}

          {/* ======================= MEMBER & SHARE CAPITAL TAB ======================= */}
          {activeTab === "Member & Share" && (
            <MemberShareOverview
              capital={shareCapitalTotal}
              linked={Boolean(dashboardData?.isLinked)}
              memberSince={dashboardData?.member?.memberSince}
              contributionCount={Number(dashboardData?.stats?.deposits) || 0}
              activities={dashboardData?.recentCapitalContributions ?? []}
              dividends={memberDividends}
              patronage={patronageData}
              loading={{ capital: isFetchingDashboard, interest: isFetchingDividends, patronage: isFetchingPatronage }}
              errors={{ capital: dashboardLoadError, interest: dividendLoadError, patronage: patronageLoadError }}
              onRefresh={() => { void refreshDashboard(); void refreshMemberDividends(); void refreshMemberPatronage(); }}
              onDividendAction={openDividendAction}
              dividendBusy={dividendActionBusy}
            />
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
                  ) : announcementLoadError ? (
                    <div role="alert" aria-live="assertive" className="rounded-3xl border border-red-200 bg-red-50 p-12 text-center shadow-sm">
                      <p className="text-sm font-semibold text-red-800">Unable to load announcements.</p>
                      <button type="button" onClick={fetchAnnouncements} className="mt-3 rounded-lg bg-[#123D2A] px-4 py-2 text-sm font-bold text-white">Retry</button>
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
                      <Megaphone className="mx-auto mb-3 h-8 w-8 text-[#94A3B8]" />
                      <p className="text-sm font-semibold text-[#6B7280]">No announcements found at the moment.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {announcements.slice(0, 3).map((ann, i) => (
                        <div 
                          key={ann.id} 
                          className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-[#E5E7EB] transition-all hover:shadow-md flex flex-col md:flex-row cursor-pointer"
                          onClick={() => {
                            setSelectedAnnouncement(ann);
                            setReadMoreModalOpen(true);
                          }}
                        >
                          <div className="md:w-1/4 h-36 md:h-auto bg-[#e8f3ec] relative overflow-hidden shrink-0">
                            {i === 0 && (
                              <div className="absolute top-4 left-4 z-10 rounded-full bg-[#123D2A] px-3 py-1 text-xs font-bold text-white shadow-md">
                                Latest Update
                              </div>
                            )}
                            {ann.featuredImagePath ? (
                              <img src={resolveUploadUrl(ann.featuredImagePath)} alt={ann.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)] z-0">
                                <Megaphone className="h-10 w-10 text-[#1F6B43]/20" />
                              </div>
                            )}
                            <div className={`absolute inset-0 bg-gradient-to-tr from-[#123D2A]/${ann.featuredImagePath ? '60' : '20'} to-transparent z-10`}></div>
                          </div>
                          <div className="flex-1 p-5 md:p-6 flex flex-col justify-between min-w-0">
                            <div>
                              <p className="text-xs font-bold text-[#2F7D57] mb-2">
                                {new Date(ann.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </p>
                              <h3 className="text-lg md:text-xl font-bold text-[#173626] group-hover:text-[#2F7D57] transition-colors leading-tight break-all">
                                {ann.title}
                              </h3>
                              <p className="mt-2 text-[#6B7280] leading-relaxed text-xs md:text-sm">
                                {getPreview(ann.message)}
                              </p>
                              <p className="mt-2 text-left text-[11px] font-bold text-[#2F7D57] hover:underline">
                                Read More
                              </p>
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
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmAcknowledge(ann.id, "viewAll");
                                  }} 
                                  className="rounded-full bg-[#173626] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#122A1E]"
                                >
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
                      ) : announcementLoadError ? (
                        <div role="alert" aria-live="assertive" className="py-8 text-center">
                          <p className="text-xs font-medium text-red-700">Unable to load alerts.</p>
                          <button type="button" onClick={fetchAnnouncements} className="mt-2 text-xs font-bold text-[#1F6B43] underline">Retry</button>
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
                                <p className={`mt-1 text-xs ${colorTheme.textLight} leading-relaxed line-clamp-2`}>{getPreview(ann.excerpt || ann.message)}</p>
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
                <RentalLandingPage />
              </RentalProvider>
            </div>
          )}

          {/* ======================= STORE TAB ======================= */}
          {activeTab === "Store" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MemberPosClient />
            </div>
          )}

          {/* ======================= REQUESTS TAB ======================= */}
          {activeTab === "Requests" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6 rounded-3xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden p-6">
              <MemberRequestsClient />
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

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence mode="wait">
              {readMoreModalOpen && selectedAnnouncement ? (
                <motion.div
                  key="read-more-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6 pointer-events-auto"
                  onClick={() => setReadMoreModalOpen(false)}
                >
                  <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[24px] bg-[#FFFAF2] shadow-2xl">
                    <motion.article
                      className="flex h-full max-h-[90vh] flex-col overflow-hidden bg-[#FFFAF2]"
                      onClick={(e) => e.stopPropagation()}
                      initial={{ opacity: 0, y: 20, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.96 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                    >
                      <div className="relative flex flex-1 flex-col overflow-hidden">
                        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
                          <button
                            type="button"
                            aria-label="Copy announcement text"
                            onClick={(event: React.MouseEvent) => {
                              event.stopPropagation();
                              const tempDiv = document.createElement('div');
                              tempDiv.innerHTML = selectedAnnouncement.message;
                              const plainMessage = tempDiv.textContent || tempDiv.innerText || '';
                              navigator.clipboard.writeText(plainMessage.trim());
                              setIsCopied(true);
                              setTimeout(() => setIsCopied(false), 2000);
                            }}
                            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-[#123D2A]"
                          >
                            {isCopied ? <CheckCircle2 className="size-5 text-green-400" /> : <Copy className="size-5" />}
                          </button>
                          <button
                            type="button"
                            aria-label="Close modal"
                            onClick={(event: React.MouseEvent) => {
                              event.stopPropagation();
                              setReadMoreModalOpen(false);
                            }}
                            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-[#123D2A]"
                          >
                            <X className="size-5" />
                          </button>
                        </div>

                        <div className="flex flex-col">
                          <div className="relative h-72 sm:h-96 bg-[#123D2A] shrink-0">
                            {selectedAnnouncement.featuredImagePath ? (
                              <img
                                src={resolveUploadUrl(selectedAnnouncement.featuredImagePath)}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)] flex items-center justify-center">
                                 <Megaphone className="size-20 text-[#1F6B43]/20" />
                              </div>
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-[#03291d]/90 via-[#03291d]/40 to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex items-end justify-between gap-6 pointer-events-none">
                              {selectedAnnouncement.title && (
                                <h2 className="text-2xl font-black text-white sm:text-3xl leading-tight drop-shadow-md line-clamp-3">
                                  {selectedAnnouncement.title}
                                </h2>
                              )}
                              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#F2C94C] shrink-0 drop-shadow-md text-right">
                                {new Date(selectedAnnouncement.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>

                          <div className="flex min-w-0 flex-col overflow-x-hidden p-6 sm:p-8 max-h-[50vh] overflow-y-auto">
                            <div 
                              className="quill-content min-w-0 max-w-full overflow-x-hidden whitespace-pre-line break-words text-base leading-relaxed text-[#123D2A] [&_*]:max-w-full [&_img]:h-auto [&_img]:object-contain"
                              dangerouslySetInnerHTML={{ __html: selectedAnnouncement.message }}
                            />
                          </div>

                          <div className="flex justify-end border-t border-gray-100 bg-[#FFFAF2] p-4 sm:px-8 shrink-0">
                            {selectedAnnouncement.isAcknowledged ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
                                <ShieldCheck className="size-4" />
                                Acknowledged
                              </span>
                            ) : (
                              <button 
                                onClick={() => {
                                  confirmAcknowledge(selectedAnnouncement.id, "readMore");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#173626] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#122A1E] shadow-sm hover:shadow-md"
                              >
                                <ShieldCheck className="size-4" />
                                Acknowledge
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}

    </div>
  );
}
