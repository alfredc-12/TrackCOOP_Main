import { isTractorService, reservedWork, TRACTOR_DAILY_HECTARES } from "./rental-hectares";
import type {
  RentalSchedule,
  RentalService,
  ScheduleConflict,
} from "./rental.types";

function scheduleTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

function scheduleWindows(
  schedule: Pick<RentalSchedule, "date" | "endDate" | "startTime" | "endTime" | "preparationMinutes" | "travelMinutes" | "bufferMinutes" | "dailyWork">,
  perHectare: boolean,
) {
  const periods = perHectare && schedule.dailyWork?.length
    ? schedule.dailyWork.map((day) => ({ date: day.date, endDate: day.date }))
    : [{ date: schedule.date, endDate: schedule.endDate || schedule.date }];
  return periods.map((period) => ({
    start: perHectare ? scheduleTime(period.date, "00:00") : scheduleTime(period.date, schedule.startTime) - (schedule.preparationMinutes + schedule.travelMinutes) * 60_000,
    end: perHectare ? scheduleTime(period.endDate, "00:00") + 86_400_000 : scheduleTime(period.endDate, schedule.endTime) + schedule.bufferMinutes * 60_000,
  }));
}

export function checkRentalScheduleConflict(
  candidate: Omit<
    RentalSchedule,
    "scheduleId" | "status" | "paymentStatus"
  > & { scheduleId?: string },
  schedules: RentalSchedule[],
  services: RentalService[],
): ScheduleConflict {
  const service = services.find((item) => item.serviceId === candidate.serviceId);
  const perHectare = isTractorService(service);
  const candidateWork = reservedWork(candidate.dailyWork, candidate.date, candidate.endDate);
  const windows = scheduleWindows(candidate, perHectare);
  const conflicts = schedules.filter((schedule) => {
    if (
      schedule.scheduleId === candidate.scheduleId ||
      schedule.status === "Cancelled"
    ) {
      return false;
    }
    // Tractor bookings share a daily work queue, up to the area limit below.
    if (perHectare && schedule.serviceId === candidate.serviceId && schedule.status !== "Maintenance") return false;
    if (perHectare && schedule.serviceId === candidate.serviceId && schedule.status === "Maintenance") {
      return candidateWork.some((day) => day.date >= schedule.date && day.date <= schedule.endDate);
    }
    const existingWindows = scheduleWindows(schedule, isTractorService(services.find((item) => item.serviceId === schedule.serviceId)));
    const sharedResource =
      schedule.serviceId === candidate.serviceId ||
      Boolean(
        candidate.assignedOperator &&
          schedule.assignedOperator === candidate.assignedOperator,
      );
    return sharedResource && windows.some((window) => existingWindows.some((existing) => window.start < existing.end && window.end > existing.start));
  });
  const reasons = conflicts.map((item) =>
    perHectare
      ? item.serviceId === candidate.serviceId
        ? `${item.equipmentName} is unavailable on the selected work dates.`
        : `The assigned operator already has work on the selected dates (${item.date} to ${item.endDate}).`
      : item.serviceId === candidate.serviceId
      ? `${item.equipmentName} is already scheduled for ${item.requesterName} from ${item.date} ${item.startTime} to ${item.endDate} ${item.endTime}.`
      : `The assigned operator has an overlapping schedule from ${item.date} ${item.startTime} to ${item.endDate} ${item.endTime}.`,
  );
  if (perHectare) {
    for (const day of candidateWork) {
      const booked = schedules.filter((item) => item.serviceId === candidate.serviceId && item.scheduleId !== candidate.scheduleId && item.status !== "Cancelled")
        .reduce((total, item) => total + Math.round((reservedWork(item.dailyWork, item.date, item.endDate).find((entry) => entry.date === day.date)?.hectares ?? 0) * 100), 0);
      if (booked + Math.round(day.hectares * 100) > TRACTOR_DAILY_HECTARES * 100) {
        reasons.push(`${service!.name} has only ${Math.max(0, TRACTOR_DAILY_HECTARES - booked / 100)} hectares remaining on ${day.date} (5 hectares per day maximum).`);
        for (const item of schedules.filter((item) => item.serviceId === candidate.serviceId && item.scheduleId !== candidate.scheduleId && item.status !== "Cancelled" && reservedWork(item.dailyWork, item.date, item.endDate).some((entry) => entry.date === day.date))) {
          if (!conflicts.includes(item)) conflicts.push(item);
        }
      }
    }
  }
  if (service?.operationalStatus === "Under Maintenance") {
    reasons.push(`${service.name} is under maintenance.`);
  }
  if (service?.availability === "Unavailable") {
    reasons.push(`${service.name} is currently unavailable.`);
  }
  const hasConflict = reasons.length > 0;
  return {
    hasConflict,
    reasons,
    conflictingSchedules: conflicts,
    suggestedSlots:
      hasConflict && !perHectare && candidate.date === candidate.endDate
        ? ["07:00–09:00", "13:00–15:00", "15:30–17:30"]
        : [],
  };
}
