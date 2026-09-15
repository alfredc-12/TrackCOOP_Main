import type { RentalFeeEstimate, RentalService, RequesterType } from "../_types/rental";

const MS_PER_DAY = 86_400_000;
export const MEMBER_RENTAL_DISCOUNT_PERCENT = 20;
export const MEMBER_RENTAL_DISCOUNT_RATE = MEMBER_RENTAL_DISCOUNT_PERCENT / 100;

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const parsed = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function getInclusiveRentalDays(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (start === undefined || end === undefined || end < start) return undefined;
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

export function estimateRentalFee({
  service,
  requesterType,
  startDate,
  endDate,
}: {
  service?: Pick<RentalService, "standardRate" | "memberRate" | "nonMemberRate">;
  requesterType: RequesterType;
  startDate: string;
  endDate: string;
}): RentalFeeEstimate | undefined {
  const days = getInclusiveRentalDays(startDate, endDate);
  if (!service || !days) return undefined;

  const originalDailyRate = service.standardRate ?? undefined;
  if (
    originalDailyRate === undefined ||
    originalDailyRate === null ||
    originalDailyRate <= 0
  ) {
    return undefined;
  }

  const discountPercent =
    requesterType === "Member" ? MEMBER_RENTAL_DISCOUNT_PERCENT : 0;
  const discountAmount =
    requesterType === "Member"
      ? roundMoney(originalDailyRate * MEMBER_RENTAL_DISCOUNT_RATE)
      : 0;
  const dailyRate = roundMoney(originalDailyRate - discountAmount);

  return {
    days,
    originalDailyRate,
    dailyRate,
    discountPercent,
    discountAmount,
    rateLabel:
      requesterType === "Member" ? "Member discounted rate" : "Regular rate",
    total: roundMoney(days * dailyRate),
    currency: "PHP",
  };
}

export function getMemberDiscountedRate(rate?: number | null) {
  if (rate === undefined || rate === null || rate <= 0) return undefined;
  return roundMoney(rate * (1 - MEMBER_RENTAL_DISCOUNT_RATE));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
