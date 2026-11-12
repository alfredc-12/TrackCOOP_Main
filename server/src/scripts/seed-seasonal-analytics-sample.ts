import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../db/pool";

const SAMPLE_MARKER = "SEASONAL_ANALYTICS_SAMPLE_V1";

type SeasonSpec = {
  key: string;
  name: string;
  type: string;
  year: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Closed";
  description: string;
};

type ProductionSpec = {
  seasonKey: string;
  cropName: string;
  sector: string;
  barangay: string;
  areaPlanted: number;
  quantityProduced: number;
  productionCost: number;
  harvestDate: string;
};

type IdRow = RowDataPacket & { id: string | number };

const seasons: SeasonSpec[] = [
  {
    key: "2025-dry",
    name: "2025 Dry Season",
    type: "Dry Season",
    year: 2025,
    startDate: "2025-01-01",
    endDate: "2025-05-31",
    status: "Closed",
    description: "Sample seasonal analytics period for the 2025 dry-crop cycle.",
  },
  {
    key: "2025-wet",
    name: "2025 Wet Season",
    type: "Wet Season",
    year: 2025,
    startDate: "2025-06-01",
    endDate: "2025-11-30",
    status: "Closed",
    description: "Sample seasonal analytics period for the 2025 wet-crop cycle.",
  },
  {
    key: "2026-dry",
    name: "2026 Dry Season",
    type: "Dry Season",
    year: 2026,
    startDate: "2026-01-01",
    endDate: "2026-05-31",
    status: "Closed",
    description: "Sample seasonal analytics period for the 2026 dry-crop cycle.",
  },
  {
    key: "2026-wet",
    name: "2026 Wet Season",
    type: "Wet Season",
    year: 2026,
    startDate: "2026-06-01",
    endDate: "2026-11-30",
    status: "Active",
    description: "Sample seasonal analytics period for the current 2026 wet-crop cycle.",
  },
];

const production: ProductionSpec[] = [
  { seasonKey: "2025-dry", cropName: "Rice", sector: "Rice", barangay: "Bulihan", areaPlanted: 12, quantityProduced: 2500, productionCost: 68000, harvestDate: "2025-04-20" },
  { seasonKey: "2025-dry", cropName: "Corn", sector: "Corn", barangay: "Kaylaway", areaPlanted: 8, quantityProduced: 1800, productionCost: 52000, harvestDate: "2025-04-28" },
  { seasonKey: "2025-dry", cropName: "Tomato", sector: "High-value crops (gulayan)", barangay: "Wawa", areaPlanted: 3, quantityProduced: 1200, productionCost: 48000, harvestDate: "2025-05-08" },
  { seasonKey: "2025-dry", cropName: "Tilapia", sector: "Fishery", barangay: "Bucana", areaPlanted: 2, quantityProduced: 900, productionCost: 76000, harvestDate: "2025-05-18" },
  { seasonKey: "2025-wet", cropName: "Rice", sector: "Rice", barangay: "Looc", areaPlanted: 15, quantityProduced: 3200, productionCost: 94000, harvestDate: "2025-09-12" },
  { seasonKey: "2025-wet", cropName: "Corn", sector: "Corn", barangay: "Banilad", areaPlanted: 10, quantityProduced: 2400, productionCost: 71000, harvestDate: "2025-09-25" },
  { seasonKey: "2025-wet", cropName: "Pechay", sector: "High-value crops (gulayan)", barangay: "Mataas na Kahoy", areaPlanted: 2, quantityProduced: 1500, productionCost: 36000, harvestDate: "2025-10-03" },
  { seasonKey: "2025-wet", cropName: "Milkfish", sector: "Fishery", barangay: "Papaya", areaPlanted: 3, quantityProduced: 1100, productionCost: 99000, harvestDate: "2025-10-18" },
  { seasonKey: "2026-dry", cropName: "Rice", sector: "Rice", barangay: "Calayo", areaPlanted: 18, quantityProduced: 4100, productionCost: 125000, harvestDate: "2026-04-18" },
  { seasonKey: "2026-dry", cropName: "Corn", sector: "Corn", barangay: "Butucan", areaPlanted: 11, quantityProduced: 2700, productionCost: 84000, harvestDate: "2026-04-26" },
  { seasonKey: "2026-dry", cropName: "Tomato", sector: "High-value crops (gulayan)", barangay: "Munting Indang", areaPlanted: 4, quantityProduced: 1900, productionCost: 62000, harvestDate: "2026-05-05" },
  { seasonKey: "2026-dry", cropName: "Chicken", sector: "Livestock", barangay: "Kayrilaw", areaPlanted: 2, quantityProduced: 1500, productionCost: 108000, harvestDate: "2026-05-22" },
  { seasonKey: "2026-wet", cropName: "Rice", sector: "Rice", barangay: "Bulihan", areaPlanted: 20, quantityProduced: 4600, productionCost: 142000, harvestDate: "2026-09-20" },
  { seasonKey: "2026-wet", cropName: "Corn", sector: "Corn", barangay: "Lumbangan", areaPlanted: 12, quantityProduced: 3000, productionCost: 96000, harvestDate: "2026-09-29" },
  { seasonKey: "2026-wet", cropName: "Bitter Gourd", sector: "High-value crops (gulayan)", barangay: "Tumalim", areaPlanted: 4, quantityProduced: 2200, productionCost: 71000, harvestDate: "2026-10-08" },
  { seasonKey: "2026-wet", cropName: "Tilapia", sector: "Fishery", barangay: "Bucana", areaPlanted: 3, quantityProduced: 1400, productionCost: 118000, harvestDate: "2026-10-22" },
];

async function getRecorderId() {
  const [rows] = await getPool().execute<IdRow[]>(
    `SELECT u.user_id AS id
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE u.account_status = 'Active'
        AND r.role_slug IN ('chairman', 'bookkeeper')
      ORDER BY CASE r.role_slug WHEN 'chairman' THEN 0 ELSE 1 END, u.user_id
      LIMIT 1`,
  );

  if (!rows[0]) {
    throw new Error("An active chairman or bookkeeper account is required to seed production records.");
  }

  return rows[0].id;
}

async function getOrCreateSeason(connection: PoolConnection, spec: SeasonSpec, recorderId: string | number) {
  const [existing] = await connection.execute<IdRow[]>(
    "SELECT season_id AS id FROM seasons WHERE season_name = ? AND season_year = ? LIMIT 1",
    [spec.name, spec.year],
  );
  if (existing[0]) return { id: existing[0].id, created: false };

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO seasons
      (season_name, season_type, season_year, start_date, end_date, season_status, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [spec.name, spec.type, spec.year, spec.startDate, spec.endDate, spec.status, spec.description, recorderId],
  );
  return { id: result.insertId, created: true };
}

async function seedProductionRecord(connection: PoolConnection, seasonId: string | number, record: ProductionSpec, recorderId: string | number) {
  const marker = `${SAMPLE_MARKER}:${record.seasonKey}:${record.cropName}`;
  const [existing] = await connection.execute<IdRow[]>(
    "SELECT production_record_id AS id FROM production_records WHERE season_id = ? AND remarks = ? LIMIT 1",
    [seasonId, marker],
  );
  if (existing[0]) return false;

  await connection.execute(
    `INSERT INTO production_records
      (season_id, member_id, barangay, sector, crop_name, area_planted, area_unit,
       quantity_produced, quantity_unit, production_cost, harvest_date, production_status, remarks, recorded_by)
     VALUES (?, NULL, ?, ?, ?, ?, 'hectare', ?, 'kg', ?, ?, 'Harvested', ?, ?)`,
    [seasonId, record.barangay, record.sector, record.cropName, record.areaPlanted, record.quantityProduced, record.productionCost, record.harvestDate, marker, recorderId],
  );
  return true;
}

async function main() {
  const pool = getPool();
  const recorderId = await getRecorderId();
  const connection = await pool.getConnection();
  const seasonIds = new Map<string, string | number>();
  let createdSeasons = 0;
  let createdProduction = 0;

  try {
    await connection.beginTransaction();

    for (const season of seasons) {
      const result = await getOrCreateSeason(connection, season, recorderId);
      seasonIds.set(season.key, result.id);
      if (result.created) createdSeasons += 1;
    }

    for (const record of production) {
      const seasonId = seasonIds.get(record.seasonKey);
      if (!seasonId) throw new Error(`Missing sample season for ${record.seasonKey}.`);
      if (await seedProductionRecord(connection, seasonId, record, recorderId)) createdProduction += 1;
    }

    await connection.commit();
    console.info(`Seasonal analytics sample ready: ${seasons.length} seasons, ${production.length} production records configured.`);
    console.info(`Created this run: ${createdSeasons} seasons and ${createdProduction} production records.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

void main()
  .catch((error) => {
    console.error("Seasonal analytics sample seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
