import { sql } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";

interface KVNamespace {
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export async function aggregateBenchmarks(db: Database, kv: KVNamespace) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db.execute(
    sql`SELECT ps.overall_score
        FROM page_scores ps
        JOIN crawl_jobs cj ON ps.job_id = cj.id
        WHERE cj.status = 'complete'
          AND cj.completed_at >= ${thirtyDaysAgo.toISOString()}
        ORDER BY ps.overall_score ASC`,
  );

  const scores = result.rows
    .map((r: any) => Number(r.overall_score))
    .filter((s: number) => !isNaN(s));

  if (scores.length === 0) return;

  const percentile = (p: number) => scores[Math.floor(scores.length * p)] ?? 0;

  const benchmarks = {
    p10: percentile(0.1),
    p25: percentile(0.25),
    p50: percentile(0.5),
    p75: percentile(0.75),
    p90: percentile(0.9),
    count: scores.length,
    updatedAt: new Date().toISOString(),
  };

  await kv.put("benchmarks:overall", JSON.stringify(benchmarks), {
    expirationTtl: 86400,
  });
}
