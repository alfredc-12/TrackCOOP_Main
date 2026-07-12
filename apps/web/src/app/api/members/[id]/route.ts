import { fail, ok } from "@/lib/response";
import { getMemberProfile } from "@/features/members/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const member = getMemberProfile(id);

  return member ? ok(member) : fail("Member not found", 404);
}
