import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { PatronageRepository } from "./patronage.repository";
import { createPatronageService } from "./patronage.service";

const auth = {
  user: { id: "1", displayName: "Chairman", email: "chairman@example.com", username: "chairman", role: "chairman" },
  sessionId: "session",
  tokenHash: "hash",
} satisfies AuthContext;

function repositoryWithSurplus(netOperatingSurplus: number) {
  let created = false;
  const repository = {
    financialBasis: async (startDate: string, endDate: string) => ({
      startDate, endDate, posIncome: netOperatingSurplus, rentalIncome: 0,
      totalOperatingIncome: netOperatingSurplus, posExpenses: 0, rentalExpenses: 0,
      otherExpenses: 0,
      totalOperatingExpenses: 0, adjustments: 0, netOperatingSurplus,
      postedRecordCount: 1, unpostedRecordCount: 0,
    }),
    createPeriod: async () => {
      created = true;
      return {};
    },
  } as unknown as PatronageRepository;
  return { repository, wasCreated: () => created };
}

test("rejects a refund pool above the posted operating surplus", async () => {
  const mock = repositoryWithSurplus(10_000);
  const service = createPatronageService(mock.repository);
  await assert.rejects(
    () => service.createPeriod({ name: "2026", startDate: "2026-01-01", endDate: "2026-12-31", refundPool: 12_000 }, auth),
    (error) => error instanceof AppError && error.code === "PATRONAGE_POOL_EXCEEDS_SURPLUS",
  );
  assert.equal(mock.wasCreated(), false);
});

test("allows a refund pool within the posted operating surplus", async () => {
  const mock = repositoryWithSurplus(10_000);
  const service = createPatronageService(mock.repository);
  await service.createPeriod({ name: "2026", startDate: "2026-01-01", endDate: "2026-12-31", refundPool: 5_000 }, auth);
  assert.equal(mock.wasCreated(), true);
});
