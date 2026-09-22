import assert from "node:assert/strict";
import test from "node:test";
import { estimateRentalFee } from "./rentalEstimate";
import {
  BookingSchema,
  normalizePhilippineMobile,
  RentalSubmissionSchema,
  rentalRescheduleSchema,
  rentalScheduleSchema,
  rentalServiceSchema,
} from "./rentalValidation";

const validInquiry = {
  fullName: "Integration Test Requester",
  requesterType: "Public or Non-member" as const,
  contactNumber: "09181234567",
  email: "requester@example.com",
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
  validIdType: "Philippine National ID" as const,
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

test("validates requester contact, required email, and valid ID type", () => {
  assert.equal(
    normalizePhilippineMobile("+63 918 123 4567"),
    normalizePhilippineMobile("09181234567"),
  );
  assert.equal(
    BookingSchema.safeParse({
      ...validInquiry,
      contactNumber: "+639181234567",
      email: "requester@example.com",
    }).success,
    true,
  );
  assert.equal(
    BookingSchema.safeParse({
      ...validInquiry,
      contactNumber: "12345",
    }).success,
    false,
  );
  assert.equal(
    BookingSchema.safeParse({
      ...validInquiry,
      contactNumber: "639181234567",
    }).success,
    false,
  );
  assert.equal(
    BookingSchema.safeParse({
      ...validInquiry,
      email: "",
    }).success,
    false,
  );
  assert.equal(
    BookingSchema.safeParse({
      ...validInquiry,
      email: "not-an-email",
    }).success,
    false,
  );
  assert.equal(
    BookingSchema.safeParse({
      ...validInquiry,
      validIdType: "School ID",
    }).success,
    false,
  );
});

test("computes an automatic possible rental fee from the date range and requester type", () => {
  assert.deepEqual(
    estimateRentalFee({
      service: {
        standardRate: 300,
        memberRate: null,
        nonMemberRate: null,
      },
      requesterType: "Member",
      startDate: "2099-08-01",
      endDate: "2099-08-03",
    }),
    {
      days: 3,
      originalDailyRate: 300,
      dailyRate: 240,
      discountPercent: 20,
      discountAmount: 60,
      rateLabel: "Member discounted rate",
      total: 720,
      currency: "PHP",
    },
  );
});

test("requires protected valid ID metadata for persisted rental submissions", () => {
  assert.equal(RentalSubmissionSchema.safeParse(validInquiry).success, false);
  assert.equal(
    RentalSubmissionSchema.safeParse({
      ...validInquiry,
      validIdDocument: {
        originalFileName: "national-id.pdf",
        storagePath: "public/uploads/rental-valid-ids/2099/id.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 512,
        checksumSha256: "a".repeat(64),
      },
    }).success,
    true,
  );
});

test("requires a public rental asset photo and one rental rate", () => {
  const asset = {
    serviceId: "RNT-TRACTOR-001",
    name: "Farm Tractor",
    category: "Land Preparation",
    shortDescription: "Tractor for farm rental",
    description: "Tractor for farm rental requests.",
    imageUrl: "",
    imageUrls: [],
    availability: "Available" as const,
    operationalStatus: "Ready for Use" as const,
    visibility: "Public" as const,
    unitOfUsage: "day",
    capacity: "Standard",
    standardRate: null,
  };

  const missing = rentalServiceSchema.safeParse(asset);
  assert.equal(missing.success, false);
  assert.deepEqual(
    missing.success ? [] : missing.error.issues.map((issue) => issue.message),
    ["Upload at least one photo.", "Enter the rental rate."],
  );

  assert.equal(
    rentalServiceSchema.safeParse({
      ...asset,
      imageUrls: ["/uploads/rentals/tractor.jpg"],
      standardRate: 300,
    }).success,
    true,
  );
});
