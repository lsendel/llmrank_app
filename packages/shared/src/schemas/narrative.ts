import { z } from "zod";

export const narrativeToneValues = ["technical", "business"] as const;
export type NarrativeTone = (typeof narrativeToneValues)[number];

export const narrativeStatusValues = [
  "pending",
  "generating",
  "ready",
  "failed",
] as const;
export type NarrativeStatus = (typeof narrativeStatusValues)[number];

export const narrativeSectionTypeValues = [
  "executive_summary",
  "technical_analysis",
  "content_analysis",
  "ai_readiness_analysis",
  "performance_analysis",
  "trend_analysis",
  "competitive_positioning",
  "priority_recommendations",
] as const;
export type NarrativeSectionType = (typeof narrativeSectionTypeValues)[number];

export const NarrativeSectionSchema = z.object({
  id: z.string(),
  type: z.enum(narrativeSectionTypeValues),
  title: z.string(),
  content: z.string(),
  editedContent: z.string().nullable().optional(),
  order: z.number(),
  dataContext: z.record(z.unknown()),
});
export type NarrativeSection = z.infer<typeof NarrativeSectionSchema>;

export const GenerateNarrativeSchema = z.object({
  crawlJobId: z.string().uuid(),
  tone: z.enum(narrativeToneValues).default("technical"),
});
export type GenerateNarrativeInput = z.infer<typeof GenerateNarrativeSchema>;

export const EditNarrativeSectionSchema = z.object({
  editedContent: z.string().nullable(),
});
export type EditNarrativeSectionInput = z.infer<
  typeof EditNarrativeSectionSchema
>;

export const RegenerateNarrativeSectionSchema = z.object({
  tone: z.enum(narrativeToneValues).default("technical"),
  instructions: z.string().max(500).optional(),
});
export type RegenerateNarrativeSectionInput = z.infer<
  typeof RegenerateNarrativeSectionSchema
>;

export interface NarrativeReportMeta {
  id: string;
  crawlJobId: string;
  projectId: string;
  tone: NarrativeTone;
  status: NarrativeStatus;
  sections: NarrativeSection[];
  version: number;
  generatedBy: string | null;
  tokenUsage: { input: number; output: number; costCents: number } | null;
  createdAt: string;
  updatedAt: string;
}
