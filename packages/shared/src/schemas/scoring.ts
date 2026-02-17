import { z } from "zod";

export const LetterGrade = z.enum(["A", "B", "C", "D", "F"]);
export type LetterGrade = z.infer<typeof LetterGrade>;

export const PageScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  technical_score: z.number().min(0).max(100),
  content_score: z.number().min(0).max(100),
  ai_readiness_score: z.number().min(0).max(100),
  performance_score: z.number().min(0).max(100),
  letter_grade: LetterGrade,
});

export const IssueSchema = z.object({
  code: z.string(),
  category: z.enum(["technical", "content", "ai_readiness", "performance"]),
  severity: z.enum(["critical", "warning", "info"]),
  message: z.string(),
  recommendation: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const LLMContentScoresSchema = z.object({
  clarity: z.number().min(0).max(100),
  authority: z.number().min(0).max(100),
  comprehensiveness: z.number().min(0).max(100),
  structure: z.number().min(0).max(100),
  citation_worthiness: z.number().min(0).max(100),
});

export const PlatformScoreSchema = z.object({
  score: z.number().min(0).max(100),
  grade: LetterGrade,
  tips: z.array(z.string()),
});

export const RecommendationSchema = z.object({
  issueCode: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  effort: z.enum(["quick", "moderate", "significant"]),
  impact: z.enum(["high", "medium", "low"]),
  estimatedImprovement: z.number(),
  affectedPlatforms: z.array(z.string()),
  steps: z.array(z.string()).optional(),
  example: z
    .object({
      before: z.string(),
      after: z.string(),
    })
    .optional(),
});

export const StrengthSchema = z.object({
  category: z.enum(["technical", "content", "ai_readiness", "performance"]),
  title: z.string(),
  description: z.string(),
});

export type PageScore = z.infer<typeof PageScoreSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type LLMContentScores = z.infer<typeof LLMContentScoresSchema>;
export type PlatformScoreDetail = z.infer<typeof PlatformScoreSchema>;
export type RecommendationDetail = z.infer<typeof RecommendationSchema>;
export type StrengthDetail = z.infer<typeof StrengthSchema>;

// --- Progress tracking schemas ---

export const CategoryDeltaSchema = z.object({
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
});

export const PageProgressSchema = z.object({
  url: z.string(),
  currentScore: z.number(),
  previousScore: z.number(),
  delta: z.number(),
  issuesFixed: z.array(z.string()),
  issuesNew: z.array(z.string()),
  categoryDeltas: z.object({
    technical: CategoryDeltaSchema,
    content: CategoryDeltaSchema,
    aiReadiness: CategoryDeltaSchema,
    performance: CategoryDeltaSchema,
  }),
});

export const ProjectProgressSchema = z.object({
  currentCrawlId: z.string(),
  previousCrawlId: z.string(),
  scoreDelta: z.number(),
  currentScore: z.number(),
  previousScore: z.number(),
  categoryDeltas: z.object({
    technical: CategoryDeltaSchema,
    content: CategoryDeltaSchema,
    aiReadiness: CategoryDeltaSchema,
    performance: CategoryDeltaSchema,
  }),
  issuesFixed: z.number(),
  issuesNew: z.number(),
  issuesPersisting: z.number(),
  gradeChanges: z.object({
    improved: z.number(),
    regressed: z.number(),
    unchanged: z.number(),
  }),
  velocity: z.number(),
  topImprovedPages: z.array(
    z.object({ url: z.string(), delta: z.number(), current: z.number() }),
  ),
  topRegressedPages: z.array(
    z.object({ url: z.string(), delta: z.number(), current: z.number() }),
  ),
});

export type CategoryDelta = z.infer<typeof CategoryDeltaSchema>;
export type PageProgress = z.infer<typeof PageProgressSchema>;
export type ProjectProgress = z.infer<typeof ProjectProgressSchema>;

// --- Intelligence fusion schemas ---

export const PlatformOpportunitySchema = z.object({
  platform: z.string(),
  currentScore: z.number(),
  opportunityScore: z.number(), // 100 - currentScore
  topTips: z.array(z.string()),
  visibilityRate: z.number().nullable(), // null if no visibility data
});

export const CitationReadinessSchema = z.object({
  score: z.number(),
  components: z.object({
    factCitability: z.number(),
    llmCitationWorthiness: z.number(),
    schemaQuality: z.number(),
    structuredDataCount: z.number(),
  }),
  topCitableFacts: z.array(
    z.object({
      content: z.string(),
      citabilityScore: z.number(),
    }),
  ),
});

export const ROIQuickWinSchema = z.object({
  issueCode: z.string(),
  scoreImpact: z.number(),
  estimatedTrafficImpact: z.number().nullable(), // null if no GSC data
  effort: z.enum(["low", "medium", "high"]),
  affectedPages: z.number(),
});

export const ContentHealthMatrixSchema = z.object({
  scoring: z.number(),
  llmQuality: z.number().nullable(),
  engagement: z.number().nullable(), // from GA4
  uxQuality: z.number().nullable(), // from Clarity
});

export const FusedInsightsSchema = z.object({
  aiVisibilityReadiness: z.number(),
  platformOpportunities: z.array(PlatformOpportunitySchema),
  contentHealthMatrix: ContentHealthMatrixSchema,
  roiQuickWins: z.array(ROIQuickWinSchema),
});

export type PlatformOpportunity = z.infer<typeof PlatformOpportunitySchema>;
export type CitationReadiness = z.infer<typeof CitationReadinessSchema>;
export type ROIQuickWin = z.infer<typeof ROIQuickWinSchema>;
export type ContentHealthMatrix = z.infer<typeof ContentHealthMatrixSchema>;
export type FusedInsights = z.infer<typeof FusedInsightsSchema>;

// --- 7-Dimension scoring schema (additive, does not replace legacy 4-pillar) ---

export const DimensionScoreSchema = z.object({
  llms_txt: z.number().min(0).max(100),
  robots_crawlability: z.number().min(0).max(100),
  sitemap: z.number().min(0).max(100),
  schema_markup: z.number().min(0).max(100),
  meta_tags: z.number().min(0).max(100),
  bot_access: z.number().min(0).max(100),
  content_citeability: z.number().min(0).max(100),
});

export type DimensionScore = z.infer<typeof DimensionScoreSchema>;
