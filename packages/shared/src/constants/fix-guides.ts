export interface FixGuideStep {
  title: string;
  description: string;
  codeSnippet?: string;
  language?: "html" | "json" | "txt" | "javascript" | "php" | "nginx";
  tip?: string;
  docsUrl?: string;
}

export interface FixGuide {
  issueCode: string;
  title: string;
  estimatedMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  platforms: Record<string, FixGuideStep[]>;
  aiFixAvailable: boolean;
}

import { TECHNICAL_GUIDES } from "./fix-guides-technical";
import { CONTENT_GUIDES } from "./fix-guides-content";
import { AI_READINESS_GUIDES } from "./fix-guides-ai";
import { PERFORMANCE_GUIDES } from "./fix-guides-performance";

export const FIX_GUIDES: Record<string, FixGuide> = {
  ...TECHNICAL_GUIDES,
  ...CONTENT_GUIDES,
  ...AI_READINESS_GUIDES,
  ...PERFORMANCE_GUIDES,
};
