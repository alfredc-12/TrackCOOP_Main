import { z } from "zod";
import { AppError } from "../../utils/app-error";
import type { LibraryPhoto, PhotoReference } from "./gallery-placement.types";
const id = z.string().regex(/^[1-9]\d{0,19}$/);
export const referenceSchema = z
  .object({ source: z.enum(["gallery", "announcement"]), photoId: id })
  .strict();
export const placementSchema = z
  .object({
    expectedRevision: z.string().regex(/^\d{1,20}$/),
    slots: z
      .array(
        z
          .object({
            position: z.number().int().min(1).max(7),
            photo: referenceSchema.nullable(),
          })
          .strict(),
      )
      .length(7),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.slots.map((s) => s.position)).size !== 7)
      ctx.addIssue({
        code: "custom",
        message: "Each of the seven positions is required once.",
        path: ["slots"],
      });
    const keys = v.slots.flatMap((s) => (s.photo ? [photoKey(s.photo)] : []));
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        message: "Choose each photo only once.",
        path: ["slots"],
      });
  });
export const librarySchema = z.object({
  source: z.enum(["all", "gallery", "announcement"]).default("all"),
  search: z.string().trim().max(190).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
});
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new AppError(
      "Review the photo selection and reload if needed.",
      422,
      "INVALID_GALLERY_PLACEMENT",
      r.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    );
  return r.data;
}
export function photoKey(p: PhotoReference) {
  return `${p.source}:${p.photoId}`;
}
export function assetKey(path: string) {
  return path
    .trim()
    .replace(/^\/?(?:public\/|storage\/)?uploads\//, "uploads/");
}
export function assertDistinctPhotos(photos: LibraryPhoto[]) {
  const ids = new Set<string>(),
    assets = new Set<string>();
  for (const p of photos) {
    if (ids.has(p.id) || assets.has(assetKey(p.imagePath)))
      throw new AppError(
        "The same photo cannot occupy two positions.",
        422,
        "DUPLICATE_GALLERY_PHOTO",
      );
    ids.add(p.id);
    assets.add(assetKey(p.imagePath));
  }
}
// One from each original group first; remaining positions can use other photos from those groups.
export function proposePhotos<
  T extends { source: string; groupId: string; imagePath: string },
>(photos: T[], randomIndex: (max: number) => number): T[] {
  const shuffled = [...photos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups = new Set<string>(),
    assets = new Set<string>(),
    chosen: T[] = [],
    rest: T[] = [];
  for (const p of shuffled) {
    const key = assetKey(p.imagePath),
      group = `${p.source}:${p.groupId}`;
    if (assets.has(key)) continue;
    if (groups.has(group)) {
      rest.push(p);
      continue;
    }
    groups.add(group);
    assets.add(key);
    chosen.push(p);
    if (chosen.length === 7) return chosen;
  }
  for (const p of rest) {
    const key = assetKey(p.imagePath);
    if (assets.has(key)) continue;
    assets.add(key);
    chosen.push(p);
    if (chosen.length === 7) break;
  }
  return chosen;
}
