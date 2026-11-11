import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "../auth/auth.types";
import type { PatronageRepository } from "./patronage.repository";
import { createPatronageService } from "./patronage.service";
const auth = { user: { id: "1", displayName: "Chairman", email: "test@example.test", username: "chairman", role: "chairman" }, sessionId: "1", tokenHash: "test" } satisfies AuthContext;
test("surplus-funded rental processing delegates to the transactional repository", async () => {
  const calls: string[] = [];
  const repository = {
    createPeriod: async () => { calls.push("create"); return {}; },
    finalize: async () => { calls.push("finalize"); return {}; },
    financialBasis: async () => { throw new Error("The repository owns the saved financial basis"); },
  } as unknown as PatronageRepository;
  const service = createPatronageService(repository);
  await service.createPeriod({ name: "2025", startDate: "2025-01-01", endDate: "2025-12-31", netSurplus: 150000, statutoryReserves: 50000 }, auth);
  await service.finalize("1", auth);
  assert.deepEqual(calls, ["create","finalize"]);
});
