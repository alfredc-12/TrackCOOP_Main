import assert from "node:assert/strict";
import test from "node:test";
import type { RentalSchedule, RentalService } from "../_types/rental";
import { checkRentalScheduleConflict } from "./rentalConflict";

const service: RentalService = {
  serviceId: "RNT-TRACTOR-001",
  name: "Farm Tractor",
  category: "Farm Equipment",
  shortDescription: "Cooperative farm tractor.",
  description: "Cooperative farm tractor for approved agricultural use.",
  imageUrls: [],
  availability: "Available",
  operationalStatus: "Ready for Use",
  visibility: "Public",
  unitOfUsage: "Operating session",
  suitableActivity: "Land preparation",
  capacity: "Confirmed during review",
  serviceArea: "Nasugbu",
  operatorRequirement: "Assigned operator",
  operationalNotes: "",
  safetyReminders: [],
  upcomingBookings: 1,
  updatedAt: "2026-07-23T08:00:00+08:00",
};

const existing: RentalSchedule = {
  scheduleId: "SCH-TEST-1",
  inquiryId: "RNT-TEST-0001",
  rentalId: "RNT-TEST-0001",
  serviceId: service.serviceId,
  equipmentName: service.name,
  requesterName: "Maria Santos",
  requesterType: "Member",
  date: "2026-08-01",
  endDate: "2026-08-01",
  startTime: "09:00",
  endTime: "11:00",
  assignedOperator: "Operator A",
  serviceLocation: "Barangay Wawa",
  barangay: "Wawa",
  preparationMinutes: 30,
  travelMinutes: 30,
  bufferMinutes: 30,
  status: "Confirmed",
  paymentStatus: "Paid",
};

function candidate(
  overrides: Partial<Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus">> = {},
): Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus"> {
  const base: Omit<
    RentalSchedule,
    "scheduleId" | "status" | "paymentStatus"
  > = {
    inquiryId: "RNT-2026-0099",
    rentalId: "RNT-2026-0099",
    serviceId: service.serviceId,
    equipmentName: service.name,
    requesterName: "Test Requester",
    requesterType: "Public or Non-member" as const,
    date: "2026-08-01",
    endDate: "2026-08-01",
    startTime: "11:45",
    endTime: "13:00",
    assignedOperator: "Operator B",
    serviceLocation: "Barangay Lumbangan",
    barangay: "Lumbangan",
    preparationMinutes: 15,
    travelMinutes: 15,
    bufferMinutes: 15,
  };
  return { ...base, ...overrides };
}

test("blocks overlap caused by preparation and travel time", () => {
  const result = checkRentalScheduleConflict(
    candidate({ startTime: "11:45" }),
    [existing],
    [service],
  );
  assert.equal(result.hasConflict, true);
  assert.equal(result.conflictingSchedules[0]?.scheduleId, existing.scheduleId);
});

test("allows an adjacent booking after the existing buffer", () => {
  const result = checkRentalScheduleConflict(
    candidate({ startTime: "12:00", preparationMinutes: 15, travelMinutes: 15 }),
    [existing],
    [service],
  );
  assert.equal(result.hasConflict, false);
});

test("blocks operator overlap even when the asset differs", () => {
  const result = checkRentalScheduleConflict(
    candidate({
      serviceId: "RNT-PUMP-001",
      equipmentName: "Water Pump",
      startTime: "09:30",
      endTime: "10:30",
      assignedOperator: "Operator A",
    }),
    [existing],
    [{ ...service, serviceId: "RNT-PUMP-001", name: "Water Pump" }],
  );
  assert.equal(result.hasConflict, true);
  assert.match(result.reasons[0] ?? "", /operator/i);
});

test("blocks an asset marked under maintenance", () => {
  const result = checkRentalScheduleConflict(candidate(), [], [
    { ...service, operationalStatus: "Under Maintenance" },
  ]);
  assert.equal(result.hasConflict, true);
  assert.match(result.reasons[0] ?? "", /maintenance/i);
});

test("blocks a booking that starts during an existing multi-day rental", () => {
  const multiDay = {
    ...existing,
    endDate: "2026-08-03",
    endTime: "17:00",
  };
  const result = checkRentalScheduleConflict(
    candidate({
      date: "2026-08-02",
      endDate: "2026-08-02",
      startTime: "08:00",
      endTime: "12:00",
    }),
    [multiDay],
    [service],
  );
  assert.equal(result.hasConflict, true);
});

test("allows a rental after a multi-day booking has ended", () => {
  const multiDay = {
    ...existing,
    endDate: "2026-08-03",
    endTime: "17:00",
  };
  const result = checkRentalScheduleConflict(
    candidate({
      date: "2026-08-04",
      endDate: "2026-08-04",
      startTime: "08:00",
      endTime: "12:00",
    }),
    [multiDay],
    [service],
  );
  assert.equal(result.hasConflict, false);
});
