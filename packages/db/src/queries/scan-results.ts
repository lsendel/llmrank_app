import { eq, lt } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { scanResults } from "../schema";

// D1 stores scores/issues/quickWins/siteContext as JSON TEXT. Parse them back
// on read so callers get the same object shape `create` was given (the public
// scan-results route and the results page index into scores.*, and a raw string
// silently yields undefined → blank category scores + a wrong "F" grade).
function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function scanResultQueries(db: Database) {
  return {
    async create(data: {
      domain: string;
      url: string;
      scores: Record<string, unknown>;
      issues: unknown[];
      quickWins: unknown[];
      siteContext?: unknown;
      ipHash?: string;
    }) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const [row] = await db
        .insert(scanResults)
        .values({
          id: crypto.randomUUID(),
          domain: data.domain,
          url: data.url,
          scores: JSON.stringify(data.scores),
          issues: JSON.stringify(data.issues),
          quickWins: JSON.stringify(data.quickWins),
          siteContext:
            data.siteContext != null
              ? typeof data.siteContext === "string"
                ? data.siteContext
                : JSON.stringify(data.siteContext)
              : null,
          ipHash: data.ipHash,
          expiresAt: expiresAt.toISOString(),
        })
        .returning();
      return row;
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(scanResults)
        .where(eq(scanResults.id, id));
      if (!row) return null;
      return {
        ...row,
        scores: parseJsonField(row.scores),
        issues: parseJsonField(row.issues),
        quickWins: parseJsonField(row.quickWins),
        siteContext: parseJsonField(row.siteContext),
      };
    },

    async deleteExpired() {
      const result = await db
        .delete(scanResults)
        .where(lt(scanResults.expiresAt, new Date().toISOString()))
        .returning({ id: scanResults.id });
      return result.length;
    },
  };
}
