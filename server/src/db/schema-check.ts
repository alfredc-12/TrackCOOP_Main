import type { Pool, RowDataPacket } from "mysql2/promise";
import { getDatabaseConfig } from "../config/database";
import { expectedDatabaseTables } from "./expected-tables";
import { getPool } from "./pool";

type DatabaseTableRow = RowDataPacket & {
  tableName: string;
};

export type SchemaComparison = {
  expectedCount: number;
  actualCount: number;
  missingTables: string[];
  unexpectedTables: string[];
  isComplete: boolean;
};

export function compareDatabaseTables(
  actualTables: readonly string[],
): SchemaComparison {
  const expected = new Set<string>(expectedDatabaseTables);
  const actual = new Set(actualTables);
  const missingTables = expectedDatabaseTables.filter(
    (tableName) => !actual.has(tableName),
  );
  const unexpectedTables = [...actual]
    .filter((tableName) => !expected.has(tableName))
    .sort();

  return {
    expectedCount: expected.size,
    actualCount: actual.size,
    missingTables,
    unexpectedTables,
    isComplete: missingTables.length === 0,
  };
}

export async function checkDatabaseSchema(
  databasePool: Pick<Pool, "execute"> = getPool(),
) {
  await databasePool.execute("SELECT 1 AS connection_ok");

  const databaseName = getDatabaseConfig().database;
  const [rows] = await databasePool.execute<DatabaseTableRow[]>(
    `SELECT TABLE_NAME AS tableName
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
    [databaseName],
  );

  return compareDatabaseTables(rows.map((row) => row.tableName));
}
