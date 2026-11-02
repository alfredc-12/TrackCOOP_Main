import { z } from "zod";
import { expenseClasses, type ExpenseClass } from "./expense-classification";
import { isYmd, periodPresets, type ComparisonMode, type Granularity, type PeriodPreset } from "./expense-periods";

export const expenseSourceModules = ["Manual", "Membership", "Payment", "Share Capital", "Rental", "POS", "Document", "Other"] as const;
export const expenseRecordViews = ["posted", "unposted", "voided", "corrected", "all"] as const;
export type ExpenseRecordView = (typeof expenseRecordViews)[number];
export const expenseSortFields = ["recordDate", "amount", "recordNumber", "category", "source"] as const;
export type ExpenseSortField = (typeof expenseSortFields)[number];
export const exportKinds = ["summary", "records", "categories", "comparison", "sources", "integrity"] as const;
export type ExportKind = (typeof exportKinds)[number];

export type ExpenseFilters = {
  period: PeriodPreset;
  startDate?: string;
  endDate?: string;
  compare: ComparisonMode;
  categoryIds: string[];
  sourceModules: string[];
  classes: ExpenseClass[];
  amountMin?: number;
  amountMax?: number;
  recordedBy?: string;
  postedBy?: string;
  seasonId?: string;
  budget?: "covered" | "uncovered";
  search?: string;
  granularity?: Granularity;
};

export type ExpenseRecordQuery = ExpenseFilters & {
  view: ExpenseRecordView;
  page: number;
  pageSize: number;
  sortBy: ExpenseSortField;
  sortDirection: "asc" | "desc";
};

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    const parts = Array.isArray(value) ? value : String(value).split(",");
    return parts.map((part) => String(part).trim()).filter(Boolean);
  }, z.array(item).max(50).optional());

const ymd = z.string().refine(isYmd, "Use a real YYYY-MM-DD date");
const idString = z.string().regex(/^\d{1,20}$/, "Use a numeric identifier");
const money = z.coerce.number().finite().min(0).max(999_999_999_999);

const filterShape = {
  period: z.enum(periodPresets).optional(),
  startDate: ymd.optional(),
  endDate: ymd.optional(),
  compare: z.enum(["previous", "last_year", "none"]).default("previous"),
  categoryIds: csv(idString),
  sourceModules: csv(z.enum(expenseSourceModules)),
  classes: csv(z.enum(expenseClasses)),
  amountMin: money.optional(),
  amountMax: money.optional(),
  recordedBy: idString.optional(),
  postedBy: idString.optional(),
  seasonId: idString.optional(),
  budget: z.enum(["covered", "uncovered"]).optional(),
  search: z.string().trim().min(1).max(190).optional(),
  granularity: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
};

function normalize(value: z.infer<z.ZodObject<typeof filterShape>>, ctx: z.RefinementCtx): ExpenseFilters | typeof z.NEVER {
  const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  const period: PeriodPreset = value.period ?? (value.startDate || value.endDate ? "custom" : "this_month");
  if (period === "custom") {
    if (!value.startDate || !value.endDate) fail("startDate", "A custom range needs both a start and an end date");
    else if (value.startDate > value.endDate) fail("endDate", "The end date cannot be before the start date");
  }
  if (value.amountMin !== undefined && value.amountMax !== undefined && value.amountMin > value.amountMax) {
    fail("amountMax", "The maximum amount cannot be below the minimum amount");
  }
  return {
    period,
    startDate: period === "custom" ? value.startDate : undefined,
    endDate: period === "custom" ? value.endDate : undefined,
    compare: value.compare,
    categoryIds: [...new Set(value.categoryIds ?? [])],
    sourceModules: [...new Set(value.sourceModules ?? [])],
    classes: value.classes?.length ? [...new Set(value.classes)] : ["operating"],
    amountMin: value.amountMin,
    amountMax: value.amountMax,
    recordedBy: value.recordedBy,
    postedBy: value.postedBy,
    seasonId: value.seasonId,
    budget: value.budget,
    search: value.search,
    granularity: value.granularity,
  };
}

export const expenseFilterSchema = z.object(filterShape).transform(normalize);

export const expenseRecordQuerySchema = z
  .object({
    ...filterShape,
    view: z.enum(expenseRecordViews).default("posted"),
    page: z.coerce.number().int().positive().max(100_000).default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.enum(expenseSortFields).default("recordDate"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .transform((value, ctx): ExpenseRecordQuery | typeof z.NEVER => {
    const filters = normalize(value, ctx);
    if (filters === z.NEVER) return z.NEVER;
    return { ...filters, view: value.view, page: value.page, pageSize: value.pageSize, sortBy: value.sortBy, sortDirection: value.sortDirection };
  });

export const expenseExportSchema = z
  .object({
    ...filterShape,
    view: z.enum(expenseRecordViews).default("posted"),
    sortBy: z.enum(expenseSortFields).default("recordDate"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
    kind: z.enum(exportKinds).default("summary"),
    format: z.enum(["xlsx", "pdf"]).default("xlsx"),
  })
  .transform((value, ctx) => {
    const filters = normalize(value, ctx);
    if (filters === z.NEVER) return z.NEVER;
    return { filters, view: value.view, sortBy: value.sortBy, sortDirection: value.sortDirection, kind: value.kind, format: value.format };
  });

export const expenseRecordIdSchema = z.object({ id: idString });
