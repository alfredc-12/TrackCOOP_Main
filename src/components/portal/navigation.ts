import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  CalendarCheck2,
  ClipboardList,
  FileText,
  Gauge,
  Globe2,
  History,
  Inbox,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Tractor,
  UserRoundCog,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { Role } from "@/config/roles";

export type StaffRole = Exclude<Role, "member">;

export type PortalNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  summary: string;
};

export type PortalNavGroup = {
  title: string;
  items: PortalNavItem[];
};

export const roleHomePaths: Record<Role, string> = {
  chairman: "/chairman/dashboard",
  bookkeeper: "/bookkeeper/dashboard",
  member: "/member_dashboard",
};

export const portalNavigation: Record<StaffRole, PortalNavGroup[]> = {
  chairman: [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          href: "/chairman/dashboard",
          icon: LayoutDashboard,
          summary: "Chairman oversight and cooperative health signals.",
        },
      ],
    },
    {
      title: "People",
      items: [
        {
          label: "User Accounts",
          href: "/chairman/users",
          icon: UserRoundCog,
          summary: "Create and manage staff and member access.",
        },
        {
          label: "Members",
          href: "/chairman/members",
          icon: UsersRound,
          summary: "Review member records, status, and profile history.",
        },
        {
          label: "Member Indicators",
          href: "/chairman/member-indicators",
          icon: Gauge,
          summary: "Track membership status indicators and recalculations.",
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          label: "Payments",
          href: "/chairman/payments",
          icon: ReceiptText,
          summary: "Review validated member payment references.",
        },
        {
          label: "Share Capital",
          href: "/chairman/share-capital",
          icon: WalletCards,
          summary: "Monitor share capital progress and summaries.",
        },
        {
          label: "Financial Overview",
          href: "/chairman/finance",
          icon: Landmark,
          summary: "View ledger performance and financial totals.",
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Products",
          href: "/chairman/products",
          icon: Package,
          summary: "Oversee products available to cooperative members.",
        },
        {
          label: "POS Sales",
          href: "/chairman/pos",
          icon: ShoppingCart,
          summary: "Process and review cooperative sales activity.",
        },
        {
          label: "Inventory",
          href: "/chairman/inventory",
          icon: Boxes,
          summary: "Track stock levels and inventory movements.",
        },
        {
          label: "Rental Assets",
          href: "/chairman/rentals/assets",
          icon: Tractor,
          summary: "Manage cooperative rental equipment and assets.",
        },
        {
          label: "Rental Bookings",
          href: "/chairman/rentals/bookings",
          icon: CalendarCheck2,
          summary: "Review rental schedules, bookings, and statuses.",
        },
      ],
    },
    {
      title: "Communication",
      items: [
        {
          label: "Announcements",
          href: "/chairman/announcements",
          icon: Megaphone,
          summary: "Create, publish, and archive cooperative notices.",
        },
        {
          label: "Requests and Inquiries",
          href: "/chairman/requests",
          icon: Inbox,
          summary: "Assign and respond to cooperative requests.",
        },
      ],
    },
    {
      title: "Records",
      items: [
        {
          label: "Documents",
          href: "/chairman/documents",
          icon: FileText,
          summary: "Manage documents and access permissions.",
        },
        {
          label: "Reports",
          href: "/chairman/reports",
          icon: BarChart3,
          summary: "Generate allowed operational and financial reports.",
        },
      ],
    },
    {
      title: "Public Website",
      items: [
        {
          label: "Page Content",
          href: "/chairman/landing/content",
          icon: Globe2,
          summary: "Manage published landing page content blocks.",
        },
        {
          label: "Services",
          href: "/chairman/landing/services",
          icon: ClipboardList,
          summary: "Maintain public cooperative service information.",
        },
        {
          label: "Programs and Projects",
          href: "/chairman/landing/programs",
          icon: Tractor,
          summary: "Maintain public programs and project highlights.",
        },
        {
          label: "Partners and Certifications",
          href: "/chairman/landing/partners",
          icon: ShieldCheck,
          summary: "Manage partner and certification records for the site.",
        },
        {
          label: "Gallery",
          href: "/chairman/landing/gallery",
          icon: Tags,
          summary: "Manage published cooperative gallery photos.",
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          label: "Settings",
          href: "/chairman/settings",
          icon: Settings,
          summary: "Manage system-level cooperative configuration.",
        },
        {
          label: "Audit Logs",
          href: "/chairman/audit-logs",
          icon: History,
          summary: "Review security and system activity logs.",
        },
      ],
    },
  ],
  bookkeeper: [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          href: "/bookkeeper/dashboard",
          icon: LayoutDashboard,
          summary: "Bookkeeper workload and financial operations overview.",
        },
      ],
    },
    {
      title: "Payments",
      items: [
        {
          label: "Payment Validation",
          href: "/bookkeeper/payment-validation",
          icon: ReceiptText,
          summary: "Validate, reject, or clarify member payment references.",
        },
        {
          label: "Share Capital",
          href: "/bookkeeper/share-capital",
          icon: WalletCards,
          summary: "Record and correct share capital transactions.",
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          label: "Financial Ledger",
          href: "/bookkeeper/financial-ledger",
          icon: Landmark,
          summary: "Post, review, and void controlled financial entries.",
        },
        {
          label: "Financial Categories",
          href: "/bookkeeper/financial-categories",
          icon: Tags,
          summary: "Maintain financial categories for ledger entries.",
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "POS Sales",
          href: "/bookkeeper/pos-sales",
          icon: ShoppingCart,
          summary: "Process cooperative POS sales and receipts.",
        },
        {
          label: "Products and Inventory",
          href: "/bookkeeper/products-inventory",
          icon: Boxes,
          summary: "Manage products, stock, and inventory movement records.",
        },
        {
          label: "Rental Transactions",
          href: "/bookkeeper/rental-transactions",
          icon: Tractor,
          summary: "Record rental charges, payments, and financial status.",
        },
      ],
    },
    {
      title: "Records",
      items: [
        {
          label: "Documents",
          href: "/bookkeeper/documents",
          icon: FileText,
          summary: "Upload and manage financial supporting documents.",
        },
        {
          label: "Reports",
          href: "/bookkeeper/reports",
          icon: BarChart3,
          summary: "Generate financial, rental, POS, and inventory reports.",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          label: "Assigned Requests",
          href: "/bookkeeper/requests",
          icon: Inbox,
          summary: "Review and respond to assigned requests.",
        },
      ],
    },
  ],
};

export function findPortalNavItem(pathname: string): PortalNavItem | null {
  for (const groups of Object.values(portalNavigation)) {
    for (const group of groups) {
      const match = group.items.find(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      );

      if (match) return match;
    }
  }

  return null;
}

export function getPortalRoleFromPath(pathname: string): StaffRole | null {
  if (pathname.startsWith("/chairman")) return "chairman";
  if (pathname.startsWith("/bookkeeper")) return "bookkeeper";
  return null;
}
