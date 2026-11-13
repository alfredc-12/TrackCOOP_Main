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
  const result = inspectStoredLivelihoods(value);
  if (result.issues.length) throw new AppError("Saved crop and livelihood details need review.", 400, "INVALID_LIVELIHOODS");
  return result.livelihoods;
}

export function inspectStoredLivelihoods(value: unknown): { livelihoods: MemberLivelihood[]; issues: string[] } {
  if (value == null || value === "") return { livelihoods: [], issues: [] };
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); }
    catch { return { livelihoods: [], issues: ["The saved details are not valid JSON. Review the original value before replacing it."] }; }
  }
  if (parsed == null) return { livelihoods: [], issues: [] };
  if (!Array.isArray(parsed)) return { livelihoods: [], issues: ["The saved details are not a list of activities."] };
  const livelihoods: MemberLivelihood[] = [], issues: string[] = [];
  const seen = new Map<string, MemberLivelihood>();
  const conflictingDates = new Set<string>();
  for (const [index, item] of parsed.entries()) {
    // Older profiles stored activity names directly in the JSON list.
    const row: Record<string, unknown> | null = typeof item === "string" ? { activity: item } :
      item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null;
    const name = z.string().trim().min(1).max(80).safeParse(row?.activity);
    if (!row || !name.success) { issues.push(`Entry ${index + 1} needs a valid activity name.`); continue; }
    const candidate: MemberLivelihood = { activity: name.data };
    if (Object.keys(row).some(key => !["activity", "plantingDate"].includes(key))) issues.push(`Entry ${index + 1} has additional details that need review.`);
    if (row.plantingDate != null && row.plantingDate !== "") {
      const dated = schema.safeParse([{ activity: name.data, plantingDate: row.plantingDate }]);
      if (dated.success) candidate.plantingDate = dated.data[0].plantingDate;
      else issues.push(`Entry ${index + 1} (${name.data}) needs its sowing date corrected. No date has been assumed.`);
    }
    const key = candidate.activity.toLowerCase(), previous = seen.get(key);
    if (previous) {
      if (conflictingDates.has(key) || previous.plantingDate !== candidate.plantingDate) {
        delete previous.plantingDate;
        conflictingDates.add(key);
        issues.push(`Repeated activity ${name.data} has different sowing dates. Choose the correct current crop cycle.`);
      }
      continue;
    }
    if (livelihoods.length >= 20) { issues.push("More than 20 activities were saved. Review the original list before saving."); continue; }
    seen.set(key, candidate); livelihoods.push(candidate);
  }
  return { livelihoods, issues };
}
