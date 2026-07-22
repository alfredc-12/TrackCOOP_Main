function normalizeSqlInteger(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;

  const integer = Math.trunc(value);
  if (integer < 0) return fallback;

  return Math.min(integer, max);
}

export function limitOffsetSql(limit: number, offset: number) {
  const safeLimit = Math.max(1, normalizeSqlInteger(limit, 20, 1000));
  const safeOffset = normalizeSqlInteger(offset, 0, 1_000_000);

  return `LIMIT ${safeLimit} OFFSET ${safeOffset}`;
}
