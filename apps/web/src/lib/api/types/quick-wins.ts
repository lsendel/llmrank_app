import type { RecommendationConfidence } from "./recommendations";

export interface QuickWin {
  code: string;
  category: string;
  severity: string;
  scoreImpact: number;
  effortLevel: "low" | "medium" | "high";
  message: string;
  recommendation: string;
  implementationSnippet?: string;
  priority: number;
  affectedPages: number;
  owner?: string;
  pillar?: string;
  docsUrl?: string;
  effort?: "low" | "medium" | "high";
  dataTimestamp?: string | null;
  confidence?: RecommendationConfidence;
}
