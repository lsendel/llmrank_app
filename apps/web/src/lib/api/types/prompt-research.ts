import type { VisibilityCheck } from "./visibility";

export interface AIPrompt {
  id: string;
  projectId: string;
  prompt: string;
  category: string | null;
  estimatedVolume: number | null;
  difficulty: number | null;
  intent: string | null;
  yourMentioned: boolean | null;
  competitorsMentioned: unknown;
  source: string;
  discoveredAt: string;
}

export interface PromptCheckResult {
  promptId?: string;
  prompt: string;
  checkCount: number;
  yourMentioned: boolean;
  competitorsMentioned: string[];
  checks: VisibilityCheck[];
}
