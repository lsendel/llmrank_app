export function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/** Average an array of nullable numbers, rounding to the nearest integer. Returns 0 if empty. */
export function averageScores(vals: (number | null | undefined)[]): number {
  const nums = vals.filter((n): n is number => n != null);
  return nums.length > 0
    ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
    : 0;
}

/** Aggregate per-page scores into overall + category scores with letter grade. */
export function aggregatePageScores(
  rows: {
    overallScore: number | null;
    technicalScore: number | null;
    contentScore: number | null;
    aiReadinessScore: number | null;
    detail?: unknown;
  }[],
) {
  const overallScore = averageScores(rows.map((s) => s.overallScore));
  const technical = averageScores(rows.map((s) => s.technicalScore));
  const content = averageScores(rows.map((s) => s.contentScore));
  const aiReadiness = averageScores(rows.map((s) => s.aiReadinessScore));
  // Performance: null ("not measured") when no page carries a performance
  // score, rather than 0. averageScores returns 0 for an empty set, which would
  // render a false F in History/Overview when performance was never collected.
  const performanceSamples = rows
    .map((s) => {
      const d = s.detail as Record<string, unknown> | null | undefined;
      return (d?.performanceScore as number) ?? null;
    })
    .filter((n): n is number => n != null);
  const performance = performanceSamples.length
    ? averageScores(performanceSamples)
    : null;

  // Content assessment split. Under top-N LLM content-scoring gating (#106-#108)
  // most pages carry NO llmContentScores, so they skip the LLM-content deduction
  // and their contentScore reads ~+17pts high — inflating the site-level `content`
  // average above. Expose an honest average taken ONLY over LLM-assessed pages,
  // plus the denominator (assessed vs total), so callers can present "assessed vs
  // pending" instead of a number inflated by unscored pages. `content` is kept
  // unchanged for backward compatibility.
  const assessedRows = rows.filter((s) => {
    const d = s.detail as Record<string, unknown> | null | undefined;
    return d != null && (d.llmContentScores ?? null) != null;
  });
  const contentAssessed = assessedRows.length
    ? averageScores(assessedRows.map((s) => s.contentScore))
    : null;

  return {
    overallScore,
    letterGrade: letterGrade(overallScore),
    scores: { technical, content, aiReadiness, performance },
    assessment: {
      contentAssessed,
      assessedPages: assessedRows.length,
      totalPages: rows.length,
    },
  };
}
