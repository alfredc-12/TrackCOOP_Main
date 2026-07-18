import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createShareCapitalRepository,
  MAX_SHARE_CAPITAL,
  type ShareCapitalRepository,
} from "./share-capital.repository";
import type {
  ShareCapitalInput,
  ShareCapitalListQuery,
  UpdateShareCapitalInput,
} from "./share-capital.types";

export interface ShareCapitalService {
  listPayments(query: ShareCapitalListQuery): ReturnType<ShareCapitalRepository["list"]>;
  getPayment(id: string): ReturnType<ShareCapitalRepository["findById"]>;
  createPayment(input: ShareCapitalInput, auth: AuthContext): ReturnType<ShareCapitalRepository["create"]>;
  updatePayment(id: string, input: UpdateShareCapitalInput, auth: AuthContext): ReturnType<ShareCapitalRepository["update"]>;
  memberProgress(memberId: string): ReturnType<ShareCapitalRepository["memberProgress"]>;
  summary(): ReturnType<ShareCapitalRepository["summary"]>;
}

export function createShareCapitalService(
  repository: ShareCapitalRepository = createShareCapitalRepository(),
): ShareCapitalService {
  async function assertWithinCapitalLimit(
    memberId: string,
    amount: number,
    status: string | undefined,
    excludingPaymentId?: string,
  ) {
    if (status !== "Validated") return;
    const currentTotal = await repository.validatedTotal(memberId, excludingPaymentId);
    if (currentTotal + amount > MAX_SHARE_CAPITAL) {
      throw new AppError(
        "Validated share capital cannot exceed PHP 15,000",
        409,
        "SHARE_CAPITAL_LIMIT_EXCEEDED",
      );
    }
  }

  return {
    listPayments(query) {
      return repository.list(query);
    },
    getPayment(id) {
      return repository.findById(id);
    },
    async createPayment(input, auth) {
      await assertWithinCapitalLimit(input.memberId, input.amount, input.paymentStatus);
      return repository.create(input, auth);
    },
    async updatePayment(id, input, auth) {
      const existing = await repository.findById(id);
      if (!existing) throw new AppError("Share capital payment was not found", 404, "SHARE_CAPITAL_NOT_FOUND");
      await assertWithinCapitalLimit(
        input.memberId ?? existing.memberId,
        input.amount ?? existing.amount,
        input.paymentStatus ?? existing.paymentStatus,
        id,
      );
      return repository.update(id, input, auth);
    },
    memberProgress(memberId) {
      return repository.memberProgress(memberId);
    },
    summary() {
      return repository.summary();
    },
  };
}
