import { z } from "zod";

export const seasonSchema = z.object({
  seasonName: z.string().trim().min(2).max(120),
  seasonType: z.string().trim().min(2).max(80),
  seasonYear: z.coerce.number().int().min(2000).max(2200),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  description: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => value.endDate >= value.startDate, {
  message: "Season end date must be on or after the start date.",
  path: ["endDate"],
});

export const seasonListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["Draft", "Active", "Closed"]).optional(),
});

export const productionRecordSchema = z.object({
  seasonId: z.string().trim().min(1),
  memberId: z.string().trim().min(1).nullable().optional(),
  barangay: z.string().trim().max(120).nullable().optional(),
  sector: z.string().trim().min(2).max(120),
  cropName: z.string().trim().min(2).max(160),
  areaPlanted: z.coerce.number().min(0).nullable().optional(),
  areaUnit: z.string().trim().max(40).nullable().optional(),
  quantityProduced: z.coerce.number().positive().max(999_999_999),
  quantityUnit: z.string().trim().min(1).max(40).default("kg"),
  productionCost: z.coerce.number().min(0).max(999_999_999.99).default(0),
  harvestDate: z.iso.date().nullable().optional(),
  productionStatus: z.enum(["Draft", "Recorded", "Verified", "Harvested", "Cancelled"]).default("Recorded"),
  remarks: z.string().trim().max(2000).nullable().optional(),
});

export const productionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  seasonId: z.string().trim().min(1).optional(),
  status: z.enum(["Draft", "Recorded", "Verified", "Harvested", "Cancelled"]).optional(),
});

export const seasonStatusSchema = z.object({
  action: z.enum(["activate", "close"]),
});

export const seasonalAnalyticsQuerySchema = z.object({
  seasonId: z.string().trim().min(1).optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
}).refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
  message: "End date must be on or after the start date.",
  path: ["endDate"],
});
