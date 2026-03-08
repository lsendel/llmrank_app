export interface SavedKeyword {
  id: string;
  projectId: string;
  keyword: string;
  source: "auto_discovered" | "user_added" | "perplexity";
  relevanceScore?: number;
  funnelStage?: "education" | "comparison" | "purchase";
  personaId?: string;
  createdAt: string;
}
