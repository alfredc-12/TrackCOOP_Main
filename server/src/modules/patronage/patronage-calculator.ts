import type { PatronageSourceAmount } from "./patronage.types";
import { rentalRefund, PATRONAGE_RATE } from "./patronage-policy";

export type CalculatedPatronage = PatronageSourceAmount & {
  totalPatronage: number;
  patronageSharePercent: number;
  refundAmount: number;
};

export function calculatePatronageAllocations(
  sources: PatronageSourceAmount[],
): CalculatedPatronage[] {
  const normalized = sources
    .map((source) => ({
      ...source,
      purchasePatronage: 0,
      rentalPatronage: Math.max(0, Number(source.rentalPatronage) || 0),
    }))
    .map((source) => ({
      ...source,
      totalPatronage: source.rentalPatronage,
    }))
    .filter((source) => source.membershipType === "True Member" && source.totalPatronage > 0);

  return normalized.map((source) => ({
    ...source,
    totalPatronage: source.totalPatronage,
    patronageSharePercent: PATRONAGE_RATE,
    refundAmount: rentalRefund(source.rentalPatronage),
  }));
}
