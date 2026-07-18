import type { LucideIcon } from "lucide-react";

export function RentalMetricCard({ label, value, note, icon: Icon }: { label: string; value: string | number; note?: string; icon: LucideIcon }) {
  return <article className="rounded-2xl border border-[#dce7d6] bg-white p-5 shadow-[0_8px_24px_rgba(18,61,42,0.06)]"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#66756c]">{label}</p><p className="mt-2 text-2xl font-extrabold text-[#123d2a]">{value}</p>{note && <p className="mt-1 text-xs text-[#75837a]">{note}</p>}</div><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf3e8] text-[#1f6b43]"><Icon className="size-5" /></span></div></article>;
}
