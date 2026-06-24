export interface Benchmarks {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  count: number;
  updatedAt: string;
}

export interface CompetitorWinningQuery {
  query: string;
  providers: string[];
  wins: number;
  bestPosition: number | null;
  avgPosition: number | null;
  lastSeenAt: string;
  yourMentioned: boolean;
  yourCited: boolean;
}

export interface CompetitorTheme {
  label: string;
  source: "homepage" | "queries" | "mixed";
  evidence: string[];
}

export interface CompetitorHomepageSignals {
  title: string | null;
  metaDescription: string | null;
  headings: string[];
}

export interface CompetitorInsight {
  competitorDomain: string;
  winningQueries: CompetitorWinningQuery[];
  inferredThemes: CompetitorTheme[];
  homepageSignals: CompetitorHomepageSignals | null;
}
