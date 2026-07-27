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

export const paymongoMembershipCheckoutBodySchema = z.discriminatedUnion(
  "paymentPurpose",
  [
    z.object({
      paymentPurpose: z.literal("Associate Membership Fee"),
    }),
    z.object({
      paymentPurpose: z.literal("Share Capital"),
      requestedAmount: z.coerce.number().finite().positive(),
    }),
  ],
);

export type PaymongoMembershipCheckoutBody = z.infer<
  typeof paymongoMembershipCheckoutBodySchema
>;

const paymongoWebhookPaymentSchema = z.object({
  id: z.string().min(1),
  type: z.string().optional(),
  attributes: z.object({
    amount: z.coerce.number().int().positive(),
    currency: z.string().min(1),
    status: z.string().min(1),
    paid_at: z.union([z.coerce.number(), z.string()]).nullable().optional(),
    fee: z.coerce.number().nullable().optional(),
    net_amount: z.coerce.number().nullable().optional(),
    source: z.object({
      type: z.string().nullable().optional(),
    }).passthrough().nullable().optional(),
    payment_method: z.object({
      type: z.string().nullable().optional(),
    }).passthrough().nullable().optional(),
  }).passthrough(),
}).passthrough();

const paymongoWebhookCheckoutSchema = z.object({
  id: z.string().min(1),
  type: z.literal("checkout_session").optional(),
  attributes: z.object({
    livemode: z.boolean(),
    reference_number: z.string().min(1),
    status: z.string().nullable().optional(),
    payment_intent: z.object({
      id: z.string().min(1),
    }).passthrough().nullable().optional(),
    payments: z.array(paymongoWebhookPaymentSchema).min(1),
    metadata: z.record(z.string(), z.string()).optional().default({}),
  }).passthrough(),
}).passthrough();

export const paymongoWebhookEventSchema = z.object({
  data: z.object({
    id: z.string().optional(),
    type: z.literal("event").optional(),
    attributes: z.object({
      type: z.string().min(1),
      livemode: z.boolean().optional(),
      data: paymongoWebhookCheckoutSchema,
    }).passthrough(),
  }).passthrough(),
}).passthrough();

export type PaymongoWebhookEventBody = z.infer<typeof paymongoWebhookEventSchema>;
