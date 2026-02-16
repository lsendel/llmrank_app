export interface ScoringWeights {
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  technical: 25,
  content: 30,
  aiReadiness: 30,
  performance: 15,
};

export const SCORING_PRESETS: Record<string, ScoringWeights> = {
  default: DEFAULT_WEIGHTS,
  ecommerce: { technical: 30, content: 20, aiReadiness: 35, performance: 15 },
  blog: { technical: 15, content: 40, aiReadiness: 30, performance: 15 },
  saas: { technical: 25, content: 25, aiReadiness: 35, performance: 15 },
  local_business: {
    technical: 30,
    content: 25,
    aiReadiness: 25,
    performance: 20,
  },
};

/** Normalize weights to sum to 1.0 for multiplication */
export function normalizeWeights(w: ScoringWeights): {
  technical: number;
  content: number;
  ai_readiness: number;
  performance: number;
} {
  const total = w.technical + w.content + w.aiReadiness + w.performance;
  return {
    technical: w.technical / total,
    content: w.content / total,
    ai_readiness: w.aiReadiness / total,
    performance: w.performance / total,
  };
}
