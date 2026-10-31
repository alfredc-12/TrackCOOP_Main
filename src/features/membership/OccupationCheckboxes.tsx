"use client";

const occupationOptions = [
  "Farmer",
  "Fisherfolk",
  "Livestock raiser",
  "Poultry raiser",
  "Aquaculture worker",
  "Agricultural worker",
  "Fish vendor",
  "Entrepreneur",
  "Government employee",
  "Private employee",
  "Self-employed",
  "Student",
  "Retired",
  "Unemployed",
] as const;

export function OccupationCheckboxes({ value, error, onChange, compact = false }: {
  compact?: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const entries = value.split("; ").filter(Boolean);
  const selected = occupationOptions.filter((option) => entries.includes(option));
  const other = entries.filter((entry) => !occupationOptions.some((option) => option === entry)).join("; ");
  const update = (choices: readonly string[], custom: string) => {
    onChange([...choices, custom].filter(Boolean).join("; "));
  };

  return (
    <fieldset className="min-w-0 md:col-span-2" aria-describedby={`occupation-help${error ? " occupation-error" : ""}`} aria-invalid={Boolean(error)}>
      <legend className="text-sm font-semibold text-[#365F4A]">Occupation — select all that apply</legend>
      <p id="occupation-help" className="mt-1 text-sm text-[#6C7A70]">Choose at least one. You can choose more than one job.</p>
      <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${compact ? "lg:grid-cols-3" : ""}`}>
        {occupationOptions.map((option) => (
          <label key={option} className={`flex ${compact ? "min-h-10" : "min-h-12"} cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold text-[#365F4A] transition ${selected.includes(option) ? "border-[#91B99A] bg-[#EAF3E8]" : "border-[#DDE8D8] bg-white hover:border-[#9FB7A4]"}`}>
            <input type="checkbox" checked={selected.includes(option)} onChange={(event) => update(event.target.checked ? [...selected, option] : selected.filter((entry) => entry !== option), other)} className="size-5 shrink-0 accent-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]" />
            {option}
          </label>
        ))}
      </div>
      <label className="mt-4 block text-sm font-semibold text-[#365F4A]">
        Other occupation (optional)
        <input type="text" value={other} onChange={(event) => update(selected, event.target.value)} placeholder="Enter another occupation" className="mt-2 min-h-11 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" />
      </label>
      {error && <p id="occupation-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}

