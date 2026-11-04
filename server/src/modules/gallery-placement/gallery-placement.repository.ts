import { randomInt } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import {
  assertDistinctPhotos,
  assetKey,
  photoKey,
  proposePhotos,
} from "./gallery-placement.policy";
import type {
  LibraryGroup,
  LibraryPhoto,
  LibraryQuery,
  PhotoReference,
  PhotoSource,
  PlacementInput,
  PlacementSnapshot,
  PlacementSlot,
} from "./gallery-placement.types";
type Db = Pool | PoolConnection;
type Row = RowDataPacket & Record<string, unknown>;
const galleryEligible =
  "g.public_visibility=1 AND g.gallery_status='Published' AND i.public_visibility=1";
const announcementEligible =
  "g.audience_type='Public' AND g.announcement_status='Published' AND (g.publish_at IS NULL OR g.publish_at<=NOW()) AND (g.expires_at IS NULL OR g.expires_at>=NOW()) AND COALESCE(g.posted_at,g.publish_at,g.created_at)<=NOW()";
const date = (v: unknown) =>
  v instanceof Date ? v.toISOString() : String(v ?? "");
const safePath = (v: unknown) =>
  typeof v === "string" &&
  Boolean(v.trim()) &&
  !/^\s*(?:javascript:|data:|blob:)/i.test(v);
function photo(row: Row, source: PhotoSource): LibraryPhoto {
  return {
    id: `${source}:${row.photoId}`,
    source,
    photoId: String(row.photoId),
    groupId: String(row.groupId),
    imagePath: String(row.imagePath ?? ""),
    thumbnailPath: row.thumbnailPath ? String(row.thumbnailPath) : null,
    altText: String(row.altText || row.title || "Cooperative photo"),
    eligible: Boolean(Number(row.eligible)) && safePath(row.imagePath),
    unavailableReason:
      Number(row.eligible) && safePath(row.imagePath)
        ? null
        : "This photo is not currently public and published.",
  };
}
function selectionSql(source: PhotoSource, where: string, lock = false) {
  const gallery = source === "gallery";
  return `SELECT CAST(i.${gallery ? "gallery_image_id" : "announcement_image_id"} AS CHAR) photoId,CAST(g.${gallery ? "gallery_group_id" : "announcement_id"} AS CHAR) groupId,i.image_path imagePath,${gallery ? "i.thumbnail_path" : "NULL"} thumbnailPath,i.alt_text altText,g.title,(${gallery ? galleryEligible : announcementEligible}) eligible FROM ${gallery ? "gallery_images" : "announcement_images"} i JOIN ${gallery ? "gallery_groups" : "announcements"} g ON g.${gallery ? "gallery_group_id" : "announcement_id"}=i.${gallery ? "gallery_group_id" : "announcement_id"} WHERE ${where} ORDER BY i.sort_order,i.${gallery ? "gallery_image_id" : "announcement_image_id"}${lock ? " FOR UPDATE" : ""}`;
}
export function createGalleryPlacementRepository(pool?: Pool) {
  const db = () => pool ?? getPool();
  async function selected(ref: PhotoReference, conn: Db = db(), lock = false) {
    const column =
      ref.source === "gallery" ? "gallery_image_id" : "announcement_image_id";
    const [r] = await conn.execute<Row[]>(
      selectionSql(ref.source, `i.${column}=?`, lock),
      [ref.photoId],
    );
    return r[0] ? photo(r[0], ref.source) : null;
  }
  async function snapshot(conn?: Db, lock = false): Promise<PlacementSnapshot> {
    if (!conn) return withTransaction((c) => snapshot(c, lock), db());
    const [state] = await conn.execute<Row[]>(
      `SELECT CAST(revision AS CHAR) revision FROM gallery_landing_state WHERE state_id=1${lock ? " FOR UPDATE" : ""}`,
    );
    if (!state[0])
      throw new AppError(
        "Homepage photo placement is not ready yet. Ask your system administrator to complete the gallery setup.",
        503,
        "GALLERY_SETUP_REQUIRED",
      );
    const [rows] = await conn.execute<Row[]>(
      "SELECT slot_key,source_type,gallery_group_id,gallery_image_id,announcement_id,announcement_image_id FROM gallery_landing_slots WHERE slot_key IN ('gallery-feature-1','gallery-feature-2','gallery-feature-3','gallery-feature-4','gallery-feature-5','gallery-feature-6','gallery-feature-7')",
    );
    const slots: PlacementSlot[] = [];
    for (let position = 1; position <= 7; position++) {
      const row = rows.find(
        (r) => r.slot_key === `gallery-feature-${position}`,
      );
      const source: PhotoSource =
        row?.source_type === "announcement" ? "announcement" : "gallery";
      const imageId =
        row?.[
          source === "gallery" ? "gallery_image_id" : "announcement_image_id"
        ];
      let p = imageId
        ? await selected({ source, photoId: String(imageId) }, conn)
        : null;
      const parentId =
        row?.[source === "gallery" ? "gallery_group_id" : "announcement_id"];
      if (p && parentId && String(parentId) !== p.groupId) p = null;
      if (
        row?.source_type &&
        !["gallery", "announcement"].includes(String(row.source_type))
      )
        p = null;
      slots.push({
        position,
        photo: p,
        unavailable:
          Boolean(
            row?.source_type ||
              row?.gallery_group_id ||
              row?.announcement_id ||
              row?.gallery_image_id ||
              row?.announcement_image_id,
          ) &&
          (!p || !p.eligible),
      });
    }
    return { revision: String(state[0].revision), slots };
  }
  async function groups(q: LibraryQuery) {
    const all = `SELECT 'gallery' source,CAST(g.gallery_group_id AS CHAR) groupId,g.title,g.gallery_status status,g.created_at date,'Uploaded' dateLabel,g.activity_date activityDate,(g.public_visibility=1 AND g.gallery_status='Published') eligible,(SELECT COUNT(*) FROM gallery_images i WHERE i.gallery_group_id=g.gallery_group_id) photoCount FROM gallery_groups g UNION ALL SELECT 'announcement',CAST(g.announcement_id AS CHAR),g.title,g.announcement_status,COALESCE(g.posted_at,g.created_at),CASE WHEN g.posted_at IS NULL THEN 'Created' ELSE 'Published' END,NULL,(${announcementEligible}),(SELECT COUNT(*) FROM announcement_images i WHERE i.announcement_id=g.announcement_id) FROM announcements g WHERE g.audience_type='Public' AND g.announcement_status<>'Archived'`;
    const values: (string | number)[] = [];
    let where = "WHERE photoCount>0";
    if (q.source !== "all") {
      where += " AND source=?";
      values.push(q.source);
    }
    if (q.search) {
      where += " AND title LIKE ? ESCAPE '!'";
      values.push(`%${q.search.replace(/[!%_]/g, (c) => `!${c}`)}%`);
    }
    const [counts] = await db().execute<Row[]>(
      `SELECT COUNT(*) total FROM (${all}) library ${where}`,
      values,
    );
    const total = Number(counts[0].total);
    const page = Math.min(q.page, Math.max(1, Math.ceil(total / q.pageSize)));
    const direction = q.sort === "oldest" ? "ASC" : "DESC";
    const [rows] = await db().execute<Row[]>(
      `SELECT * FROM (${all}) library ${where} ORDER BY date ${direction},source,CAST(groupId AS UNSIGNED) ${direction} LIMIT ${q.pageSize} OFFSET ${(page - 1) * q.pageSize}`,
      values,
    );
    const result: LibraryGroup[] = await Promise.all(
      rows.map(async (r) => {
        const source = r.source as PhotoSource;
        const photos = await groupPhotos(source, String(r.groupId), 1, 7);
        return {
          id: `${source}:${r.groupId}`,
          source,
          groupId: String(r.groupId),
          title: String(r.title),
          status: String(r.status),
          date: date(r.date),
          dateLabel: r.dateLabel as LibraryGroup["dateLabel"],
          activityDate: r.activityDate ? date(r.activityDate) : null,
          photoCount: Number(r.photoCount),
          eligible: Boolean(Number(r.eligible)),
          photos: photos.photos,
        };
      }),
    );
    return { groups: result, total, page, pageSize: q.pageSize };
  }
  async function groupPhotos(
    source: PhotoSource,
    groupId: string,
    page = 1,
    pageSize = 100,
  ) {
    const column =
      source === "gallery" ? "gallery_group_id" : "announcement_id";
    const suffix =
      source === "announcement"
        ? " AND g.audience_type='Public' AND g.announcement_status<>'Archived'"
        : "";
    const [rows] = await db().execute<Row[]>(
      selectionSql(source, `g.${column}=?${suffix}`) +
        ` LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}`,
      [groupId],
    );
    return {
      photos: rows.slice(0, pageSize).map((r) => photo(r, source)),
      hasMore: rows.length > pageSize,
      page,
    };
  }
  async function proposal(excluded: string[] = []) {
    const rows: LibraryPhoto[] = [];
    for (const source of ["gallery", "announcement"] as const) {
      const [r] = await db().query<Row[]>(
        selectionSql(
          source,
          `${source === "gallery" ? galleryEligible : announcementEligible} AND NULLIF(TRIM(i.image_path),'') IS NOT NULL`,
        ),
      );
      rows.push(...r.map((x) => photo(x, source)).filter((x) => x.eligible));
    }
    const excludedIds = new Set(excluded);
    const excludedAssets = new Set(
      rows
        .filter((p) => excludedIds.has(p.id))
        .map((p) => assetKey(p.imagePath)),
    );
    const chosen = proposePhotos(
      rows.filter(
        (p) =>
          !excludedIds.has(p.id) && !excludedAssets.has(assetKey(p.imagePath)),
      ),
      randomInt,
    );
    return { photos: chosen, availablePositions: chosen.length };
  }
  async function publish(input: PlacementInput, userId: string) {
    return withTransaction(async (conn) => {
      const before = await snapshot(conn, true);
      if (before.revision !== input.expectedRevision)
        throw new AppError(
          "Another officer changed the published photos. Reload the published arrangement before saving.",
          409,
          "GALLERY_PLACEMENT_CONFLICT",
        );
      const resolved = new Map<string, LibraryPhoto>();
      // Lock referenced records in a stable order and recheck their eligibility inside the transaction.
      for (const ref of input.slots
        .flatMap((s) => (s.photo ? [s.photo] : []))
        .sort((a, b) => photoKey(a).localeCompare(photoKey(b)))) {
        const p = await selected(ref, conn, true);
        if (!p?.eligible)
          throw new AppError(
            "A selected photo is no longer available for public viewing. Replace it and try again.",
            422,
            "GALLERY_PHOTO_UNAVAILABLE",
          );
        resolved.set(p.id, p);
      }
      assertDistinctPhotos(
        input.slots.flatMap((slot) =>
          slot.photo ? [resolved.get(photoKey(slot.photo))!] : [],
        ),
      );
      for (const slot of input.slots) {
        const p = slot.photo ? resolved.get(photoKey(slot.photo))! : null;
        await conn.execute(
          `INSERT INTO gallery_landing_slots(slot_key,source_type,gallery_group_id,gallery_image_id,announcement_id,announcement_image_id,display_order,updated_by) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE source_type=VALUES(source_type),gallery_group_id=VALUES(gallery_group_id),gallery_image_id=VALUES(gallery_image_id),announcement_id=VALUES(announcement_id),announcement_image_id=VALUES(announcement_image_id),display_order=VALUES(display_order),updated_by=VALUES(updated_by)`,
          [
            `gallery-feature-${slot.position}`,
            p?.source ?? null,
            p?.source === "gallery" ? p.groupId : null,
            p?.source === "gallery" ? p.photoId : null,
            p?.source === "announcement" ? p.groupId : null,
            p?.source === "announcement" ? p.photoId : null,
            slot.position,
            userId,
          ],
        );
      }
      await conn.execute(
        "UPDATE gallery_landing_state SET revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE state_id=1",
        [userId],
      );
      const after = await snapshot(conn);
      const audit = (s: PlacementSnapshot) => ({
        revision: s.revision,
        placements: s.slots.map((x) => ({
          position: x.position,
          source: x.photo?.source ?? null,
          photoId: x.photo?.photoId ?? null,
        })),
      });
      await conn.execute(
        "INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,old_values,new_values,action_time) VALUES(?,'landing.gallery_placement.published','gallery_landing_state',1,'Published the homepage photo arrangement.',?,?,UTC_TIMESTAMP())",
        [userId, JSON.stringify(audit(before)), JSON.stringify(audit(after))],
      );
      return after;
    }, db());
  }
  async function publicPhotos() {
    try {
      const s = await snapshot();
      return s.slots
        .filter((x) => x.photo?.eligible)
        .map((x) => ({ ...x.photo!, position: x.position }));
    } catch (e) {
      if (
        ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(
          String((e as { code?: string }).code),
        ) ||
        (e instanceof AppError && e.code === "GALLERY_SETUP_REQUIRED")
      )
        return [];
      throw e;
    }
  }
  return { snapshot, groups, groupPhotos, proposal, publish, publicPhotos };
}
export type GalleryPlacementRepository = ReturnType<
  typeof createGalleryPlacementRepository
>;
