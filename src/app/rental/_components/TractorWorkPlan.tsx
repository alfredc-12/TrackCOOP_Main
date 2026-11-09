"use client";

import type { PublicRentalBlockedDate, RentalDailyWork } from "../_types/rental";
import { totalWorkHectares, workDateKeys } from "../_lib/rentalHectares";

export function TractorWorkPlan({ startDate, endDate, value = [], onChange, availability, error }: {
  startDate: string;
  endDate: string;
  value?: RentalDailyWork[];
  onChange: (work: RentalDailyWork[]) => void;
  availability?: PublicRentalBlockedDate[];
  error?: string;
}) {
  const dates = workDateKeys(startDate, endDate);
  return (
    <fieldset className="mt-4 rounded-xl border border-[#d7e2dc] bg-[#fbfdfb] p-4">
      <legend className="px-1 text-sm font-bold text-[#123d2a]">Tractor work per date</legend>
      <p className="mb-3 text-xs text-[#6b786f]">Maximum 5 hectares per tractor per day across approved bookings. Enter 0 for dates with no work. Partial hectares are allowed.</p>
      <div className="grid max-h-72 gap-3 overflow-y-auto sm:grid-cols-2">
        {dates.map((date) => {
          const availabilityDay = availability?.find((day) => day.date === date);
          const remaining = availabilityDay ? availabilityDay.remainingHectares ?? 0 : 5;
          return <label key={date} className="grid gap-1 text-sm font-semibold text-[#334b3d]">
            <span>{date}</span>
            <input type="number" min="0" max={remaining} step="0.01" inputMode="decimal" aria-label={`Hectares on ${date}`} aria-invalid={Boolean(error)} disabled={remaining === 0} value={value.find((day) => day.date === date)?.hectares ?? 0}
              onChange={(event) => {
                const hectares = Number(event.target.value);
                const next = value.filter((day) => day.date !== date && dates.includes(day.date));
                onChange((hectares > 0 ? [...next, { date, hectares }] : next).sort((a, b) => a.date.localeCompare(b.date)));
              }}
              className="min-h-11 w-full rounded-xl border border-[#cfd9d2] bg-white px-3 py-2 text-sm outline-none focus:border-[#168046] focus:ring-2 focus:ring-[#168046]/20 disabled:bg-[#f4f6f2]" />
            <span className="text-xs font-normal text-[#6b786f]">{availability === undefined ? "Maximum 5 hectares per day" : remaining === 0 ? "Unavailable" : `${remaining} hectares available`}</span>
          </label>;
        })}
      </div>
      <p className="mt-3 text-sm font-bold text-[#123d2a]">Total: {totalWorkHectares(value.filter((day) => dates.includes(day.date)))} hectares</p>
      {error ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
    </fieldset>
  );
}

export function TractorWorkSummary({ value }: { value?: RentalDailyWork[] }) {
  if (!value?.length) return null;
  return <div className="mt-4 rounded-xl border border-[#d7e2dc] bg-[#fbfdfb] p-4 text-sm text-[#123d2a]">
    <h3 className="font-bold">Tractor work: {totalWorkHectares(value)} hectares</h3>
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">{value.map((day) => <div key={day.date} className="flex justify-between gap-3"><dt>{day.date}</dt><dd>{day.hectares} ha</dd></div>)}</dl>
  </div>;
}
