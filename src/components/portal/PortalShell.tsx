"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import type { AuthUser } from "@/features/auth/types";
import { getAuthenticatedUser, logout } from "@/lib/auth-client";
import { useRealtimeEvents } from "@/lib/realtime";
import { LoadingAccess } from "./PortalPrimitives";
import { roleHomePaths, type PortalRole } from "./navigation";
import { PortalSidebar } from "./PortalSidebar";
import { PortalTopbar } from "./PortalTopbar";

type PortalShellProps = {
  role: PortalRole;
  children: ReactNode;
};

export function PortalShell({ role, children }: PortalShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    getAuthenticatedUser()
      .then((currentUser) => {
        if (!active) return;

        if (currentUser.role !== role) {
          router.replace(roleHomePaths[currentUser.role]);
          return;
        }

        setUser(currentUser);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [role, router]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      toast.error("Sign out could not reach the server.");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  useRealtimeEvents(() => {
    if (refreshTimer.current) {
      window.clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = window.setTimeout(() => {
      router.refresh();
    }, 500);
  }, { enabled: Boolean(user) });

  useEffect(() => () => {
    if (refreshTimer.current) {
      window.clearTimeout(refreshTimer.current);
    }
  }, []);

  if (!user) {
    return <LoadingAccess />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F7F8F3] text-[#17211C]">
      <PortalSidebar
        role={role}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <div className="min-w-0 min-h-screen lg:pl-72">
        <PortalTopbar
          user={user}
          onMenuClick={() => setIsMobileOpen(true)}
          onLogout={handleLogout}
        />
        <main className="min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
