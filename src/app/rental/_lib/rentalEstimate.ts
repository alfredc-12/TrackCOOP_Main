import type { RentalFeeEstimate, RentalService, RequesterType } from "../_types/rental";

const MS_PER_DAY = 86_400_000;

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

  const preferredRate =
    requesterType === "Member" ? service.memberRate : service.nonMemberRate;
  const dailyRate = preferredRate ?? service.standardRate ?? undefined;
  if (dailyRate === undefined || dailyRate === null || dailyRate <= 0) {
    return undefined;
  }

  return {
    days,
    dailyRate,
    rateLabel:
      preferredRate != null
        ? requesterType === "Member"
          ? "Member rate"
          : "Non-member rate"
        : "Standard rate",
    total: days * dailyRate,
    currency: "PHP",
  };
}
