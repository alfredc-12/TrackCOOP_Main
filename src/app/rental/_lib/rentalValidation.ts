import { z } from "zod";
import { VALID_ID_TYPES } from "../_types/rental";
import { MAX_RENTAL_ASSET_PHOTOS } from "./rentalPhotos";

export const PHILIPPINE_MOBILE_PATTERN = /^(?:\+63|0)9\d{9}$/;
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

export function normalizePhilippineMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("63") ? `0${digits.slice(2)}` : digits;
}
const optionalText = z.string().trim();
const validIdDocumentSchema = z.object({
  originalFileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().startsWith("public/uploads/rental-valid-ids/"),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  fileSizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const requiredConsent = z
  .boolean()
  .refine((value) => value, "This confirmation is required.");

export const BookingSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter the requester's full name.")
      .max(120, "Name must be 120 characters or fewer.")
      .regex(PERSON_NAME_PATTERN, "Use letters, spaces, apostrophes, or hyphens only."),
    requesterType: z.enum(["Member", "Public or Non-member"]),
    contactNumber: z
      .string()
      .trim()
      .transform(normalizePhilippineMobile)
      .refine((value) => PHILIPPINE_MOBILE_PATTERN.test(value), "Enter a Philippine mobile number beginning with +63 9, for example +63 917 123 4567."),
    email: z
      .string()
      .trim()
      .max(190, "Email address is too long.")
      .refine(
        (value) => !value || z.email().safeParse(value).success,
        "Enter a valid email address.",
      ),
    completeAddress: z.string().trim().min(5, "Enter the complete address.").max(250, "Address must be 250 characters or fewer."),
    barangay: z.string().trim().min(1, "Select a barangay.").max(100),
    municipality: z.string().trim().min(2, "Enter the municipality.").max(100),
    serviceId: z.string().trim().min(1, "Select equipment or a service.").max(80),
    intendedUse: z.string().trim().min(5, "Tell us what farm work the equipment will be used for.").max(160, "Farm use must be 160 characters or fewer."),
    preferredDate: z.iso.date("Choose a preferred start date."),
    preferredEndDate: z.iso.date("Choose a preferred end date."),
    preferredStartTime: z.string().min(1, "Choose a preferred start time."),
    preferredEndTime: z.string().min(1, "Choose a preferred end time."),
    requestDescription: z.string().trim().min(5, "Tell us what farm work the equipment will be used for.").max(500),
    notes: optionalText.max(500, "Notes must be 500 characters or fewer."),
    validIdType: z.string().refine(
      (value) => VALID_ID_TYPES.includes(value as (typeof VALID_ID_TYPES)[number]),
      "Select the valid ID you are providing.",
    ),
    attachmentName: optionalText.max(255),
    membershipProofName: optionalText.max(255),
    clientRequestId: z.string().uuid().optional(),
    dataPrivacyConsent: requiredConsent,
    accuracyConfirmation: requiredConsent,
    contactConsent: requiredConsent,
    preferredPaymentMethod: z.enum(["Cash", "Online"]).optional(),
  })
  .superRefine((data, context) => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    if (data.preferredDate < todayKey) {
      context.addIssue({
        code: "custom",
        message: "Preferred start date cannot be in the past.",
        path: ["preferredDate"],
      });
    }
    if (data.preferredEndDate < data.preferredDate) {
      context.addIssue({
        code: "custom",
        message: "Preferred end date cannot be before the start date.",
        path: ["preferredEndDate"],
      });
    }
    if (
      data.preferredEndDate === data.preferredDate &&
      data.preferredEndTime <= data.preferredStartTime
    ) {
      context.addIssue({
        code: "custom",
        message: "End time must be after the start time for a same-day rental.",
        path: ["preferredEndTime"],
      });
    }

  });

export const RentalSubmissionSchema = BookingSchema.safeExtend({
  validIdDocument: validIdDocumentSchema,
});

export type BookingFormValues = z.infer<typeof BookingSchema>;

const rentalAssetPhotoUrlSchema = z.string().trim().min(1).max(500);
const assetRequiredText = (label: string, minimum = 2, maximum = 190) =>
  z.string().trim().min(minimum, `Enter ${label}.`).max(maximum, `${label} must be ${maximum} characters or fewer.`);
const assetOptionalText = (maximum: number) =>
  z.string().trim().max(maximum, `Use ${maximum} characters or fewer.`).optional();
const optionalDate = z.union([z.literal(""), z.iso.date()]).optional();
const optionalTime = z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid time.")]).optional();
const rentalWeekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const rentalServiceSchema = z
  .object({
    serviceId: z
      .string()
      .trim()
      .min(3, "Enter the asset code.")
      .max(80)
      .regex(
        /^[A-Z0-9][A-Z0-9_-]*$/,
        "Use uppercase letters, numbers, hyphens, or underscores.",
      ),
    name: assetRequiredText("the asset name"),
    category: assetRequiredText("a category", 2, 120),
    shortDescription: z
      .string()
      .trim()
      .min(5, "Enter a short description.")
      .max(500),
    description: assetRequiredText("a clear description", 5, 2000),
    imageUrl: z.string().trim().max(500).optional(),
    imageUrls: z
      .array(rentalAssetPhotoUrlSchema)
      .max(MAX_RENTAL_ASSET_PHOTOS, "Upload up to 5 photos only.")
      .optional(),
    availability: z.enum(
      ["Available", "Limited Availability", "Unavailable", "By Schedule Only"],
      "Choose a valid availability.",
    ),
    operationalStatus: z.enum(
      ["Ready for Use", "Under Maintenance", "Out of Service", "Archived"],
      "Choose a valid status.",
    ),
    visibility: z.enum(
      ["Public", "Member-only", "Hidden"],
      "Choose a valid status.",
    ),
    unitOfUsage: assetRequiredText("a unit of usage", 1, 80),
    suitableActivity: assetRequiredText("the suitable farm activity", 2, 160),
    capacity: z.string().trim().max(160, "Capacity must be 160 characters or fewer."),
    serviceArea: assetRequiredText("the service area", 2, 190),
    operatorRequirement: assetRequiredText("the operator requirement", 2, 190),
    operationalNotes: z.string().trim().max(2000, "Operating instructions must be 2,000 characters or fewer."),
    safetyReminders: z.array(z.string().trim().min(2).max(300)).max(10, "Add up to 10 safety reminders."),
    lastMaintenanceDate: optionalDate,
    nextMaintenanceDate: optionalDate,
    assetCondition: assetOptionalText(120),
    internalNotes: assetOptionalText(2000),
    availableDays: z.array(z.enum(rentalWeekdays, "Choose valid available days.")).max(7).optional(),
    availableStartTime: optionalTime,
    availableEndTime: optionalTime,
    assignedCustodian: assetOptionalText(190),
    publicTitle: assetOptionalText(190),
    publicDescription: assetOptionalText(1000),
    publicNotes: assetOptionalText(1000),
    publicAvailabilityMessage: assetOptionalText(500),
    gasolineHandling: z.string().trim().max(500).nullable().optional(),
    cancellationPolicy: z.string().trim().max(1000).nullable().optional(),
    reschedulingPolicy: z.string().trim().max(1000).nullable().optional(),
    paymentDeadline: z.string().trim().max(190).nullable().optional(),
    standardRate: z.number().nullable().optional(),
    memberRate: z.number().nullable().optional(),
    nonMemberRate: z.number().nullable().optional(),
    maximumBookingsPerDay: z.number().int().min(1, "Allow at least one booking per day.").max(20).optional(),
    preparationMinutes: z.number().int().min(0).max(1440).optional(),
    travelMinutes: z.number().int().min(0).max(1440).optional(),
    bufferMinutes: z.number().int().min(0).max(1440).optional(),
  })
  .superRefine((service, context) => {
    const photos = [service.imageUrl, ...(service.imageUrls ?? [])].filter(
      (url) => Boolean(url?.trim()),
    );
    const hasRate =
      typeof service.standardRate === "number" && service.standardRate > 0;

    if (service.visibility === "Public" && photos.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Upload at least one photo.",
        path: ["imageUrls"],
      });
    }

    if (typeof service.standardRate === "number" && service.standardRate <= 0) {
      context.addIssue({
        code: "custom",
        message: "Enter the rental rate.",
        path: ["standardRate"],
      });
    }

    if (service.visibility === "Public" && !hasRate) {
      context.addIssue({
        code: "custom",
        message: "Enter the rental rate.",
        path: ["standardRate"],
      });
    }
    if (
      service.availableStartTime &&
      service.availableEndTime &&
      service.availableEndTime <= service.availableStartTime
    ) {
      context.addIssue({
        code: "custom",
        message: "Available end time must be after the start time.",
        path: ["availableEndTime"],
      });
    }
    if (
      service.lastMaintenanceDate &&
      service.nextMaintenanceDate &&
      service.nextMaintenanceDate < service.lastMaintenanceDate
    ) {
      context.addIssue({
        code: "custom",
        message: "Next maintenance cannot be before the last maintenance date.",
        path: ["nextMaintenanceDate"],
      });
    }
    if (
      ["Under Maintenance", "Out of Service", "Archived"].includes(service.operationalStatus) &&
      service.availability !== "Unavailable"
    ) {
      context.addIssue({
        code: "custom",
        message: "An asset under maintenance, out of service, or archived must be unavailable.",
        path: ["availability"],
      });
    }
    if (service.operationalStatus === "Archived" && service.visibility === "Public") {
      context.addIssue({
        code: "custom",
        message: "An archived asset cannot be published.",
        path: ["visibility"],
      });
    }
  });

export const rentalScheduleSchema = z
  .object({
    rentalId: z.string().trim().min(1),
    serviceId: z.string().trim().min(1),
    date: z.iso.date(),
    endDate: z.iso.date(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    preparationMinutes: z.number().int().min(0).max(1440),
    travelMinutes: z.number().int().min(0).max(1440),
    bufferMinutes: z.number().int().min(0).max(1440),
    serviceLocation: z.string().trim().min(3, "Enter the service location.").max(250),
    barangay: z.string().trim().min(2, "Enter the barangay.").max(100),
    assignedOperator: z.string().trim().max(190).optional(),
    specialInstructions: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.endDate >= value.date, {
    message: "Schedule end date cannot be before the start date.",
    path: ["endDate"],
  })
  .refine((value) => value.endDate > value.date || value.endTime > value.startTime, {
    message: "Schedule end time must be after the start time.",
    path: ["endTime"],
  });

export const rentalRescheduleSchema = z
  .object({
    requestedDate: z.iso.date(),
    requestedEndDate: z.iso.date(),
    alternativeDate: z.union([z.literal(""), z.iso.date()]).optional(),
    alternativeEndDate: z.union([z.literal(""), z.iso.date()]).optional(),
    reason: z.string().trim().min(5, "Explain why rescheduling is needed."),
    note: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(
        today.getMonth() + 1,
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (value.requestedDate < todayKey) {
        context.addIssue({
          code: "custom",
          message: "Reschedule dates cannot be in the past.",
          path: ["requestedDate"],
        });
      }
      if (value.requestedEndDate < value.requestedDate) {
        context.addIssue({
          code: "custom",
          message: "Requested end date cannot be before the start date.",
          path: ["requestedEndDate"],
        });
      }
      const hasAlternativeStart = Boolean(value.alternativeDate);
      const hasAlternativeEnd = Boolean(value.alternativeEndDate);
      if (hasAlternativeStart !== hasAlternativeEnd) {
        context.addIssue({
          code: "custom",
          message: "Provide both alternative start and end dates.",
          path: [hasAlternativeStart ? "alternativeEndDate" : "alternativeDate"],
        });
      }
      if (value.alternativeDate && value.alternativeEndDate) {
        if (value.alternativeDate < todayKey) {
          context.addIssue({
            code: "custom",
            message: "Alternative dates cannot be in the past.",
            path: ["alternativeDate"],
          });
        }
        if (value.alternativeEndDate < value.alternativeDate) {
          context.addIssue({
            code: "custom",
            message: "Alternative end date cannot be before the start date.",
            path: ["alternativeEndDate"],
          });
        }
        if (
          value.alternativeDate === value.requestedDate &&
          value.alternativeEndDate === value.requestedEndDate
        ) {
          context.addIssue({
            code: "custom",
            message: "Alternative range must differ from the requested range.",
            path: ["alternativeDate"],
          });
        }
      }
    });

export const fileRules = {
  maxSize: 5 * 1024 * 1024,
  accepted: ["image/jpeg", "image/png", "application/pdf"],
};

export function validateUpload(file?: File) {
  if (!file) return undefined;
  if (file.size <= 0) return "Choose a non-empty file.";
  if (!fileRules.accepted.includes(file.type)) return "Use a JPG, PNG, or PDF file.";
  if (file.size > fileRules.maxSize) return "File must be 5 MB or smaller.";
  return undefined;
}
