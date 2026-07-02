"use server";

import { paymentSchema } from "./schema";

export async function createPaymentAction(formData: FormData) {
  const parsed = paymentSchema.safeParse({
    memberId: formData.get("memberId"),
    type: formData.get("type"),
    amount: formData.get("amount"),
  });

  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, message: "Please check the payment details." };
}
