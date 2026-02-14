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
  const performance = averageScores(
    rows.map((s) => {
      const d = s.detail as Record<string, unknown> | null | undefined;
      return (d?.performanceScore as number) ?? null;
    }),
  );

  return {
    overallScore,
    letterGrade: letterGrade(overallScore),
    scores: { technical, content, aiReadiness, performance },
  };
}
