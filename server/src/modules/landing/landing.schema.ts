import { z } from "zod";

const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().trim().min(1).max(190).optional(),
  status: z.string().trim().max(80).optional(),
});

export const listLandingQuerySchema = pageQuerySchema;

export const partnerSchema = z.object({
  recordType: z.enum(["Partner", "Certification", "Accreditation", "Recognition"]),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().nullable().optional(),
  logoPath: z.string().trim().max(500).nullable().optional(),
  externalUrl: z.string().trim().max(500).nullable().optional(),
  issuedDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expirationDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  publicVisibility: z.coerce.boolean().default(true),
  status: z.enum(["Draft", "Active", "Expired", "Archived"]).default("Draft"),
  displayOrder: z.coerce.number().int().default(0),
});

export const gallerySchema = z.object({
  title: z.string().trim().min(1).max(255),
  caption: z.string().trim().nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  activityDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  borderColor: z.string().trim().max(20).nullable().optional(),
  publicVisibility: z.coerce.boolean().default(true),
  galleryStatus: z.enum(["Draft", "Published", "Archived"]).default("Draft"),
  displayOrder: z.coerce.number().int().default(0),
  images: z.array(z.object({
    id: z.string().trim().optional(),
    imagePath: z.string().trim().min(1).max(500),
    thumbnailPath: z.string().trim().max(500).nullable().optional(),
    altText: z.string().trim().max(255).nullable().optional(),
    sortOrder: z.coerce.number().int().default(0),
    isCover: z.coerce.boolean().default(false),
    publicVisibility: z.coerce.boolean().default(true),
  })).min(1).optional(),
});

export const gallerySlotSchema = z.object({
  galleryGroupId: z.string().trim().nullable().optional(),
  galleryImageId: z.string().trim().nullable().optional(),
  displayOrder: z.coerce.number().int().default(0),
});

export const settingSchema = z.object({
  settingGroup: z.string().trim().min(1).max(100),
  settingKey: z.string().trim().min(1).max(160),
  settingValue: z.string().trim().nullable().optional(),
  valueType: z.enum(["String", "Number", "Boolean", "Date", "JSON"]).default("String"),
  description: z.string().trim().nullable().optional(),
  isPublic: z.coerce.boolean().default(false),
  effectiveDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const updatePartnerSchema = partnerSchema.partial();
export const updateGallerySchema = gallerySchema.partial();
export const updateSettingSchema = settingSchema.partial();
