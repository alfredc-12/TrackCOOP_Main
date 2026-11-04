import { z } from "zod";
import { AppError } from "../../utils/app-error";
import { activityAreas } from "./activity.presentation";
export const activityQuery = z
  .object({
    page: z.coerce.number().int().positive().max(1000000).default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().trim().max(190).default(""),
    start: z.iso.date().optional(),
    end: z.iso.date().optional(),
    category: z.string().max(30).default(""),
    userId: z
      .string()
      .regex(/^(?:system|\d{1,20})$/)
      .optional(),
  })
  .superRefine((f, c) => {
    if (f.start && f.end && f.start > f.end)
      c.addIssue({
        code: "custom",
        path: ["end"],
        message: "End date must be on or after start date.",
      });
    if (f.category && !activityAreas.some((a) => a.id === f.category))
      c.addIssue({
        code: "custom",
        path: ["category"],
        message: "Choose a supported activity category.",
      });
  });
export type ActivityQuery = z.infer<typeof activityQuery>;
export function parseActivityQuery(value: unknown) {
  const r = activityQuery.safeParse(value);
  if (!r.success)
    throw new AppError(
      "Review the activity filters.",
      422,
      "INVALID_ACTIVITY_FILTERS",
      r.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    );
  return r.data;
}
