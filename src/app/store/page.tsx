"use client";

import { StorePublicHeader } from "./_components/StorePublicHeader";
import MemberPOS from "@/app/(dashboard)/member_dashboard/member_pos";

export default function CooperativeStorePage() {
  return (
    <div className="flex min-h-screen flex-col font-sans bg-[#F8F6EF]">
      <StorePublicHeader />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 [&>div]:rounded-2xl [&>div]:border [&>div]:border-gray-200 [&>div]:shadow-sm">
          <MemberPOS isPublicView={true} />
        </div>
      </main>
    </div>
  );
}
