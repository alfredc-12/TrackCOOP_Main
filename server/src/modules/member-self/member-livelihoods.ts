import { z } from "zod";
import { AppError } from "../../utils/app-error";

export type MemberLivelihood = { activity: string; plantingDate?: string };

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)?.value).join("-");
}

const schema = z.array(z.object({
  activity: z.string().trim().min(1).max(80),
  plantingDate: z.string().refine((date) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date >= "1900-01-01" && date <= todayInManila();
  }, "Enter a valid past or current sowing date.").optional(),
}).strict()).max(20).refine((items) => new Set(items.map((item) => item.activity.toLowerCase())).size === items.length, "Select each activity once.");

export function validateLivelihoods(value: unknown): MemberLivelihood[] {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("Check your crops and livelihoods. Use unique activity names (up to 80 characters) and valid sowing dates that are not in the future.", 400, "INVALID_LIVELIHOODS");
  return result.data;
}

export function readLivelihoods(value: unknown): MemberLivelihood[] {
  if (value == null) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  return validateLivelihoods(parsed);
}
