"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, LogOut, Menu, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/features/auth/types";
import { findPortalNavItem } from "./navigation";
import { Breadcrumbs } from "./Breadcrumbs";

type PortalTopbarProps = {
  user: AuthUser;
  onMenuClick: () => void;
  onLogout: () => void;
};

export function PortalTopbar({ user, onMenuClick, onLogout }: PortalTopbarProps) {
  const pathname = usePathname();
  const current = findPortalNavItem(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-[#CAD8CB] bg-[#F7F8F3]/92 backdrop-blur">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open navigation"
              className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC] lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <Breadcrumbs />
              <h1 className="mt-1 truncate text-xl font-black text-[#123D2A]">
                {current?.label ?? "Portal"}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC]"
          >
            <Bell className="size-4" aria-hidden="true" />
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
              >
                <span className="grid size-6 place-items-center rounded-full bg-[#E7F2E4]">
                  <UserRound className="size-3.5" aria-hidden="true" />
                </span>
                <span className="hidden max-w-40 truncate sm:inline">{user.displayName}</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-60 rounded-lg border border-[#CAD8CB] bg-white p-2 text-[#17211C] shadow-[0_18px_45px_rgba(18,61,42,0.16)]"
              >
                <div className="border-b border-[#EEF2EC] px-3 py-2">
                  <p className="truncate text-sm font-black text-[#123D2A]">{user.displayName}</p>
                  <p className="truncate text-xs text-[#5D6D63]">{user.email}</p>
                  <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#D8A011]">
                    {user.role}
                  </p>
                </div>
                <DropdownMenu.Item
                  onSelect={onLogout}
                  className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#9A392A] outline-none transition hover:bg-[#FFF4EC]"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}
