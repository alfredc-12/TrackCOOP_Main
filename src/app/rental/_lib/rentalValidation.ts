import { z } from "zod";

const contactPattern = /^(?:\+?63|0)9\d{9}$/;
const optionalText = z.string().trim();

const requiredConsent = z
  .boolean()
  .refine((value) => value, "This confirmation is required.");

export const inquirySchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter the requester's full name."),
    requesterType: z.enum(["Member", "Public or Non-member"]),
    contactNumber: z.string().trim().regex(contactPattern, "Use a valid Philippine mobile number."),
    email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
    completeAddress: z.string().trim().min(5, "Enter the complete address."),
    barangay: z.string().min(1, "Select a barangay."),
    municipality: z.string().trim().min(2, "Enter the municipality."),
    preferredContactMethod: z.enum(["Phone", "SMS", "Email"]),
    serviceId: z.string().min(1, "Select equipment or a service."),
    intendedUse: z.string().trim().min(3, "Describe the intended use."),
    preferredDate: z.iso.date("Choose a preferred start date."),
    preferredEndDate: z.iso.date("Choose a preferred end date."),
    alternativeDate: optionalText,
    alternativeEndDate: optionalText,
    preferredStartTime: z.string().min(1, "Choose a preferred start time."),
    preferredEndTime: z.string().min(1, "Choose a preferred end time."),
    estimatedDuration: z.string().trim().min(1, "Enter an estimated duration."),
    estimatedUsage: z.string().trim().min(1, "Enter the estimated area or usage."),
    unitOfMeasurement: z.string().trim().min(1, "Enter the unit of measurement."),
    serviceLocation: z.string().trim().min(5, "Enter the service location."),
    serviceBarangay: z.string().min(1, "Select the service barangay."),
    requestDescription: z.string().trim().min(10, "Add at least 10 characters of request details."),
    specialInstructions: optionalText,
    additionalNotes: optionalText,
    attachmentName: optionalText,
    membershipProofName: optionalText,
    clientRequestId: z.string().uuid().optional(),
    dataPrivacyConsent: requiredConsent,
    accuracyConfirmation: requiredConsent,
    contactConsent: requiredConsent,
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

    const hasAlternativeStart = Boolean(data.alternativeDate);
    const hasAlternativeEnd = Boolean(data.alternativeEndDate);
    if (hasAlternativeStart !== hasAlternativeEnd) {
      context.addIssue({
        code: "custom",
        message: hasAlternativeStart
          ? "Choose an alternative end date."
          : "Choose an alternative start date.",
        path: [hasAlternativeStart ? "alternativeEndDate" : "alternativeDate"],
      });
    }
    if (data.alternativeDate && data.alternativeEndDate) {
      if (data.alternativeDate < todayKey) {
        context.addIssue({
          code: "custom",
          message: "Alternative start date cannot be in the past.",
          path: ["alternativeDate"],
        });
      }
      if (data.alternativeEndDate < data.alternativeDate) {
        context.addIssue({
          code: "custom",
          message: "Alternative end date cannot be before the start date.",
          path: ["alternativeEndDate"],
        });
      }
      if (
        data.alternativeDate === data.preferredDate &&
        data.alternativeEndDate === data.preferredEndDate
      ) {
        context.addIssue({
          code: "custom",
          message: "Alternative date range must differ from the preferred range.",
          path: ["alternativeDate"],
        });
      }
    }
  });

export type InquiryFormValues = z.infer<typeof inquirySchema>;

export const rentalServiceSchema = z.object({
  serviceId: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Use uppercase letters, numbers, hyphens, or underscores."),
  name: z.string().trim().min(2).max(190),
  category: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().min(5).max(500),
  description: z.string().trim().min(5),
  availability: z.enum([
    "Available",
    "Limited Availability",
    "Unavailable",
    "By Schedule Only",
  ]),
  operationalStatus: z.enum([
    "Ready for Use",
    "Under Maintenance",
    "Out of Service",
    "Archived",
  ]),
  visibility: z.enum(["Public", "Member-only", "Internal only", "Hidden"]),
  capacity: z.string().trim(),
  maximumBookingsPerDay: z.number().int().min(0).max(100).optional(),
  preparationMinutes: z.number().int().min(0).max(1440).optional(),
  travelMinutes: z.number().int().min(0).max(1440).optional(),
  bufferMinutes: z.number().int().min(0).max(1440).optional(),
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
    serviceLocation: z.string().trim().min(3),
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
  if (!fileRules.accepted.includes(file.type)) return "Use a JPG, PNG, or PDF file.";
  if (file.size > fileRules.maxSize) return "File must be 5 MB or smaller.";
  return undefined;
}
