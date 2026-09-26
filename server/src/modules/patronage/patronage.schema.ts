import { z } from "zod";

export const createPatronagePeriodSchema = z.object({
  name: z.string().trim().min(3).max(120),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  refundPool: z.coerce.number().positive().max(999_999_999_999.99),
  notes: z.string().trim().max(4000).nullable().optional(),
}).refine((value) => value.endDate >= value.startDate, {
  message: "End date must be on or after the start date",
  path: ["endDate"],
});

export const patronagePaymentSchema = z.object({
  notes: z.string().trim().max(500).nullable().optional(),
});
