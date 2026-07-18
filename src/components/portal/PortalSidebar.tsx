"use client";

import { ChevronDown, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { StaffRole } from "./navigation";
import { portalNavigation, roleHomePaths } from "./navigation";

type PortalSidebarProps = {
  role: StaffRole;
  isMobileOpen: boolean;
  onMobileClose: () => void;
};

function SidebarContent({ role, onNavigate }: { role: StaffRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = portalNavigation[role];
  const initialOpen = useMemo(
    () =>
      Object.fromEntries(
        groups.map((group) => [
          group.title,
          group.items.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          ),
        ]),
      ) as Record<string, boolean>,
    [groups, pathname],
  );
  const [openGroups, setOpenGroups] = useState(initialOpen);

  return (
    <div className="flex h-full flex-col bg-[#123D2A] text-white">
      <Link
        href={roleHomePaths[role]}
        className="flex min-h-20 items-center gap-3 border-b border-white/10 px-5"
        onClick={onNavigate}
      >
        <span className="relative block size-11 shrink-0">
          <Image
            src="/trackcoop-logo.svg"
            alt="TrackCOOP logo"
            fill
            unoptimized
            sizes="44px"
            className="object-contain"
          />
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-black leading-tight">TrackCOOP</span>
          <span className="block truncate text-xs italic text-[#DCEB9A]">
            {role === "chairman" ? "Chairman Portal" : "Bookkeeper Portal"}
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-5">
        {groups.map((group) => {
          const isOpen = openGroups[group.title] ?? true;

          return (
            <section key={group.title}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.title]: !isOpen,
                  }))
                }
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#DCEB9A] transition hover:bg-white/8"
                aria-expanded={isOpen}
              >
                {group.title}
                <ChevronDown
                  className={cn("size-4 transition", isOpen ? "rotate-180" : "rotate-0")}
                  aria-hidden="true"
                />
              </button>
              {isOpen ? (
                <div className="mt-1 grid gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-white/78 transition",
                          active
                            ? "bg-white text-[#123D2A] shadow-[0_8px_22px_rgba(0,0,0,0.12)]"
                            : "hover:bg-white/9 hover:text-white",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-[#1F6B43]" : "text-[#A8CDB0]",
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
    </div>
  );
}

export function PortalSidebar({ role, isMobileOpen, onMobileClose }: PortalSidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#CAD8CB] lg:block">
        <SidebarContent role={role} />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-[#061B11]/50 backdrop-blur-sm transition lg:hidden",
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onMobileClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] w-[min(20rem,86vw)] border-r border-[#CAD8CB] transition-transform duration-300 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close navigation"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md bg-white/10 text-white transition hover:bg-white/18"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <SidebarContent role={role} onNavigate={onMobileClose} />
      </aside>
    </>
  );
}
