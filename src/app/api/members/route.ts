import { ok } from "@/lib/response";
import { getMembersOverview } from "@/features/members/service";

export async function GET() {
  return ok(getMembersOverview());
}
