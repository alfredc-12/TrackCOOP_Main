"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { getSeasonGuide, manilaDateKey, type MemberLivelihood } from "./livelihoods";

export function SeasonGuide({ livelihoods, province, municipality, onEdit, onFinancial }: {
  livelihoods: MemberLivelihood[];
  province: string;
  municipality: string;
  onEdit: () => void;
  onFinancial: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const item = livelihoods.find((entry) => entry.activity === selected) ?? livelihoods[0];
  const guide = item ? getSeasonGuide(item, province) : null;
  const editLivelihoods = () => { setOpen(false); onEdit(); };
  const viewFinances = () => { setOpen(false); onFinancial(); };
  return (
    <Modal title="Season Guide" description="A simple guide for your crops and livelihoods." maxWidth="max-w-3xl" open={open} onOpenChange={setOpen} trigger={
      <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#A8C7AE] bg-[#EAF3DF] px-3 text-xs font-bold text-[#123D2A] transition hover:bg-[#DCECCB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7D57]"><span aria-hidden="true">🌱</span>Season Guide<ArrowRight className="size-3.5" aria-hidden="true" /></button>
    }>
      {guide && item ? <div className="space-y-4">
        <div role="group" aria-label="Choose a crop or livelihood" className="flex flex-wrap gap-2">
          {livelihoods.map((entry) => <button type="button" key={entry.activity} aria-pressed={entry.activity === item.activity} onClick={() => setSelected(entry.activity)} className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7D57] ${entry.activity === item.activity ? "border-[#123D2A] bg-[#123D2A] text-white" : "border-[#DDE8D8] bg-[#F5F8F1] text-[#365F4A] hover:bg-[#EAF3E8]"}`}><span aria-hidden="true">{activityEmoji(entry.activity)}</span><span className="break-words">{entry.activity}</span></button>)}
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-[#123D2A] to-[#286346] p-4 text-white sm:p-5" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl" aria-hidden="true">{activityEmoji(item.activity)}</span>
            <div className="min-w-0"><h3 className="break-words text-xl font-bold">{item.activity}</h3><p className="mt-1 text-sm font-semibold text-[#E7EFBD]">{guide.stage}</p></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/80">{[municipality, province].filter(Boolean).join(", ") || "Location not provided"} · {manilaDateKey()} (Philippine time)</p>
          <p className="mt-1 text-xs leading-5 text-white/80">Typical guidance or crop-age estimate. Your actual results may differ.</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {([
            { label: "Production", emoji: "🌱", text: guide.production, tone: "border-[#DDE8D8] bg-[#F2F8EE]" },
            { label: "Sales", emoji: "🛒", text: guide.sales, tone: "border-[#DAE7EF] bg-[#F0F6FA]" },
            { label: "Income", emoji: "💰", text: guide.income, tone: "border-[#EBE3C9] bg-[#FFF9E9]" },
            { label: "Expenses", emoji: "🧾", text: guide.expenses, tone: "border-[#EDDCCF] bg-[#FFF4EB]" },
          ]).map((entry) => <div key={entry.label} className={`rounded-2xl border p-4 ${entry.tone}`}><dt className="flex items-center gap-2 text-sm font-bold text-[#173626]"><span className="text-xl" aria-hidden="true">{entry.emoji}</span><span>{entry.label}</span></dt><dd className="mt-2 text-sm leading-6 text-[#52705D]">{entry.text}</dd></div>)}
        </dl>
        <details key={item.activity} className="rounded-xl border border-[#DDE8D8] bg-white p-3 text-sm text-[#52705D]">
          <summary className="min-h-7 cursor-pointer font-semibold text-[#365F4A]">How this guide works</summary>
          <p className="mt-2 leading-6">{guide.basis}</p>
          {guide.sources.length > 0 && <div className="mt-3"><p className="text-xs font-bold text-[#52705D]">Guide references</p>{guide.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs leading-5 text-[#1F6B43] underline">{source.title}</a>)}</div>}
          <p className="mt-3 text-xs leading-5">This guide does not show your actual production, sales, income, or expenses.</p>
        </details>
        <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={editLivelihoods} className="min-h-11 rounded-xl border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#F5F8F1]">Edit My Crops</button><button type="button" onClick={viewFinances} className="min-h-11 rounded-xl bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]">View My Finances</button></div>
      </div> : <div className="rounded-2xl border border-[#DDE8D8] bg-[#F2F8EE] p-6 text-center">
        <span className="text-5xl" aria-hidden="true">🌱</span><h3 className="mt-4 text-xl font-bold text-[#173626]">What do you grow or raise?</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#52705D]">Add your crops and livelihoods to see relevant seasonal guidance.</p>
        <button type="button" onClick={editLivelihoods} className="mt-5 min-h-11 rounded-xl bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]">Add My Crops & Livelihoods</button>
      </div>}
    </Modal>
  );
}

function activityEmoji(activity: string) {
  const emojis: Record<string, string> = { Sugarcane: "🌱", Rice: "🌾", Corn: "🌽", Vegetables: "🥬", Livestock: "🐄", Poultry: "🐔", Fishing: "🎣", Aquaculture: "🐟" };
  return emojis[activity] ?? "🌿";
}
