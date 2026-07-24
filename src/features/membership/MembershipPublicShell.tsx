import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export function MembershipPublicShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#1E1E1E]">
      <SiteHeader />
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-[#365F4A] outline-none transition hover:text-[#123D2A] focus-visible:ring-2 focus-visible:ring-[#1F6B43]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to TrackCOOP
        </Link>
        <header className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1F6B43]">
            NFFAC Membership
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#123D2A] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5D6D63] sm:text-base">
            {description}
          </p>
        </header>
        <div className="mt-8">{children}</div>
      </div>
      <SiteFooter />
    </main>
  );
}
