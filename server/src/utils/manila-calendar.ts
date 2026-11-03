/** Calendar-only helpers. Stored UTC instants and Philippine reporting days remain distinct. */
export function manilaToday(now = new Date()) {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function utcBoundary(day: string, next = false) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 8 * 3_600_000 + (next ? 86_400_000 : 0))
    .toISOString().slice(0, 19).replace("T", " ");
}
