import type { PatronageSourceAmount } from "./patronage.types";
import { rentalRefund, PATRONAGE_RATE } from "./patronage-policy";

export type CalculatedPatronage = PatronageSourceAmount & {
  totalPatronage: number;
  patronageSharePercent: number;
  refundAmount: number;
};

export function calculatePatronageAllocations(
  sources: PatronageSourceAmount[],
  refundPool?: number,
  memberRate = PATRONAGE_RATE,
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

  // Historical fixed-rate periods use 3%; configured periods supply their saved rate.
  if (refundPool === undefined) return normalized.map((source) => ({
    ...source,
    totalPatronage: source.totalPatronage,
    patronageSharePercent: memberRate,
    refundAmount: rentalRefund(source.rentalPatronage, memberRate),
  }));

  if (!Number.isFinite(refundPool) || refundPool < 0) throw new Error("Refund pool must be a non-negative finite amount.");
  const poolCents = Math.round(refundPool * 100);
  const weights = normalized.map((source) => BigInt(Math.round(source.rentalPatronage * 100)));
  const total = weights.reduce((sum, amount) => sum + amount, BigInt(0));
  if (total === BigInt(0)) return [];
  // Largest remainders distribute every cent, with member ID as a stable tie-breaker.
  const shares = weights.map((weight, index) => ({ index, cents: Number(BigInt(poolCents) * weight / total), remainder: BigInt(poolCents) * weight % total }));
  const remaining = poolCents - shares.reduce((sum, share) => sum + share.cents, 0);
  const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? normalized[a.index].memberId.localeCompare(normalized[b.index].memberId) : a.remainder > b.remainder ? -1 : 1);
  for (let index = 0; index < remaining; index++) ranked[index].cents++;
  return normalized.map((source, index) => ({
    ...source,
    patronageSharePercent: Number((Number(weights[index]) / Number(total) * 100).toFixed(6)),
    refundAmount: shares[index].cents / 100,
  }));
}
