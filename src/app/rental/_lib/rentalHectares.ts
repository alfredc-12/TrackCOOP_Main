import type { RentalDailyWork, RentalService } from "../_types/rental";

export const TRACTOR_DAILY_HECTARES = 5;
// Existing datetime columns are retained; tractor reservations cover whole work dates.
export const TRACTOR_SCHEDULE_DEFAULTS = {
  startTime: "00:00",
  endTime: "23:59",
  preparationMinutes: 0,
  travelMinutes: 0,
  bufferMinutes: 0,
};

type TractorService = Partial<Pick<RentalService, "name" | "category" | "serviceId">>;
export function isTractorService(service?: TractorService) {
  return Boolean(service && /\btractor\b/i.test(`${service.name ?? ""} ${service.category ?? ""} ${(service.serviceId ?? "").replace(/[_-]/g, " ")}`));
}

export function workDateKeys(start: string, end: string) {
  const dates: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return dates;
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  // The booking form allows dates up to two years ahead. Bound iteration for API input.
  for (; cursor <= last && dates.length < 1100; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export function totalWorkHectares(work?: RentalDailyWork[]) {
  return Math.round((work ?? []).reduce((total, day) => total + day.hectares, 0) * 100) / 100;
}

export function dailyWorkError(work: RentalDailyWork[] | undefined, start: string, end: string) {
  if (!work?.length) return "Enter the hectares to work on at least one date.";
  const dates = workDateKeys(start, end);
  const seen = new Set<string>();
  for (const day of work) {
    if (!dates.includes(day.date) || seen.has(day.date)) return "Work dates must be unique and within the selected rental period.";
    if (!Number.isFinite(day.hectares) || day.hectares <= 0 || day.hectares > TRACTOR_DAILY_HECTARES || Math.abs(day.hectares * 100 - Math.round(day.hectares * 100)) > 0.000001) {
      return "Enter more than 0 and at most 5 hectares per work date, using up to two decimal places.";
    }
    seen.add(day.date);
  }
  return undefined;
}

// Older bookings have no area recorded. Reserve their entire dates without changing their price.
export function reservedWork(work: RentalDailyWork[] | undefined, start: string, end: string) {
  return work?.length ? work : workDateKeys(start, end).map((date) => ({ date, hectares: TRACTOR_DAILY_HECTARES }));
}

export function shiftDailyWork(work: RentalDailyWork[] | undefined, from: string, to: string) {
  if (!work?.length || !from || !to) return work;
  const offset = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  if (!Number.isFinite(offset)) return work;
  return work.map((day) => ({ ...day, date: new Date(new Date(`${day.date}T00:00:00Z`).getTime() + offset).toISOString().slice(0, 10) }));
}

export function formatWorkShiftAssignments(work?: RentalDailyWork[]) {
  return (work ?? []).filter((day) => day.shift)
    .map((day) => `${day.date}: ${day.shift}`).join("; ");
}

export function workShiftLabel(day: RentalDailyWork) {
  return day.shift ?? (day.preferredShift ? `Prefers ${day.preferredShift}` : "");
}
