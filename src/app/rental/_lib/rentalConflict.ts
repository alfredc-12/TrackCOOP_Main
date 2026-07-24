import type {
  RentalSchedule,
  RentalService,
  ScheduleConflict,
} from "../_types/rental";

function scheduleTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

export function checkRentalScheduleConflict(
  candidate: Omit<
    RentalSchedule,
    "scheduleId" | "status" | "paymentStatus"
  > & { scheduleId?: string },
  schedules: RentalSchedule[],
  services: RentalService[],
): ScheduleConflict {
  const start =
    scheduleTime(candidate.date, candidate.startTime) -
    (candidate.preparationMinutes + candidate.travelMinutes) * 60_000;
  const end =
    scheduleTime(candidate.endDate, candidate.endTime) +
    candidate.bufferMinutes * 60_000;
  const conflicts = schedules.filter((schedule) => {
    if (
      schedule.scheduleId === candidate.scheduleId ||
      schedule.status === "Cancelled"
    ) {
      return false;
    }
    const existingStart =
      scheduleTime(schedule.date, schedule.startTime) -
      (schedule.preparationMinutes + schedule.travelMinutes) * 60_000;
    const existingEnd =
      scheduleTime(schedule.endDate || schedule.date, schedule.endTime) +
      schedule.bufferMinutes * 60_000;
    const sharedResource =
      schedule.serviceId === candidate.serviceId ||
      Boolean(
        candidate.assignedOperator &&
          schedule.assignedOperator === candidate.assignedOperator,
      );
    return sharedResource && start < existingEnd && end > existingStart;
  });
  const service = services.find(
    (item) => item.serviceId === candidate.serviceId,
  );
  const reasons = conflicts.map((item) =>
    item.serviceId === candidate.serviceId
      ? `${item.equipmentName} is already scheduled for ${item.requesterName} from ${item.date} ${item.startTime} to ${item.endDate} ${item.endTime}.`
      : `The assigned operator has an overlapping schedule from ${item.date} ${item.startTime} to ${item.endDate} ${item.endTime}.`,
  );
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
      hasConflict && candidate.date === candidate.endDate
        ? ["07:00–09:00", "13:00–15:00", "15:30–17:30"]
        : [],
  };
}
