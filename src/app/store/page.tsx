"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
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
    <div className="public-store flex min-h-screen flex-col bg-[var(--public-canvas)] text-[#123D2A]">
      <SiteHeader initialActive="services" />
      <main className="min-w-0 flex-1 pt-16">
          <Suspense fallback={<div role="status" className="px-5 py-16 text-center text-[#365F4A]">Loading cooperative store...</div>}>
            <StoreCheckoutClient />
          </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
