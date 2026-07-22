import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { limitOffsetSql } from "../../db/pagination";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { LandingCollection, LandingListQuery, LandingListResult, LandingRow, PublicLandingPayload } from "./landing.types";

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
  "content-blocks": {
    table: "site_content_blocks",
    idColumn: "site_content_id",
    statusColumn: "content_status",
    publicWhere: "content_status = 'Published'",
    orderColumn: "display_order",
    searchColumns: ["page_slug", "section_key", "title", "body"],
    select: `SELECT CAST(site_content_id AS CHAR) AS id,
                    page_slug AS pageSlug,
                    section_key AS sectionKey,
                    content_type AS contentType,
                    title,
                    body,
                    value_text AS valueText,
                    link_label AS linkLabel,
                    link_url AS linkUrl,
                    media_path AS mediaPath,
                    display_order AS displayOrder,
                    content_status AS contentStatus,
                    published_at AS publishedAt,
                    created_at AS createdAt,
                    updated_at AS updatedAt
               FROM site_content_blocks`,
    insertColumns: {
      pageSlug: "page_slug",
      sectionKey: "section_key",
      contentType: "content_type",
      title: "title",
      body: "body",
      valueText: "value_text",
      linkLabel: "link_label",
      linkUrl: "link_url",
      mediaPath: "media_path",
      displayOrder: "display_order",
      contentStatus: "content_status",
    },
    createByColumn: "updated_by",
  },
  services: {
    table: "services",
    idColumn: "service_id",
    statusColumn: "service_status",
    publicWhere: "public_visibility = 1 AND service_status = 'Active'",
    orderColumn: "display_order",
    searchColumns: ["service_code", "title", "short_description"],
    select: `SELECT CAST(service_id AS CHAR) AS id,
                    service_code AS serviceCode,
                    service_type AS serviceType,
                    title,
                    short_description AS shortDescription,
                    full_description AS fullDescription,
                    requirements_text AS requirementsText,
                    image_path AS imagePath,
                    cta_label AS ctaLabel,
                    cta_url AS ctaUrl,
                    public_visibility AS publicVisibility,
                    service_status AS serviceStatus,
                    display_order AS displayOrder,
                    created_at AS createdAt,
                    updated_at AS updatedAt
               FROM services`,
    insertColumns: {
      serviceCode: "service_code",
      serviceType: "service_type",
      title: "title",
      shortDescription: "short_description",
      fullDescription: "full_description",
      requirementsText: "requirements_text",
      imagePath: "image_path",
      ctaLabel: "cta_label",
      ctaUrl: "cta_url",
      publicVisibility: "public_visibility",
      serviceStatus: "service_status",
      displayOrder: "display_order",
    },
    createByColumn: "created_by",
  },
  programs: {
    table: "programs_projects",
    idColumn: "program_project_id",
    statusColumn: "status",
    publicWhere: "public_visibility = 1 AND status IN ('Upcoming', 'Ongoing', 'Completed')",
    orderColumn: "display_order",
    searchColumns: ["title", "category", "summary", "location"],
    select: `SELECT CAST(program_project_id AS CHAR) AS id,
                    title,
                    category,
                    summary,
                    description,
                    start_date AS startDate,
                    end_date AS endDate,
                    location,
                    image_path AS imagePath,
                    public_visibility AS publicVisibility,
                    status,
                    display_order AS displayOrder,
                    created_at AS createdAt,
                    updated_at AS updatedAt
               FROM programs_projects`,
    insertColumns: {
      title: "title",
      category: "category",
      summary: "summary",
      description: "description",
      startDate: "start_date",
      endDate: "end_date",
      location: "location",
      imagePath: "image_path",
      publicVisibility: "public_visibility",
      status: "status",
      displayOrder: "display_order",
    },
    createByColumn: "created_by",
  },
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
    table: "gallery_items",
    idColumn: "gallery_item_id",
    statusColumn: "gallery_status",
    publicWhere: "public_visibility = 1 AND gallery_status = 'Published'",
    orderColumn: "display_order",
    searchColumns: ["title", "caption", "category", "location"],
    select: `SELECT CAST(gallery_item_id AS CHAR) AS id,
                    title,
                    caption,
                    category,
                    image_path AS imagePath,
                    thumbnail_path AS thumbnailPath,
                    activity_date AS activityDate,
                    location,
                    alt_text AS altText,
                    public_visibility AS publicVisibility,
                    gallery_status AS galleryStatus,
                    display_order AS displayOrder,
                    published_at AS publishedAt,
                    created_at AS createdAt,
                    updated_at AS updatedAt
               FROM gallery_items`,
    insertColumns: {
      title: "title",
      caption: "caption",
      category: "category",
      imagePath: "image_path",
      thumbnailPath: "thumbnail_path",
      activityDate: "activity_date",
      location: "location",
      altText: "alt_text",
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

export interface LandingRepository {
  publicLanding(): Promise<PublicLandingPayload>;
  list(collection: LandingCollection, query: LandingListQuery): Promise<LandingListResult<LandingRow>>;
  create(collection: LandingCollection, input: Record<string, unknown>, auth: AuthContext): Promise<LandingRow>;
  update(collection: LandingCollection, id: string, input: Record<string, unknown>, auth: AuthContext): Promise<LandingRow>;
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

  async function listPublic(collection: LandingCollection) {
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
      const [contentBlocks, services, programs, partners, gallery] = await Promise.all([
        listPublic("content-blocks"),
        listPublic("services"),
        listPublic("programs"),
        listPublic("partners"),
        listPublic("gallery"),
      ]);
      return { contentBlocks, services, programs, partners, gallery };
    },

    async list(collection, query) {
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
           VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))`,
          [auth.user.id, `landing.${collection}.created`, meta.table, id, `A ${collection} landing record was created.`, JSON.stringify(input)],
        );
        const created = await readOne(meta, id, connection);
        if (!created) throw new AppError("Landing record was not found", 404, "LANDING_RECORD_NOT_FOUND");
        return created;
      }, databasePool());
    },

    async update(collection, id, input, auth) {
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
           VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))`,
          [auth.user.id, `landing.${collection}.updated`, meta.table, id, `A ${collection} landing record was updated.`, JSON.stringify(input)],
        );
        const updated = await readOne(meta, id, connection);
        if (!updated) throw new AppError("Landing record was not found", 404, "LANDING_RECORD_NOT_FOUND");
        return updated;
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
           VALUES (?, 'system_setting.upserted', 'system_settings', 'A system setting was saved.', CAST(? AS JSON))`,
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
