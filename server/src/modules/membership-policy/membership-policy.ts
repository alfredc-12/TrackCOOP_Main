/** Policy snapshots apply only to applications/upgrade requests created after rollout. */
export const MEMBERSHIP_POLICY_VERSION = "membership-2026-11-v2";
export const MEMBERSHIP_FEE = 200;
export const INITIAL_CAPITAL = 1500;
export const REQUIRED_CAPITAL = 3000;
export const MAXIMUM_CAPITAL = 15000;
export type CapitalCompletionStatus =
  | "In Progress"
  | "Reminder"
  | "Overdue"
  | "Completed";

export function manilaDate(value: Date | string = new Date()): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)
      throw new Error("Invalid membership date");
    return value;
  }
  const date =
    value instanceof Date
      ? value
      : new Date(
          value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)
            ? value
            : `${value.replace(" ", "T")}Z`,
        );
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid membership date");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function calendarMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0));
  const result = new Date(
    Date.UTC(
      last.getUTCFullYear(),
      last.getUTCMonth(),
      Math.min(d, last.getUTCDate()),
    ),
  );
  return result.toISOString().slice(0, 10);
}
export function capitalCompletion(input: {
  startedOn: string;
  validated: number;
  pending?: number;
  target?: number;
  deadline?: string;
  asOf?: string;
}) {
  const target = input.target ?? REQUIRED_CAPITAL;
  const deadline = input.deadline ?? calendarMonths(input.startedOn, 6);
  const reminderOn = calendarMonths(input.startedOn, 3);
  const asOf = input.asOf ?? manilaDate();
  const validated = Math.round(input.validated * 100) / 100;
  const status: CapitalCompletionStatus =
    validated >= target
      ? "Completed"
      : asOf > deadline
        ? "Overdue"
        : asOf >= reminderOn
          ? "Reminder"
          : "In Progress";
  return {
    applicationDate: input.startedOn,
    reminderOn,
    deadline,
    validated,
    pending: input.pending ?? 0,
    target,
    remaining: Math.max(0, target - validated),
    percentage: Math.min(100, Math.max(0, (validated / target) * 100)),
    status,
    eligibleForTrueMembershipReview: validated >= target,
  };
}
/** New and legacy applications use their stored obligations, never today's settings. */
export function applicationPaymentPolicy(
  application: {
    requestedMembershipType?: string;
    membershipFeeAmount?: number | string;
    initialShareCapitalAmount?: number | string;
    targetShareCapitalAmount?: number | string;
  },
  fallback: {
    associateFee: number;
    initialShareCapital: number;
    trueMemberRequiredCapital: number;
    maximumShareCapital: number;
  },
) {
  return {
    ...fallback,
    associateFee:
      application.membershipFeeAmount == null
        ? application.requestedMembershipType === "True Member"
          ? 0
          : fallback.associateFee
        : Number(application.membershipFeeAmount),
    initialShareCapital:
      application.initialShareCapitalAmount == null
        ? fallback.initialShareCapital
        : Number(application.initialShareCapitalAmount),
    trueMemberRequiredCapital:
      application.targetShareCapitalAmount == null
        ? fallback.trueMemberRequiredCapital
        : Number(application.targetShareCapitalAmount),
  };
}
