import { getTableColumns, type Table } from "drizzle-orm";

/**
 * Cloudflare D1 (SQLite) rejects any statement with more than 100 bound
 * parameters ("too many SQL variables", SQLITE_ERROR 7500). A multi-row INSERT
 * binds one parameter per (row, column), so a batch that is fine on
 * Postgres/Neon can overflow on D1 once it has enough rows.
 *
 * Chunk size is derived from the TABLE's full insertable column count, not from
 * the keys present in each row object. Drizzle can bind a parameter for every
 * column it knows about (rows that omit a column still contribute to the column
 * set of a multi-row insert), so counting `Object.keys(row)` undercounts and a
 * "safe" chunk can still overflow. Sizing by the table's column count is
 * conservative and correct regardless of which optional fields a row sets.
 *
 * `reservedParams` reserves headroom for parameters a statement binds beyond the
 * row values — e.g. an `onConflictDoUpdate({ set: {...} })` clause.
 *
 * NOTE: chunks are not a single atomic statement. Callers that need all-or-
 * nothing semantics (or retry-safety against at-least-once ingest) should rely
 * on idempotent inserts (unique constraint + onConflict), not on this helper.
 */
export const D1_MAX_BIND_PARAMS = 100;

export function chunkForD1Insert<T>(
  rows: T[],
  table: Table,
  reservedParams = 0,
): T[][] {
  if (rows.length <= 1) return rows.length ? [rows] : [];

  const colsPerRow = Math.max(1, Object.keys(getTableColumns(table)).length);
  const budget = Math.max(1, D1_MAX_BIND_PARAMS - reservedParams);
  const rowsPerChunk = Math.max(1, Math.floor(budget / colsPerRow));
  if (rowsPerChunk >= rows.length) return [rows];

  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerChunk) {
    chunks.push(rows.slice(i, i + rowsPerChunk));
  }
  return chunks;
}
