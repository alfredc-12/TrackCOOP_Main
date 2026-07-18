import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  FileClock,
  FileText,
  Gauge,
  HandCoins,
  LayoutGrid,
  ListChecks,
  Settings,
  Tractor,
  UserRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import type { RentalCapability } from "./rentalPermissions";

export const rentalNavigation = [
  { href: "/rental/dashboard", label: "Dashboard", icon: Gauge, capability: "dashboard" },
  { href: "/rental/services", label: "Rental Services", icon: Tractor, capability: "services" },
  { href: "/rental/inquiries", label: "Inquiries", icon: ClipboardList, capability: "inquiries" },
  { href: "/rental/schedule", label: "Schedule", icon: CalendarDays, capability: "schedule" },
  { href: "/rental/availability", label: "Availability", icon: LayoutGrid, capability: "availability" },
  { href: "/rental/operations", label: "Operations", icon: ListChecks, capability: "operations" },
  { href: "/rental/payments", label: "Payments", icon: WalletCards, capability: "payments" },
  { href: "/rental/expenses", label: "Expenses", icon: HandCoins, capability: "expenses" },
  { href: "/rental/reports", label: "Reports", icon: FileText, capability: "reports" },
  { href: "/rental/analytics", label: "Analytics", icon: BarChart3, capability: "analytics" },
  { href: "/rental/notifications", label: "Notifications", icon: Bell, capability: "public" },
  { href: "/rental/audit", label: "Audit Trail", icon: FileClock, capability: "audit" },
  { href: "/rental/settings", label: "Settings", icon: Settings, capability: "settings" },
  { href: "/rental/member", label: "Member Area", icon: UserRound, capability: "member" },
] satisfies Array<{ href: string; label: string; icon: typeof Wrench; capability: RentalCapability }>;

export function isPublicRentalPath(pathname: string) {
  if (pathname === "/rental") return true;
  if (pathname.startsWith("/rental/inquiry")) return true;
  const servicePath = pathname.match(/^\/rental\/services\/([^/]+)$/);
  return Boolean(servicePath);
}

export function titleForPath(pathname: string) {
  const item = [...rentalNavigation].sort((a, b) => b.href.length - a.href.length).find((entry) => pathname.startsWith(entry.href));
  if (pathname.includes("/validate")) return "Validate Payment";
  if (pathname.includes("/review")) return "Review Request";
  if (pathname.includes("/reschedule")) return "Request Reschedule";
  if (pathname.endsWith("/new")) return `New ${item?.label ?? "Rental Record"}`;
  if (pathname.endsWith("/edit")) return `Edit ${item?.label ?? "Rental Record"}`;
  return item?.label ?? "Equipment Rental Services";
}
