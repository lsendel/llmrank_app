import {
  createDb,
  savedKeywordQueries,
  projectQueries,
  userQueries,
  pageQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, validateKeyword } from "@llm-boost/shared";
import { createLogger } from "@llm-boost/shared";

export interface AutoKeywordInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
}

export async function runAutoKeywordGeneration(
  input: AutoKeywordInput,
): Promise<void> {
  const log = createLogger({ context: "auto-keyword" });
  const db = createDb(input.databaseUrl);

  const existing = await savedKeywordQueries(db).countByProject(
    input.projectId,
  );
  if (existing > 0) {
    log.info("Auto-keyword skipped: keywords already exist", {
      projectId: input.projectId,
    });
    return;
  }

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = PLAN_LIMITS[user.plan];

  // Gather context from crawled pages
  const pages = await pageQueries(db).listByJob(input.crawlJobId);
  const titles = pages
    .map((p) => p.title)
    .filter(Boolean)
    .slice(0, 20)
    .join("\n");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: input.anthropicApiKey });

  const prompt = `Generate 10 search queries that a potential customer would type into an AI assistant (ChatGPT, Claude, Perplexity) when looking for a product/service like this website offers.

Domain: ${project.domain}
Name: ${project.name}
Page titles:
${titles}

Return ONLY a valid JSON array of objects: [{"keyword": "the search query", "funnelStage": "education"|"comparison"|"purchase"}]

Mix of funnel stages. Keep queries under 100 characters. Natural language, not SEO-stuffed.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const keywords = JSON.parse(cleaned);

    if (!Array.isArray(keywords)) return;

    const maxToCreate = Math.min(
      keywords.length,
      limits.savedKeywordsPerProject,
    );

    const validRows = keywords
      .slice(0, maxToCreate)
      .filter(
        (k: { keyword?: string }) =>
          k.keyword && validateKeyword(k.keyword).valid,
      )
      .map((k: { keyword: string; funnelStage?: string }) => ({
        projectId: input.projectId,
        keyword: k.keyword.trim(),
        source: "auto_discovered" as const,
        funnelStage: (["education", "comparison", "purchase"].includes(
          k.funnelStage ?? "",
        )
          ? k.funnelStage
          : "education") as "education" | "comparison" | "purchase",
      }));

    if (validRows.length > 0) {
      await savedKeywordQueries(db).createMany(validRows);
    }

    log.info(`Auto-keyword created ${validRows.length} keywords`, {
      projectId: input.projectId,
    });
  } catch (err) {
    log.error("Auto-keyword generation failed", { error: String(err) });
  }
}
