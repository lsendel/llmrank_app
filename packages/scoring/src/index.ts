export { scorePage } from "./engine";
export { scorePageV2 } from "./engine-v2";
export { scoreTechnicalFactors } from "./factors/technical";
export { scoreContentFactors } from "./factors/content";
export { scoreAiReadinessFactors } from "./factors/ai-readiness";
export { scorePerformanceFactors } from "./factors/performance";
export type {
  PageData,
  ScoringResult,
  ScoringResultV2,
  FactorResult,
} from "./types";
export {
  clusterPagesByTopic,
  type PageTopicInput,
  type TopicCluster,
} from "./domain/topic-cluster";
export { computeCitationReadiness } from "./citation-readiness";
export {
  calculatePlatformScores,
  type PlatformScores,
  type PlatformScoreResult,
} from "./platforms";
export {
  detectContentType,
  type ContentTypeId,
  type ContentTypeResult,
} from "./domain/content-type";
export {
  generateRecommendations,
  generateStrengths,
  RECOMMENDATION_TEMPLATES,
  type Recommendation,
  type Strength,
  type RecommendationPriority,
  type RecommendationEffort,
  type RecommendationImpact,
} from "./recommendations";
export {
  SCORING_PRESETS,
  DEFAULT_WEIGHTS,
  normalizeWeights,
  type ScoringWeights,
} from "./profiles";
export {
  scoringResultToDimensions,
  dimensionsToLegacyScores,
} from "./dimension-adapter";
export {
  computeAIVisibilityScore,
  type AIVisibilityInput,
  type AIVisibilityResult,
} from "./ai-visibility-score";
