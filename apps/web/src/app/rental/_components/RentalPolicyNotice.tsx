import { Info } from "lucide-react";
import { POLICY_NOTICE, PRICING_NOTICE } from "../_lib/rentalConstants";

export function RentalPolicyNotice({ compact = false }: { compact?: boolean }) {
  return <aside className="rounded-2xl border border-[#c7d9a7] bg-[#f1f6dd] p-4 text-[#244c34]" aria-label="Rental pricing and policy notice"><div className="flex gap-3"><Info className="mt-0.5 size-5 shrink-0" /><div><p className="font-bold">{PRICING_NOTICE}</p>{!compact && <p className="mt-1 text-sm leading-6">{POLICY_NOTICE}</p>}</div></div></aside>;
}
