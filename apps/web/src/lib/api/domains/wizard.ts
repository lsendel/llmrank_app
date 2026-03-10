import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

interface KeywordItem {
  keyword: string;
  source: "ai" | "extracted";
}

interface ExtractKeywordsResponse {
  extracted: KeywordItem[];
  aiSuggested: KeywordItem[];
}

interface SuggestedCompetitor {
  domain: string;
  reason: string;
}

interface SuggestCompetitorsResponse {
  competitors: SuggestedCompetitor[];
}

export function createWizardApi() {
  return {
    async extractKeywords(domain: string): Promise<ExtractKeywordsResponse> {
      const res = await apiClient.post<ApiEnvelope<ExtractKeywordsResponse>>(
        "/api/wizard/extract-keywords",
        { domain },
      );
      return res.data;
    },

    async suggestCompetitors(
      domain: string,
      keywords: string[],
    ): Promise<SuggestCompetitorsResponse> {
      const res = await apiClient.post<ApiEnvelope<SuggestCompetitorsResponse>>(
        "/api/wizard/suggest-competitors",
        { domain, keywords },
      );
      return res.data;
    },
  };
}
