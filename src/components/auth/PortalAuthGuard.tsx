"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import type { Role } from "@/config/roles";
import type { AuthUser } from "@/features/auth/types";
import { getAuthenticatedUser } from "@/lib/auth-client";

const destinations: Record<AuthUser["role"], string> = {
  chairman: "/portal/chairman/dashboard",
  bookkeeper: "/portal/bookkeeper/dashboard",
  member: "/portal/member/dashboard",
};

function requiredRole(pathname: string): Role | null {
  if (
    pathname.startsWith("/chairman") ||
    pathname.startsWith("/portal/chairman") ||
    pathname.startsWith("/chairman_dashboard") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/members")
  ) {
    return "chairman";
  }

  if (
    pathname.startsWith("/bookkeeper") ||
    pathname.startsWith("/portal/bookkeeper") ||
    pathname.startsWith("/bookkeeper_dashboard")
  ) {
    return "bookkeeper";
  }

  if (pathname.startsWith("/member_dashboard") || pathname.startsWith("/portal/member")) {
    return "member";
  }

  return null;
}

export function PortalAuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    getAuthenticatedUser()
      .then((user) => {
        if (!active) return;
        const expectedRole = requiredRole(pathname);

        if (expectedRole && user.role !== expectedRole) {
          router.replace(destinations[user.role]);
          return;
        }

        setIsAuthorized(true);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (!isAuthorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F8F3] text-[#123D2A]">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          Verifying access...
        </div>
      </main>
    );
  }

  return children;
}
