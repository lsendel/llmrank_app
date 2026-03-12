import type { Persona } from "./personas";

export interface DiscoveryResult {
  competitors: string[];
  personas: Array<Omit<Persona, "id" | "projectId" | "createdAt">>;
  keywords: Array<{
    keyword: string;
    funnelStage?: string;
    relevanceScore?: number;
  }>;
}

export interface CompetitorSuggestion {
  domain: string;
  reason: string;
}

export interface SuggestCompetitorsResponse {
  competitors: CompetitorSuggestion[];
}
