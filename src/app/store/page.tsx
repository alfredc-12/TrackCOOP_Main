"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StorePublicHeader } from "./_components/StorePublicHeader";
import MemberPosClient from "@/features/pos/components/MemberPosClient";

function StoreCheckoutClient() {
  const searchParams = useSearchParams();
  const paymentReferenceId = searchParams.get("paymentReferenceId")?.trim() ?? "";
  const referenceNumber = searchParams.get("referenceNumber")?.trim() ?? "";
  const statusToken = searchParams.get("statusToken")?.trim() ?? "";
  const hasPaymentReturn = Boolean(paymentReferenceId && referenceNumber && statusToken);

  return (
    <MemberPosClient
      isPublicView
      paymentReturn={hasPaymentReturn ? {
        paymentReferenceId,
        referenceNumber,
        statusToken,
        // Payment returns carry signed status parameters. A full replacement reliably
        // clears them after an external QRPH checkout hands control back to the store.
        onDismiss: () => window.location.replace("/store"),
      } : undefined}
    />
  );
}

export default function CooperativeStorePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6EF] font-sans">
      <StorePublicHeader />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 [&>div]:rounded-2xl [&>div]:border [&>div]:border-gray-200 [&>div]:shadow-sm">
          <Suspense fallback={<MemberPosClient isPublicView />}>
            <StoreCheckoutClient />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
