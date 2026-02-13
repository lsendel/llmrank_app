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

export type PageScore = z.infer<typeof PageScoreSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type LLMContentScores = z.infer<typeof LLMContentScoresSchema>;
