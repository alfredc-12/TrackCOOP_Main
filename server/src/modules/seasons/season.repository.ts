import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  ProductionListQuery,
  ProductionRecord,
  ProductionRecordInput,
  ProductionStatus,
  Season,
  SeasonInput,
  SeasonListQuery,
  SeasonStatus,
  SeasonalAnalytics,
  SeasonalAnalyticsQuery,
} from "./season.types";

type SeasonRow = RowDataPacket & {
  id: string;
  seasonName: string;
  seasonType: string;
  seasonYear: number;
  startDate: string;
  endDate: string;
  seasonStatus: SeasonStatus;
  description: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  productionRecordCount: number | string;
};

type ProductionRow = RowDataPacket & {
  id: string;
  seasonId: string;
  seasonName: string;
  memberId: string | null;
  memberName: string | null;
  barangay: string | null;
  sector: string;
  cropName: string;
  areaPlanted: string | number | null;
  areaUnit: string | null;
  quantityProduced: string | number;
  quantityUnit: string;
  productionCost: string | number;
  harvestDate: string | null;
  productionStatus: ProductionStatus;
  remarks: string | null;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

function numberValue(value: unknown) {
  return Number(value ?? 0) || 0;
}

function mapSeason(row: SeasonRow): Season {
  return {
    id: String(row.id),
    seasonName: row.seasonName,
    seasonType: row.seasonType,
    seasonYear: Number(row.seasonYear),
    startDate: row.startDate,
    endDate: row.endDate,
    seasonStatus: row.seasonStatus,
    description: row.description,
    createdBy: row.createdBy ? String(row.createdBy) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    productionRecordCount: numberValue(row.productionRecordCount),
  };
}

function mapProduction(row: ProductionRow): ProductionRecord {
  return {
    id: String(row.id),
    seasonId: String(row.seasonId),
    seasonName: row.seasonName,
    memberId: row.memberId ? String(row.memberId) : null,
    memberName: row.memberName,
    barangay: row.barangay,
    sector: row.sector,
    cropName: row.cropName,
    areaPlanted: row.areaPlanted === null ? null : numberValue(row.areaPlanted),
    areaUnit: row.areaUnit,
    quantityProduced: numberValue(row.quantityProduced),
    quantityUnit: row.quantityUnit,
    productionCost: numberValue(row.productionCost),
    harvestDate: row.harvestDate,
    productionStatus: row.productionStatus,
    remarks: row.remarks,
    recordedBy: String(row.recordedBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertChairman(auth: AuthContext) {
  if (auth.user.role !== "chairman") throw new AppError("Only the Chairman can manage seasons.", 403, "FORBIDDEN");
}

function seasonWhere(query: SeasonListQuery) {
  return query.status ? { sql: "WHERE s.season_status = ?", values: [query.status] } : { sql: "", values: [] as string[] };
}

function periodClause(alias: string, query: { startDate?: string; endDate?: string }) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (query.startDate) { clauses.push(`${alias} >= ?`); values.push(query.startDate); }
  if (query.endDate) { clauses.push(`${alias} <= ?`); values.push(query.endDate); }
  return { sql: clauses.length ? `AND ${clauses.join(" AND ")}` : "", values };
}

async function getSeason(connection: Pool | PoolConnection, id: string) {
  const [rows] = await connection.execute<SeasonRow[]>(
    `SELECT CAST(s.season_id AS CHAR) AS id,
            s.season_name AS seasonName,
            s.season_type AS seasonType,
            s.season_year AS seasonYear,
            DATE_FORMAT(s.start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(s.end_date, '%Y-%m-%d') AS endDate,
            s.season_status AS seasonStatus,
            s.description,
            CAST(s.created_by AS CHAR) AS createdBy,
            s.created_at AS createdAt,
            s.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM production_records pr WHERE pr.season_id = s.season_id AND pr.production_status <> 'Cancelled') AS productionRecordCount
       FROM seasons s
      WHERE s.season_id = ?
      LIMIT 1`,
    [id],
  );
  return rows[0] ? mapSeason(rows[0]) : null;
}

export interface SeasonRepository {
  list(query: SeasonListQuery): Promise<{ seasons: Season[]; total: number; page: number; pageSize: number }>;
  get(id: string): Promise<Season | null>;
  create(input: SeasonInput, auth: AuthContext): Promise<Season>;
  transition(id: string, action: "activate" | "close", auth: AuthContext): Promise<Season>;
  listProduction(query: ProductionListQuery): Promise<{ records: ProductionRecord[]; total: number; page: number; pageSize: number }>;
  createProduction(input: ProductionRecordInput, auth: AuthContext): Promise<ProductionRecord>;
  analytics(query: SeasonalAnalyticsQuery): Promise<SeasonalAnalytics>;
}

export function createSeasonRepository(pool?: Pool): SeasonRepository {
  const databasePool = () => pool ?? getPool();
  return {
    async list(query) {
      const where = seasonWhere(query);
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<SeasonRow[]>(
        `SELECT CAST(s.season_id AS CHAR) AS id,
                s.season_name AS seasonName,
                s.season_type AS seasonType,
                s.season_year AS seasonYear,
                DATE_FORMAT(s.start_date, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(s.end_date, '%Y-%m-%d') AS endDate,
                s.season_status AS seasonStatus,
                s.description,
                CAST(s.created_by AS CHAR) AS createdBy,
                s.created_at AS createdAt,
                s.updated_at AS updatedAt,
                (SELECT COUNT(*) FROM production_records pr WHERE pr.season_id = s.season_id AND pr.production_status <> 'Cancelled') AS productionRecordCount
           FROM seasons s
           ${where.sql}
          ORDER BY s.start_date DESC, s.season_id DESC
          ${limitOffsetSql(query.pageSize, offset)}`,
        where.values,
      );
      const [countRows] = await databasePool().execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM seasons s ${where.sql}`, where.values);
      return { seasons: rows.map(mapSeason), total: numberValue(countRows[0]?.total), page: query.page, pageSize: query.pageSize };
    },

    async get(id) { return getSeason(databasePool(), id); },

    async create(input, auth) {
      assertChairman(auth);
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO seasons (season_name, season_type, season_year, start_date, end_date, description, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [input.seasonName, input.seasonType, input.seasonYear, input.startDate, input.endDate, input.description ?? null, auth.user.id],
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'season.created', 'seasons', ?, 'A season was created.', ?)`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const season = await getSeason(connection, id);
        if (!season) throw new AppError("Season was not found after creation", 500, "SEASON_NOT_FOUND");
        return season;
      }, databasePool());
    },

    async transition(id, action, auth) {
      assertChairman(auth);
      return withTransaction(async (connection) => {
        const existing = await getSeason(connection, id);
        if (!existing) throw new AppError("Season was not found", 404, "SEASON_NOT_FOUND");
        const nextStatus: SeasonStatus = action === "activate" ? "Active" : "Closed";
        if (action === "activate" && existing.seasonStatus !== "Draft") throw new AppError("Only Draft seasons can be activated.", 409, "SEASON_STATUS_INVALID");
        if (action === "close" && existing.seasonStatus !== "Active") throw new AppError("Only Active seasons can be closed.", 409, "SEASON_STATUS_INVALID");
        await connection.execute("UPDATE seasons SET season_status = ? WHERE season_id = ?", [nextStatus, id]);
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'season.status_changed', 'seasons', ?, ?, ?)`,
          [auth.user.id, id, `Season status changed to ${nextStatus}.`, JSON.stringify({ status: nextStatus })],
        );
        const updated = await getSeason(connection, id);
        if (!updated) throw new AppError("Season was not found after update", 500, "SEASON_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async listProduction(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      if (query.seasonId) { where.push("pr.season_id = ?"); values.push(query.seasonId); }
      if (query.status) { where.push("pr.production_status = ?"); values.push(query.status); }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<ProductionRow[]>(
        `SELECT CAST(pr.production_record_id AS CHAR) AS id,
                CAST(pr.season_id AS CHAR) AS seasonId,
                s.season_name AS seasonName,
                CAST(pr.member_id AS CHAR) AS memberId,
                mp.full_name AS memberName,
                pr.barangay,
                pr.sector,
                pr.crop_name AS cropName,
                pr.area_planted AS areaPlanted,
                pr.area_unit AS areaUnit,
                pr.quantity_produced AS quantityProduced,
                pr.quantity_unit AS quantityUnit,
                pr.production_cost AS productionCost,
                DATE_FORMAT(pr.harvest_date, '%Y-%m-%d') AS harvestDate,
                pr.production_status AS productionStatus,
                pr.remarks,
                CAST(pr.recorded_by AS CHAR) AS recordedBy,
                pr.created_at AS createdAt,
                pr.updated_at AS updatedAt
           FROM production_records pr
           JOIN seasons s ON s.season_id = pr.season_id
           LEFT JOIN member_profiles mp ON mp.member_id = pr.member_id
           ${whereSql}
          ORDER BY COALESCE(pr.harvest_date, DATE(pr.created_at)) DESC, pr.production_record_id DESC
          ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM production_records pr ${whereSql}`, values);
      return { records: rows.map(mapProduction), total: numberValue(countRows[0]?.total), page: query.page, pageSize: query.pageSize };
    },

    async createProduction(input, auth) {
      if (!["chairman", "bookkeeper"].includes(auth.user.role)) throw new AppError("You cannot record production data.", 403, "FORBIDDEN");
      return withTransaction(async (connection) => {
        const season = await getSeason(connection, input.seasonId);
        if (!season) throw new AppError("Season was not found", 404, "SEASON_NOT_FOUND");
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO production_records
             (season_id, member_id, barangay, sector, crop_name, area_planted, area_unit,
              quantity_produced, quantity_unit, production_cost, harvest_date, production_status, remarks, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [input.seasonId, input.memberId ?? null, input.barangay ?? null, input.sector, input.cropName, input.areaPlanted ?? null, input.areaUnit ?? null, input.quantityProduced, input.quantityUnit, input.productionCost ?? 0, input.harvestDate ?? null, input.productionStatus ?? "Recorded", input.remarks ?? null, auth.user.id],
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'production_record.created', 'production_records', ?, 'A production record was created.', ?)`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<ProductionRow[]>(
          `SELECT CAST(pr.production_record_id AS CHAR) AS id,
                  CAST(pr.season_id AS CHAR) AS seasonId,
                  s.season_name AS seasonName,
                  CAST(pr.member_id AS CHAR) AS memberId,
                  mp.full_name AS memberName,
                  pr.barangay,
                  pr.sector,
                  pr.crop_name AS cropName,
                  pr.area_planted AS areaPlanted,
                  pr.area_unit AS areaUnit,
                  pr.quantity_produced AS quantityProduced,
                  pr.quantity_unit AS quantityUnit,
                  pr.production_cost AS productionCost,
                  DATE_FORMAT(pr.harvest_date, '%Y-%m-%d') AS harvestDate,
                  pr.production_status AS productionStatus,
                  pr.remarks,
                  CAST(pr.recorded_by AS CHAR) AS recordedBy,
                  pr.created_at AS createdAt,
                  pr.updated_at AS updatedAt
             FROM production_records pr
             JOIN seasons s ON s.season_id = pr.season_id
             LEFT JOIN member_profiles mp ON mp.member_id = pr.member_id
            WHERE pr.production_record_id = ?
            LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Production record was not found after creation", 500, "PRODUCTION_RECORD_NOT_FOUND");
        return mapProduction(rows[0]);
      }, databasePool());
    },

    async analytics(query) {
      const selectedSeason = query.seasonId ? await getSeason(databasePool(), query.seasonId) : null;
      if (query.seasonId && !selectedSeason) throw new AppError("Season was not found", 404, "SEASON_NOT_FOUND");
      const seasonFilter = query.seasonId ? "AND season_id = ?" : "";
      const seasonParams = query.seasonId ? [query.seasonId] : [];
      const salesSeasonFilter = query.seasonId && selectedSeason
        ? "AND (pos_sales.season_id = ? OR (pos_sales.season_id IS NULL AND DATE(pos_sales.sale_date) BETWEEN ? AND ?))"
        : "";
      const salesSeasonParams = query.seasonId && selectedSeason ? [query.seasonId, selectedSeason.startDate, selectedSeason.endDate] : [];
      const financeSeasonFilter = query.seasonId && selectedSeason
        ? "AND (fr.season_id = ? OR (fr.season_id IS NULL AND DATE(fr.record_date) BETWEEN ? AND ?))"
        : "";
      const financeSeasonParams = query.seasonId && selectedSeason ? [query.seasonId, selectedSeason.startDate, selectedSeason.endDate] : [];
      const productionPeriod = periodClause("COALESCE(harvest_date, DATE(created_at))", query);
      const salesPeriod = periodClause("DATE(sale_date)", query);
      const financePeriod = periodClause("record_date", query);
      const postedIncomeCondition = `fr.source_module <> 'Share Capital'
        AND UPPER(COALESCE(fc.category_code, '')) <> 'SHARE_CAPITAL'
        AND UPPER(COALESCE(fc.category_name, '')) NOT LIKE '%SHARE CAPITAL%'`;
      const [productionSummary] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(quantity_produced), 0) AS productionQuantity,
                COALESCE(SUM(production_cost), 0) AS productionCost
           FROM production_records
          WHERE production_status IN ('Recorded', 'Verified', 'Harvested') ${seasonFilter} ${productionPeriod.sql}`,
        [...seasonParams, ...productionPeriod.values],
      );
      const [salesSummary] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS salesTransactions
           FROM pos_sales
          WHERE sale_status IN ('Paid', 'Completed')
            AND payment_status = 'Paid'
            ${salesSeasonFilter} ${salesPeriod.sql.replaceAll("DATE(sale_date)", "DATE(pos_sales.sale_date)")}`,
        [...salesSeasonParams, ...salesPeriod.values],
      );
      const [financeSummary] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(CASE WHEN fr.record_type = 'Income' AND fr.source_module = 'POS' AND (${postedIncomeCondition}) THEN fr.amount ELSE 0 END), 0) AS salesTotal,
                COALESCE(SUM(CASE WHEN fr.record_type = 'Income' AND fr.source_module <> 'POS' AND (${postedIncomeCondition}) THEN fr.amount ELSE 0 END), 0) AS incomeTotal,
                COALESCE(SUM(CASE WHEN fr.record_type = 'Expense' THEN fr.amount ELSE 0 END), 0) AS expenseTotal
           FROM financial_records fr
           LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
          WHERE fr.record_status = 'Active'
            AND fr.approved_by IS NOT NULL
            ${financeSeasonFilter} ${financePeriod.sql.replaceAll("record_date", "fr.record_date")}`,
        [...financeSeasonParams, ...financePeriod.values],
      );
      const [cropRows] = await databasePool().execute<RowDataPacket[]>(
        `SELECT crop_name AS cropName,
                sector,
                COALESCE(SUM(quantity_produced), 0) AS quantityProduced,
                COALESCE(SUM(production_cost), 0) AS productionCost,
                COUNT(*) AS records
           FROM production_records
          WHERE production_status IN ('Recorded', 'Verified', 'Harvested') ${seasonFilter} ${productionPeriod.sql}
          GROUP BY crop_name, sector
          ORDER BY quantityProduced DESC, cropName ASC`,
        [...seasonParams, ...productionPeriod.values],
      );
      const [categoryRows] = await databasePool().execute<RowDataPacket[]>(
        `SELECT fc.category_name AS categoryName,
                fr.record_type AS recordType,
                COALESCE(SUM(fr.amount), 0) AS amount,
                COUNT(*) AS records
           FROM financial_records fr
           JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
          WHERE fr.record_status = 'Active'
            AND fr.approved_by IS NOT NULL
            AND fr.record_type IN ('Income', 'Expense')
            AND (fr.record_type = 'Expense' OR (${postedIncomeCondition}))
            ${financeSeasonFilter} ${financePeriod.sql.replaceAll("record_date", "fr.record_date")}
          GROUP BY fc.category_name, fr.record_type
          ORDER BY amount DESC, categoryName ASC`,
        [...financeSeasonParams, ...financePeriod.values],
      );
      const [productionTrend] = await databasePool().execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(COALESCE(harvest_date, DATE(created_at)), '%Y-%m') AS month,
                COALESCE(SUM(quantity_produced), 0) AS productionQuantity
           FROM production_records
          WHERE production_status IN ('Recorded', 'Verified', 'Harvested') ${seasonFilter} ${productionPeriod.sql}
          GROUP BY month ORDER BY month ASC`,
        [...seasonParams, ...productionPeriod.values],
      );
      const [financeTrend] = await databasePool().execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(fr.record_date, '%Y-%m') AS month,
                COALESCE(SUM(CASE WHEN fr.record_type = 'Income' AND fr.source_module = 'POS' AND (${postedIncomeCondition}) THEN fr.amount ELSE 0 END), 0) AS salesTotal,
                COALESCE(SUM(CASE WHEN fr.record_type = 'Income' AND fr.source_module <> 'POS' AND (${postedIncomeCondition}) THEN fr.amount ELSE 0 END), 0) AS incomeTotal,
                COALESCE(SUM(CASE WHEN fr.record_type = 'Expense' THEN fr.amount ELSE 0 END), 0) AS expenseTotal
           FROM financial_records fr
           LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
          WHERE fr.record_status = 'Active'
            AND fr.approved_by IS NOT NULL
            AND (fr.record_type = 'Expense' OR (${postedIncomeCondition}))
            ${financeSeasonFilter} ${financePeriod.sql.replaceAll("record_date", "fr.record_date")}
          GROUP BY month ORDER BY month ASC`,
        [...financeSeasonParams, ...financePeriod.values],
      );
      const trendMap = new Map<string, { month: string; productionQuantity: number; salesTotal: number; incomeTotal: number; expenseTotal: number; netResult: number }>();
      const ensureMonth = (month: string) => {
        const current = trendMap.get(month) ?? { month, productionQuantity: 0, salesTotal: 0, incomeTotal: 0, expenseTotal: 0, netResult: 0 };
        trendMap.set(month, current);
        return current;
      };
      for (const row of productionTrend) ensureMonth(String(row.month)).productionQuantity += numberValue(row.productionQuantity);
      for (const row of financeTrend) {
        const item = ensureMonth(String(row.month));
        item.salesTotal += numberValue(row.salesTotal);
        item.incomeTotal += numberValue(row.incomeTotal);
        item.expenseTotal += numberValue(row.expenseTotal);
      }
      const summary = {
        productionQuantity: numberValue(productionSummary[0]?.productionQuantity),
        productionCost: numberValue(productionSummary[0]?.productionCost),
        salesTotal: numberValue(financeSummary[0]?.salesTotal),
        salesTransactions: numberValue(salesSummary[0]?.salesTransactions),
        incomeTotal: numberValue(financeSummary[0]?.incomeTotal),
        expenseTotal: numberValue(financeSummary[0]?.expenseTotal),
        netResult: numberValue(financeSummary[0]?.salesTotal) + numberValue(financeSummary[0]?.incomeTotal) - numberValue(financeSummary[0]?.expenseTotal),
        profitMargin: 0,
      };
      const grossIncome = summary.salesTotal + summary.incomeTotal;
      summary.profitMargin = grossIncome > 0 ? (summary.netResult / grossIncome) * 100 : 0;
      const monthlyTrend = [...trendMap.values()].map((item) => ({ ...item, netResult: item.salesTotal + item.incomeTotal - item.expenseTotal }));
      return {
        season: selectedSeason,
        summary,
        productionByCrop: cropRows.map((row) => ({ cropName: String(row.cropName), sector: String(row.sector), quantityProduced: numberValue(row.quantityProduced), productionCost: numberValue(row.productionCost), records: numberValue(row.records) })),
        financialByCategory: categoryRows.map((row) => ({ categoryName: String(row.categoryName), recordType: row.recordType as "Income" | "Expense", amount: numberValue(row.amount), records: numberValue(row.records) })),
        monthlyTrend,
      };
    },
  };
}
