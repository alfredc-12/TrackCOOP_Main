import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { PaymongoClient } from "./paymongo.client";
import type { PaymongoCheckoutAttemptRepository } from "./paymongo.checkout-attempt.repository";
import type { PaymongoRepository } from "./paymongo.repository";
import { createPaymongoService } from "./paymongo.service";
import type {
  PaymongoCheckoutAttemptRecord,
  PaymongoCheckoutAttemptResult,
  PaymongoCheckoutSession,
  PaymongoConfig,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";

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
  timeoutMs: 1_000,
};

const memberAuth: AuthContext = {
  user: {
    id: "member-user-1",
    displayName: "Member One",
    email: "member@example.test",
    username: "member1",
    role: "member",
  },
  sessionId: "session-1",
  tokenHash: "hash-1",
};

function paymentReference(
  overrides: Partial<PaymongoPaymentReferenceRecord> = {},
): PaymongoPaymentReferenceRecord {
  return {
    id: "900",
    memberId: "300",
    memberUserId: "member-user-1",
    submittedBy: "member-user-1",
    payerName: "Member One",
    payerEmail: "member@example.test",
    payerContact: "09170000000",
    provider: "PayMongo Hosted Checkout",
    referenceNumber: "TC-PAY-900",
    paymentPurpose: "Share Capital",
    relatedEntityType: "member",
    relatedEntityId: "300",
    amount: 1500,
    validationStatus: "Pending",
    paymentChannel: "PayMongo",
    gatewayEnvironment: "Manual",
    gatewayCheckoutId: null,
    gatewayPaymentId: null,
    gatewayPaymentIntentId: null,
    gatewayStatus: null,
    idempotencyKey: null,
    paidAt: null,
    ...overrides,
  };
}

class InMemoryAttemptRepository implements PaymongoCheckoutAttemptRepository {
  private attempts = new Map<string, PaymongoCheckoutAttemptRecord[]>();
  private queues = new Map<string, Promise<void>>();
  createCalls = 0;
  refreshed = 0;

  constructor(private readonly records: Map<string, PaymongoPaymentReferenceRecord>) {}

  private async exclusive<T>(key: string, work: () => Promise<T>) {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.queues.set(key, queued);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.queues.get(key) === queued) this.queues.delete(key);
    }
  }

  async createOrReuseCheckoutAttempt(input: {
    paymentReferenceId: string;
    environment: "Test" | "Live";
    reuseMinutes: number;
    validateRecord(record: PaymongoPaymentReferenceRecord): void;
    createSession(
      record: PaymongoPaymentReferenceRecord,
      idempotencyKey: string,
    ): Promise<PaymongoCheckoutSession>;
  }): Promise<PaymongoCheckoutAttemptResult> {
    return this.exclusive(input.paymentReferenceId, async () => {
      const record = this.records.get(input.paymentReferenceId);
      if (!record) {
        throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      }
      input.validateRecord(record);

      const attempts = this.attempts.get(record.id) ?? [];
      const reusable = [...attempts].reverse().find((attempt) =>
        attempt.gatewayEnvironment === input.environment
        && attempt.reusableUntil.getTime() > Date.now()
        && !attempt.supersededAt
        && !attempt.completedAt
        && attempt.gatewayStatus?.toLowerCase() !== "expired");
      if (reusable?.checkoutUrl) {
        return {
          record,
          attempt: { ...reusable, checkoutUrl: reusable.checkoutUrl },
          reused: true,
        };
      }

      const attemptNumber = attempts.length + 1;
      const idempotencyKey = `trackcoop-paymongo-payment-reference-${record.id}-attempt-${attemptNumber}`;
      this.createCalls += 1;
      const session = await input.createSession(record, idempotencyKey);
      const now = new Date();
      for (const attempt of attempts) {
        if (!attempt.supersededAt && !attempt.completedAt) attempt.supersededAt = now;
      }
      const attempt: PaymongoCheckoutAttemptRecord & { checkoutUrl: string } = {
        id: String(attemptNumber),
        paymentReferenceId: record.id,
        attemptNumber,
        idempotencyKey,
        checkoutId: session.id,
        checkoutUrl: session.checkoutUrl,
        gatewayStatus: session.status,
        gatewayEnvironment: input.environment,
        amount: record.amount,
        currency: "PHP",
        lastCheckedAt: null,
        reusableUntil: new Date(Date.now() + input.reuseMinutes * 60_000),
        supersededAt: null,
        completedAt: null,
      };
      attempts.push(attempt);
      this.attempts.set(record.id, attempts);
      record.gatewayEnvironment = input.environment;
      record.gatewayCheckoutId = session.id;
      record.gatewayStatus = session.status;
      record.idempotencyKey = idempotencyKey;
      return { record, attempt, reused: false };
    });
  }

  async findLatestCheckoutAttempt(paymentReferenceId: string) {
    const attempts = this.attempts.get(paymentReferenceId) ?? [];
    return attempts.at(-1) ?? null;
  }

  async refreshCheckoutAttempt(input: {
    paymentReferenceId: string;
    checkoutId: string;
    session: {
      id: string;
      checkoutUrl: string;
      status: string | null;
      livemode: boolean | null;
      paymentIntentId: string | null;
      paymentId: string | null;
    };
  }) {
    const attempts = this.attempts.get(input.paymentReferenceId) ?? [];
    const attempt = attempts.find((value) => value.checkoutId === input.checkoutId);
    if (!attempt) throw new AppError("Attempt not found", 404, "PAYMONGO_CHECKOUT_ATTEMPT_NOT_FOUND");
    attempt.gatewayStatus = input.session.status;
    attempt.lastCheckedAt = new Date();
    if (input.session.paymentId || input.session.status?.toLowerCase() === "expired") {
      attempt.completedAt = new Date();
    }
    const record = this.records.get(input.paymentReferenceId);
    if (record) {
      record.gatewayStatus = input.session.status;
      record.gatewayPaymentId = input.session.paymentId ?? record.gatewayPaymentId;
      record.gatewayPaymentIntentId = input.session.paymentIntentId ?? record.gatewayPaymentIntentId;
    }
    this.refreshed += 1;
  }

  expireLatest(paymentReferenceId: string) {
    const attempts = this.attempts.get(paymentReferenceId) ?? [];
    const latest = attempts.at(-1);
    if (latest) latest.reusableUntil = new Date(Date.now() - 1);
  }
}

function makeFixture(recordOverrides: Partial<PaymongoPaymentReferenceRecord> = {}) {
  const record = paymentReference(recordOverrides);
  const records = new Map([[record.id, record]]);
  const attemptRepository = new InMemoryAttemptRepository(records);
  const idempotencyKeys: string[] = [];
  let clientCalls = 0;
  const client: PaymongoClient = {
    async createCheckoutSession(_request, idempotencyKey) {
      clientCalls += 1;
      idempotencyKeys.push(idempotencyKey);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        id: `cs_test_${clientCalls}`,
        checkoutUrl: `https://checkout.paymongo.test/cs_test_${clientCalls}`,
        status: "active",
        livemode: false,
        paymentIntentId: null,
        paymentId: null,
      };
    },
    async retrieveCheckoutSession(checkoutSessionId) {
      return {
        id: checkoutSessionId,
        checkoutUrl: `https://checkout.paymongo.test/${checkoutSessionId}`,
        status: "active",
        livemode: false,
        paymentIntentId: null,
        paymentId: null,
      };
    },
  };
  const repository: PaymongoRepository = {
    async findPaymentReference(id) {
      return records.get(id) ?? null;
    },
    async findMembershipApplicationByCode() {
      return null;
    },
    async getMembershipPaymentSettings() {
      return {
        associateFee: 200,
        initialShareCapital: 1500,
        trueMemberRequiredCapital: 3000,
        maximumShareCapital: 15000,
      };
    },
    async getValidatedMembershipPaymentTotal() {
      return 0;
    },
    async prepareMembershipPaymentReference() {
      return record;
    },
    async recordCheckoutSession() {},
  };
  const service = createPaymongoService({
    config,
    client,
    repository,
    attemptRepository,
  });

  return {
    service,
    record,
    attemptRepository,
    idempotencyKeys,
    get clientCalls() {
      return clientCalls;
    },
  };
}

test("first checkout creates attempt 1 and immediate duplicate reuses it", async () => {
  const fixture = makeFixture();
  const first = await fixture.service.createPaymentReferenceCheckout("900", memberAuth);
  const second = await fixture.service.createPaymentReferenceCheckout("900", memberAuth);

  assert.equal(first.attemptNumber, 1);
  assert.equal(first.reused, false);
  assert.equal(second.attemptNumber, 1);
  assert.equal(second.reused, true);
  assert.equal(second.checkoutUrl, first.checkoutUrl);
  assert.equal(fixture.clientCalls, 1);
});

test("expired local attempt creates attempt 2 with a new idempotency key", async () => {
  const fixture = makeFixture();
  await fixture.service.createPaymentReferenceCheckout("900", memberAuth);
  fixture.attemptRepository.expireLatest("900");
  const second = await fixture.service.createPaymentReferenceCheckout("900", memberAuth);

  assert.equal(second.attemptNumber, 2);
  assert.equal(second.reused, false);
  assert.equal(fixture.clientCalls, 2);
  assert.equal(fixture.idempotencyKeys.length, 2);
  assert.notEqual(fixture.idempotencyKeys[0], fixture.idempotencyKeys[1]);
});

test("concurrent duplicate clicks produce one active attempt and one PayMongo call", async () => {
  const fixture = makeFixture();
  const [first, second] = await Promise.all([
    fixture.service.createPaymentReferenceCheckout("900", memberAuth),
    fixture.service.createPaymentReferenceCheckout("900", memberAuth),
  ]);

  assert.equal(first.attemptNumber, 1);
  assert.equal(second.attemptNumber, 1);
  assert.equal(fixture.clientCalls, 1);
  assert.equal([first.reused, second.reused].filter(Boolean).length, 1);
});

test("browser cancellation does not mutate payment validation or create another attempt", async () => {
  const fixture = makeFixture();
  const checkout = await fixture.service.createPaymentReferenceCheckout("900", memberAuth);

  assert.equal(checkout.validationStatus, "Pending");
  assert.equal(fixture.record.validationStatus, "Pending");
  assert.equal(fixture.clientCalls, 1);
  assert.equal((await fixture.attemptRepository.findLatestCheckoutAttempt("900"))?.attemptNumber, 1);
});

test("Validated, Reversed, and unsupported-purpose payments cannot create checkout", async () => {
  for (const [overrides, code] of [
    [{ validationStatus: "Validated" as const }, "PAYMENT_ALREADY_VALIDATED"],
    [{ validationStatus: "Reversed" as const }, "PAYMENT_REVERSED"],
    [{ paymentPurpose: "Rental" }, "PAYMENT_PURPOSE_GATEWAY_NOT_IMPLEMENTED"],
  ] as const) {
    const fixture = makeFixture(overrides);
    await assert.rejects(
      () => fixture.service.createPaymentReferenceCheckout("900", memberAuth),
      (error) => error instanceof AppError && error.code === code,
    );
    assert.equal(fixture.clientCalls, 0);
  }
});

test("checkout URL is not exposed to an unauthorized member", async () => {
  const fixture = makeFixture();
  const otherAuth: AuthContext = {
    ...memberAuth,
    user: { ...memberAuth.user, id: "other-member" },
  };

  await assert.rejects(
    () => fixture.service.createPaymentReferenceCheckout("900", otherAuth),
    (error) => error instanceof AppError && error.code === "PAYMENT_REFERENCE_FORBIDDEN",
  );
  assert.equal(fixture.clientCalls, 0);
  assert.equal(fixture.attemptRepository.createCalls, 0);
});

test("status inquiry updates safe local status without validating or exposing checkout URL", async () => {
  const fixture = makeFixture();
  await fixture.service.createPaymentReferenceCheckout("900", memberAuth);
  const status = await fixture.service.getPaymentReferenceStatus("900", memberAuth);

  assert.equal(status.validationStatus, "Pending");
  assert.equal(status.gatewayStatus, "active");
  assert.equal(status.checkoutAttemptNumber, 1);
  assert.equal(fixture.attemptRepository.refreshed, 1);
  assert.ok(!("checkoutUrl" in status));
});
