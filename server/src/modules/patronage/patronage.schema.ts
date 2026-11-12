import { z } from "zod";

const money = z.number().finite().nonnegative().max(999_999_999_999.99).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.01, "Use at most two decimal places.");
export const createPatronagePeriodSchema = z.object({
  netSurplus: money,
  statutoryReserves: money,
  name: z.string().trim().min(3).max(120),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  refundPool: z.coerce.number().nonnegative().max(999_999_999_999.99).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
}).refine((value) => value.endDate >= value.startDate, {
  message: "End date must be on or after the start date",
  path: ["endDate"],
}).refine((value) => value.statutoryReserves < value.netSurplus, {
  message: "Statutory reserves must be less than the reviewed net surplus to fund a refund.",
  path: ["statutoryReserves"],
});

export const patronagePaymentSchema = z.object({
  notes: z.string().trim().max(500).nullable().optional(),
});
