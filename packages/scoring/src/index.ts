export { scorePage } from "./engine";
export { scoreTechnicalFactors } from "./factors/technical";
export { scoreContentFactors } from "./factors/content";
export { scoreAiReadinessFactors } from "./factors/ai-readiness";
export { scorePerformanceFactors } from "./factors/performance";
export type { PageData, ScoringResult, FactorResult } from "./types";
export {
  clusterPagesByTopic,
  type PageTopicInput,
  type TopicCluster,
} from "./domain/topic-cluster";
export { computeCitationReadiness } from "./citation-readiness";
