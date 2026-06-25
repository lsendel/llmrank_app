/**
 * Cloudflare D1 (SQLite) rejects any statement with more than 100 bound
 * parameters ("too many SQL variables", SQLITE_ERROR 7500). A multi-row
 * INSERT binds (rows × columns) parameters, so a batch that is fine on
 * Postgres/Neon can overflow on D1 once it has enough rows.
 *
 * Split rows into chunks small enough that (rowsPerChunk × columns) stays at or
 * under the limit. Chunk size is derived from the widest row's column count, so
 * it stays correct if a table gains columns. Callers insert each chunk and
 * concatenate the results.
 */
export const D1_MAX_BIND_PARAMS = 100;

export function chunkForD1Insert<T extends Record<string, unknown>>(
  rows: T[],
  maxParams: number = D1_MAX_BIND_PARAMS,
): T[][] {
  if (rows.length <= 1) return rows.length ? [rows] : [];

  const colsPerRow = rows.reduce(
    (max, row) => Math.max(max, Object.keys(row).length),
    1,
  );
  const rowsPerChunk = Math.max(1, Math.floor(maxParams / colsPerRow));
  if (rowsPerChunk >= rows.length) return [rows];

  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerChunk) {
    chunks.push(rows.slice(i, i + rowsPerChunk));
  }
  return chunks;
}
