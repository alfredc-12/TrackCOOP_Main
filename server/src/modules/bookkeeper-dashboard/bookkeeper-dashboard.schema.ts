import { z } from "zod";
import { dashboardPeriodKeys } from "./bookkeeper-dashboard.period";

export const dashboardQuerySchema = z
  .object({
    period: z.enum(dashboardPeriodKeys).default("month"),
    start: z.iso.date().optional(),
    end: z.iso.date().optional(),
  })
  .strict();

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

