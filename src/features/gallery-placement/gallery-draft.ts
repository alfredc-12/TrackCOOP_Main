import type { LibraryPhoto, PlacementSnapshot } from "./gallery-client";
export function photoSignature(photos: Array<LibraryPhoto | null>) {
  return photos.map((p) => p?.id ?? "").join("|");
}
export function snapshotPhotos(snapshot: PlacementSnapshot) {
  return Array.from(
    { length: 7 },
    (_, i) => snapshot.slots.find((s) => s.position === i + 1)?.photo ?? null,
  );
}
export function placePhoto(
  draft: Array<LibraryPhoto | null>,
  photo: LibraryPhoto,
  index: number,
) {
  const next = [...draft];
  const existing = next.findIndex((p) => p?.id === photo.id);
  if (existing === index) return next;
  if (existing >= 0) next[existing] = next[index];
  next[index] = photo;
  return next;
}
export function photoDateBucket(value: string, now = new Date()) {
  const parts = (d: Date) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(d)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    );
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Older";
  const today = parts(now),
    target = parts(parsed);
  const t = Date.UTC(+today.year, +today.month - 1, +today.day),
    d = Date.UTC(+target.year, +target.month - 1, +target.day);
  const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * 86400000;
  if (d === t) return "Today";
  if (d <= t && d >= monday) return "This week";
  if (d <= t && target.year === today.year && target.month === today.month)
    return "This month";
  return "Older";
}
