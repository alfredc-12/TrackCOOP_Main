"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AuthUser } from "@/features/auth/types";
import { getAuthenticatedUser } from "@/lib/auth-client";

const destinations: Record<AuthUser["role"], string> = {
  chairman: "/portal/chairman/dashboard",
  bookkeeper: "/portal/bookkeeper/dashboard",
  member: "/portal/member/dashboard",
};

export default function PortalRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    getAuthenticatedUser()
      .then((user) => router.replace(destinations[user.role]))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8F1E5] text-[#123D2A]">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        Opening your portal...
      </div>
    </main>
  );
}
