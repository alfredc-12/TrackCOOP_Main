import { ok } from "@/lib/response";
import { getPaymentSummary } from "@/features/payments/service";

export async function GET() {
  return ok(getPaymentSummary());
}
