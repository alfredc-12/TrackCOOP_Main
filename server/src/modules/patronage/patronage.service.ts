import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createPatronageRepository, type PatronageRepository } from "./patronage.repository";
import type { CreatePatronagePeriodInput } from "./patronage.types";

export interface PatronageService {
  financialBasis(startDate: string, endDate: string): ReturnType<PatronageRepository["financialBasis"]>;
  overview(periodId?: string): ReturnType<PatronageRepository["overview"]>;
  createPeriod(input: CreatePatronagePeriodInput, auth: AuthContext): ReturnType<PatronageRepository["createPeriod"]>;
  recalculate(periodId: string, auth: AuthContext): ReturnType<PatronageRepository["recalculate"]>;
  finalize(periodId: string, auth: AuthContext): ReturnType<PatronageRepository["finalize"]>;
  markPaid(allocationId: string, notes: string | null, auth: AuthContext): ReturnType<PatronageRepository["markPaid"]>;
  memberSummary(auth: AuthContext): ReturnType<PatronageRepository["memberSummary"]>;
}

export function createPatronageService(
  repository: PatronageRepository = createPatronageRepository(),
): PatronageService {
  return {
    financialBasis: (startDate, endDate) => repository.financialBasis(startDate, endDate),
    overview: (periodId) => repository.overview(periodId),
    async createPeriod(input, auth) {
      const basis = await repository.financialBasis(input.startDate, input.endDate);
      if (basis.netOperatingSurplus <= 0) {
        throw new AppError(
          "The selected period has no positive posted POS and rental operating surplus available for a patronage refund.",
          409,
          "PATRONAGE_SURPLUS_REQUIRED",
        );
      }
      if (input.refundPool > basis.netOperatingSurplus) {
        throw new AppError(
          "The refund pool cannot be greater than the posted POS and rental operating surplus for this period.",
          409,
          "PATRONAGE_POOL_EXCEEDS_SURPLUS",
        );
      }
      return repository.createPeriod(input, auth);
    },
    recalculate: (periodId, auth) => repository.recalculate(periodId, auth),
    async finalize(periodId, auth) {
      const overview = await repository.overview(periodId);
      const period = overview.selectedPeriod?.id === periodId ? overview.selectedPeriod : null;
      if (!period) {
        throw new AppError("Patronage period was not found.", 404, "PATRONAGE_PERIOD_NOT_FOUND");
      }
      const basis = await repository.financialBasis(period.startDate, period.endDate);
      if (period.refundPool > Math.max(0, basis.netOperatingSurplus)) {
        throw new AppError(
          "The refund pool is greater than the current posted POS and rental operating surplus. Review the ledger or create a corrected period before finalizing.",
          409,
          "PATRONAGE_POOL_EXCEEDS_SURPLUS",
        );
      }
      return repository.finalize(periodId, auth);
    },
    markPaid: (allocationId, notes, auth) => repository.markPaid(allocationId, notes, auth),
    memberSummary: (auth) => repository.memberSummary(auth),
  };
}
