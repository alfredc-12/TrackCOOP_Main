"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import * as Select from "@radix-ui/react-select";
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
  Wallet,
  Calendar,
  Megaphone,
  MessageSquare,
  Inbox,
  MapPin,
  Phone,
  Mail,
  Award,
  FileText,
  Briefcase,
  ChevronDown,
  ArrowRight,
  Leaf,
  LogOut,
  Images,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  Check,
  ShoppingBag,
  Store,
  Tractor,
  TrendingUp,
  Download,
  Printer,
  RefreshCw,
  PieChart,
  Star,
  ShieldCheck,
  AlertCircle,
  Info,
  X,
  Link2,
  Copy,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight
} from "lucide-react";
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

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function isAtLeastYearsAgo(value: unknown, years: number) {
  if (!value) return false;
  const startDate = new Date(String(value));
  if (Number.isNaN(startDate.getTime())) return false;

  const anniversary = new Date(startDate);
  anniversary.setFullYear(anniversary.getFullYear() + years);
  return new Date() >= anniversary;
}

const MAX_SHARE_CAPITAL = 15_000;
const SHARE_CAPITAL_TIERS = [
  { label: "Starter Tier", minimum: 0 },
  { label: "Bronze Tier", minimum: 1_500 },
  { label: "Silver Tier", minimum: 3_000 },
  { label: "Gold Tier", minimum: 7_500 },
  { label: "Platinum Tier", minimum: MAX_SHARE_CAPITAL },
] as const;

const SHARE_CAPITAL_TIER_BADGE_CLASSES = {
  "Starter Tier": "bg-slate-100 text-slate-600",
  "Bronze Tier": "bg-amber-100 text-amber-700",
  "Silver Tier": "bg-slate-200 text-slate-700",
  "Gold Tier": "bg-yellow-100 text-yellow-700",
  "Platinum Tier": "bg-indigo-100 text-indigo-700",
} as const;

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
  all: "All Time",
  custom: "Custom Range",
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
  const [restoreModalStack, setRestoreModalStack] = useState<{readMore: boolean, viewAll: boolean}>({readMore: false, viewAll: false});

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isFetchingDashboard, setIsFetchingDashboard] = useState(true);
  const [dashboardLoadError, setDashboardLoadError] = useState(false);
  const [financialTransparencyModalOpen, setFinancialTransparencyModalOpen] = useState(false);
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
  const cappedShareCapital = Math.min(shareCapitalTotal, MAX_SHARE_CAPITAL);
  const shareCapitalProgress = Math.round((cappedShareCapital / MAX_SHARE_CAPITAL) * 100);
  const shareCapitalTierIndex = SHARE_CAPITAL_TIERS.reduce(
    (currentIndex, tier, index) => (cappedShareCapital >= tier.minimum ? index : currentIndex),
    0,
  );
  const currentShareCapitalTier = SHARE_CAPITAL_TIERS[shareCapitalTierIndex];
  const nextShareCapitalTier = SHARE_CAPITAL_TIERS[shareCapitalTierIndex + 1];
  const currentShareCapitalTierBadgeClass = SHARE_CAPITAL_TIER_BADGE_CLASSES[currentShareCapitalTier.label];
  const amountToNextShareCapitalTier = nextShareCapitalTier
    ? Math.max(0, nextShareCapitalTier.minimum - cappedShareCapital)
    : 0;
  const memberSince = dashboardData?.member?.memberSince;
  const postedCapitalContributionCount = Number(dashboardData?.stats?.deposits) || 0;
  const hasDividendReinvestment = memberDividends.some((dividend) => dividend.status === "Added to Share Capital");
  const badgesReady = Boolean(dashboardData) && !isFetchingDashboard && !isFetchingDividends;
  const memberBadges = [
    {
      label: "1 Year Member",
      icon: Award,
      iconClassName: "bg-amber-100 text-amber-600",
      earned: isAtLeastYearsAgo(memberSince, 1),
    },
    {
      label: "First Share Capital Deposit",
      icon: Wallet,
      iconClassName: "bg-blue-100 text-blue-600",
      earned: postedCapitalContributionCount >= 1,
    },
    {
      label: "Consistent Contributor",
      icon: Star,
      iconClassName: "bg-green-100 text-green-600",
      earned: postedCapitalContributionCount >= 3,
    },
    {
      label: "Dividend Reinvestor",
      icon: TrendingUp,
      iconClassName: "bg-purple-100 text-purple-600",
      earned: hasDividendReinvestment,
    },
  ];

  const financialTransparency = dashboardData?.financialTransparency;
  const financialIncomeTotal = Number(financialTransparency?.incomeTotal || 0);
  const financialExpenseTotal = Number(financialTransparency?.expenseTotal || 0);
  const financialIncomeItems = (financialTransparency?.incomeByCategory || []) as FinancialCategoryItem[];
  const financialExpenseItems = (financialTransparency?.expenseByCategory || []) as FinancialCategoryItem[];
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

  useEffect(() => {
    setFinancialCategoryPage(1);
  }, [financialEndDate, financialPeriod, financialStartDate]);

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
    printWindow.document.write(`<!doctype html><html><head><title>TrackCOOP Financial Transparency</title><style>body{font-family:Arial,sans-serif;color:#173626;padding:32px}h1{margin:0 0 6px}p{color:#657169}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.card{border:1px solid #dce6dd;border-radius:12px;padding:14px;background:#f8fbf8}.label{font-size:11px;text-transform:uppercase;color:#6c7a70;font-weight:bold}.value{font-size:20px;font-weight:800;margin-top:8px}.income{color:#1f6b43}.expense{color:#a15c16}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5ebe6}th{background:#eef4ef;font-size:12px;text-transform:uppercase;color:#52705e}td:last-child,th:last-child{text-align:right}@media print{body{padding:0}}</style></head><body><h1>Financial transparency</h1><p>Cooperative-wide posted income and expenses · ${escapeHtml(FINANCIAL_PERIOD_LABELS[financialPeriod])}</p><p>Generated: ${escapeHtml(financialGeneratedAt?.toLocaleString("en-PH") || new Date().toLocaleString("en-PH"))}</p><div class="summary"><div class="card"><div class="label">Posted income</div><div class="value income">${escapeHtml(formatPeso(financialIncomeTotal))}</div></div><div class="card"><div class="label">Posted expenses</div><div class="value expense">${escapeHtml(formatPeso(financialExpenseTotal))}</div></div><div class="card"><div class="label">Net operating result</div><div class="value">${escapeHtml(formatPeso(financialIncomeTotal - financialExpenseTotal))}</div></div></div><table><thead><tr><th>Type</th><th>Category</th><th>Amount</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="3">No posted financial records.</td></tr>'}</tbody></table><p>This report includes active and approved cooperative records. Share Capital contributions are excluded from operating income.</p></body></html>`);
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

    getMemberPatronage()
      .then((data) => {
        setPatronageData(data);
        setPatronageLoadError(false);
      })
      .catch((error) => {
        console.error(error);
        setPatronageLoadError(true);
      })
      .finally(() => setIsFetchingPatronage(false));
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshDashboard({ silent: true });
        void refreshMemberDividends({ silent: true });
      }
    };
    const interval = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(dashboardRefreshTimer);
      window.clearTimeout(dividendRefreshTimer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshDashboard, refreshMemberDividends]);

  const publishedDividends = memberDividends
    .filter((dividend) => dividend.declarationStatus === "Published")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const latestPublishedDividend = publishedDividends[0] ?? null;
  const latestPublishedDividendAmount = Number(latestPublishedDividend?.amount ?? 0);
  const latestPublishedDividendCompleted = latestPublishedDividend?.status === "Withdrawn" || latestPublishedDividend?.status === "Added to Share Capital";
  const latestPublishedDividendBalance = latestPublishedDividendCompleted ? 0 : latestPublishedDividendAmount;

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
            <button onClick={() => setActiveTab("Requests")} className={`transition ${activeTab === "Requests" ? "text-[#1F6B43]" : "text-[#365f4a] hover:text-[#123D2A]"}`} title="My Requests">
              <Inbox className="size-5" />
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
        title="Financial transparency"
        description={`Cooperative-wide posted income and expenses grouped by category for ${FINANCIAL_PERIOD_LABELS[financialPeriod].toLowerCase()}.`}
        maxWidth="max-w-5xl"
        open={financialTransparencyModalOpen}
        onOpenChange={setFinancialTransparencyModalOpen}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-4 max-h-[75vh] space-y-5 overflow-x-hidden overflow-y-auto pr-1">
          {dashboardLoadError ? (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">Unable to refresh the financial summary.</p>
                <p className="mt-1">The latest available values are shown when available. Try Refresh again.</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 rounded-xl border border-[#DDE8D8] bg-[#F8FBF8] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#173626]">Reporting period</p>
              <p className="mt-1 text-xs text-[#6C7A70]">Use the same period as the Chairman financial dashboard for comparable totals.</p>
            </div>
            <Select.Root value={financialPeriod} onValueChange={(value) => setFinancialPeriod(value as FinancialPeriod)}>
              <Select.Trigger aria-label="Reporting period" className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-[#CAD8CB] bg-white px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#9FB7A4] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 sm:w-36">
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
                      <Select.ItemText>All Time</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="custom" className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-[#365F4A] outline-none data-[highlighted]:bg-[#EAF3E8] data-[highlighted]:text-[#123D2A]">
                      <Select.ItemText>Custom Range</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-[#1F6B43]" aria-hidden="true" /></Select.ItemIndicator>
                    </Select.Item>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {financialPeriod === "custom" ? (
            <div className="grid gap-3 rounded-xl border border-[#DDE8D8] bg-white p-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-[#294B39]">Start date<input type="date" value={financialStartDate} onChange={(event) => setFinancialStartDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#CAD8CB] px-3 font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
              <label className="text-sm font-bold text-[#294B39]">End date<input type="date" value={financialEndDate} onChange={(event) => setFinancialEndDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#CAD8CB] px-3 font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
              {financialStartDate && financialEndDate && financialStartDate > financialEndDate ? <p className="sm:col-span-2 text-xs font-semibold text-red-700">End date must be on or after the start date.</p> : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 rounded-xl border border-[#DDE8D8] bg-[#F8FBF8] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#173626]">Cooperative-wide totals</p>
              <p className="mt-1 text-xs text-[#6C7A70]">This is not personal member income. Share Capital contributions are tracked separately.</p>
              <p className="mt-1 text-xs font-semibold text-[#6C7A70]">Last updated: {financialGeneratedAt && !Number.isNaN(financialGeneratedAt.getTime()) ? financialGeneratedAt.toLocaleString("en-PH") : "Not available"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3E8] px-2.5 py-1 text-[11px] font-bold text-[#1F6B43]"><CheckCircle2 className="size-3.5" aria-hidden="true" /> Aligned with Chairman dashboard</span>
                <button type="button" onClick={() => setFinancialDefinitionsOpen((open) => !open)} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2F7D57] underline-offset-2 hover:underline"><Info className="size-3.5" aria-hidden="true" /> How this is counted</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void refreshDashboard()} className="inline-flex items-center gap-2 rounded-lg border border-[#CAD8CB] bg-white px-3 py-2 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-60" disabled={isFetchingDashboard}><RefreshCw className={`size-4 ${isFetchingDashboard ? "animate-spin" : ""}`} /> Refresh</button>
              <button type="button" onClick={printFinancialReport} className="inline-flex items-center gap-2 rounded-lg bg-[#123D2A] px-3 py-2 text-xs font-bold text-white hover:bg-[#1F6B43]"><Printer className="size-4" /> Save as PDF</button>
            </div>
          </div>

          {financialDefinitionsOpen ? (
            <div className="rounded-xl border border-[#DDE8D8] bg-[#F8F6EF] p-4 text-xs leading-relaxed text-[#5D6D63]">
              <p className="font-bold text-[#294B39]">Definitions</p>
              <ul className="mt-2 space-y-1.5">
                <li><span className="font-bold text-[#173626]">Posted income:</span> approved active income records, excluding Share Capital contributions.</li>
                <li><span className="font-bold text-[#173626]">Posted expenses:</span> approved active expense records for the selected reporting period.</li>
                <li><span className="font-bold text-[#173626]">Net operating result:</span> posted income minus posted expenses.</li>
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
              { label: "Posted income", value: financialIncomeTotal, previous: financialComparison?.incomeTotal, kind: "income" as const, className: "text-[#1F6B43]" },
              { label: "Posted expenses", value: financialExpenseTotal, previous: financialComparison?.expenseTotal, kind: "expense" as const, className: "text-[#A15C16]" },
              { label: "Net operating result", value: financialTransparency?.netTotal, previous: financialComparison?.netTotal, kind: "net" as const, className: "text-[#123D2A]" },
            ].map((summary) => (
              <div key={summary.label} className="min-w-0 rounded-xl border border-[#E5E7EB] bg-[#F8FBF8] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">{summary.label}</p>
                <p className={`mt-2 whitespace-nowrap text-xl font-black ${summary.className}`}>{isFetchingDashboard && !dashboardData ? "..." : formatPeso(Number(summary.value || 0))}</p>
                <p className={`mt-1 text-[11px] font-bold ${financialComparisonMeta(Number(summary.value || 0), Number(summary.previous || 0), summary.kind).className}`}>
                  {financialComparisonMeta(Number(summary.value || 0), Number(summary.previous || 0), summary.kind).label}
                </p>
              </div>
            ))}
          </div>

          {!dashboardLoadError && financialIncomeTotal === 0 && financialExpenseTotal === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CAD8CB] bg-[#FBFCFA] px-5 py-8 text-center">
              <FileText className="size-8 text-[#7A9A84]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[#294B39]">No posted financial records yet</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#6C7A70]">Try another reporting period or refresh after approved income and expense records have been posted.</p>
            </div>
          ) : null}

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {[
              { title: "Income by category", kind: "Income" as const, items: financialIncomeItems, total: financialIncomeTotal, empty: "No posted income records for this period.", color: "bg-[#1F6B43]", amountClass: "text-[#1F6B43]" },
              { title: "Expenses by category", kind: "Expense" as const, items: financialExpenseItems, total: financialExpenseTotal, empty: "No posted expense records for this period.", color: "bg-[#A15C16]", amountClass: "text-[#A15C16]" },
            ].map((group) => {
              const visibleItems = group.items.filter((item) => Number(item.amount) > 0);
              const pagedItems = visibleItems.slice((safeFinancialCategoryPage - 1) * financialCategoryPageSize, safeFinancialCategoryPage * financialCategoryPageSize);
              return (
                <div key={group.title} className="min-w-0 rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-[#173626]">{group.title}</h4>
                    <span className="text-[11px] font-semibold text-[#6C7A70]">Click a row for details</span>
                  </div>
                  <div className="mt-3 divide-y divide-[#EEF2EC]">
                    {visibleItems.length ? pagedItems.map((item) => {
                      const percentage = group.total > 0 ? (Number(item.amount) / group.total) * 100 : 0;
                      return (
                        <button
                          key={item.category}
                          type="button"
                          onClick={() => setSelectedFinancialCategory({ ...item, kind: group.kind, total: group.total })}
                          className="group w-full py-3 text-left text-sm outline-none transition hover:bg-[#F8FBF8] focus-visible:ring-2 focus-visible:ring-[#1F6B43]"
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
                          <span className="mt-1 block text-[11px] font-semibold text-[#6C7A70] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">View category details</span>
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

          <p className="rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-3 text-xs font-medium leading-relaxed text-[#5D6D63]">
            This summary includes active, approved cooperative records only. Share Capital contributions are tracked separately and are not counted as operating income.
          </p>

          {financialCategoryPageCount > 1 ? (
            <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 border-t border-[#DDE8D8] bg-white/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
              <span className="text-xs font-bold text-[#6C7A70]">Page {safeFinancialCategoryPage} of {financialCategoryPageCount}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFinancialCategoryPage((page) => Math.max(1, page - 1))} disabled={safeFinancialCategoryPage === 1} className="rounded-lg border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#365F4A] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <button type="button" onClick={() => setFinancialCategoryPage((page) => Math.min(financialCategoryPageCount, page + 1))} disabled={safeFinancialCategoryPage === financialCategoryPageCount} className="rounded-lg border border-[#8FB49A] bg-[#F5FAF5] px-3 py-2 text-xs font-bold text-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
          ) : null}
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
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Share of total</p><p className="mt-1 text-lg font-black text-[#123D2A]">{selectedFinancialCategory.total > 0 ? `${((Number(selectedFinancialCategory.amount) / selectedFinancialCategory.total) * 100).toFixed(1)}%` : "0.0%"}</p></div>
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Posted records</p><p className="mt-1 text-lg font-black text-[#123D2A]">{Number(selectedFinancialCategory.recordCount || 0).toLocaleString("en-PH")}</p></div>
            </div>
            <p className="rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-3 text-sm leading-relaxed text-[#5D6D63]">
              This category includes active and approved posted records for the selected period. Individual transaction details remain protected in this member-facing view.
            </p>
          </div>
        ) : null}
      </Modal>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

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

              {/* 3. FINANCIAL TRANSPARENCY */}
              <section className="mt-8 rounded-3xl border border-[#DDE8D8] bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[#2F7D57]">
                      <PieChart className="h-5 w-5" />
                      <p className="text-xs font-bold uppercase tracking-[0.18em]">Financial transparency</p>
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-[#173626]">Cooperative income &amp; expenses</h3>
                    <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">
                      Posted cooperative records grouped by category. Share Capital contributions are tracked separately in your passbook.
                    </p>
                  </div>
                  <a href="/statement" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[#B8D6BE] px-4 py-2.5 text-sm font-bold text-[#123D2A] transition hover:bg-[#F3F7F1]">
                    View statement
                  </a>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Posted income", value: dashboardData?.financialTransparency?.incomeTotal, className: "text-[#1F6B43]", icon: ArrowDownLeft },
                    { label: "Posted expenses", value: dashboardData?.financialTransparency?.expenseTotal, className: "text-[#A15C16]", icon: ArrowUpRight },
                    { label: "Net operating result", value: dashboardData?.financialTransparency?.netTotal, className: "text-[#123D2A]", icon: Wallet },
                  ].map((summary) => (
                    <div key={summary.label} className="rounded-2xl border border-[#E5E7EB] bg-[#F8FBF8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">{summary.label}</p>
                        <summary.icon className={`h-4 w-4 ${summary.className}`} />
                      </div>
                      <p className={`mt-2 text-2xl font-black ${summary.className}`}>
                        {isFetchingDashboard ? "..." : formatPeso(Number(summary.value || 0))}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FBF8] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#173626]">Category breakdown</h4>
                    <p className="mt-1 text-sm text-[#6B7280]">Open the full income and expense allocation in a detailed popup.</p>
                  </div>
                  <button type="button" onClick={() => setFinancialTransparencyModalOpen(true)} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#123D2A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1B4D37]">
                    View full breakdown
                  </button>
                </div>
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
                    <div className="rounded-2xl border border-[#B8D6BE] bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#1F6B43]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#6B7280]">Dividends Earned</p>
                        <PieChart className="h-5 w-5 text-amber-500" />
                      </div>
                      {latestPublishedDividendCompleted ? (
                        <div className="mt-3 flex min-h-[112px] flex-col justify-between gap-4">
                          <h3 className="text-2xl font-bold text-[#173626]">
                            {isFetchingDividends ? "..." : formatPeso(0)}
                          </h3>
                          <div className="flex items-end justify-between gap-3">
                            <p className="max-w-[210px] text-[10px] font-semibold leading-3 text-[#6B7280]">
                              {latestPublishedDividend?.declarationName}
                            </p>
                            <div className={`shrink-0 text-right ${latestPublishedDividend?.status === "Withdrawn" ? "text-red-600" : "text-emerald-700"}`}>
                              <p className="text-[10px] font-bold uppercase tracking-wider">
                                {latestPublishedDividend?.status === "Withdrawn"
                                  ? latestPublishedDividend.withdrawalMethod ?? "Cash"
                                  : "Share Capital"}
                              </p>
                              <p className="text-sm font-bold">
                                {latestPublishedDividend?.status === "Withdrawn" ? "−" : "+"} {formatPeso(latestPublishedDividendAmount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <h3 className="text-2xl font-bold text-[#173626]">
                              {isFetchingDividends ? "..." : formatPeso(latestPublishedDividendBalance)}
                            </h3>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              dividendLoadError
                                ? "bg-red-50 text-red-600"
                                : latestPublishedDividend?.status === "Available"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : latestPublishedDividend?.status === "Withdrawal Requested" || latestPublishedDividend?.status === "Capitalization Requested"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-slate-100 text-slate-500"
                            }`}>
                              {isFetchingDividends
                                ? "Loading"
                                : dividendLoadError
                                  ? "Unavailable"
                                  : latestPublishedDividend?.status ?? "No published dividend"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {latestPublishedDividend?.declarationName ?? "Published dividend allocations will appear here."}
                          </p>
                          {latestPublishedDividend?.status === "Available" ? (
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => openDividendAction(latestPublishedDividend, "withdraw")}
                                disabled={dividendActionBusy}
                                className="flex-1 rounded-lg border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#123D2A] transition hover:bg-[#F3F7F1] disabled:opacity-50"
                              >
                                Withdraw
                              </button>
                              <button
                                type="button"
                                onClick={() => openDividendAction(latestPublishedDividend, "capital")}
                                disabled={dividendActionBusy}
                                className="flex-1 rounded-lg bg-[#123D2A] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-50"
                              >
                                Add to capital
                              </button>
                            </div>
                          ) : latestPublishedDividend ? (
                            <p className="mt-4 text-xs font-semibold text-[#6B7280]">
                              {latestPublishedDividend.status === "Pending"
                                ? "Waiting for the scheduled distribution date."
                                : latestPublishedDividend.status === "Withdrawal Requested"
                                  ? "Withdrawal request sent to the Bookkeeper."
                                  : latestPublishedDividend.status === "Capitalization Requested"
                                    ? "Share Capital addition request sent to the Bookkeeper."
                                    : "No action available for this dividend."}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className="hidden rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#1F6B43]">
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
                        <h3 className="text-2xl font-bold text-[#173626]">
                          {isFetchingPatronage
                            ? "..."
                            : `₱${(patronageData?.refunds.allocatedTotal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                          patronageLoadError
                            ? "bg-red-50 text-red-600"
                            : (patronageData?.refunds.pendingTotal || 0) > 0
                              ? "bg-amber-50 text-amber-700"
                              : (patronageData?.refunds.paidTotal || 0) > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                        }`}>
                          {isFetchingPatronage
                            ? "Loading"
                            : patronageLoadError
                              ? "Unavailable"
                              : (patronageData?.refunds.pendingTotal || 0) > 0
                                ? "Pending"
                                : (patronageData?.refunds.paidTotal || 0) > 0
                                  ? "Paid"
                                  : "No refund yet"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {patronageLoadError
                          ? "Could not load your refund balance"
                          : `Balance: ₱${(patronageData?.refunds.pendingTotal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Received: ₱${(patronageData?.refunds.paidTotal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </p>
                      <Link href="/portal/member/patronage" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1F6B43] hover:underline">
                        View patronage details <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Achievements & Milestones */}
                <div className="md:col-span-5 flex flex-col gap-6">

                  {/* Achievements Panel */}
                  <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-[#173626]">Badges & Tiers</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${currentShareCapitalTierBadgeClass}`}>
                        {currentShareCapitalTier.label}
                      </span>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-[#173626]">
                          {nextShareCapitalTier ? `Next Milestone: ${nextShareCapitalTier.label}` : "Maximum Share Capital reached"}
                        </span>
                        <span className="font-bold text-[#2F7D57]">{shareCapitalProgress}%</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#1F6B43] to-[#2F7D57] transition-all duration-500"
                          style={{ width: `${shareCapitalProgress}%` }}
                        ></div>
                      </div>
                      <p className="mt-2 text-xs text-[#6B7280]">
                        {nextShareCapitalTier
                          ? `${formatPeso(amountToNextShareCapitalTier)} more share capital needed for ${nextShareCapitalTier.label}.`
                          : `You have reached the ${formatPeso(MAX_SHARE_CAPITAL)} maximum share capital.`}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      {memberBadges.map((badge) => {
                        const BadgeIcon = badge.icon;
                        const isEarned = badgesReady && badge.earned;

                        return (
                          <div
                            key={badge.label}
                            className={`flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center transition hover:bg-white hover:shadow-md hover:border-[#E5E7EB] ${isEarned ? "" : "opacity-50 grayscale"}`}
                          >
                            <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isEarned ? badge.iconClassName : "bg-slate-200 text-slate-400"}`}>
                              <BadgeIcon className="h-6 w-6" />
                            </div>
                            <h4 className="text-sm font-bold text-[#173626]">{badge.label}</h4>
                            <span className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isEarned ? "text-[#2F7D57]" : "text-slate-400"}`}>
                              {!badgesReady ? "Checking..." : isEarned ? "Earned" : "Locked"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT DEPOSITS LIST */}
              <div className="mt-8 rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
                <h3 className="text-xl font-bold text-[#173626] mb-6">Recent Capital Contributions</h3>
                <div className="space-y-4">
                  {dashboardData?.recentCapitalContributions?.length > 0 ? (
                    dashboardData.recentCapitalContributions.map((item: any, idx: number) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:bg-white hover:shadow-sm transition">
                        <div className="flex items-center gap-4 mb-3 sm:mb-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <ArrowDownRight className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-[#173626]">{item.type === "Dividend Added to Share Capital" ? "Dividend Added to Share Capital" : "Capital Deposit"}</h4>
                            <p className="text-xs text-[#6B7280]">{item.type === "Dividend Added to Share Capital" ? "From dividend allocation" : "Member Share Capital payment"}</p>
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
