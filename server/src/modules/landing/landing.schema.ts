import { z } from "zod";

const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().trim().min(1).max(190).optional(),
  status: z.string().trim().max(80).optional(),
});

export const listLandingQuerySchema = pageQuerySchema;

export const contentBlockSchema = z.object({
  pageSlug: z.string().trim().min(1).max(120),
  sectionKey: z.string().trim().min(1).max(120),
  contentType: z.enum(["Hero", "Heading", "Rich Text", "Statistic", "Call to Action", "Contact Information", "Other"]),
  title: z.string().trim().max(255).nullable().optional(),
  body: z.string().trim().nullable().optional(),
  valueText: z.string().trim().max(255).nullable().optional(),
  linkLabel: z.string().trim().max(120).nullable().optional(),
  linkUrl: z.string().trim().max(500).nullable().optional(),
  mediaPath: z.string().trim().max(500).nullable().optional(),
  displayOrder: z.coerce.number().int().default(0),
  contentStatus: z.enum(["Draft", "Published", "Archived"]).default("Draft"),
});

export const serviceSchema = z.object({
  serviceCode: z.string().trim().min(1).max(80),
  serviceType: z.enum(["Membership", "Rental", "Product/POS", "Program", "Document", "Other"]),
  title: z.string().trim().min(1).max(190),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  fullDescription: z.string().trim().nullable().optional(),
  requirementsText: z.string().trim().nullable().optional(),
  imagePath: z.string().trim().max(500).nullable().optional(),
  ctaLabel: z.string().trim().max(120).nullable().optional(),
  ctaUrl: z.string().trim().max(500).nullable().optional(),
  publicVisibility: z.coerce.boolean().default(true),
  serviceStatus: z.enum(["Draft", "Active", "Inactive", "Archived"]).default("Draft"),
  displayOrder: z.coerce.number().int().default(0),
});

export const programSchema = z.object({
  title: z.string().trim().min(1).max(255),
  category: z.string().trim().max(120).nullable().optional(),
  summary: z.string().trim().max(700).nullable().optional(),
  description: z.string().trim().nullable().optional(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  imagePath: z.string().trim().max(500).nullable().optional(),
  publicVisibility: z.coerce.boolean().default(true),
  status: z.enum(["Draft", "Upcoming", "Ongoing", "Completed", "Archived"]).default("Draft"),
  displayOrder: z.coerce.number().int().default(0),
});

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
  imagePath: z.string().trim().min(1).max(500),
  thumbnailPath: z.string().trim().max(500).nullable().optional(),
  activityDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  altText: z.string().trim().max(255).nullable().optional(),
  publicVisibility: z.coerce.boolean().default(true),
  galleryStatus: z.enum(["Draft", "Published", "Archived"]).default("Draft"),
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

export const updateContentBlockSchema = contentBlockSchema.partial();
export const updateServiceSchema = serviceSchema.partial();
export const updateProgramSchema = programSchema.partial();
export const updatePartnerSchema = partnerSchema.partial();
export const updateGallerySchema = gallerySchema.partial();
export const updateSettingSchema = settingSchema.partial();
