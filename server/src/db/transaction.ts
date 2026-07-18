import type { Pool, PoolConnection } from "mysql2/promise";
import { getPool } from "./pool";

export async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
  transactionPool: Pick<Pool, "getConnection"> = getPool(),
) {
  const connection = await transactionPool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
