"use client";

import { cropActivities, livelihoodActivities, manilaDateKey, type MemberLivelihood } from "./livelihoods";

export function LivelihoodFields({ value, occupation, error, onChange }: {
  value: MemberLivelihood[];
  occupation: string;
  error?: string;
  onChange: (value: MemberLivelihood[]) => void;
}) {
  const occupations = occupation.split("; ");
  const suggested = (activity: string) =>
    (cropActivities.includes(activity) && occupations.some((item) => ["Farmer", "Agricultural worker"].includes(item))) ||
    (activity === "Livestock" && occupations.includes("Livestock raiser")) ||
    (activity === "Poultry" && occupations.includes("Poultry raiser")) ||
    (activity === "Fishing" && occupations.includes("Fisherfolk")) ||
    (activity === "Aquaculture" && occupations.includes("Aquaculture worker"));
  const options = [...livelihoodActivities].sort((a, b) => Number(suggested(b)) - Number(suggested(a)));
  const custom = value.filter((item) => !livelihoodActivities.includes(item.activity));

  return (
    <fieldset id="my-livelihoods" tabIndex={-1} className="scroll-mt-32 border-t border-[#EDF2EA] pt-4 outline-none" aria-describedby={`livelihood-help${error ? " livelihood-error" : ""}`}>
      <legend className="pt-4 text-base font-bold text-[#173626]">My Crops & Livelihoods</legend>
      <p id="livelihood-help" className="mt-1 text-sm text-[#6B7280]">Select everything you grow, raise, or do. Choices related to your occupation appear first.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((activity) => {
          const checked = value.some((item) => item.activity === activity);
          return <label key={activity} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-[#365F4A] ${checked ? "border-[#91B99A] bg-[#EAF3E8]" : "border-[#DDE8D8] bg-white"}`}><input type="checkbox" className="size-5 shrink-0 accent-[#1F6B43]" checked={checked} onChange={(event) => onChange(event.target.checked ? [...value, { activity }] : value.filter((item) => item.activity !== activity))} />{activity}</label>;
        })}
      </div>
      <label className="mt-3 block text-sm font-semibold text-[#365F4A]">Other crop or livelihood (optional)
        <input value={custom.map((item) => item.activity).join("; ")} maxLength={80} onChange={(event) => onChange([...value.filter((item) => livelihoodActivities.includes(item.activity)), ...(event.target.value ? [{ activity: event.target.value }] : [])])} placeholder="For example, coconut growing" className="mt-1 min-h-11 w-full rounded-xl border border-[#DDE8D8] px-3 text-sm outline-none focus:border-[#2F7D57]" />
      </label>
      {value.some((item) => cropActivities.includes(item.activity)) && <div className="mt-3 rounded-xl bg-[#F5F8F1] p-3"><p className="text-sm font-semibold text-[#365F4A]">Planting dates (optional)</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">Use the current crop cycle. For rice, enter the sowing date, not the transplanting date. Update after a new planting.</p><div className="mt-2 grid gap-3 sm:grid-cols-2">
        {value.filter((item) => cropActivities.includes(item.activity)).map((item) => <label key={item.activity} className="text-sm font-medium text-[#365F4A]">{item.activity} sowing date<input type="date" min="1900-01-01" max={manilaDateKey()} value={item.plantingDate ?? ""} onChange={(event) => onChange(value.map((entry) => entry.activity === item.activity ? { activity: entry.activity, ...(event.target.value ? { plantingDate: event.target.value } : {}) } : entry))} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[#DDE8D8] bg-white px-3 text-sm" /></label>)}
      </div></div>}
      {error && <p id="livelihood-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}
