"use client";

import { useState } from "react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type { PublicRentalBlockedDate, RentalDailyWork } from "../_types/rental";
import { totalWorkHectares, workDateKeys, workShiftLabel } from "../_lib/rentalHectares";

export function TractorWorkPlan({
  startDate, endDate, value = [], onChange, availability, error,
  allowShiftAssignment = false, allowShiftPreference = false,
}: {
  startDate: string;
  endDate: string;
  value?: RentalDailyWork[];
  onChange: (work: RentalDailyWork[]) => void;
  availability?: PublicRentalBlockedDate[];
  error?: string;
  allowShiftAssignment?: boolean;
  allowShiftPreference?: boolean;
}) {
  const [hectareDraft, setHectareDraft] = useState<{ date: string; text: string; hectares?: number } | null>(null);
  const dates = workDateKeys(startDate, endDate);
  const visibleWork = value.filter((day) => dates.includes(day.date));
  const hasShift = allowShiftAssignment || allowShiftPreference;
  const total = totalWorkHectares(visibleWork);

  return (
    <fieldset className="mt-4 overflow-hidden rounded-2xl border border-[#d7e2dc] bg-white">
      <legend className="ml-4 px-2 text-sm font-extrabold text-[#123d2a]">Your work plan</legend>
      <div className="px-4 pb-3 pt-1">
        <p className="text-xs leading-5 text-[#6b786f]">
          Enter hectares for each date. Use 0 to skip a day. Up to 5 hectares per tractor daily.
        </p>
        {allowShiftPreference ? <p className="mt-1 text-xs font-semibold leading-5 text-[#365f4a]">AM/PM is a preference. NFFAC confirms the final shift and operator.</p> : null}
        {allowShiftAssignment ? <p className="mt-1 text-xs leading-5 text-[#6b786f]">Several customers can share a shift within the combined daily limit.</p> : null}
      </div>
      <div className="max-h-80 divide-y divide-[#e5ece7] overflow-y-auto">
        {dates.map((date) => {
          const availabilityDay = availability?.find((day) => day.date === date);
          const remaining = availabilityDay ? availabilityDay.remainingHectares ?? 0 : 5;
          const workDay = value.find((day) => day.date === date);
          const dateLabel = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
          const shiftValue = allowShiftAssignment ? workDay?.shift : workDay?.preferredShift;
          const emptyShift = allowShiftAssignment ? "Not assigned" : "Any time";

          return (
            <div key={date} className={`grid grid-cols-2 items-end gap-3 px-4 py-3 ${hasShift ? "sm:grid-cols-[minmax(0,1fr)_7rem_10rem]" : "sm:grid-cols-[minmax(0,1fr)_9rem]"} ${remaining === 0 ? "bg-[#f6f7f4]" : "bg-white"}`}>
              <div className="col-span-2 self-center sm:col-span-1">
                <p className="text-sm font-bold text-[#123d2a]">{dateLabel}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${remaining === 0 ? "bg-[#e8ebe7] text-[#6b786f]" : "bg-[#edf6ee] text-[#365f4a]"}`}>
                  {availability === undefined ? "Max. 5 ha" : remaining === 0 ? "Unavailable" : `${remaining} ha available`}
                </span>
              </div>
              <label className={`grid min-w-0 gap-1.5 text-xs font-semibold text-[#334b3d] ${hasShift ? "" : "col-span-2 sm:col-span-1"}`}>
                <span>Hectares</span>
                <input type="number" min="0" max={remaining} step="0.01" inputMode="decimal" aria-label={`Hectares on ${date}`} aria-invalid={Boolean(error)} disabled={remaining === 0} placeholder="0" value={hectareDraft?.date === date && hectareDraft.hectares === workDay?.hectares ? hectareDraft.text : workDay?.hectares ?? ""}
                  onBlur={() => setHectareDraft(null)}
                  onChange={(event) => {
                    const text = event.target.value;
                    const hectares = Number(text);
                    setHectareDraft({ date, text, hectares: hectares > 0 ? hectares : undefined });
                    const next = value.filter((day) => day.date !== date && dates.includes(day.date));
                    onChange((hectares > 0 ? [...next, { ...workDay, date, hectares }] : next).sort((a, b) => a.date.localeCompare(b.date)));
                  }}
                  className="min-h-11 w-full rounded-xl border border-[#cfd9d2] bg-white px-3 py-2 text-sm outline-none focus:border-[#168046] focus:ring-2 focus:ring-[#168046]/20 disabled:bg-[#f0f2ef]" />
              </label>
              {hasShift ? <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#334b3d]">
                <span>{allowShiftAssignment ? "Assigned shift" : "Preferred shift"} <span className="font-normal text-[#7a877f]">(optional)</span></span>
                <StyledSelect
                  aria-label={`${allowShiftAssignment ? "Shift" : "Preferred shift"} on ${date}`}
                  value={shiftValue ?? emptyShift}
                  options={[emptyShift, "AM", "PM"]}
                  disabled={!workDay || remaining === 0}
                  onChange={(shift) => onChange(value.map((day) => day.date === date
                    ? { ...day, [allowShiftAssignment ? "shift" : "preferredShift"]: shift === "AM" || shift === "PM" ? shift : undefined }
                    : day))}
                />
                {allowShiftAssignment && workDay?.preferredShift ? <span className="text-[11px] font-normal text-[#6b786f]">Customer prefers {workDay.preferredShift}</span> : null}
              </label> : null}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[#d7e2dc] bg-[#edf6ee] px-4 py-3 text-sm text-[#123d2a]">
        <span className="font-semibold">{visibleWork.length} work date{visibleWork.length === 1 ? "" : "s"}</span>
        <strong>Total: {total} hectare{total === 1 ? "" : "s"}</strong>
      </div>
      {error ? <p role="alert" className="px-4 py-3 text-xs font-semibold text-red-700">{error}</p> : null}
    </fieldset>
  );
}

export function TractorWorkSummary({ value }: { value?: RentalDailyWork[] }) {
  if (!value?.length) return null;
  return <div className="mt-4 rounded-xl border border-[#d7e2dc] bg-[#fbfdfb] p-4 text-sm text-[#123d2a]">
    <h3 className="font-bold">Tractor work: {totalWorkHectares(value)} hectares</h3>
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">{value.map((day) => <div key={day.date} className="flex justify-between gap-3"><dt>{day.date}</dt><dd>{day.hectares} ha{workShiftLabel(day) ? ` · ${workShiftLabel(day)}` : ""}</dd></div>)}</dl>
  </div>;
}
