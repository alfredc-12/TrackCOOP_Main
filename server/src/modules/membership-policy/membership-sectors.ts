import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
export const SECTORS = [
  "Rice",
  "Corn",
  "Fishery",
  "Livestock",
  "High-value crops (gulayan)",
  "Coffee",
] as const;
export async function saveSectors(
  db: Pool | PoolConnection,
  kind: "application" | "member",
  id: string,
  sectors: readonly string[],
) {
  const table =
    kind === "application"
      ? "membership_application_sectors"
      : "member_sectors";
  const column =
    kind === "application" ? "membership_application_id" : "member_id";
  await db.execute(`DELETE FROM ${table} WHERE ${column}=?`, [id]);
  for (const sector of new Set(sectors))
    await db.execute(
      `INSERT INTO ${table}(${column},sector_id) SELECT ?,sector_id FROM cooperative_sectors WHERE sector_name=?`,
      [id, sector],
    );
}
export async function readSectors(
  db: Pool | PoolConnection,
  kind: "application" | "member",
  id: string,
) {
  const table =
    kind === "application"
      ? "membership_application_sectors"
      : "member_sectors";
  const column =
    kind === "application" ? "membership_application_id" : "member_id";
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT s.sector_name AS name FROM ${table} j JOIN cooperative_sectors s ON s.sector_id=j.sector_id WHERE j.${column}=? ORDER BY s.sector_id`,
    [id],
  );
  return rows.map((r) => String(r.name));
}
