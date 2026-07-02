"use server";

import { memberSchema } from "./schema";

export async function createMemberAction(formData: FormData) {
  const parsed = memberSchema.safeParse({
    name: formData.get("name"),
    sector: formData.get("sector"),
    location: formData.get("location"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please complete the member profile." };
  }

  return { ok: true, data: parsed.data };
}
