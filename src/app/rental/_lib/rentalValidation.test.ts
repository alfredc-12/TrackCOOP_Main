import assert from "node:assert/strict";
import test from "node:test";
import {
  BookingSchema,
  rentalRescheduleSchema,
  rentalScheduleSchema,
} from "./rentalValidation";

const validInquiry = {
  fullName: "Integration Test Requester",
  requesterType: "Public or Non-member" as const,
  contactNumber: "09181234567",
  email: "",
  completeAddress: "Barangay Wawa, Nasugbu, Batangas",
  barangay: "Wawa",
  municipality: "Nasugbu",
  serviceId: "RNT-TRACTOR-001",
  intendedUse: "Land preparation",
  preferredDate: "2099-08-01",
  preferredEndDate: "2099-08-03",
  preferredStartTime: "08:00",
  preferredEndTime: "17:00",
  requestDescription: "Prepare agricultural land for planting.",
  notes: "",
  attachmentName: "",
  membershipProofName: "",
  dataPrivacyConsent: true,
  accuracyConfirmation: true,
  contactConsent: true,
};

test("requires all three inquiry declarations", () => {
  const result = BookingSchema.safeParse({
    ...validInquiry,
    accuracyConfirmation: false,
  });
  assert.equal(result.success, false);
});

test("accepts a UUID idempotency key", () => {
  const result = BookingSchema.safeParse({
    ...validInquiry,
    clientRequestId: "4f4ab6a7-1208-4b9a-aafe-cdfa474d6160",
  });
  assert.equal(result.success, true);
});

test("rejects a schedule whose end is not after its start", () => {
  const result = rentalScheduleSchema.safeParse({
    rentalId: "RNT-2026-0001",
    serviceId: "RNT-TRACTOR-001",
    date: "2099-08-01",
    endDate: "2099-08-01",
    startTime: "10:00",
    endTime: "09:00",
    preparationMinutes: 0,
    travelMinutes: 0,
    bufferMinutes: 0,
    serviceLocation: "Barangay Wawa",
  });
  assert.equal(result.success, false);
});

test("validates a structured member reschedule request", () => {
  assert.equal(
    rentalRescheduleSchema.safeParse({
      requestedDate: "2099-08-03",
      requestedEndDate: "2099-08-05",
      alternativeDate: "2099-08-07",
      alternativeEndDate: "2099-08-08",
      reason: "Heavy rain delayed land preparation.",
      note: "Morning is preferred.",
    }).success,
    true,
  );
  assert.equal(
    rentalRescheduleSchema.safeParse({
      requestedDate: "2099-08-03",
      requestedEndDate: "2099-08-05",
      alternativeDate: "2099-08-03",
      alternativeEndDate: "2099-08-05",
      reason: "Heavy rain delayed land preparation.",
    }).success,
    false,
  );
});

test("accepts a multi-day inquiry and rejects a reversed date range", () => {
  assert.equal(BookingSchema.safeParse(validInquiry).success, true);
  assert.equal(
    BookingSchema.safeParse({
      ...validInquiry,
      preferredEndDate: "2099-07-31",
    }).success,
    false,
  );
});
