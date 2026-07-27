import { RotateCcw } from "lucide-react";
import Link from "next/link";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";

export default function PaymentCancelledPage() {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-5 pb-12 pt-28 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8] sm:p-10">
          <div className="grid size-14 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
            <RotateCcw className="size-7" />
          </div>
          <p className="mt-7 text-xs font-black uppercase tracking-[0.32em] text-[#f4b62a]">
            Checkout Cancelled
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight tracking-normal text-[#073f2b] md:text-6xl">
            No payment was confirmed
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[#365F4A]">
            Cancelling checkout does not reject your membership application or
            mark a payment as failed. You can return to the status page and try
            PayMongo checkout again.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/membership/application-status">
              <Button className="h-11 w-full rounded-full bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43] sm:w-auto">
                Return to Status Page
              </Button>
            </Link>
            <Link href="/">
              <Button className="h-11 w-full rounded-full border border-[#DDE8D8] bg-white px-5 text-[#123D2A] hover:bg-[#EAF3E8] sm:w-auto">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
