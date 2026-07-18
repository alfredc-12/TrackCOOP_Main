import { z } from "zod";

export const paymentSchema = z.object({
  memberId: z.string().min(1),
  type: z.string().min(2),
  amount: z.coerce.number().positive(),
});
