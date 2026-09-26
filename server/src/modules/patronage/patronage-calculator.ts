import type { PatronageSourceAmount } from "./patronage.types";

export type CalculatedPatronage = PatronageSourceAmount & {
  totalPatronage: number;
  patronageSharePercent: number;
  refundAmount: number;
};

export function calculatePatronageAllocations(
  sources: PatronageSourceAmount[],
  refundPool: number,
): CalculatedPatronage[] {
  const normalized = sources
    .map((source) => ({
      ...source,
      purchasePatronage: Math.max(0, Number(source.purchasePatronage) || 0),
      rentalPatronage: Math.max(0, Number(source.rentalPatronage) || 0),
    }))
    .map((source) => ({
      ...source,
      totalPatronage: source.purchasePatronage + source.rentalPatronage,
    }))
    .filter((source) => source.totalPatronage > 0);

  const totalPatronage = normalized.reduce((sum, source) => sum + source.totalPatronage, 0);
  const poolCents = Math.round(Math.max(0, refundPool) * 100);
  if (totalPatronage <= 0 || poolCents <= 0) return [];

  const provisional = normalized.map((source) => {
    const exactCents = (poolCents * source.totalPatronage) / totalPatronage;
    const cents = Math.floor(exactCents);
    return { source, exactCents, cents, remainder: exactCents - cents };
  });

  const remainingCents = poolCents - provisional.reduce((sum, item) => sum + item.cents, 0);
  const remainderOrder = [...provisional].sort(
    (a, b) => b.remainder - a.remainder || a.source.memberId.localeCompare(b.source.memberId),
  );
  for (let index = 0; index < remainingCents; index += 1) {
    remainderOrder[index % remainderOrder.length].cents += 1;
  }

  return provisional.map(({ source, cents }) => ({
    ...source,
    totalPatronage: source.totalPatronage,
    patronageSharePercent: (source.totalPatronage / totalPatronage) * 100,
    refundAmount: cents / 100,
  }));
}
