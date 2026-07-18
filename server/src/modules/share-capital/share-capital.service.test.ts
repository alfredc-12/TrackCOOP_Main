import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createShareCapitalService } from "./share-capital.service";
import type { ShareCapitalRepository } from "./share-capital.repository";
import type { ShareCapitalPayment } from "./share-capital.types";

const auth: AuthContext = {
  sessionId: "1",
  tokenHash: "hash",
  user: {
    id: "1",
    displayName: "Book Keeper",
    email: "bookkeeper@example.test",
    username: "bookkeeper",
    role: "bookkeeper",
  },
};

const payment: ShareCapitalPayment = {
  id: "20",
  memberId: "10",
  memberCode: "NFFAC-001",
  memberName: "Sample Member",
  paymentReferenceId: null,
  amount: 1000,
  paymentDate: new Date("2026-07-18T00:00:00.000Z"),
  paymentStatus: "Pending",
  verifiedBy: null,
  verifiedAt: null,
  reversalOfPaymentId: null,
  remarks: null,
  createdAt: new Date("2026-07-18T00:00:00.000Z"),
  updatedAt: new Date("2026-07-18T00:00:00.000Z"),
};

function createRepository(overrides: Partial<ShareCapitalRepository> = {}): ShareCapitalRepository {
  return {
    async list() {
      return { payments: [], total: 0, page: 1, pageSize: 20 };
    },
    async findById() {
      return payment;
    },
    async create() {
      return payment;
    },
    async update() {
      return payment;
    },
    async memberProgress() {
      throw new Error("not used");
    },
    async summary() {
      throw new Error("not used");
    },
    async validatedTotal() {
      return 14_500;
    },
    ...overrides,
  };
}

test("createPayment prevents validated totals above PHP 15,000", async () => {
  const service = createShareCapitalService(createRepository());

  await assert.rejects(
    () =>
      service.createPayment(
        {
          memberId: "10",
          amount: 1000,
          paymentDate: "2026-07-18",
          paymentStatus: "Validated",
        },
        auth,
      ),
    (error) =>
      error instanceof AppError && error.code === "SHARE_CAPITAL_LIMIT_EXCEEDED",
  );
});

test("createPayment allows pending payments above the validated cap check", async () => {
  let delegated = false;
  const service = createShareCapitalService(
    createRepository({
      async create() {
        delegated = true;
        return payment;
      },
    }),
  );

  await service.createPayment(
    {
      memberId: "10",
      amount: 1000,
      paymentDate: "2026-07-18",
      paymentStatus: "Pending",
    },
    auth,
  );

  assert.equal(delegated, true);
});
