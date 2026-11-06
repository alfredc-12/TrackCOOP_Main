import { z } from "zod";
import { cents, money } from "../budgets/controlled-budget.model";
export const controlledId = z.string().regex(/^[1-9]\d{0,19}$/);
export const controlledDraftSchema = z.object({
  recordNumber: z.string().trim().min(2).max(60),
  categoryId: controlledId,
  recordType: z.enum(["Income","Expense"]),
  amount: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/).refine((v) => /[1-9]/.test(v),"Amount must be positive").transform((v) => money(cents(v))),
  date: z.iso.date(),
  seasonId: controlledId.nullable(),
  remarks: z.string().trim().max(2000).nullable(),
  idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const controlledDraftEditSchema = controlledDraftSchema.omit({ idempotencyKey: true });
export type ControlledDraftInput = z.input<typeof controlledDraftSchema>;
export type ControlledDraftEdit = z.input<typeof controlledDraftEditSchema>;
