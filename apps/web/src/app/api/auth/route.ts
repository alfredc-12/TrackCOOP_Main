import { ok } from "@/lib/response";
import { getDemoUser } from "@/features/auth/service";

export async function GET() {
  return ok(getDemoUser());
}
