import { apiClient } from "../core/client";

interface KeywordItem {
  keyword: string;
  source: "ai" | "extracted";
}

export interface ExtractKeywordsResponse {
  extracted: KeywordItem[];
  aiSuggested: KeywordItem[];
}

interface SuggestedCompetitor {
  domain: string;
  reason: string;
}

export interface SuggestCompetitorsResponse {
  competitors: SuggestedCompetitor[];
}

export function createWizardApi() {
  return {
    async extractKeywords(domain: string): Promise<ExtractKeywordsResponse> {
      return apiClient.post<ExtractKeywordsResponse>(
        "/api/wizard/extract-keywords",
        { domain },
      );
    },

    async suggestCompetitors(
      domain: string,
      keywords: string[],
    ): Promise<SuggestCompetitorsResponse> {
      return apiClient.post<SuggestCompetitorsResponse>(
        "/api/wizard/suggest-competitors",
        { domain, keywords },
      );
    },
  };
}
