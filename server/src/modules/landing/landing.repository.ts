import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { limitOffsetSql } from "../../db/pagination";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { GallerySlotInput, LandingCollection, LandingListQuery, LandingListResult, LandingRow, PublicLandingPayload } from "./landing.types";

type CountRow = RowDataPacket & { total: number };
type GenericRow = RowDataPacket & Record<string, unknown>;
type SqlValue = string | number | boolean | Date | null;

type CollectionMeta = {
  table: string;
  idColumn: string;
  statusColumn: string;
  publicWhere: string;
  orderColumn: string;
  select: string;
  searchColumns: string[];
  insertColumns: Record<string, string>;
  createByColumn?: string;
};

const collections: Record<LandingCollection, CollectionMeta> = {
  partners: {
    table: "partners_certifications",
    idColumn: "partner_certification_id",
    statusColumn: "status",
    publicWhere: "public_visibility = 1 AND status IN ('Active', 'Expired')",
    orderColumn: "display_order",
    searchColumns: ["record_type", "name", "description"],
    select: `SELECT CAST(partner_certification_id AS CHAR) AS id,
                    record_type AS recordType,
                    name,
                    description,
                    logo_path AS logoPath,
                    external_url AS externalUrl,
                    issued_date AS issuedDate,
                    expiration_date AS expirationDate,
                    public_visibility AS publicVisibility,
                    status,
                    display_order AS displayOrder,
                    created_at AS createdAt,
                    updated_at AS updatedAt
               FROM partners_certifications`,
    insertColumns: {
      recordType: "record_type",
      name: "name",
      description: "description",
      logoPath: "logo_path",
      externalUrl: "external_url",
      issuedDate: "issued_date",
      expirationDate: "expiration_date",
      publicVisibility: "public_visibility",
      status: "status",
      displayOrder: "display_order",
    },
    createByColumn: "created_by",
  },
  gallery: {
    table: "gallery_groups",
    idColumn: "gallery_group_id",
    statusColumn: "gallery_status",
    publicWhere: "public_visibility = 1 AND gallery_status = 'Published'",
    orderColumn: "display_order",
    searchColumns: ["title", "caption", "category", "location"],
    select: `SELECT CAST(gallery_group_id AS CHAR) AS id,
                    title,
                    caption,
                    category,
                    activity_date AS activityDate,
                    location,
                    border_color AS borderColor,
                    public_visibility AS publicVisibility,
                    gallery_status AS galleryStatus,
                    display_order AS displayOrder,
                    published_at AS publishedAt,
                    created_at AS createdAt,
                    updated_at AS updatedAt
               FROM gallery_groups`,
    insertColumns: {
      title: "title",
      caption: "caption",
      category: "category",
      activityDate: "activity_date",
      location: "location",
      borderColor: "border_color",
      publicVisibility: "public_visibility",
      galleryStatus: "gallery_status",
      displayOrder: "display_order",
    },
    createByColumn: "uploaded_by",
  },
};

function mapRow(row: GenericRow): LandingRow {
  const mapped: LandingRow = { id: String(row.id) };
  for (const [key, value] of Object.entries(row)) {
    if (key === "id") continue;
    mapped[key] = typeof value === "number" && key === "publicVisibility" ? Boolean(value) : value;
  }
  return mapped;
}

function whereForList(meta: CollectionMeta, query: LandingListQuery, publicOnly = false) {
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (publicOnly) {
    where.push(meta.publicWhere);
  }
  if (query.status) {
    where.push(`${meta.statusColumn} = ?`);
    values.push(query.status);
  }
  if (query.search) {
    where.push(`(${meta.searchColumns.map((column) => `${column} LIKE ?`).join(" OR ")})`);
    values.push(...meta.searchColumns.map(() => `%${query.search}%`));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

function toSqlValue(value: unknown): SqlValue {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return value == null ? null : String(value);
}

function createInsert(meta: CollectionMeta, input: Record<string, unknown>, userId: string) {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: SqlValue[] = [];

  for (const [property, column] of Object.entries(meta.insertColumns)) {
    if (!Object.prototype.hasOwnProperty.call(input, property)) continue;
    columns.push(column);
    placeholders.push("?");
    values.push(toSqlValue(input[property]));
  }

  if (meta.createByColumn) {
    columns.push(meta.createByColumn);
    placeholders.push("?");
    values.push(userId);
  }

  return { columns, placeholders, values };
}

function createUpdate(meta: CollectionMeta, input: Record<string, unknown>) {
  const set: string[] = [];
  const values: SqlValue[] = [];

  for (const [property, column] of Object.entries(meta.insertColumns)) {
    if (!Object.prototype.hasOwnProperty.call(input, property)) continue;
    set.push(`${column} = ?`);
    values.push(toSqlValue(input[property]));
  }

  return { set, values };
}

type GalleryImageInput = {
  id?: string;
  imagePath: string;
  thumbnailPath?: string | null;
  altText?: string | null;
  sortOrder?: number;
  isCover?: boolean;
  publicVisibility?: boolean;
};

type GalleryImageRow = RowDataPacket & {
  id: string;
  galleryGroupId: string;
  imagePath: string;
  thumbnailPath: string | null;
  altText: string | null;
  sortOrder: number;
  isCover: number;
  publicVisibility: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type GallerySlotRow = RowDataPacket & {
  slotKey: string;
  galleryGroupId: string | null;
  galleryImageId: string | null;
  displayOrder: number;
  updatedBy: string | null;
  updatedAt: Date | string;
};

function getGalleryImages(input: Record<string, unknown>) {
  return Array.isArray(input.images) ? input.images as GalleryImageInput[] : undefined;
}

function mapGalleryImage(row: GalleryImageRow): LandingRow {
  return {
    id: String(row.id),
    galleryGroupId: String(row.galleryGroupId),
    imagePath: row.imagePath,
    thumbnailPath: row.thumbnailPath,
    altText: row.altText,
    sortOrder: Number(row.sortOrder),
    isCover: Boolean(row.isCover),
    publicVisibility: Boolean(row.publicVisibility),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGallerySlot(row: GallerySlotRow): LandingRow {
  return {
    id: row.slotKey,
    slotKey: row.slotKey,
    galleryGroupId: row.galleryGroupId ? String(row.galleryGroupId) : null,
    galleryImageId: row.galleryImageId ? String(row.galleryImageId) : null,
    displayOrder: Number(row.displayOrder),
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
    updatedAt: row.updatedAt,
  };
}

function attachGalleryRelations(
  groups: LandingRow[],
  imageRows: GalleryImageRow[],
  slotRows: GallerySlotRow[],
) {
  const imagesByGroup = new Map<string, LandingRow[]>();
  const slotsByGroup = new Map<string, LandingRow[]>();

  for (const row of imageRows) {
    const groupId = String(row.galleryGroupId);
    const images = imagesByGroup.get(groupId) ?? [];
    images.push(mapGalleryImage(row));
    imagesByGroup.set(groupId, images);
  }

  for (const row of slotRows) {
    if (!row.galleryGroupId) continue;
    const groupId = String(row.galleryGroupId);
    const slots = slotsByGroup.get(groupId) ?? [];
    slots.push(mapGallerySlot(row));
    slotsByGroup.set(groupId, slots);
  }

  return groups.map((group) => {
    const images = imagesByGroup.get(group.id) ?? [];
    const cover = images.find((image) => image.isCover) ?? images[0] ?? null;
    return {
      ...group,
      images,
      landingSlots: slotsByGroup.get(group.id) ?? [],
      imagePath: cover?.imagePath ?? null,
      thumbnailPath: cover?.thumbnailPath ?? null,
      altText: cover?.altText ?? null,
      coverImageId: cover?.id ?? null,
    };
  });
}

function sanitizeGalleryGroupInput(input: Record<string, unknown>) {
  const groupInput = { ...input };
  delete groupInput.images;
  return groupInput;
}

export interface LandingRepository {
  publicLanding(): Promise<PublicLandingPayload>;
  list(collection: LandingCollection, query: LandingListQuery): Promise<LandingListResult<LandingRow>>;
  create(collection: LandingCollection, input: Record<string, unknown>, auth: AuthContext): Promise<LandingRow>;
  update(collection: LandingCollection, id: string, input: Record<string, unknown>, auth: AuthContext): Promise<LandingRow>;
  updateGallerySlot(slotKey: string, input: GallerySlotInput, auth: AuthContext): Promise<LandingRow>;
  listSettings(query: LandingListQuery): Promise<LandingListResult<LandingRow>>;
  upsertSetting(input: Record<string, unknown>, auth: AuthContext): Promise<LandingRow>;
  listAuditLogs(query: LandingListQuery): Promise<LandingListResult<LandingRow>>;
}

export function createLandingRepository(pool?: Pool): LandingRepository {
  const databasePool = () => pool ?? getPool();

  async function readOne(meta: CollectionMeta, id: string, connection: Pool | PoolConnection = databasePool()) {
    const [rows] = await connection.execute<GenericRow[]>(
      `${meta.select} WHERE ${meta.idColumn} = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async function readGalleryImages(groupIds: string[], connection: Pool | PoolConnection = databasePool()) {
    if (!groupIds.length) return [];
    const placeholders = groupIds.map(() => "?").join(", ");
    const [rows] = await connection.execute<GalleryImageRow[]>(
      `SELECT CAST(gallery_image_id AS CHAR) AS id,
              CAST(gallery_group_id AS CHAR) AS galleryGroupId,
              image_path AS imagePath,
              thumbnail_path AS thumbnailPath,
              alt_text AS altText,
              sort_order AS sortOrder,
              is_cover AS isCover,
              public_visibility AS publicVisibility,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM gallery_images
        WHERE gallery_group_id IN (${placeholders})
        ORDER BY gallery_group_id ASC, sort_order ASC, gallery_image_id ASC`,
      groupIds,
    );
    return rows;
  }

  async function readGallerySlots(connection: Pool | PoolConnection = databasePool()) {
    const [rows] = await connection.execute<GallerySlotRow[]>(
      `SELECT slot_key AS slotKey,
              CAST(gallery_group_id AS CHAR) AS galleryGroupId,
              CAST(gallery_image_id AS CHAR) AS galleryImageId,
              display_order AS displayOrder,
              CAST(updated_by AS CHAR) AS updatedBy,
              updated_at AS updatedAt
         FROM gallery_landing_slots
        ORDER BY display_order ASC, slot_key ASC`,
    );
    return rows;
  }

  async function readGalleryGroup(id: string, connection: Pool | PoolConnection = databasePool()) {
    const meta = collections.gallery;
    const group = await readOne(meta, id, connection);
    if (!group) return null;
    const images = await readGalleryImages([id], connection);
    const slots = await readGallerySlots(connection);
    return attachGalleryRelations([group], images, slots)[0] ?? null;
  }

  async function insertGalleryImages(
    connection: Pool | PoolConnection,
    groupId: string,
    images: GalleryImageInput[],
  ) {
    if (!images.length) return;
    const hasCover = images.some((image) => image.isCover);
    await Promise.all(
      images.map((image, index) =>
        connection.execute(
          `INSERT INTO gallery_images
             (gallery_group_id, image_path, thumbnail_path, alt_text, sort_order, is_cover, public_visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            groupId,
            image.imagePath,
            toSqlValue(image.thumbnailPath),
            toSqlValue(image.altText),
            Number(image.sortOrder ?? index),
            hasCover ? Boolean(image.isCover) : index === 0,
            image.publicVisibility !== false,
          ],
        ),
      ),
    );
  }

  async function saveGalleryImages(
    connection: PoolConnection,
    groupId: string,
    images: GalleryImageInput[],
  ) {
    const existingIds = images
      .map((image) => image.id)
      .filter((id): id is string => Boolean(id));

    if (existingIds.length) {
      const placeholders = existingIds.map(() => "?").join(", ");
      await connection.execute(
        `DELETE FROM gallery_images
          WHERE gallery_group_id = ?
            AND gallery_image_id NOT IN (${placeholders})`,
        [groupId, ...existingIds],
      );
    } else {
      await connection.execute("DELETE FROM gallery_images WHERE gallery_group_id = ?", [groupId]);
    }

    const hasCover = images.some((image) => image.isCover);
    for (const [index, image] of images.entries()) {
      const isCover = hasCover ? Boolean(image.isCover) : index === 0;
      if (image.id) {
        await connection.execute(
          `UPDATE gallery_images
              SET image_path = ?,
                  thumbnail_path = ?,
                  alt_text = ?,
                  sort_order = ?,
                  is_cover = ?,
                  public_visibility = ?
            WHERE gallery_group_id = ?
              AND gallery_image_id = ?`,
          [
            image.imagePath,
            toSqlValue(image.thumbnailPath),
            toSqlValue(image.altText),
            Number(image.sortOrder ?? index),
            isCover,
            image.publicVisibility !== false,
            groupId,
            image.id,
          ],
        );
      } else {
        await connection.execute(
          `INSERT INTO gallery_images
             (gallery_group_id, image_path, thumbnail_path, alt_text, sort_order, is_cover, public_visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            groupId,
            image.imagePath,
            toSqlValue(image.thumbnailPath),
            toSqlValue(image.altText),
            Number(image.sortOrder ?? index),
            isCover,
            image.publicVisibility !== false,
          ],
        );
      }
    }
  }

  async function listPublic(collection: LandingCollection) {
    if (collection === "gallery") {
      const [slotRows] = await databasePool().execute<GenericRow[]>(
        `SELECT s.slot_key AS slotKey,
                CAST(g.gallery_group_id AS CHAR) AS id,
                g.title,
                g.caption,
                g.category,
                g.activity_date AS activityDate,
                g.location,
                g.border_color AS borderColor,
                g.display_order AS displayOrder,
                CAST(i.gallery_image_id AS CHAR) AS galleryImageId,
                i.image_path AS imagePath,
                i.thumbnail_path AS thumbnailPath,
                i.alt_text AS altText,
                s.display_order AS slotDisplayOrder,
                g.created_at AS createdAt,
                g.updated_at AS updatedAt
           FROM gallery_landing_slots s
           JOIN gallery_groups g ON g.gallery_group_id = s.gallery_group_id
           JOIN gallery_images i ON i.gallery_image_id = s.gallery_image_id
          WHERE g.public_visibility = 1
            AND g.gallery_status = 'Published'
            AND i.public_visibility = 1
          ORDER BY s.display_order ASC, s.slot_key ASC`,
      );
      if (slotRows.length) return slotRows.map(mapRow);

      const [rows] = await databasePool().execute<GenericRow[]>(
        `SELECT CAST(g.gallery_group_id AS CHAR) AS id,
                g.title,
                g.caption,
                g.category,
                g.activity_date AS activityDate,
                g.location,
                g.border_color AS borderColor,
                g.display_order AS displayOrder,
                CAST(i.gallery_image_id AS CHAR) AS galleryImageId,
                i.image_path AS imagePath,
                i.thumbnail_path AS thumbnailPath,
                i.alt_text AS altText,
                g.created_at AS createdAt,
                g.updated_at AS updatedAt
           FROM gallery_groups g
           JOIN gallery_images i ON i.gallery_group_id = g.gallery_group_id
          WHERE g.public_visibility = 1
            AND g.gallery_status = 'Published'
            AND i.public_visibility = 1
            AND i.gallery_image_id = (
              SELECT gi.gallery_image_id
                FROM gallery_images gi
               WHERE gi.gallery_group_id = g.gallery_group_id
                 AND gi.public_visibility = 1
               ORDER BY gi.is_cover DESC, gi.sort_order ASC, gi.gallery_image_id ASC
               LIMIT 1
            )
          ORDER BY g.display_order ASC, g.gallery_group_id DESC
          LIMIT 100`,
      );
      return rows.map(mapRow);
    }

    const meta = collections[collection];
    const { whereSql, values } = whereForList(meta, { page: 1, pageSize: 100 }, true);
    const [rows] = await databasePool().execute<GenericRow[]>(
      `${meta.select} ${whereSql} ORDER BY ${meta.orderColumn} ASC, ${meta.idColumn} DESC LIMIT 100`,
      values,
    );
    return rows.map(mapRow);
  }

  return {
    async publicLanding() {
      const [partners, gallery] = await Promise.all([
        listPublic("partners"),
        listPublic("gallery"),
      ]);
      return { partners, gallery };
    },

    async list(collection, query) {
      if (collection === "gallery") {
        const meta = collections.gallery;
        const { whereSql, values } = whereForList(meta, query);
        const offset = (query.page - 1) * query.pageSize;
        const [rows] = await databasePool().execute<GenericRow[]>(
          `${meta.select}
           ${whereSql}
           ORDER BY ${meta.orderColumn} ASC, ${meta.idColumn} DESC
           ${limitOffsetSql(query.pageSize, offset)}`,
          values,
        );
        const groups = rows.map(mapRow);
        const [counts] = await databasePool().execute<CountRow[]>(
          `SELECT COUNT(*) AS total FROM ${meta.table} ${whereSql}`,
          values,
        );
        const images = await readGalleryImages(groups.map((group) => group.id));
        const slots = await readGallerySlots();
        return {
          records: attachGalleryRelations(groups, images, slots),
          total: Number(counts[0]?.total ?? 0),
          page: query.page,
          pageSize: query.pageSize,
        };
      }

      const meta = collections[collection];
      const { whereSql, values } = whereForList(meta, query);
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<GenericRow[]>(
        `${meta.select}
         ${whereSql}
         ORDER BY ${meta.orderColumn} ASC, ${meta.idColumn} DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM ${meta.table} ${whereSql}`,
        values,
      );
      return { records: rows.map(mapRow), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },

    async create(collection, input, auth) {
      if (collection === "gallery") {
        const images = getGalleryImages(input) ?? [];
        if (!images.length) {
          throw new AppError("At least one gallery image is required", 400, "GALLERY_IMAGE_REQUIRED");
        }
        const meta = collections.gallery;
        return withTransaction(async (connection) => {
          const insert = createInsert(meta, sanitizeGalleryGroupInput(input), auth.user.id);
          const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO ${meta.table} (${insert.columns.join(", ")}) VALUES (${insert.placeholders.join(", ")})`,
            insert.values,
          );
          const id = String(result.insertId);
          await insertGalleryImages(connection, id, images);
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description, new_values)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [auth.user.id, "landing.gallery.created", meta.table, id, "A gallery group was created.", JSON.stringify(input)],
          );
          const created = await readGalleryGroup(id, connection);
          if (!created) throw new AppError("Gallery group was not found", 404, "LANDING_RECORD_NOT_FOUND");
          return created;
        }, databasePool());
      }

      const meta = collections[collection];
      return withTransaction(async (connection) => {
        const insert = createInsert(meta, input, auth.user.id);
        if (!insert.columns.length) {
          throw new AppError("At least one field is required", 400, "LANDING_INPUT_REQUIRED");
        }
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO ${meta.table} (${insert.columns.join(", ")}) VALUES (${insert.placeholders.join(", ")})`,
          insert.values,
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [auth.user.id, `landing.${collection}.created`, meta.table, id, `A ${collection} landing record was created.`, JSON.stringify(input)],
        );
        const created = await readOne(meta, id, connection);
        if (!created) throw new AppError("Landing record was not found", 404, "LANDING_RECORD_NOT_FOUND");
        return created;
      }, databasePool());
    },

    async update(collection, id, input, auth) {
      if (collection === "gallery") {
        const meta = collections.gallery;
        return withTransaction(async (connection) => {
          const groupInput = sanitizeGalleryGroupInput(input);
          const update = createUpdate(meta, groupInput);
          const images = getGalleryImages(input);
          if (!update.set.length && !images) {
            throw new AppError("At least one field is required", 400, "LANDING_INPUT_REQUIRED");
          }
          if (update.set.length) {
            await connection.execute(
              `UPDATE ${meta.table} SET ${update.set.join(", ")} WHERE ${meta.idColumn} = ?`,
              [...update.values, id],
            );
          }
          if (images) {
            if (!images.length) {
              throw new AppError("At least one gallery image is required", 400, "GALLERY_IMAGE_REQUIRED");
            }
            await saveGalleryImages(connection, id, images);
          }
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description, new_values)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [auth.user.id, "landing.gallery.updated", meta.table, id, "A gallery group was updated.", JSON.stringify(input)],
          );
          const updated = await readGalleryGroup(id, connection);
          if (!updated) throw new AppError("Gallery group was not found", 404, "LANDING_RECORD_NOT_FOUND");
          return updated;
        }, databasePool());
      }

      const meta = collections[collection];
      return withTransaction(async (connection) => {
        const update = createUpdate(meta, input);
        if (!update.set.length) {
          throw new AppError("At least one field is required", 400, "LANDING_INPUT_REQUIRED");
        }
        await connection.execute(
          `UPDATE ${meta.table} SET ${update.set.join(", ")} WHERE ${meta.idColumn} = ?`,
          [...update.values, id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [auth.user.id, `landing.${collection}.updated`, meta.table, id, `A ${collection} landing record was updated.`, JSON.stringify(input)],
        );
        const updated = await readOne(meta, id, connection);
        if (!updated) throw new AppError("Landing record was not found", 404, "LANDING_RECORD_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async updateGallerySlot(slotKey, input, auth) {
      return withTransaction(async (connection) => {
        if (input.galleryGroupId && input.galleryImageId) {
          const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT gallery_image_id
               FROM gallery_images
              WHERE gallery_group_id = ?
                AND gallery_image_id = ?
              LIMIT 1`,
            [input.galleryGroupId, input.galleryImageId],
          );
          if (!rows[0]) {
            throw new AppError("The selected gallery photo does not belong to that group", 400, "GALLERY_SLOT_IMAGE_MISMATCH");
          }
        }

        await connection.execute(
          `INSERT INTO gallery_landing_slots
             (slot_key, gallery_group_id, gallery_image_id, display_order, updated_by)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             gallery_group_id = VALUES(gallery_group_id),
             gallery_image_id = VALUES(gallery_image_id),
             display_order = VALUES(display_order),
             updated_by = VALUES(updated_by)`,
          [
            slotKey,
            toSqlValue(input.galleryGroupId),
            toSqlValue(input.galleryImageId),
            input.displayOrder,
            auth.user.id,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'landing.gallery_slot.updated', 'gallery_landing_slots', ?, 'A gallery landing placement was updated.', ?)`,
          [auth.user.id, slotKey, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<GallerySlotRow[]>(
          `SELECT slot_key AS slotKey,
                  CAST(gallery_group_id AS CHAR) AS galleryGroupId,
                  CAST(gallery_image_id AS CHAR) AS galleryImageId,
                  display_order AS displayOrder,
                  CAST(updated_by AS CHAR) AS updatedBy,
                  updated_at AS updatedAt
             FROM gallery_landing_slots
            WHERE slot_key = ?
            LIMIT 1`,
          [slotKey],
        );
        if (!rows[0]) throw new AppError("Gallery placement was not found", 404, "GALLERY_SLOT_NOT_FOUND");
        return mapGallerySlot(rows[0]);
      }, databasePool());
    },

    async listSettings(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      if (query.search) {
        where.push("(setting_group LIKE ? OR setting_key LIKE ? OR description LIKE ?)");
        values.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<GenericRow[]>(
        `SELECT CAST(system_setting_id AS CHAR) AS id,
                setting_group AS settingGroup,
                setting_key AS settingKey,
                setting_value AS settingValue,
                value_type AS valueType,
                description,
                is_public AS isPublic,
                effective_date AS effectiveDate,
                CAST(updated_by AS CHAR) AS updatedBy,
                created_at AS createdAt,
                updated_at AS updatedAt
           FROM system_settings
           ${whereSql}
          ORDER BY setting_group ASC, setting_key ASC
          ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM system_settings ${whereSql}`,
        values,
      );
      return { records: rows.map(mapRow), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },

    async upsertSetting(input, auth) {
      return withTransaction(async (connection) => {
        await connection.execute(
          `INSERT INTO system_settings
             (setting_group, setting_key, setting_value, value_type, description, is_public, effective_date, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             setting_group = VALUES(setting_group),
             setting_value = VALUES(setting_value),
             value_type = VALUES(value_type),
             description = VALUES(description),
             is_public = VALUES(is_public),
             effective_date = VALUES(effective_date),
             updated_by = VALUES(updated_by)`,
          [
            toSqlValue(input.settingGroup),
            toSqlValue(input.settingKey),
            toSqlValue(input.settingValue),
            toSqlValue(input.valueType ?? "String"),
            toSqlValue(input.description),
            input.isPublic ? 1 : 0,
            toSqlValue(input.effectiveDate),
            auth.user.id,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, description, new_values)
           VALUES (?, 'system_setting.upserted', 'system_settings', 'A system setting was saved.', ?)`,
          [auth.user.id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<GenericRow[]>(
          `SELECT CAST(system_setting_id AS CHAR) AS id,
                  setting_group AS settingGroup,
                  setting_key AS settingKey,
                  setting_value AS settingValue,
                  value_type AS valueType,
                  description,
                  is_public AS isPublic,
                  effective_date AS effectiveDate,
                  CAST(updated_by AS CHAR) AS updatedBy,
                  created_at AS createdAt,
                  updated_at AS updatedAt
             FROM system_settings
            WHERE setting_key = ?
            LIMIT 1`,
          [toSqlValue(input.settingKey)],
        );
        if (!rows[0]) throw new AppError("System setting was not found", 404, "SETTING_NOT_FOUND");
        return mapRow(rows[0]);
      }, databasePool());
    },

    async listAuditLogs(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      if (query.search) {
        where.push("(a.action LIKE ? OR a.entity_table LIKE ? OR a.description LIKE ? OR u.display_name LIKE ?)");
        values.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<GenericRow[]>(
        `SELECT CAST(a.audit_log_id AS CHAR) AS id,
                CAST(a.user_id AS CHAR) AS userId,
                u.display_name AS userName,
                a.action,
                a.entity_table AS entityTable,
                CAST(a.record_id AS CHAR) AS recordId,
                a.description,
                a.ip_address AS ipAddress,
                a.user_agent AS userAgent,
                a.action_time AS actionTime
           FROM audit_logs a
      LEFT JOIN users u ON u.user_id = a.user_id
           ${whereSql}
          ORDER BY a.action_time DESC, a.audit_log_id DESC
          ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ${whereSql}`,
        values,
      );
      return { records: rows.map(mapRow), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },
  };
}
