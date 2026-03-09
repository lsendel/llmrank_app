import { type StrategyCompetitor } from "@/lib/api";

export type SubTab = "benchmark" | "activity" | "trends";

export type BenchmarkCategory =
  | "overall"
  | "technical"
  | "content"
  | "aiReadiness"
  | "performance";

export type BenchmarkCompetitor = {
  competitorDomain: string;
  scores: Record<string, number>;
  comparison: Record<string, number>;
  crawledAt: string;
};

export type BenchmarkListData = {
  projectScores: Record<string, number>;
  competitors: BenchmarkCompetitor[];
};

export type BenchmarkScoreRow = {
  key: BenchmarkCategory;
  label: string;
  yourScore: number;
  theirScore: number;
  delta: number;
};

export const BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
  "overall",
  "technical",
  "content",
  "aiReadiness",
  "performance",
];

type StrategyCompetitorWithMonitoring = StrategyCompetitor & {
  monitoringEnabled?: boolean;
  lastBenchmarkAt?: string | null;
};

export function ago(d: string | null | undefined) {
  if (!d) return "Never";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function benchmarkCategoryLabel(category: BenchmarkCategory) {
  if (category === "aiReadiness") return "AI Readiness";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function buildBenchmarkScoreRows(
  projectScores: Record<string, number> | undefined,
  competitor: BenchmarkCompetitor,
) {
  return BENCHMARK_CATEGORIES.map((key) => ({
    key,
    label: benchmarkCategoryLabel(key),
    yourScore: projectScores?.[key] ?? 0,
    theirScore: competitor.scores[key] ?? 0,
    delta: competitor.comparison[key] ?? 0,
  })) satisfies BenchmarkScoreRow[];
}

export function buildStrategyByDomain(
  strategyCompetitors?: StrategyCompetitor[] | null,
) {
  return new Map(
    (strategyCompetitors ?? []).map((item) => [item.domain, item]),
  );
}

export function getStrategyCompetitorMeta(
  competitor?: StrategyCompetitor | null,
) {
  const candidate = competitor as StrategyCompetitorWithMonitoring | undefined;

  return {
    competitorId: candidate?.id,
    monitoringEnabled: candidate?.monitoringEnabled !== false,
    lastBenchmarkAt: candidate?.lastBenchmarkAt,
  };
}

export function buildComparisonBadge(delta: number) {
  if (delta > 0) return { label: "You lead", variant: "success" as const };
  if (delta < 0) {
    return { label: "They lead", variant: "destructive" as const };
  }
  return { label: "Tied", variant: "secondary" as const };
}

export function buildTrendCompetitors(
  competitors: BenchmarkCompetitor[],
  strategyByDomain: Map<string, StrategyCompetitor>,
) {
  return competitors.map((competitor) => ({
    domain: competitor.competitorDomain,
    id: strategyByDomain.get(competitor.competitorDomain)?.id,
  }));
}
