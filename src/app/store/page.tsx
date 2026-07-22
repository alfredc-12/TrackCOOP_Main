"use client";

import { StorePublicHeader } from "./_components/StorePublicHeader";
import MemberPosClient from "@/features/pos/components/MemberPosClient";

export default function CooperativeStorePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6EF] font-sans">
      <StorePublicHeader />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 [&>div]:rounded-2xl [&>div]:border [&>div]:border-gray-200 [&>div]:shadow-sm">
          <MemberPosClient isPublicView />
        </div>
      </main>
    </div>
  );
}
