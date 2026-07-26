import { z } from "zod";

const nullableString = z.string().nullable().optional();

const paymongoPaymentSchema = z.object({
  id: z.string(),
}).passthrough();

const paymongoPaymentIntentSchema = z.object({
  id: z.string(),
}).passthrough();

export const paymongoCheckoutSessionResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.literal("checkout_session").optional(),
    attributes: z.object({
      checkout_url: z.string().url(),
      status: nullableString,
      livemode: z.boolean().nullable().optional(),
      payment_intent: paymongoPaymentIntentSchema.nullable().optional(),
      payments: z.array(paymongoPaymentSchema).nullable().optional(),
    }).passthrough(),
  }).passthrough(),
});

export type PaymongoCheckoutSessionResponse = z.infer<
  typeof paymongoCheckoutSessionResponseSchema
>;

