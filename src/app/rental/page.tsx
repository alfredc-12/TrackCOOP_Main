import { ArrowRight, BadgeCheck, CalendarCheck2, ClipboardCheck, SearchCheck } from "lucide-react";
import Link from "next/link";
import { RentalPolicyNotice } from "./_components/RentalPolicyNotice";
import { RentalServiceBrowser } from "./_components/RentalServiceBrowser";
import { Modal } from "@/components/ui/Modal";
import { RentalInquiryForm } from "./_components/RentalInquiryForm";
import { RentalStatusLookup } from "./_components/RentalStatusLookup";

export default function RentalLandingPage({ useModals }: { useModals?: boolean; params?: any; searchParams?: any } = {}) {
  return <><section className="relative overflow-hidden border-b border-[#d8e4d3] bg-[#123d2a] text-white"><div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#9ad19d_0,transparent_30%),radial-gradient(circle_at_80%_70%,#dce7a9_0,transparent_28%)]" /><div className="relative mx-auto grid min-h-[32rem] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_.85fr]"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-[#a9ddb7]">TrackCOOP · NFFAC</p><h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">Equipment Rental Services</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">Browse cooperative-managed farm equipment and submit a rental inquiry for review by the Nasugbu Farmers and Fisherfolks Agriculture Cooperative.</p><div className="mt-8 flex flex-wrap gap-3">
    {useModals ? (
      <>
        <Modal title="Submit Rental Inquiry" description="Complete the form below to send a rental inquiry to NFFAC." maxWidth="max-w-4xl" trigger={<button className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e7efbd] px-6 font-extrabold text-[#123d2a] hover:bg-white transition-colors cursor-pointer">Submit Rental Inquiry<ArrowRight className="size-4" /></button>}>
          <div className="px-1 py-4">
            <RentalInquiryForm hideBackButton={useModals} />
          </div>
        </Modal>
        <Modal title="Check Inquiry Status" description="Enter your Inquiry ID to check the current status." maxWidth="max-w-2xl" trigger={<button className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-6 font-bold text-white hover:bg-white/10 transition-colors cursor-pointer">Check Inquiry Status</button>}>
          <RentalStatusLookup />
        </Modal>
      </>
    ) : (
      <>
        <Link href="/rental/inquiry" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e7efbd] px-6 font-extrabold text-[#123d2a] hover:bg-white transition-colors">
          Submit Rental Inquiry<ArrowRight className="size-4" />
        </Link>
        <Link href="/rental/inquiry/status" className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-6 font-bold text-white hover:bg-white/10 transition-colors">
          Check Inquiry Status
        </Link>
      </>
    )}
  </div></div><div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm"><RentalPolicyNotice /><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><Feature icon={SearchCheck} label="Browse services" /><Feature icon={ClipboardCheck} label="Submit inquiry" /><Feature icon={CalendarCheck2} label="Confirm schedule" /><Feature icon={BadgeCheck} label="Cooperative review" /></div></div></div></section><RentalServiceBrowser /></>;
}

function Feature({ icon: Icon, label }: { icon: typeof SearchCheck; label: string }) {
  return <div className="rounded-2xl bg-white/10 p-4"><Icon className="mb-3 size-5 text-[#bde4c5]" /><span className="font-bold">{label}</span></div>;
}
