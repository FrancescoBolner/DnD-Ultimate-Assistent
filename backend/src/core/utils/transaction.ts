import { pool } from '../../config/db';
import type { PoolConnection } from 'mysql2/promise';

/**
 * Run a callback inside a MySQL transaction.
 * Automatically commits on success, rolls back on error.
 *
 * Usage:
 *   await withTransaction(async (conn) => {
 *     await conn.execute('UPDATE ...', [...]);
 *     await conn.execute('DELETE ...', [...]);
 *   });
 */
export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
