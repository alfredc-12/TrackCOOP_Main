import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RecentLandingPhoto } from "./landing.types";

type PhotoRow = RowDataPacket & {
  recordId: string;
  source: RecentLandingPhoto["source"];
  title: string;
  caption: string | null;
  imagePath: string;
  publishedAt: Date;
};

function plainCaption(value: string | null) {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return (value ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match;
      const code = entity.toLowerCase().startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadRecentLandingPhotos(pool: Pick<Pool, "execute">): Promise<RecentLandingPhoto[]> {
  const [rows] = await pool.execute<PhotoRow[]>(
    `SELECT recent.source, CAST(recent.recordId AS CHAR) AS recordId,
            recent.title, recent.caption, recent.imagePath, recent.publishedAt
       FROM (
         SELECT 'gallery' AS source, g.gallery_group_id AS recordId,
                g.title, g.caption, i.image_path AS imagePath,
                COALESCE(g.published_at, g.created_at) AS publishedAt
           FROM gallery_groups g
           JOIN gallery_images i ON i.gallery_image_id = (
             SELECT gi.gallery_image_id FROM gallery_images gi
              WHERE gi.gallery_group_id = g.gallery_group_id
                AND gi.public_visibility = 1
              ORDER BY gi.sort_order ASC, gi.gallery_image_id ASC LIMIT 1
           )
          WHERE g.public_visibility = 1 AND g.gallery_status = 'Published'
         UNION ALL
         SELECT 'announcement' AS source, a.announcement_id AS recordId,
                a.title, COALESCE(NULLIF(TRIM(a.excerpt), ''), a.message) AS caption,
                CASE WHEN ai.announcement_image_id IS NOT NULL THEN ai.image_path
                     ELSE a.featured_image_path END AS imagePath,
                COALESCE(a.posted_at, a.publish_at, a.created_at) AS publishedAt
           FROM announcements a
           LEFT JOIN announcement_images ai ON ai.announcement_image_id = (
             SELECT first_image.announcement_image_id FROM announcement_images first_image
              WHERE first_image.announcement_id = a.announcement_id
              ORDER BY first_image.sort_order ASC, first_image.announcement_image_id ASC LIMIT 1
           )
          WHERE a.audience_type = 'Public' AND a.announcement_status = 'Published'
            AND (a.expires_at IS NULL OR a.expires_at >= NOW())
            AND (a.publish_at IS NULL OR a.publish_at <= NOW())
       ) recent
      WHERE NULLIF(TRIM(recent.imagePath), '') IS NOT NULL
        AND recent.publishedAt <= NOW()
      ORDER BY recent.publishedAt DESC, recent.source ASC, recent.recordId DESC
      LIMIT 7`,
  );

  return rows.map((row) => ({
    id: `${row.source}:${row.recordId}`,
    source: row.source,
    title: row.title,
    caption: plainCaption(row.caption),
    imagePath: row.imagePath.trim(),
    publishedAt: row.publishedAt.toISOString(),
  }));
}
