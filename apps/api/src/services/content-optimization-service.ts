import Anthropic from "@anthropic-ai/sdk";
import { createDb, pageQueries, scoreQueries } from "@llm-boost/db";

export interface ContentOptimizationInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
  limit?: number;
}

interface Improvement {
  type: string;
  suggestion: string;
  priority: string;
}

interface PageSuggestion {
  pageId: string;
  url: string;
  aiReadinessScore: number;
  improvements: Improvement[];
}

export interface ContentOptimizationResult {
  pagesAnalyzed: number;
  suggestions: PageSuggestion[];
}

export async function runContentOptimization(
  input: ContentOptimizationInput,
): Promise<ContentOptimizationResult> {
  const db = createDb(input.databaseUrl);
  const pages = await pageQueries(db).listByJob(input.crawlJobId);
  const scores = await scoreQueries(db).listByJob(input.crawlJobId);
  const issues = await scoreQueries(db).getIssuesByJob(input.crawlJobId);

  const limit = input.limit ?? 10;
  const scoreMap = new Map(scores.map((s) => [s.pageId, s]));
  const issueMap = new Map<string, typeof issues>();
  for (const issue of issues) {
    const arr = issueMap.get(issue.pageId) ?? [];
    arr.push(issue);
    issueMap.set(issue.pageId, arr);
  }

  const ranked = pages
    .map((p) => ({ page: p, score: scoreMap.get(p.id) }))
    .filter((r) => r.score)
    .sort(
      (a, b) =>
        (a.score!.aiReadinessScore ?? 100) - (b.score!.aiReadinessScore ?? 100),
    )
    .slice(0, limit);

  if (ranked.length === 0) {
    return { pagesAnalyzed: 0, suggestions: [] };
  }

  const client = new Anthropic({ apiKey: input.anthropicApiKey });
  const suggestions: PageSuggestion[] = [];

  for (const { page, score } of ranked) {
    const pageIssues = issueMap.get(page.id) ?? [];

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Analyze this page and suggest improvements for AI visibility:

URL: ${page.url}
Title: ${page.title ?? "None"}
Word Count: ${page.wordCount ?? 0}
AI Readiness Score: ${score!.aiReadinessScore}/100
Content Score: ${score!.contentScore}/100
Issues: ${pageIssues.map((i) => i.code).join(", ") || "None"}

Return JSON: { "improvements": [{ "type": string, "suggestion": string, "priority": "high"|"medium"|"low" }] }`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.improvements?.length) {
          suggestions.push({
            pageId: page.id,
            url: page.url,
            aiReadinessScore: score!.aiReadinessScore ?? 0,
            improvements: parsed.improvements,
          });
        }
      }
    } catch {
      // Continue with next page on failure
    }
  }

  return { pagesAnalyzed: ranked.length, suggestions };
}
