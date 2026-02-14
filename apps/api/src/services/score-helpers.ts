export type AggregateScoreInput = {
  overallScore: number | null;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  detail?: unknown;
};

export function toAggregateInput<T extends AggregateScoreInput>(rows: T[]) {
  return rows.map((row) => ({
    overallScore: row.overallScore,
    technicalScore: row.technicalScore,
    contentScore: row.contentScore,
    aiReadinessScore: row.aiReadinessScore,
    detail: (row.detail ?? null) as Record<string, unknown> | null,
  }));
}
