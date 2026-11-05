import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationPaymentPolicy,
  calendarMonths,
  capitalCompletion,
  manilaDate,
  MEMBERSHIP_FEE,
  INITIAL_CAPITAL,
  REQUIRED_CAPITAL,
} from "./membership-policy";
test("membership payment amounts stay separate", () => {
  assert.equal(MEMBERSHIP_FEE, 200);
  assert.equal(MEMBERSHIP_FEE + INITIAL_CAPITAL, 1700);
  assert.equal(MEMBERSHIP_FEE + REQUIRED_CAPITAL, 3200);
});
test("Manila anniversaries clamp month ends and leap years", () => {
  assert.equal(manilaDate("2026-01-31T17:00:00Z"), "2026-02-01");
  assert.equal(calendarMonths("2026-08-31", 6), "2027-02-28");
  assert.equal(calendarMonths("2027-08-31", 6), "2028-02-29");
});
test("reminder and inclusive six-month deadline; late completion wins", () => {
  const base = { startedOn: "2026-01-31", validated: 1500, pending: 1500 };
  assert.equal(
    capitalCompletion({ ...base, asOf: "2026-04-29" }).status,
    "In Progress",
  );
  assert.equal(
    capitalCompletion({ ...base, asOf: "2026-04-30" }).status,
    "Reminder",
  );
  assert.equal(
    capitalCompletion({ ...base, asOf: "2026-07-31" }).status,
    "Reminder",
  );
  assert.equal(
    capitalCompletion({ ...base, asOf: "2026-08-01" }).status,
    "Overdue",
  );
  assert.equal(
    capitalCompletion({ ...base, validated: 3000, asOf: "2026-08-01" }).status,
    "Completed",
  );
  assert.equal(capitalCompletion(base).remaining, 1500);
});
test("legacy fee/target snapshot overrides changed settings", () => {
  const legacy = applicationPaymentPolicy(
    { membershipFeeAmount: 0, targetShareCapitalAmount: 1500 },
    {
      associateFee: 200,
      initialShareCapital: 1500,
      trueMemberRequiredCapital: 3000,
      maximumShareCapital: 15000,
    },
  );
  assert.equal(legacy.associateFee, 0);
  assert.equal(legacy.trueMemberRequiredCapital, 1500);
});
