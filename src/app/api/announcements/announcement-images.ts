import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

type AnnouncementWithImages = RowDataPacket & {
  id?: string | number;
  featuredImagePath?: string | null;
  images?: string[];
};

export function normalizeAnnouncementImages(body: Record<string, unknown>) {
  const list =
    Array.isArray(body.images)
      ? body.images
      : Array.isArray(body.imagePaths)
        ? body.imagePaths
        : [];

  const featured =
    typeof body.featuredImagePath === "string" && body.featuredImagePath.trim()
      ? body.featuredImagePath.trim()
      : null;

  const images = list
    .filter((image): image is string => typeof image === "string")
    .map((image) => image.trim())
    .filter(Boolean);

  return Array.from(new Set(featured ? [featured, ...images] : images));
}

export function hasAnnouncementImagePayload(body: Record<string, unknown>) {
  return (
    Object.prototype.hasOwnProperty.call(body, "images") ||
    Object.prototype.hasOwnProperty.call(body, "imagePaths") ||
    Object.prototype.hasOwnProperty.call(body, "featuredImagePath")
  );
}

export async function addImagesToAnnouncements<T extends AnnouncementWithImages>(
  announcements: T[],
) {
  if (announcements.length === 0) return announcements;

  const ids = announcements
    .map((announcement) => announcement.id)
    .filter((id): id is string | number => id !== undefined && id !== null);

  if (ids.length === 0) return announcements;

  const placeholders = ids.map(() => "?").join(", ");

  const [imageRows] = await db.query<RowDataPacket[]>(
    `SELECT announcement_id as announcementId, image_path as imagePath
       FROM announcement_images
      WHERE announcement_id IN (${placeholders})
      ORDER BY announcement_id, sort_order, announcement_image_id`,
    ids,
  );

  const imagesByAnnouncement = new Map<string, string[]>();
  for (const row of imageRows) {
    const key = String(row.announcementId);
    const images = imagesByAnnouncement.get(key) ?? [];
    images.push(row.imagePath);
    imagesByAnnouncement.set(key, images);
  }

  return announcements.map((announcement) => {
    const images =
      imagesByAnnouncement.get(String(announcement.id)) ??
      (announcement.featuredImagePath ? [announcement.featuredImagePath] : []);

    return { ...announcement, images };
  });
}

export async function replaceAnnouncementImages(
  announcementId: string | number,
  imagePaths: string[],
  altText?: string,
) {
  await db.query(`DELETE FROM announcement_images WHERE announcement_id = ?`, [
    announcementId,
  ]);

  for (const [index, imagePath] of imagePaths.entries()) {
    await db.query(
      `INSERT IGNORE INTO announcement_images
         (announcement_id, image_path, alt_text, sort_order, is_featured)
       VALUES (?, ?, ?, ?, ?)`,
      [announcementId, imagePath, altText ?? null, index, index === 0 ? 1 : 0],
    );
  }
}
