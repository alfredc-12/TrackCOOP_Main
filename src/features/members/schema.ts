import { z } from "zod";

export const memberSchema = z.object({
  name: z.string().min(2),
  sector: z.string().min(2),
  location: z.string().min(2),
});

export type MemberInput = z.infer<typeof memberSchema>;
