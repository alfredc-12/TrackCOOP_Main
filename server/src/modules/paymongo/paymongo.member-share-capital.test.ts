import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { PaymongoClient } from "./paymongo.client";
import type { PaymongoCheckoutAttemptRepository } from "./paymongo.checkout-attempt.repository";
import type { PaymongoMemberShareCapitalRepository } from "./paymongo.member-share-capital.repository";
import {
  assertMemberShareCapitalAmount,
  assertMemberShareCapitalCapacity,
  buildMemberShareCapitalSummary,
} from "./paymongo.member-share-capital.rules";
import type { PaymongoRepository } from "./paymongo.repository";
import { createPaymongoMemberShareCapitalService } from "./paymongo.member-share-capital.service";
import { createPaymongoService } from "./paymongo.service";
import type {
  PaymongoCheckoutAttemptResult,
  PaymongoConfig,
  PaymongoMemberShareCapitalCheckoutInput,
  PaymongoMemberShareCapitalSummary,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";

const settings = {
  associateFee: 200,
  initialShareCapital: 1500,
  trueMemberRequiredCapital: 3000,
  maximumShareCapital: 15000,
};
const config: PaymongoConfig = {
  enabled: true,
  mode: "test",
  apiBaseUrl: "https://api.paymongo.test",
  secretKey: "sk_test_example",
  webhookSecret: "whsec_test_example",
  webhookToleranceSeconds: 300,
  checkoutReuseMinutes: 30,
  paymentMethodTypes: ["card"],
  passOnFees: false,
  successUrl: "http://localhost:3000/payment/success",
  cancelUrl: "http://localhost:3000/payment/cancelled",
  timeoutMs: 1000,
};
const memberAuth: AuthContext = {
  user: {
    id: "user-10",
    displayName: "Member Ten",
    email: "member10@example.test",
    username: "member10",
    role: "member",
  },
  sessionId: "session-10",
  tokenHash: "token-10",
};
const chairmanAuth: AuthContext = {
  ...memberAuth,
  user: { ...memberAuth.user, id: "chairman-1", role: "chairman" },
};
const bookkeeperAuth: AuthContext = {
  ...memberAuth,
  user: { ...memberAuth.user, id: "bookkeeper-1", role: "bookkeeper" },
};

function record(
  id: string,
  overrides: Partial<PaymongoPaymentReferenceRecord> = {},
): PaymongoPaymentReferenceRecord {
  return {
    id,
    memberId: "member-10",
    memberUserId: memberAuth.user.id,
    submittedBy: memberAuth.user.id,
    payerName: memberAuth.user.displayName,
    payerEmail: memberAuth.user.email,
    payerContact: "09170000000",
    provider: "PayMongo Hosted Checkout",
    referenceNumber: `SC-2026-${id.padStart(6, "0")}`,
    paymentPurpose: "Share Capital",
    relatedEntityType: "member_profile",
    relatedEntityId: "member-10",
    amount: 1500,
    validationStatus: "Pending",
    paymentChannel: "PayMongo",
    gatewayEnvironment: "Test",
    gatewayCheckoutId: null,
    gatewayPaymentId: null,
    gatewayPaymentIntentId: null,
    gatewayStatus: null,
    idempotencyKey: null,
    paidAt: null,
    ...overrides,
  };
}

function baseRepository(): PaymongoRepository {
  return {
    async findPaymentReference() { return null; },
    async findMembershipApplicationByCode() { return null; },
    async getMembershipPaymentSettings() { return settings; },
    async getValidatedMembershipPaymentTotal() { return 0; },
    async prepareMembershipPaymentReference() { throw new Error("unused"); },
    async recordCheckoutSession() {},
  };
}

class FakeAttemptRepository implements PaymongoCheckoutAttemptRepository {
  calls = 0;
  private attempts = new Map<string, PaymongoCheckoutAttemptResult>();
  constructor(private readonly records: Map<string, PaymongoPaymentReferenceRecord>) {}

  async createOrReuseCheckoutAttempt(input: Parameters<PaymongoCheckoutAttemptRepository["createOrReuseCheckoutAttempt"]>[0]) {
    const current = this.records.get(input.paymentReferenceId);
    if (!current) throw new AppError("Missing payment", 404, "PAYMENT_REFERENCE_NOT_FOUND");
    await input.validateRecord(current, null);
    const existing = this.attempts.get(current.id);
    if (existing) return { ...existing, reused: true };
    this.calls += 1;
    const session = await input.createSession(
      current,
      `member-share-${current.id}-attempt-1`,
    );
    const result: PaymongoCheckoutAttemptResult = {
      record: current,
      attempt: {
        id: `attempt-${current.id}`,
        paymentReferenceId: current.id,
        attemptNumber: 1,
        idempotencyKey: `member-share-${current.id}-attempt-1`,
        checkoutId: session.id,
        checkoutUrl: session.checkoutUrl,
        gatewayStatus: session.status,
        gatewayEnvironment: "Test",
        amount: current.amount,
        currency: "PHP",
        lastCheckedAt: null,
        reusableUntil: new Date(Date.now() + 30 * 60_000),
        supersededAt: null,
        completedAt: null,
      },
      reused: false,
    };
    this.attempts.set(current.id, result);
    return result;
  }
  async findLatestCheckoutAttempt() { return null; }
  async refreshCheckoutAttempt() {}
}

function fakeClient(): PaymongoClient {
  return {
    async createCheckoutSession(_input, idempotencyKey) {
      return {
        id: `cs_${idempotencyKey}`,
        checkoutUrl: `https://checkout.paymongo.test/${idempotencyKey}`,
        status: "active",
        livemode: false,
        paymentIntentId: null,
        paymentId: null,
      };
    },
    async retrieveCheckoutSession() { throw new Error("unused"); },
  };
}

function serviceWith(input: {
  prepare?: (checkout: PaymongoMemberShareCapitalCheckoutInput) => Promise<PaymongoPaymentReferenceRecord>;
  summary?: () => Promise<PaymongoMemberShareCapitalSummary>;
  capacity?: () => Promise<void>;
}) {
  const records = new Map<string, PaymongoPaymentReferenceRecord>();
  const memberRepository: PaymongoMemberShareCapitalRepository = {
    async getSummary() {
      if (input.summary) return input.summary();
      throw new AppError("No profile", 404, "MEMBER_PROFILE_NOT_FOUND");
    },
    async prepareContribution({ checkout }) {
      const prepared = input.prepare
        ? await input.prepare(checkout)
        : record("101", { amount: checkout.requestedAmount });
      records.set(prepared.id, prepared);
      return prepared;
    },
    async assertCheckoutCapacity() {
      if (input.capacity) await input.capacity();
    },
  };
  const attempts = new FakeAttemptRepository(records);
  return {
    attempts,
    service: createPaymongoMemberShareCapitalService({
      config,
      client: fakeClient(),
      repository: baseRepository(),
      attemptRepository: attempts,
      memberRepository,
    }),
  };
}

test("member owner can create and safely reuse their own contribution checkout", async () => {
  const { service, attempts } = serviceWith({});
  const input = { requestedAmount: 1500, clientRequestId: "f2cf838e-7e88-4b51-b5ad-2fd235aebfc4" };
  const first = await service.createCheckout(input, memberAuth);
  const second = await service.createCheckout(input, memberAuth);
  assert.equal(first.paymentReferenceId, "101");
  assert.equal(first.checkoutUrl, second.checkoutUrl);
  assert.equal(second.reused, true);
  assert.equal(attempts.calls, 1);
});

test("member without a profile receives a safe not-found error", async () => {
  const { service } = serviceWith({});
  await assert.rejects(
    () => service.getSummary(memberAuth),
    (error) => error instanceof AppError && error.code === "MEMBER_PROFILE_NOT_FOUND",
  );
});

test("Chairman and Bookkeeper cannot use the dedicated Member checkout", async () => {
  const { service } = serviceWith({});
  for (const auth of [chairmanAuth, bookkeeperAuth]) {
    await assert.rejects(
      () => service.createCheckout({
        requestedAmount: 500,
        clientRequestId: crypto.randomUUID(),
      }, auth),
      (error) => error instanceof AppError && error.code === "MEMBER_SHARE_CAPITAL_ROLE_REQUIRED",
    );
  }
});

test("authenticated status lookup does not expose another Member's payment", async () => {
  const other = record("103", {
    memberId: "member-other",
    memberUserId: "user-other",
    submittedBy: "user-other",
    relatedEntityId: "member-other",
  });
  const repository = {
    ...baseRepository(),
    async findPaymentReference() { return other; },
  } as PaymongoRepository;
  const service = createPaymongoService({
    config,
    client: fakeClient(),
    repository,
    attemptRepository: new FakeAttemptRepository(new Map([[other.id, other]])),
  });
  await assert.rejects(
    () => service.getPaymentReferenceStatus(other.id, memberAuth),
    (error) => error instanceof AppError && error.code === "PAYMENT_REFERENCE_FORBIDDEN",
  );
});

test("a Member cannot create a checkout for another member profile", async () => {
  const { service } = serviceWith({
    async prepare(checkout) {
      return record("102", {
        amount: checkout.requestedAmount,
        memberId: "member-other",
        memberUserId: "user-other",
        relatedEntityId: "member-other",
      });
    },
  });
  await assert.rejects(
    () => service.createCheckout({
      requestedAmount: 500,
      clientRequestId: crypto.randomUUID(),
    }, memberAuth),
    (error) => error instanceof AppError && error.code === "MEMBER_SHARE_CAPITAL_FORBIDDEN",
  );
});

test("amount must be positive and projected capital cannot exceed PHP 15,000", () => {
  assert.throws(
    () => assertMemberShareCapitalAmount(0),
    (error) => error instanceof AppError && error.code === "MEMBER_SHARE_CAPITAL_AMOUNT_INVALID",
  );
  assert.throws(
    () => assertMemberShareCapitalCapacity({
      validatedCapital: 14500,
      activePendingCapital: 250,
      requestedAmount: 300,
      maximumShareCapital: 15000,
    }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
  );
});

test("a conflicting active contribution is rejected", async () => {
  const { service } = serviceWith({
    async prepare() {
      throw new AppError(
        "A Share Capital PayMongo checkout is already active",
        409,
        "MEMBER_SHARE_CAPITAL_CHECKOUT_ACTIVE",
      );
    },
  });
  await assert.rejects(
    () => service.createCheckout({
      requestedAmount: 500,
      clientRequestId: crypto.randomUUID(),
    }, memberAuth),
    (error) => error instanceof AppError && error.code === "MEMBER_SHARE_CAPITAL_CHECKOUT_ACTIVE",
  );
});

test("a new contribution can be created after the prior reference is validated", async () => {
  let sequence = 200;
  const { service } = serviceWith({
    async prepare(checkout) {
      sequence += 1;
      return record(String(sequence), { amount: checkout.requestedAmount });
    },
  });
  const first = await service.createCheckout({
    requestedAmount: 1500,
    clientRequestId: crypto.randomUUID(),
  }, memberAuth);
  const second = await service.createCheckout({
    requestedAmount: 500,
    clientRequestId: crypto.randomUUID(),
  }, memberAuth);
  assert.notEqual(first.paymentReferenceId, second.paymentReferenceId);
  assert.equal(first.amount, 1500);
  assert.equal(second.amount, 500);
});

test("summary exposes validated, active pending, PHP 3,000 remainder, and PHP 15,000 capacity", () => {
  const summary = buildMemberShareCapitalSummary({
    profile: {
      id: "member-10",
      userId: memberAuth.user.id,
      memberCode: "NFFAC-2026-000010",
      fullName: "Member Ten",
      email: memberAuth.user.email,
      contactNumber: "09170000000",
      membershipType: "Associate",
      approvalStatus: "Approved",
      officialMemberStatus: "Active",
    },
    settings,
    validatedCapital: 1500,
    activePendingCapital: 500,
    mode: "test",
    activeCheckout: null,
    history: [],
  });
  assert.equal(summary.validatedCapital, 1500);
  assert.equal(summary.activePendingCapital, 500);
  assert.equal(summary.remainingToTrueMember, 1500);
  assert.equal(summary.maximumShareCapital, 15000);
  assert.equal(summary.availableCapacity, 13000);
  assert.equal(summary.mode, "test");
});
