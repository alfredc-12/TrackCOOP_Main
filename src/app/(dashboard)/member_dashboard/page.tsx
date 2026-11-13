"use client";

import Image from "next/image";
import { MemberMembershipPanel, MembershipHistory } from "@/features/membership/MembershipProgress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import * as Select from "@radix-ui/react-select";
import * as Tabs from "@radix-ui/react-tabs";
import SiteFooter from "@/components/layout/SiteFooter";
import { MemberRentalSection } from "@/app/rental/_components/MemberRentalSection";
import { RentalProvider } from "@/app/rental/_context/RentalProvider";
import { logout, getAuthenticatedUser } from "@/lib/auth-client";
import type { AuthUser } from "@/features/auth/types";
import { apiRequest } from "@/lib/api-client";
import { expressFetch } from "@/lib/express-api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PaginationControls } from "@/components/portal/PortalPrimitives";
import { toast } from "sonner";
import { resolveUploadUrl } from "@/lib/upload-url";
import {
  Bell,
  Search,
  User,
  UserPlus,
  Wallet,
  Megaphone,
  MessageSquare,
  Inbox,
  MapPin,
  FileText,
  Briefcase,
  ChevronDown,
  Menu,
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
  RefreshCw,
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
import { MemberAttendanceQr } from "@/features/activities/MemberAttendanceQr";
import { SeasonGuide } from "@/features/member-livelihoods/SeasonGuide";
import { TrueMembershipApplication, type UpgradeStatus } from "@/features/membership/TrueMembershipApplication";
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
  const [activeTab, setActiveTabState] = useState("Dashboard");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<UpgradeStatus | null>();
  const [profileSection, setProfileSection] = useState("");
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [activeTab]);
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
  const [announcementFeedPage, setAnnouncementFeedPage] = useState(1);
  const [announcementFeedPageSize, setAnnouncementFeedPageSize] = useState(3);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  const [readMoreModalOpen, setReadMoreModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isReferralCodeCopied, setIsReferralCodeCopied] = useState(false);
  const [isReferralLinkCopied, setIsReferralLinkCopied] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [restoreModalStack, setRestoreModalStack] = useState<{readMore: boolean, viewAll: boolean}>({readMore: false, viewAll: false});

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isFetchingDashboard, setIsFetchingDashboard] = useState(true);
  const [dashboardLoadError, setDashboardLoadError] = useState(false);
  const [financialView, setFinancialView] = useState("personal");
  const [financialPeriod, setFinancialPeriod] = useState<FinancialPeriod>("year");
  const [financialStartDate, setFinancialStartDate] = useState("");
  const [financialEndDate, setFinancialEndDate] = useState("");
  const [selectedFinancialCategory, setSelectedFinancialCategory] = useState<FinancialCategorySelection | null>(null);
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

  const canAccessFinancials = dashboardData?.canAccessFinancials === true;
  const isAssociate = dashboardData?.membershipType === "Associate";
  const membershipLabel = canAccessFinancials ? "True Member" : isAssociate ? "Associate Member" : "Cooperative Member";
  const selectTab = useCallback((tab: string) => {
    if (["Financial", "Member & Share"].includes(tab) && !canAccessFinancials) {
      if (isAssociate) setUpgradeOpen(true);
      else toast.error("Please wait for your membership details to load.");
      return;
    }
    setMobileMenuOpen(false);
    setActiveTabState(tab);
  }, [canAccessFinancials, isAssociate]);
  const openLivelihoods = () => { setProfileSection("livelihoods"); selectTab("Profile"); };

  const shareCapitalTotal = Math.max(0, Number(dashboardData?.shareCapital?.total) || 0);
  const referralCode = String(dashboardData?.referrals?.code || "");
  const referralLink = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/membership/apply?ref=${encodeURIComponent(referralCode)}`
    : "";
  const unreadUpdates = dashboardData?.unreadUpdates ?? {};
  const unreadAnnouncementCount = Number(unreadUpdates.announcements || 0);
  const unreadInquiryCount = Number(unreadUpdates.inquiries || 0);
  const unreadReferralCount = Number(unreadUpdates.referrals || 0);
  const memberFinancialSummary = dashboardData?.memberFinancialSummary;
  const memberIncomeItems = (memberFinancialSummary?.incomeByCategory || []) as FinancialCategoryItem[];
  const memberExpenseItems = (memberFinancialSummary?.expenseByCategory || []) as FinancialCategoryItem[];
  const needsFinancialSummary = activeTab === "Financial";
  const dashboardRequest = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const dividendRequest = useRef<{ promise: Promise<void> } | null>(null);
  const patronageRequest = useRef<{ promise: Promise<void> } | null>(null);
  const refreshDashboard = useCallback(({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
    const params = new URLSearchParams({ period: financialPeriod, includeFinancialSummary: String(needsFinancialSummary) });
    if (financialPeriod === "custom" && financialStartDate && financialEndDate) {
      params.set("startDate", financialStartDate);
      params.set("endDate", financialEndDate);
    }
    const key = params.toString();
    if (!force && dashboardRequest.current?.key === key) return dashboardRequest.current.promise;
    dashboardRequest.current?.controller.abort();
    const request = { key, controller: new AbortController(), promise: Promise.resolve() };
    dashboardRequest.current = request;
    if (!silent) setIsFetchingDashboard(true);
    request.promise = (async () => {
      try {
        const response = await expressFetch(`/api/members/me/dashboard?${key}`, { signal: request.controller.signal });
        if (!response.ok) {
          const failure = await response.json().catch(() => null) as { error?: string; message?: string } | null;
          const message = failure?.error || failure?.message || response.statusText;
          throw new Error(`Failed to refresh dashboard (HTTP ${response.status}): ${message}`);
        }
        const data = await response.json();
        if (dashboardRequest.current !== request || request.controller.signal.aborted) return;
        setDashboardData(data);
        setDashboardLoadError(false);
      } catch (error) {
        if (dashboardRequest.current !== request || request.controller.signal.aborted) return;
        console.error(error);
        setDashboardLoadError(true);
      } finally {
        if (dashboardRequest.current === request) {
          dashboardRequest.current = null;
          setIsFetchingDashboard(false);
        }
      }
    })();
    return request.promise;
  }, [financialEndDate, financialPeriod, financialStartDate, needsFinancialSummary]);

  useEffect(() => () => {
    dashboardRequest.current?.controller.abort();
    dashboardRequest.current = null;
  }, []);

  const refreshMemberDividends = useCallback(({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
    if (!force && dividendRequest.current) return dividendRequest.current.promise;
    const request = { promise: Promise.resolve() };
    dividendRequest.current = request;
    if (!silent) setIsFetchingDividends(true);
    request.promise = (async () => {
      try {
        if (!canAccessFinancials) { setMemberDividends([]); return; }
        const data = await getMemberDividends();
        if (dividendRequest.current !== request) return;
        setMemberDividends(data);
        setDividendLoadError(false);
      } catch {
        if (dividendRequest.current === request) setDividendLoadError(true);
      } finally {
        if (dividendRequest.current === request) {
          dividendRequest.current = null;
          setIsFetchingDividends(false);
        }
      }
    })();
    return request.promise;
  }, [canAccessFinancials]);

  const refreshMemberPatronage = useCallback(({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
    if (!force && patronageRequest.current) return patronageRequest.current.promise;
    const request = { promise: Promise.resolve() };
    patronageRequest.current = request;
    if (!silent) setIsFetchingPatronage(true);
    request.promise = (async () => {
      try {
        if (!canAccessFinancials) { setPatronageData(null); return; }
        const data = await getMemberPatronage();
        if (patronageRequest.current !== request) return;
        setPatronageData(data);
        setPatronageLoadError(false);
      } catch {
        if (patronageRequest.current === request) setPatronageLoadError(true);
      } finally {
        if (patronageRequest.current === request) {
          patronageRequest.current = null;
          setIsFetchingPatronage(false);
        }
      }
    })();
    return request.promise;
  }, [canAccessFinancials]);

  useEffect(() => {
    getAuthenticatedUser().then(setUser).catch(console.error);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void refreshDashboard(); }, 0);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshDashboard({ silent: true });
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    const refreshAfterMutation = () => { if (document.visibilityState === "visible") void refreshDashboard({ silent: true, force: true }); };
    window.addEventListener("trackcoop:patronage-updated", refreshAfterMutation);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("trackcoop:patronage-updated", refreshAfterMutation);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshDashboard]);

  const needsBenefitDetails = activeTab === "Member & Share" && canAccessFinancials;
  useEffect(() => {
    if (!needsBenefitDetails) return;
    const refresh = (silent = false, force = false) => {
      if (document.visibilityState !== "visible") return;
      void refreshMemberDividends({ silent, force });
      void refreshMemberPatronage({ silent, force });
    };
    const initial = window.setTimeout(() => refresh(), 0);
    const background = () => refresh(true);
    const interval = window.setInterval(background, 60_000);
    window.addEventListener("focus", background);
    const afterMutation = () => refresh(true, true);
    window.addEventListener("trackcoop:patronage-updated", afterMutation);
    document.addEventListener("visibilitychange", background);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", background);
      window.removeEventListener("trackcoop:patronage-updated", afterMutation);
      document.removeEventListener("visibilitychange", background);
    };
  }, [needsBenefitDetails, refreshMemberDividends, refreshMemberPatronage]);

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
        toast.success("Annual Interest added to Share Capital.");
      }
      resetDividendAction();
      await Promise.all([refreshMemberDividends({ silent: true, force: true }), refreshDashboard({ silent: true, force: true })]);
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
      const timer = window.setTimeout(() => setActiveTabState("Store"), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const navClass = (id: string) =>
    `inline-flex h-8 items-center border-b-2 px-1 text-sm font-semibold transition ${activeTab === id
      ? "border-coop-green text-coop-forest"
      : "border-transparent text-coop-secondary hover:border-[#1F6B43]/55 hover:text-coop-forest"
    }`;

  const mobileNavClass = (id: string) =>
    `flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold transition ${activeTab === id
      ? "bg-coop-sage text-coop-forest"
      : "text-coop-secondary hover:text-coop-forest"
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

  const announcementFeedTotalPages = Math.max(1, Math.ceil(announcements.length / announcementFeedPageSize));
  const currentAnnouncementFeedPage = Math.min(announcementFeedPage, announcementFeedTotalPages);
  const visibleAnnouncementFeed = announcements.slice(
    (currentAnnouncementFeedPage - 1) * announcementFeedPageSize,
    currentAnnouncementFeedPage * announcementFeedPageSize,
  );

  return (
    <div className="flex min-h-[101vh] min-w-0 flex-col bg-[#F8F6EF] font-sans">
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 w-full min-w-0 max-w-full overflow-x-clip border-b-2 border-[#1F6B43]/55 bg-white/92 text-coop-forest shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] w-full min-w-0 max-w-[1440px] items-center justify-between gap-3 px-4 sm:gap-5 sm:px-8 xl:px-10">
          {/* Logo Section */}
          <div className="min-w-0 shrink-0 xl:w-[230px]">
            <Link href="#" onClick={() => selectTab("Dashboard")} className="flex min-w-0 items-center gap-3">
              <span className="relative block size-10 overflow-hidden rounded-md sm:size-12">
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
                  {membershipLabel}
                </span>
              </span>
            </Link>
          </div>

          {/* Center Nav Links */}
          <nav aria-label="Member navigation" className="hidden items-center gap-2.5 text-sm font-semibold xl:flex">
            <button onClick={() => selectTab("Dashboard")} className={navClass("Dashboard")}>Dashboard</button>
            {canAccessFinancials && <>
              <button onClick={() => selectTab("Member & Share")} className={navClass("Member & Share")}>Member & Share</button>
              <button onClick={() => selectTab("Financial")} className={navClass("Financial")}>Financial</button>
            </>}
            <button onClick={() => selectTab("Rental")} className={navClass("Rental")}>Equipment Rental</button>
            <button onClick={() => selectTab("Store")} className={navClass("Store")}>Coop Store</button>
          </nav>

          {/* Right Actions */}
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-3 xl:gap-4">
            <div className="hidden items-center gap-2.5 xl:flex">

            {/* <button onClick={() => selectTab("Help")} className={`transition ${activeTab === "Help" ? "text-coop-green" : "text-coop-secondary hover:text-coop-forest"}`} title="Help Center">
              <MessageSquare className="size-5" />
            </button> */}
            <button onClick={() => { setProfileSection(""); selectTab("Profile"); }} className={`grid size-9 place-items-center rounded-lg transition hover:bg-coop-sage ${activeTab === "Profile" ? "text-coop-green" : "text-coop-secondary hover:text-coop-forest"}`} title="Profile & Settings">
              <User className="size-5" />
            </button>
            <button onClick={() => selectTab("Announcements")} className={`relative grid size-9 place-items-center rounded-lg transition hover:bg-coop-sage ${activeTab === "Announcements" ? "text-coop-green" : "text-coop-secondary hover:text-coop-forest"}`} title="Announcements" aria-label={`Announcements${unreadAnnouncementCount ? `, ${unreadAnnouncementCount} unread` : ""}`}>
              <Bell className="size-5" />
              {unreadAnnouncementCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full border-2 border-white bg-[#F3C94A] px-1 text-center text-[10px] font-black leading-4 text-coop-forest" aria-hidden="true">{unreadAnnouncementCount > 99 ? "99+" : unreadAnnouncementCount}</span>}
            </button>
            <button onClick={() => selectTab("Requests")} className={`relative grid size-9 place-items-center rounded-lg transition hover:bg-coop-sage ${activeTab === "Requests" ? "text-coop-green" : "text-coop-secondary hover:text-coop-forest"}`} title="My Requests" aria-label={`My Requests${unreadInquiryCount ? `, ${unreadInquiryCount} unread` : ""}`}>
              <Inbox className="size-5" />
              {unreadInquiryCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full border-2 border-white bg-[#F3C94A] px-1 text-center text-[10px] font-black leading-4 text-coop-forest" aria-hidden="true">{unreadInquiryCount > 99 ? "99+" : unreadInquiryCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => setReferralModalOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Refer a Friend${unreadReferralCount ? `, ${unreadReferralCount} unread` : ""}`}
              className="relative flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-[#A9C9B1] bg-coop-sage px-4 py-2.5 text-sm font-bold text-coop-green transition hover:bg-[#DCEEDC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green focus-visible:ring-offset-2"
            >
              <UserPlus className="hidden size-4 sm:block" aria-hidden="true" />
              Refer a Friend
              {unreadReferralCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full border-2 border-white bg-[#F3C94A] px-1 text-center text-[10px] font-black leading-4 text-coop-forest" aria-hidden="true">{unreadReferralCount > 99 ? "99+" : unreadReferralCount}</span>}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-[#123D2A]/20 bg-coop-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-coop-green disabled:cursor-wait disabled:opacity-70"
            >
              {isSigningOut ? "Logging out" : "Logout"}
              <LogOut className="size-4" />
            </button>
            </div>
            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close member menu" : "Open member menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="member-mobile-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#DDE8D8] bg-[var(--public-canvas)] text-coop-forest transition hover:bg-coop-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green focus-visible:ring-offset-2 xl:hidden sm:size-11"
            >
              {mobileMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen ? (
          <div id="member-mobile-menu" className="border-t border-[#DDE8D8] bg-white px-4 py-3 shadow-xl xl:hidden">
            <nav aria-label="Mobile member navigation" className="mx-auto grid max-w-7xl gap-0.5 text-sm">
              {[
                { value: "Dashboard", label: "Dashboard" },
                { value: "Member & Share", label: "Member & Share" },
                { value: "Financial", label: "Financial" },
                { value: "Rental", label: "Equipment Rental" },
                { value: "Store", label: "Coop Store" },
              ].filter((item) => canAccessFinancials || !["Financial", "Member & Share"].includes(item.value)).map((item) => (
                <button key={item.value} type="button" onClick={() => selectTab(item.value)} aria-current={activeTab === item.value ? "page" : undefined} className={mobileNavClass(item.value)}>{item.label}</button>
              ))}
            </nav>
            <div className="mx-auto mt-2 grid max-w-7xl gap-0.5 border-t border-[#DDE8D8] pt-2 sm:grid-cols-2">
              <button type="button" onClick={() => { setMobileMenuOpen(false); setProfileSection(""); selectTab("Profile"); }} className={mobileNavClass("Profile")}>Profile &amp; Settings</button>
              <button type="button" onClick={() => selectTab("Announcements")} className={mobileNavClass("Announcements")}>
                <span>Announcements</span>
                {unreadAnnouncementCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-[#F3C94A] px-1.5 text-center text-[10px] font-black leading-5 text-coop-forest">{unreadAnnouncementCount > 99 ? "99+" : unreadAnnouncementCount}</span>}
              </button>
              <button type="button" onClick={() => selectTab("Requests")} className={mobileNavClass("Requests")}>
                <span>My Requests</span>
                {unreadInquiryCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-[#F3C94A] px-1.5 text-center text-[10px] font-black leading-5 text-coop-forest">{unreadInquiryCount > 99 ? "99+" : unreadInquiryCount}</span>}
              </button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setReferralModalOpen(true); }} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-bold text-coop-green transition hover:text-coop-forest">
                <span>Refer a Friend</span>
                {unreadReferralCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-[#F3C94A] px-1.5 text-center text-[10px] font-black leading-5 text-coop-forest">{unreadReferralCount > 99 ? "99+" : unreadReferralCount}</span>}
              </button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); void handleLogout(); }} disabled={isSigningOut} className="flex min-h-11 w-full items-center rounded-lg bg-coop-forest px-3 text-left text-sm font-bold text-white transition hover:bg-coop-green disabled:cursor-wait disabled:opacity-70">{isSigningOut ? "Logging out" : "Logout"}</button>
            </div>
          </div>
        ) : null}
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
                          <div className="absolute top-2 left-2 z-10 rounded-full bg-coop-forest px-2 py-0.5 text-[8px] font-bold text-white shadow-md">
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
                      <div className="flex items-center gap-3 bg-[#F8FDF9] py-2 px-3 rounded-xl border border-coop-sage">
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
            <div className="rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-4 text-sm text-coop-secondary">
              Choose how you want to receive the Annual Interest. The Bookkeeper will review the request and record the payout.
            </div>
            <fieldset>
              <legend className="text-sm font-bold text-coop-body">Payout method</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["Cash", "Online Transfer"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setWithdrawalMethod(method)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition ${withdrawalMethod === method ? "border-coop-forest bg-coop-forest text-white" : "border-coop-border text-coop-forest hover:bg-[#F3F7F1]"}`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </fieldset>
            {withdrawalMethod === "Online Transfer" ? (
              <div className="space-y-3 rounded-lg border border-[#DDE8D8] bg-[#F7FAF5] p-4">
                <label className="block text-sm font-bold text-coop-body">
                  Provider
                  <Select.Root value={withdrawalProvider || undefined} onValueChange={setWithdrawalProvider}>
                    <Select.Trigger aria-label="Provider" className="mt-1 flex h-11 w-full items-center justify-between rounded-md border border-coop-border bg-white px-3 text-left font-normal text-coop-forest outline-none transition hover:border-[#9FB7A4] focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/20 data-[placeholder]:text-[#6C7A70]">
                      <Select.Value placeholder="Select provider" />
                      <Select.Icon><ChevronDown className="size-4 text-coop-green" aria-hidden="true" /></Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content position="popper" sideOffset={6} className="z-[120] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border border-coop-border bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.18)]">
                        <Select.Viewport>
                          {["GCash", "Maya", "Bank Transfer"].map((provider) => (
                            <Select.Item key={provider} value={provider} className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-coop-secondary outline-none data-[highlighted]:bg-coop-sage data-[highlighted]:text-coop-forest">
                              <Select.ItemText>{provider}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-coop-green" aria-hidden="true" /></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </label>
                <label className="block text-sm font-bold text-coop-body">
                  Account name
                  <input value={withdrawalAccountName} onChange={(event) => setWithdrawalAccountName(event.target.value)} placeholder="Name registered on the account" className="mt-1 h-11 w-full rounded-md border border-coop-border px-3 font-normal" />
                </label>
                <label className="block text-sm font-bold text-coop-body">
                  Account number / mobile number
                  <input value={withdrawalAccountNumber} onChange={(event) => setWithdrawalAccountNumber(event.target.value)} placeholder="Optional if a QR code is uploaded" className="mt-1 h-11 w-full rounded-md border border-coop-border px-3 font-normal" />
                </label>
                <label className="block text-sm font-bold text-coop-body">
                  QR code <span className="font-normal text-[#6C7A70]">(optional)</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleWithdrawalQrCode(event.target.files?.[0])} className="mt-1 block w-full rounded-md border border-coop-border bg-white p-2 text-sm font-normal" />
                </label>
                {withdrawalQrFileName ? <p className="text-xs font-semibold text-[#2F7D57]">QR attached: {withdrawalQrFileName}</p> : null}
                <p className="text-xs text-[#6C7A70]">Provide either an account/mobile number or a QR code. These details are visible only to the Bookkeeper.</p>
              </div>
            ) : (
              <p className="rounded-lg border border-[#DDE8D8] bg-[#F7FAF5] p-3 text-sm text-[#42594B]">Cash withdrawals will be claimed through the cooperative office after Bookkeeper processing.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-4 text-sm text-coop-secondary">
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
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Amount</p><p className="mt-1 text-lg font-black text-coop-green">{formatPeso(Number(selectedFinancialCategory.amount))}</p></div>
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Part of the total</p><p className="mt-1 text-lg font-black text-coop-forest">{selectedFinancialCategory.total > 0 ? `${((Number(selectedFinancialCategory.amount) / selectedFinancialCategory.total) * 100).toFixed(1)}%` : "0.0%"}</p></div>
              <div className="rounded-lg border border-[#E5E7EB] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6C7A70]">Approved records</p><p className="mt-1 text-lg font-black text-coop-forest">{Number(selectedFinancialCategory.recordCount || 0).toLocaleString("en-PH")}</p></div>
            </div>
            <p className="rounded-lg border border-[#DDE8D8] bg-[#F8F6EF] p-3 text-sm leading-relaxed text-coop-muted">
              This total comes from records checked and approved by the cooperative for your chosen dates. Other members’ private payment details are not shown.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Member referral program"
        description="Share your referral code and track invited applicants."
        maxWidth="max-w-4xl"
        mobileFullScreen
        open={referralModalOpen}
        onOpenChange={setReferralModalOpen}
        trigger={<span className="hidden"></span>}
      >
        <div className="mt-2 flex min-h-full flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#CFE4D4] bg-gradient-to-br from-[#F2FAF3] to-[#FFF9EC] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-coop-green">Your referral code</p>
              <p className="mt-2 break-all text-2xl font-black tracking-wider text-coop-forest">
                {referralCode || "Loading..."}
              </p>
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#A9C9B1] bg-white px-4 py-2.5 text-sm font-bold text-coop-forest transition hover:bg-[#F4FAF4] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-coop-forest px-4 py-2.5 text-sm font-bold text-white transition hover:bg-coop-green disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#A9C9B1] bg-white px-4 py-2.5 text-sm font-bold text-coop-forest transition hover:bg-[#F4FAF4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Share2 className="size-4" />
                Share
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Invitation link</p>
            <p className="mt-2 break-all rounded-xl bg-[#F7FAF7] px-3 py-2 text-xs font-semibold text-coop-secondary">
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
              <p className="mt-2 text-2xl font-black text-coop-green">{Number(dashboardData?.referrals?.successful || 0)}</p>
            </div>

          </div>

          <MembershipHistory kind="referrals" />
        </div>
      </Modal>

      <main className="flex-1">
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${activeTab === "Dashboard" || activeTab === "Financial" || activeTab === "Member & Share" || activeTab === "Rental" || activeTab === "Store" || activeTab === "Profile" ? "py-3" : "py-8"}`}>

          {/* ======================= DASHBOARD TAB ======================= */}
          {activeTab === "Dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {dashboardData?.isLinked === false ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-coop-border bg-white p-12 text-center shadow-sm">
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
                  <section aria-labelledby="member-dashboard-heading" className={`rounded-2xl border border-[#DDE8D8] bg-gradient-to-r from-white to-[#EDF6EE] shadow-sm ${isAssociate ? "p-5 sm:p-7" : "p-4"}`}>
                    <div className={`grid items-center ${isAssociate ? "gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10" : "gap-5 md:grid-cols-[1fr_20rem]"}`}>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2F7D57]">My cooperative</p>
                        <h1 id="member-dashboard-heading" className="mt-2 text-2xl font-bold tracking-tight text-[#173626] sm:text-3xl">Welcome back, {user?.displayName?.split(" ")[0] || "Member"}</h1>
                        <div className={`flex flex-wrap items-center ${isAssociate ? "mt-4 gap-2" : "mt-3 gap-3"}`}>
                          <span className="rounded-full border border-[#CFE2D1] bg-[#EDF6EE] px-3 py-1 text-sm font-bold text-coop-forest">{membershipLabel}</span>
                          {isAssociate && <TrueMembershipApplication open={upgradeOpen} onOpenChange={setUpgradeOpen} onStatus={setUpgradeStatus} />}
                        </div>
                        <p className={`${isAssociate ? "mt-4 leading-6" : "mt-2"} text-sm text-[#6B7280]`}>Your activities and cooperative updates in one place.</p>
                        {!dashboardLoadError && !isFetchingDashboard && <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="My occupations and livelihoods">
                          {(dashboardData?.member?.occupation || "").split("; ").filter(Boolean).map((occupation: string) => <span key={occupation} className="rounded-full border border-[#CFE2D1] bg-white px-2.5 py-1 text-xs font-semibold text-coop-secondary">{occupation}</span>)}
                          {(dashboardData?.member?.livelihoods ?? []).map((item: { activity: string }) => <span key={item.activity} className="rounded-full bg-[#E4F0DE] px-2.5 py-1 text-xs font-semibold text-coop-secondary">{item.activity}</span>)}
                          <SeasonGuide livelihoods={dashboardData?.member?.livelihoods ?? []} province={dashboardData?.member?.province ?? ""} municipality={dashboardData?.member?.municipality ?? ""} onEdit={openLivelihoods} onFinancial={() => { setFinancialView("personal"); selectTab("Financial"); }} />
                          {!dashboardData?.member?.occupation && <button onClick={() => { setProfileSection(""); selectTab("Profile"); }} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-coop-green underline">Add your occupation</button>}
                        </div>}
                      </div>
                      {isAssociate ? <section aria-labelledby="associate-capital-heading" className="rounded-2xl border border-white/10 bg-coop-forest p-5 text-white shadow-coop-card sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                          <h2 id="associate-capital-heading" className="text-sm font-semibold text-[#DFF5E8]">My Share Capital Progress</h2>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10"><Wallet className="size-4 text-coop-mint" aria-hidden="true" /></span>
                        </div>
                        {upgradeStatus ? <>
                          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{formatPeso(upgradeStatus.requirements.validatedTotal)}</p>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#DFF5E8]"><p>of {formatPeso(upgradeStatus.requirements.fullRequirement)} required</p><span className="rounded-full bg-white/10 px-2 py-1 font-semibold tabular-nums">{Math.min(100, Math.round(upgradeStatus.requirements.validatedTotal / upgradeStatus.requirements.fullRequirement * 100))}%</span></div>
                          <progress aria-label="Progress toward True Membership capital requirement" max={upgradeStatus.requirements.fullRequirement} value={Math.min(upgradeStatus.requirements.validatedTotal, upgradeStatus.requirements.fullRequirement)} className="mt-3 block h-2 w-full overflow-hidden rounded-full accent-[#82E6A7] [&::-webkit-progress-bar]:bg-white/15 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#82E6A7] [&::-moz-progress-bar]:bg-[#82E6A7]" />
                          <p className="mt-3 text-sm font-semibold leading-6">{upgradeStatus.requirements.fullRequirementMet && upgradeStatus.requirements.validatedTotal <= upgradeStatus.requirements.maximumAllowed ? "Capital requirement met — eligible for True Membership review" : upgradeStatus.requirements.validatedTotal > upgradeStatus.requirements.maximumAllowed ? "Contribution limit exceeded. Please contact the cooperative." : `${formatPeso(upgradeStatus.requirements.remainingToFull)} more to reach the capital requirement`}</p>
                          <p className="mt-2 text-xs leading-5 text-[#DFF5E8]/80">Only validated contributions count. True Membership requires chairman approval.</p>
                        </> : <p role="status" className="mt-3 text-sm">{upgradeStatus === null ? "Progress could not be loaded. Open your application to retry." : "Loading your contributions…"}</p>}
                        <button onClick={() => setUpgradeOpen(true)} className="mt-4 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-coop-forest transition hover:bg-coop-sage focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{upgradeStatus?.application?.status === "Pending" ? "View Pending Application" : "Apply for True Membership"}<ArrowRight className="size-4 shrink-0" aria-hidden="true" /></button>
                      </section>
 : <div className="rounded-2xl bg-coop-forest p-3 text-white">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[#DFF5E8]">{canAccessFinancials ? "My Share Capital" : "True Member Benefits"}</p>
                          <Wallet className="size-5 text-[#A9D5B5]" aria-hidden="true" />
                        </div>
                        <p className="mt-2 text-3xl font-bold tracking-tight" aria-live="polite">{isFetchingDashboard ? "Loading…" : dashboardLoadError ? "—" : (canAccessFinancials ? formatPeso(dashboardData?.shareCapital?.total ?? 0) : "Exclusive to True Members")}</p>
                        <button onClick={() => selectTab("Member & Share")} className="mt-2 inline-flex min-h-8 items-center gap-2 rounded-lg text-sm font-semibold text-[#DFF5E8] underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{canAccessFinancials ? "View My Savings" : "Apply for True Membership"}<ArrowRight className="size-4" aria-hidden="true" /></button>
                      </div>}
                    </div>
                  </section>
                  <MemberMembershipPanel />
                  {dashboardData?.member?.livelihoodsUnavailable && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Some saved crop and livelihood details could not be displayed. Your other dashboard records are still available.</p>}
                  {dashboardLoadError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"><p>We couldn’t load your records. Please try again.</p><button onClick={() => void refreshDashboard()} className="min-h-10 rounded-lg px-3 font-bold underline">Try again</button></div>}

                  <section aria-label="My activity summary" className={`${isAssociate ? "mt-5" : "mt-4"} grid grid-cols-2 gap-3 ${canAccessFinancials ? "lg:grid-cols-4" : "sm:grid-cols-3"}`}>
                    {[
                      { label: "Capital Deposits", value: dashboardData?.stats?.deposits ?? 0, icon: Wallet, tab: "Member & Share", detail: "Recorded additions" },
                      { label: "Store Purchases", value: dashboardData?.stats?.purchases ?? 0, icon: ShoppingBag, tab: "Store", detail: "Purchase records" },
                      { label: "Rental Bookings", value: dashboardData?.stats?.rentals ?? 0, icon: Tractor, tab: "Rental", detail: "All bookings" },
                      { label: "Announcements", value: dashboardData?.stats?.announcements ?? 0, icon: Megaphone, tab: "Announcements", detail: "Cooperative updates" },
                    ].filter((stat) => canAccessFinancials || stat.tab !== "Member & Share").map((stat) => (
                      <button key={stat.label} onClick={() => selectTab(stat.tab)} className={`flex items-center justify-between gap-2 rounded-2xl border border-[#DDE8D8] bg-white text-left shadow-sm transition hover:border-[#2F7D57] hover:bg-[#F5FAF4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7D57] ${isAssociate ? "p-5 last:col-span-2 sm:last:col-span-1" : "p-4"}`}>
                        <div>
                          <p className="text-2xl font-bold text-[#173626]">{isFetchingDashboard ? "…" : dashboardLoadError ? "—" : stat.value}</p>
                          <h2 className="mt-1 text-sm font-semibold text-coop-secondary">{stat.label}</h2>
                          <p className="mt-1 text-xs text-[#6B7280]">{stat.detail}</p>
                        </div>
                        <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF6EE] text-[#2F7D57] sm:flex"><stat.icon className="size-5" aria-hidden="true" /></span>
                      </button>
                    ))}
                  </section>

              {/* 4. QUICK ACTIONS GRID & 5. RECENT TRANSACTIONS */}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">

                {/* RECENT TRANSACTIONS TABLE */}
                <section className="min-w-0 lg:col-span-2 rounded-2xl border border-[#DDE8D8] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-[#173626]">Recent Activity</h2><span className="text-xs text-[#6B7280]">Latest 5 records</span>
                  </div>

                  <div className="max-h-56 overflow-auto" tabIndex={0} role="region" aria-label="Recent activity records">
                    <table className={`w-full text-left text-sm ${isAssociate ? "min-w-[42rem] [&_th]:pr-4 [&_td]:pr-4 [&_td:nth-child(2)]:whitespace-nowrap [&_td:nth-child(3)]:whitespace-nowrap" : "min-w-[32rem] [&_th]:pr-4 [&_td]:pr-4"}`}>
                      <thead className="border-b border-[#E5E7EB] text-[#6B7280]">
                        <tr>
                          <th className="pb-3 font-semibold">Transaction</th>
                          <th className="pb-3 font-semibold">Date</th>
                          <th className="pb-3 font-semibold">Amount</th>
                          <th className="pb-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {!isFetchingDashboard && !dashboardLoadError && dashboardData?.recentActivity?.length > 0 ? (
                          dashboardData.recentActivity.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${item.type.includes('Withdrawal') ? 'bg-red-50 text-red-600' : item.type.includes('Deposit') || item.type.includes('Share Capital') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {item.type.includes('Withdrawal') ? <ArrowUpRight className="h-5 w-5" /> : item.type.includes('Deposit') || item.type.includes('Share Capital') ? <ArrowDownLeft className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                                  </div>
                                  <span className="font-medium text-[#173626]">{item.type}</span>
                                </div>
                              </td>
                              <td className="py-3 text-[#6B7280]">
                                {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                              </td>
                              <td className={`relative py-3 font-bold ${item.amount == null ? 'text-transparent after:absolute after:left-4 after:top-1/2 after:-translate-y-1/2 after:text-[#9CA3AF] after:content-["—"]' : item.type.includes('Withdrawal') ? 'text-red-700' : item.type.includes('Deposit') || item.type.includes('Share Capital') ? 'text-green-700' : 'text-[#173626]'}`}>
                                {item.amount == null ? '—' : `${item.type.includes('Withdrawal') ? '-' : item.type.includes('Deposit') || item.type.includes('Share Capital') ? '+' : '-'} ₱${Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                              </td>
                              <td className="py-3">
                                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold border ${item.status === 'Completed' || item.status === 'Validated' || item.status === 'Paid' || item.status === 'Acknowledged' || item.status === 'Withdrawn' ? 'bg-green-50 text-green-700 border-green-200' :
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
                            <td colSpan={4} className="py-8 text-center text-[#6B7280]">{isFetchingDashboard ? "Loading your activity…" : dashboardLoadError ? "Your activity is unavailable. Please try again." : "No activity yet. Your cooperative transactions will appear here."}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section aria-labelledby="dashboard-actions-heading" className="rounded-2xl border border-[#DDE8D8] bg-white p-3 shadow-sm sm:p-4">
                  <h2 id="dashboard-actions-heading" className="mb-3 text-lg font-bold text-[#173626]">Quick Actions</h2>
                  <div className="grid gap-1">
                    <MemberAttendanceQr memberCode={dashboardData?.member?.code ?? ""} memberName={user?.displayName} />
                    {[
                      { label: "View My Savings", detail: "Share Capital and earnings", icon: Wallet, action: () => selectTab("Member & Share") },
                      { label: "Rent Equipment", detail: "Find equipment for your farm", icon: Tractor, action: () => selectTab("Rental") },
                      { label: "Visit Coop Store", detail: "Browse farm supplies", icon: ShoppingBag, action: () => selectTab("Store") },
                      { label: "My Requests", detail: "Ask for help and check replies", icon: Inbox, action: () => selectTab("Requests") },
                      { label: "Refer a Friend", detail: "Invite someone to join", icon: UserPlus, action: () => setReferralModalOpen(true) },
                    ].filter((item) => canAccessFinancials || item.label !== "View My Savings").map((item) => (
                      <button key={item.label} onClick={item.action} className="group flex min-h-11 items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-[#F1F7EF] focus-visible:outline-2 focus-visible:outline-[#2F7D57]">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#EDF6EE] text-[#2F7D57]"><item.icon className="size-4" aria-hidden="true" /></span>
                        <span className="flex-1"><span className="block text-sm font-bold text-[#173626]">{item.label}</span><span className="block text-xs text-[#6B7280]">{item.detail}</span></span>
                        <ArrowRight className="size-4 shrink-0 text-[#52705D]" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DDE8D8] bg-[#EDF6EE] px-4 py-2 text-sm text-coop-secondary">
                <p>Need help with your account? Send a request to the cooperative.</p>
                <button onClick={() => selectTab("Requests")} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 font-bold text-coop-forest hover:bg-white">Get Help<ArrowRight className="size-4" aria-hidden="true" /></button>
              </div>
              </>
              )}
            </div>
          )}

          {/* ======================= FINANCIAL TAB ======================= */}
          {activeTab === "Financial" && canAccessFinancials && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" aria-labelledby="financial-heading">
              <Tabs.Root value={financialView} onValueChange={setFinancialView}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2F7D57]">Financial</p>
                <h2 id="financial-heading" className="mt-1 text-2xl font-bold text-[#173626]">Your money at a glance</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Your records and the cooperative’s money, clearly explained.</p>
                </div>
                <Tabs.List aria-label="Financial sections" className="flex shrink-0 gap-1 rounded-2xl lg:w-[420px] border border-[#DDE8D8] bg-white p-2">
                  <Tabs.Trigger value="personal" className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-[#52705D] outline-none focus-visible:ring-2 focus-visible:ring-coop-green data-[state=active]:bg-coop-forest data-[state=active]:text-white"><Wallet className="size-4 shrink-0" />My money</Tabs.Trigger>
                </Tabs.List>
              </div>
              {dashboardData?.isLinked === false ? (
                <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Please ask the cooperative office to connect your account to your member record.</p>
              ) : null}


                <Tabs.Content value="personal" className="rounded-3xl border border-[#DDE8D8] bg-[#FFFCF5] p-4 outline-none focus-visible:ring-2 focus-visible:ring-coop-green sm:p-5">
                  {dashboardLoadError ? <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">We could not get the latest amounts. Please press Update to try again.</p> : null}
                  <details className="mb-4 rounded-xl border border-[#DDE8D8] bg-white p-3 text-sm text-[#52705D]">
                    <summary className="cursor-pointer font-bold text-[#173626]">What is seasonal analytics?</summary>
                    <p className="mt-2 leading-6">It compares production, sales, income, and expenses between planting, growing, and harvest periods. This helps you see when money comes in and when you need money for farm costs.</p>
                    <p className="mt-2 leading-6">The Season Guide gives typical guidance or crop-age estimates. The amounts below are recorded cooperative transactions. Personal farm production and comparisons by crop season need farm records and are not available here yet.</p>
                  </details>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-[#173626]"><Wallet className="size-5 text-[#2F7D57]" />Your earnings and spending</h3>
                        <p className="mt-1 text-sm text-[#6B7280]">Only your records with the cooperative.</p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div><p className="mb-1 text-xs font-semibold text-[#42594B]">Choose dates</p>
                  <Select.Root value={financialPeriod} onValueChange={(value) => setFinancialPeriod(value as FinancialPeriod)}>
                    <Select.Trigger aria-label="My money period" className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-coop-border bg-white px-3 text-left text-sm font-bold text-coop-forest outline-none transition hover:border-[#9FB7A4] focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/20 sm:w-48">
                      <Select.Value />
                      <Select.Icon><ChevronDown className="size-4 text-coop-green" aria-hidden="true" /></Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content position="popper" sideOffset={6} className="z-[120] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-coop-border bg-white p-1.5 shadow-[0_18px_40px_rgba(18,61,42,0.18)]">
                        <Select.Viewport>
                          {(["year", "month", "30d", "all", "custom"] as FinancialPeriod[]).map((period) => (
                            <Select.Item key={period} value={period} className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-9 text-sm font-semibold text-coop-secondary outline-none data-[highlighted]:bg-coop-sage data-[highlighted]:text-coop-forest">
                              <Select.ItemText>{FINANCIAL_PERIOD_LABELS[period]}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-3"><Check className="size-4 text-coop-green" aria-hidden="true" /></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                        </div>
                    <button type="button" onClick={() => void refreshDashboard()} disabled={isFetchingDashboard} className="inline-flex items-center gap-2 min-h-11 rounded-lg border border-coop-border bg-white px-4 py-2 text-sm font-bold text-coop-forest hover:bg-coop-subtle disabled:opacity-60"><RefreshCw className={`size-4 ${isFetchingDashboard ? "animate-spin" : ""}`} />Update</button>
                      </div>
                    </div>

                {financialPeriod === "custom" ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-[#DDE8D8] bg-white p-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-coop-body">Start date<input type="date" value={financialStartDate} onChange={(event) => setFinancialStartDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-coop-border px-3 font-normal text-coop-forest outline-none focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
                    <label className="text-sm font-bold text-coop-body">End date<input type="date" value={financialEndDate} onChange={(event) => setFinancialEndDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-coop-border px-3 font-normal text-coop-forest outline-none focus:border-coop-green focus:ring-2 focus:ring-[#1F6B43]/20" /></label>
                    {financialStartDate && financialEndDate && financialStartDate > financialEndDate ? <p className="sm:col-span-2 text-xs font-semibold text-red-700">End date must be on or after the start date.</p> : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {[
                    { label: "What you earned", help: "Annual Interest on Share Capital, patronage refund, and other earnings.", value: memberFinancialSummary?.totalEarnings, className: "text-coop-green", icon: ArrowDownLeft },
                    { label: "Annual Interest Earnings", help: "Published Annual Interest on Share Capital, whether received as cash or added to Share Capital.", value: memberFinancialSummary?.annualInterestEarnings, className: "text-coop-green", icon: Leaf },
                    { label: "What you paid", help: "Purchases, rentals, and other charges.", value: memberFinancialSummary?.totalExpenses, className: "text-[#A15C16]", icon: ArrowUpRight },
                    { label: "Earnings minus payments", help: "Earnings less payments. Not a cash balance.", value: memberFinancialSummary?.netResult, className: "text-coop-forest", icon: Wallet },
                    { label: "Share Capital payments", help: "Added in these dates. Not earnings or total balance.", value: memberFinancialSummary?.shareCapitalContributions, className: "text-[#52705D]", icon: Leaf },
                  ].map((summary) => (
                    <div key={summary.label} className="rounded-2xl border border-[#DDE8D8] bg-gradient-to-br from-white to-[#EFF7F0] p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#42594B]">{summary.label}</p>
                        <summary.icon className={`h-4 w-4 ${summary.className}`} />
                      </div>
                      <p className={`mt-2 text-2xl font-black tracking-tight ${summary.className}`}>{isFetchingDashboard ? "..." : memberFinancialSummary ? formatPeso(Number(summary.value || 0)) : "?"}</p>
                      <p className="mt-1 text-sm leading-snug text-coop-muted">{summary.help}</p>
                    </div>
                  ))}
                </div>

                <div className="grid items-start gap-3 lg:grid-cols-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                  {[
                    { title: "Where my earnings came from", items: memberIncomeItems, color: "bg-coop-green", amountClass: "text-coop-green", empty: "No earnings recorded for these dates." },
                    { title: "What I paid for", items: memberExpenseItems, color: "bg-[#A15C16]", amountClass: "text-[#A15C16]", empty: "No payments recorded for these dates." },
                  ].map((group) => (
                    <section key={group.title} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                      <h4 className="text-sm font-bold text-[#173626]">
                        {group.title}
                      </h4>
                      <div className="mt-2 max-h-32 overflow-y-auto divide-y divide-coop-subtle">
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
                  <div className="mt-2 max-h-32 overflow-y-auto divide-y divide-coop-subtle">
                    {memberFinancialSummary?.transactions?.length ? memberFinancialSummary.transactions.slice(0, 5).map((transaction: { id: string; type: "Income" | "Expense"; category: string; description: string; amount: number; date: string | Date }) => (
                      <div key={`${transaction.id}-${transaction.date}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#42594B]">{transaction.description}</p>
                          <p className="text-xs text-[#6C7A70]">{transaction.category} · {new Date(transaction.date).toLocaleDateString("en-PH")}</p>
                        </div>
                        <span className={`shrink-0 font-bold ${transaction.type === "Income" ? "text-coop-green" : "text-[#A15C16]"}`}>{transaction.type === "Income" ? "+" : "-"}{formatPeso(Number(transaction.amount || 0))}</span>
                      </div>
                    )) : <p className="py-3 text-sm text-[#6B7280]">No payments or earnings recorded for these dates.</p>}
                  </div>
                </div>

                </div>

                <p className="rounded-xl border border-[#DDE8D8] bg-white p-3 text-xs leading-relaxed text-coop-muted">
                  Your Share Capital payments are separate from earnings. Farm and household records outside the cooperative are not included.
                </p>
                </div>
                </Tabs.Content>

              </Tabs.Root>
            </section>
          )}

          {/* ======================= MEMBER & SHARE CAPITAL TAB ======================= */}
          {activeTab === "Member & Share" && canAccessFinancials && (
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
              onRefresh={() => { void refreshDashboard({ force: true }); void refreshMemberDividends({ force: true }); void refreshMemberPatronage({ force: true }); }}
              onDividendAction={openDividendAction}
              dividendBusy={dividendActionBusy}
            />
          )}

          {/* ======================= ANNOUNCEMENTS TAB ======================= */}
          {activeTab === "Announcements" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Header Banner */}
              <section className="mb-10 rounded-3xl bg-coop-forest px-8 py-10 text-white shadow-md relative overflow-hidden">
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
                      <button type="button" onClick={fetchAnnouncements} className="mt-3 rounded-lg bg-coop-forest px-4 py-2 text-sm font-bold text-white">Retry</button>
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
                      <Megaphone className="mx-auto mb-3 h-8 w-8 text-[#94A3B8]" />
                      <p className="text-sm font-semibold text-[#6B7280]">No announcements found at the moment.</p>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-4 pb-3 shadow-sm sm:p-6 sm:pb-3">
                      <div className="flex flex-col gap-4">
                      {visibleAnnouncementFeed.map((ann) => (
                        <div 
                          key={ann.id} 
                          className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-[#E5E7EB] transition-all hover:shadow-md flex flex-col md:flex-row cursor-pointer"
                          onClick={() => {
                            setSelectedAnnouncement(ann);
                            setReadMoreModalOpen(true);
                          }}
                        >
                          <div className="md:w-1/4 h-36 md:h-auto bg-[#e8f3ec] relative overflow-hidden shrink-0">
                            {ann.id === announcements[0]?.id && (
                              <div className="absolute top-4 left-4 z-10 rounded-full bg-coop-forest px-3 py-1 text-xs font-bold text-white shadow-md">
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
                      </div>
                      <PaginationControls
                        currentPage={currentAnnouncementFeedPage}
                        totalPages={announcementFeedTotalPages}
                        totalItems={announcements.length}
                        itemName="announcements"
                        onPageChange={setAnnouncementFeedPage}
                        pageSize={announcementFeedPageSize}
                        pageSizeOptions={[3, 6, 10]}
                        onPageSizeChange={(nextPageSize) => {
                          setAnnouncementFeedPageSize(nextPageSize);
                          setAnnouncementFeedPage(1);
                        }}
                        centerControls
                        className="mb-0 border-t border-[#E5E7EB] pt-5"
                      />
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
                          <button type="button" onClick={fetchAnnouncements} className="mt-2 text-xs font-bold text-coop-green underline">Retry</button>
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
              <RentalProvider>
                <MemberRentalSection />
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6 rounded-3xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden p-6 pb-3">
              <MemberRequestsClient />
            </div>
          )}

          {/* ======================= PROFILE TAB ======================= */}
          {activeTab === "Profile" && (
            <ProfileSettings membershipLabel={membershipLabel} initialSection={profileSection} onSaved={() => void refreshDashboard({ silent: true, force: true })} />
          )}

          {/* ======================= HELP CENTER TAB ======================= */}
          {/* {activeTab === "Help" && (
            <HelpCenter />
          )} */}

        </div>
      </main>
      {/* FOOTER */}
      <div className="mt-0">
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
                            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-coop-forest"
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
                            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-coop-forest"
                          >
                            <X className="size-5" />
                          </button>
                        </div>

                        <div className="flex flex-col">
                          <div className="relative h-72 sm:h-96 bg-coop-forest shrink-0">
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
                              <p className="text-xs font-bold uppercase tracking-[0.24em] text-coop-yellow shrink-0 drop-shadow-md text-right">
                                {new Date(selectedAnnouncement.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>

                          <div className="flex min-w-0 flex-col overflow-x-hidden p-6 sm:p-8 max-h-[50vh] overflow-y-auto">
                            <div 
                              className="quill-content min-w-0 max-w-full overflow-x-hidden whitespace-pre-line break-words text-base leading-relaxed text-coop-forest [&_*]:max-w-full [&_img]:h-auto [&_img]:object-contain"
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
