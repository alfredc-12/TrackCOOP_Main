"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Kung nasa member_dashboard tayo, huwag ipakita ang Admin Sidebar at Header
  if (pathname === "/member_dashboard") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f7f8f3] text-[#17211c] lg:grid lg:grid-cols-[18rem_1fr]">
      <Sidebar />
      <div className="min-w-0">
        <main className="px-5 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
