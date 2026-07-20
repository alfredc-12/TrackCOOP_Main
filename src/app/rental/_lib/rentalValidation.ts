import { z } from "zod";

const contactPattern = /^(?:\+?63|0)9\d{9}$/;
const optionalText = z.string().trim();

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
    preferredDate: z.string().min(1, "Choose a preferred date."),
    alternativeDate: optionalText,
    preferredStartTime: z.string().min(1, "Choose a preferred start time."),
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
    dataPrivacyConsent: z.boolean(),
    accuracyConfirmation: z.boolean(),
    contactConsent: z.boolean(),
  })
  .refine((data) => !data.alternativeDate || data.alternativeDate !== data.preferredDate, {
    message: "Alternative date must differ from the preferred date.",
    path: ["alternativeDate"],
  });

export type InquiryFormValues = z.infer<typeof inquirySchema>;

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
