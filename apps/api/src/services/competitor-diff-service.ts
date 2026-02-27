type Benchmark = {
  overallScore: number | null;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  performanceScore: number | null;
  llmsTxtScore: number | null;
  robotsTxtScore: number | null;
  sitemapScore: number | null;
  schemaMarkupScore: number | null;
  botAccessScore: number | null;
};

type CompetitorEvent = {
  eventType: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  data: Record<string, unknown>;
};

const SCORE_CHANGE_THRESHOLD = 5;
const REGRESSION_THRESHOLD = 10;
const IMPROVEMENT_THRESHOLD = 10;

export function diffBenchmarks(
  domain: string,
  previous: Benchmark | null,
  current: Benchmark,
): CompetitorEvent[] {
  if (!previous) return [];

  const events: CompetitorEvent[] = [];

  // Overall score regression/improvement
  if (previous.overallScore != null && current.overallScore != null) {
    const delta = current.overallScore - previous.overallScore;
    if (delta <= -REGRESSION_THRESHOLD) {
      events.push({
        eventType: "score_regression",
        severity: "warning",
        summary: `${domain} overall score dropped ${Math.abs(delta).toFixed(0)} points (${previous.overallScore.toFixed(0)} → ${current.overallScore.toFixed(0)})`,
        data: {
          previousScore: previous.overallScore,
          newScore: current.overallScore,
          delta,
        },
      });
    } else if (delta >= IMPROVEMENT_THRESHOLD) {
      events.push({
        eventType: "score_improvement",
        severity: "info",
        summary: `${domain} overall score improved ${delta.toFixed(0)} points (${previous.overallScore.toFixed(0)} → ${current.overallScore.toFixed(0)})`,
        data: {
          previousScore: previous.overallScore,
          newScore: current.overallScore,
          delta,
        },
      });
    }
  }

  // Per-category score changes
  const categories = [
    { key: "technicalScore", label: "Technical" },
    { key: "contentScore", label: "Content" },
    { key: "aiReadinessScore", label: "AI Readiness" },
    { key: "performanceScore", label: "Performance" },
  ] as const;

  for (const { key, label } of categories) {
    const prev = previous[key];
    const curr = current[key];
    if (prev != null && curr != null) {
      const delta = curr - prev;
      if (Math.abs(delta) >= SCORE_CHANGE_THRESHOLD) {
        events.push({
          eventType: "score_change",
          severity: "info",
          summary: `${domain} ${label} score ${delta > 0 ? "improved" : "dropped"} ${Math.abs(delta).toFixed(0)} points (${prev.toFixed(0)} → ${curr.toFixed(0)})`,
          data: { category: key, previousScore: prev, newScore: curr, delta },
        });
      }
    }
  }

  // Binary change detection
  const binaryCheck = (
    prevScore: number | null,
    currScore: number | null,
    addedType: string,
    removedType: string,
    addedSeverity: "critical" | "warning" | "info",
    removedSeverity: "critical" | "warning" | "info",
    label: string,
  ) => {
    const wasPresent = prevScore != null && prevScore > 0;
    const isPresent = currScore != null && currScore > 0;
    if (!wasPresent && isPresent) {
      events.push({
        eventType: addedType,
        severity: addedSeverity,
        summary: `${domain} added ${label}`,
        data: { previousScore: prevScore, newScore: currScore },
      });
    } else if (wasPresent && !isPresent) {
      events.push({
        eventType: removedType,
        severity: removedSeverity,
        summary: `${domain} removed ${label}`,
        data: { previousScore: prevScore, newScore: currScore },
      });
    }
  };

  binaryCheck(
    previous.llmsTxtScore,
    current.llmsTxtScore,
    "llms_txt_added",
    "llms_txt_removed",
    "critical",
    "info",
    "llms.txt",
  );
  binaryCheck(
    previous.botAccessScore,
    current.botAccessScore,
    "ai_crawlers_unblocked",
    "ai_crawlers_blocked",
    "critical",
    "warning",
    "AI crawler access",
  );
  binaryCheck(
    previous.schemaMarkupScore,
    current.schemaMarkupScore,
    "schema_added",
    "schema_removed",
    "info",
    "info",
    "structured data",
  );
  binaryCheck(
    previous.sitemapScore,
    current.sitemapScore,
    "sitemap_added",
    "sitemap_removed",
    "info",
    "info",
    "sitemap",
  );

  return events;
}
