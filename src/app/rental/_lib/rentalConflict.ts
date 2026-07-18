import type { RentalSchedule, RentalService, ScheduleConflict } from "../_types/rental";

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

export function checkRentalScheduleConflict(
  candidate: Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus"> & { scheduleId?: string },
  schedules: RentalSchedule[],
  services: RentalService[],
): ScheduleConflict {
  const start = minutes(candidate.startTime) - candidate.preparationMinutes;
  const end = minutes(candidate.endTime) + candidate.bufferMinutes;
  const conflicts = schedules.filter((schedule) => {
    if (schedule.scheduleId === candidate.scheduleId || schedule.date !== candidate.date || schedule.status === "Cancelled") return false;
    const existingStart = minutes(schedule.startTime) - schedule.preparationMinutes;
    const existingEnd = minutes(schedule.endTime) + schedule.bufferMinutes;
    const sharedResource = schedule.serviceId === candidate.serviceId ||
      Boolean(candidate.assignedOperator && schedule.assignedOperator === candidate.assignedOperator);
    return sharedResource && start < existingEnd && end > existingStart;
  });
  const service = services.find((item) => item.serviceId === candidate.serviceId);
  const reasons = conflicts.map((item) =>
    item.serviceId === candidate.serviceId
      ? `${item.equipmentName} is already scheduled for ${item.requesterName} from ${item.startTime} to ${item.endTime}.`
      : `The assigned operator has an overlapping schedule from ${item.startTime} to ${item.endTime}.`,
  );
  if (service?.operationalStatus === "Under Maintenance") reasons.push(`${service.name} is under maintenance.`);
  if (service?.availability === "Unavailable") reasons.push(`${service.name} is currently unavailable.`);
  const hasConflict = reasons.length > 0;
  return {
    hasConflict,
    reasons,
    conflictingSchedules: conflicts,
    suggestedSlots: hasConflict ? ["07:00–09:00", "13:00–15:00", "15:30–17:30"] : [],
  };
}
