"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  CreditCard,
  Tractor,
  FileText,
  Megaphone,
  MessageSquare,
  LineChart,
  PhilippinePeso,
  User,
  Calendar,
  Package,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth-client";

const chairmanNavItems = [
  { href: "/chairman/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chairman/members", label: "Members", icon: Users },
  { href: "/chairman/finance", label: "Finance", icon: Wallet },
  { href: "/chairman/payments", label: "Payments", icon: CreditCard },
  { href: "/chairman/pos", label: "POS Sales", icon: Tractor },
  { href: "/chairman/documents", label: "Documents", icon: FileText },
  { href: "/chairman/announcements", label: "Announcements", icon: Megaphone },
  { href: "/chairman/requests", label: "Requests", icon: MessageSquare },
];

const bookkeeperNavItems = [
  { href: "/bookkeeper/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookkeeper/share-capital", label: "Share Capital", icon: Wallet },
  { href: "/bookkeeper/financial-ledger", label: "Financial Ledger", icon: LineChart },
  { href: "/bookkeeper/financial-categories", label: "Categories", icon: PhilippinePeso },
];

const memberNavItems = [
  { href: "/member_dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/member_dashboard", label: "Cooperative Shop", icon: Package },
  { href: "/member-share-capital", label: "Member & Share Capital", icon: User },
  { href: "/activities-programs", label: "Activities & Programs", icon: Calendar },
  { href: "/announcements", label: "Communication & Announcements", icon: Megaphone },
  { href: "/support", label: "Inquiry & Support", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const roleFromPath = pathname.includes("bookkeeper") ? "bookkeeper"
    : pathname.includes("member") ? "member"
      : "chairman";
  const role = searchParams.get("role") || roleFromPath;
  const tab = searchParams.get("tab");

  const navItems =
    role === "bookkeeper" ? bookkeeperNavItems :
      role === "member" ? memberNavItems :
        chairmanNavItems;
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);

  const sidebarContent = (
    <>
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6">
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-1" onClick={() => setIsOpen(false)}>
          <Image
            src="/trackcoop-logo.svg"
            alt="NFFAC logo"
            width={52}
            height={52}
            className="rounded-xl"
          />
          <span className="text-3xl font-bold tracking-tight text-[#82E6A7]">
            NFFAC
          </span>
        </Link>

        {/* Role Badge */}
        <div className="w-fit rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-[#82E6A7]">
          {roleTitle}
        </div>
      </div>

      <div className="mt-8">
        <p className="mb-4 px-4 text-xs font-bold tracking-[0.15em] text-white/50">
          MENU
        </p>
        <nav className="grid gap-1">
          {navItems.map((item) => {
            const isActive = tab
              ? item.href.includes(tab)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[15.5px] font-semibold transition-all",
                  isActive
                    ? "bg-white/10 text-white shadow-sm border border-white/5"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => {
            void logout().finally(() => router.replace("/login"));
          }}
          className="flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[15.5px] font-semibold text-white/60 transition-all hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-5" strokeWidth={2} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/10 bg-[#f7f8f3] px-5 lg:hidden">
        <div className="flex items-center gap-3">
          <Image src="/icon.png" alt="logo" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold text-[#17211c]">NFFAC</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="grid size-10 place-items-center rounded-md border border-black/10 bg-white text-[#17211c]"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-[#07110b] p-5 text-white lg:hidden"
            >
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="grid size-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden sticky top-0 h-screen w-72 flex-col overflow-y-auto border-r border-white/10 bg-[#07110b] p-5 text-white lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
