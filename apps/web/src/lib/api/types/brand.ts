export interface BrandSentiment {
  overallSentiment: "positive" | "neutral" | "negative" | "mixed" | null;
  sentimentScore: number | null;
  distribution: { positive: number; neutral: number; negative: number };
  recentDescriptions: {
    description: string;
    provider: string;
    checkedAt: string | Date;
  }[];
  providerBreakdown: Record<
    string,
    { positive: number; neutral: number; negative: number; total: number }
  >;
  sampleSize: number;
}

export interface BrandSentimentSnapshot {
  id: string;
  projectId: string;
  period: string;
  overallSentiment: "positive" | "neutral" | "negative" | "mixed" | null;
  sentimentScore: number | null;
  keyAttributes: unknown;
  brandNarrative: string | null;
  strengthTopics: unknown;
  weaknessTopics: unknown;
  providerBreakdown: unknown;
  sampleSize: number;
  createdAt: string | Date;
}

export interface BrandPerceptionProvider {
  provider: string;
  sampleSize: number;
  overallSentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  distribution: { positive: number; neutral: number; negative: number };
  descriptions: string[];
}

export interface BrandPerformance {
  period: string;
  yourBrand: {
    mentionRate: number;
    citationRate: number;
    sovPercent: number;
    trend: number;
  };
  competitors: {
    domain: string;
    mentionRate: number;
    citationRate: number;
    sovPercent: number;
    trend: number;
  }[];
  topPrompts: {
    query: string;
    yourMentioned: boolean;
    competitorsMentioned: string[];
  }[];
  weekOverWeek: {
    mentionsDelta: number;
    sovDelta: number;
    citationsDelta: number;
  };
}
