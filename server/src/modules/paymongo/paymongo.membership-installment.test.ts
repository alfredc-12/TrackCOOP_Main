import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import {
  buildPublicMembershipPaymentSummary,
  formatApplicationCapitalReference,
  validateApplicationShareCapitalAmount,
} from "./paymongo.membership-installment.repository";

const settings = {
  associateFee: 200,
  initialShareCapital: 1500,
  trueMemberRequiredCapital: 3000,
  maximumShareCapital: 15000,
};

type Entry = {
  reference: string;
  purpose: "Associate Membership Fee" | "Share Capital";
  amount: number;
  validated: boolean;
  active: boolean;
  attempt: number;
};

class Lock {
  private tail = Promise.resolve();

  async run<T>(work: () => Promise<T>) {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  }
}

class InstallmentBook {
  readonly entries: Entry[] = [];
  readonly lock = new Lock();
  clientCalls = 0;

  async checkout(input: {
    applicationCode?: string;
    membershipType?: "Associate" | "True Member";
    purpose: Entry["purpose"];
    amount?: number;
  }) {
    return this.lock.run(async () => {
      const applicationCode = input.applicationCode ?? "MEM-APP-2026-000300";
      const membershipType = input.membershipType ?? "True Member";
      const related = this.entries.filter((entry) => entry.purpose === input.purpose);
      const validated = related.filter((entry) => entry.validated)
        .reduce((sum, entry) => sum + entry.amount, 0);
      const pending = related.find((entry) => !entry.validated);

      if (input.purpose === "Associate Membership Fee") {
        if (validated >= settings.associateFee) {
          throw new AppError("Fee paid", 409, "MEMBERSHIP_FEE_ALREADY_VALIDATED");
        }
        if (pending?.active) return pending;
        if (pending) {
          pending.attempt += 1;
          pending.active = true;
          this.clientCalls += 1;
          return pending;
        }
        const created: Entry = {
          reference: `${applicationCode}-FEE`,
          purpose: input.purpose,
          amount: settings.associateFee,
          validated: false,
          active: true,
          attempt: 1,
        };
        this.entries.push(created);
        this.clientCalls += 1;
        return created;
      }

      if (membershipType !== "True Member") {
        throw new AppError("True Member required", 409, "SHARE_CAPITAL_TRUE_MEMBER_REQUIRED");
      }
      const amount = input.amount ?? 0;
      if (pending) {
        if (pending.amount !== amount) {
          throw new AppError("Pending amount mismatch", 409, "SHARE_CAPITAL_PENDING_AMOUNT_MISMATCH");
        }
        if (!pending.active) {
          pending.attempt += 1;
          pending.active = true;
          this.clientCalls += 1;
        }
        return pending;
      }

      validateApplicationShareCapitalAmount({
        requestedAmount: amount,
        validatedAmount: validated,
        otherActivePendingAmount: related.filter((entry) => entry.active && !entry.validated)
          .reduce((sum, entry) => sum + entry.amount, 0),
        initialShareCapital: settings.initialShareCapital,
        maximumShareCapital: settings.maximumShareCapital,
      });
      const created: Entry = {
        reference: formatApplicationCapitalReference(applicationCode, related.length + 1),
        purpose: input.purpose,
        amount,
        validated: false,
        active: true,
        attempt: 1,
      };
      this.entries.push(created);
      this.clientCalls += 1;
      return created;
    });
  }

  validate(reference: string) {
    const entry = this.entries.find((candidate) => candidate.reference === reference);
    if (!entry) throw new Error("Missing test entry");
    entry.validated = true;
    entry.active = false;
  }

  abandon(reference: string) {
    const entry = this.entries.find((candidate) => candidate.reference === reference);
    if (!entry) throw new Error("Missing test entry");
    entry.active = false;
  }
}

test("PHP 1,500 plus PHP 1,500 creates two references and PHP 3,000 validated total", async () => {
  const book = new InstallmentBook();
  const first = await book.checkout({ purpose: "Share Capital", amount: 1500 });
  book.validate(first.reference);
  const second = await book.checkout({ purpose: "Share Capital", amount: 1500 });
  book.validate(second.reference);

  assert.deepEqual([first.reference, second.reference], [
    "MEM-APP-2026-000300-CAP-001",
    "MEM-APP-2026-000300-CAP-002",
  ]);
  assert.equal(book.entries.filter((entry) => entry.validated)
    .reduce((sum, entry) => sum + entry.amount, 0), 3000);
});

test("three installments receive three unique sequential references", async () => {
  const book = new InstallmentBook();
  const references: string[] = [];
  for (const amount of [1500, 1500, 500]) {
    const entry = await book.checkout({ purpose: "Share Capital", amount });
    references.push(entry.reference);
    book.validate(entry.reference);
  }
  assert.deepEqual(references, [
    "MEM-APP-2026-000300-CAP-001",
    "MEM-APP-2026-000300-CAP-002",
    "MEM-APP-2026-000300-CAP-003",
  ]);
  assert.equal(new Set(references).size, 3);
});

test("concurrent duplicate clicks allocate one reference and one gateway call", async () => {
  const book = new InstallmentBook();
  const [first, second] = await Promise.all([
    book.checkout({ purpose: "Share Capital", amount: 1500 }),
    book.checkout({ purpose: "Share Capital", amount: 1500 }),
  ]);
  assert.equal(first.reference, second.reference);
  assert.equal(book.entries.length, 1);
  assert.equal(book.clientCalls, 1);
});

test("Associate applications cannot start Share Capital checkout", async () => {
  const book = new InstallmentBook();
  await assert.rejects(
    () => book.checkout({ membershipType: "Associate", purpose: "Share Capital", amount: 1500 }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_TRUE_MEMBER_REQUIRED",
  );
});

test("validated membership fee cannot create a duplicate fee reference", async () => {
  const book = new InstallmentBook();
  const fee = await book.checkout({ purpose: "Associate Membership Fee" });
  book.validate(fee.reference);
  await assert.rejects(
    () => book.checkout({ purpose: "Associate Membership Fee" }),
    (error) => error instanceof AppError && error.code === "MEMBERSHIP_FEE_ALREADY_VALIDATED",
  );
  assert.equal(book.entries.length, 1);
});

test("PHP 15,000 maximum includes validated and active pending capital", () => {
  assert.throws(
    () => validateApplicationShareCapitalAmount({
      requestedAmount: 600,
      validatedAmount: 14000,
      otherActivePendingAmount: 500,
      initialShareCapital: 1500,
      maximumShareCapital: 15000,
    }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
  );
});

test("abandoned checkout stops reserving capital and renews the same reference", async () => {
  const book = new InstallmentBook();
  const first = await book.checkout({ purpose: "Share Capital", amount: 1500 });
  book.abandon(first.reference);
  const renewed = await book.checkout({ purpose: "Share Capital", amount: 1500 });

  assert.equal(renewed.reference, first.reference);
  assert.equal(renewed.attempt, 2);
  assert.equal(book.entries.length, 1);
  assert.equal(book.clientCalls, 2);
});

test("public aggregates are safe and active checkout is not treated as confirmed", () => {
  const summary = buildPublicMembershipPaymentSummary({
    mode: "test",
    gatewayEnabled: true,
    applicationStatus: "Under Review",
    requestedMembershipType: "True Member",
    settings,
    feeValidatedAmount: 200,
    feePendingAmount: 0,
    capitalValidatedAmount: 1500,
    capitalPendingAmount: 1500,
    installmentCount: 2,
    latestCheckout: {
      paymentPurpose: "Share Capital",
      referenceNumber: "MEM-APP-2026-000300-CAP-002",
      amount: 1500,
      gatewayStatus: "active",
      createdAt: new Date("2026-07-27T08:00:00.000Z"),
      reusableUntil: new Date("2026-07-27T08:30:00.000Z"),
      isReusable: true,
    },
    feeRequirementStatus: "Verified",
    capitalRequirementStatus: "Verified",
  });

  assert.equal(summary.membershipFee.status, "Confirmed");
  assert.equal(summary.shareCapital.validatedAmount, 1500);
  assert.equal(summary.shareCapital.pendingAmount, 1500);
  assert.equal(summary.shareCapital.remainingToTarget, 0);
  assert.equal(summary.shareCapital.remainingToMaximum, 12000);
  assert.equal(summary.shareCapital.installmentCount, 2);
  assert.equal(summary.latestCheckout?.gatewayStatus, "active");
  assert.ok(!("paymentReferenceId" in summary));
  assert.ok(!("trackingTokenHash" in summary));
  assert.ok(!("checkoutUrl" in (summary.latestCheckout ?? {})));
});
