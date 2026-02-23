import {
  createDb,
  projectQueries,
  pageQueries,
  crawlQueries,
} from "@llm-boost/db";
import { createLogger } from "../lib/logger";

export interface AutoSiteDescriptionInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
}

export async function runAutoSiteDescription(
  input: AutoSiteDescriptionInput,
): Promise<void> {
  const log = createLogger({ context: "auto-site-description" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  // Skip if user already set a description manually
  if (project.siteDescription) {
    log.info("Auto-site-description skipped: already set", {
      projectId: input.projectId,
    });
    return;
  }

  // Gather context from crawl
  const crawl = await crawlQueries(db).getById(input.crawlJobId);
  const pages = await pageQueries(db).listByJob(input.crawlJobId);

  const titles = pages
    .map((p) => p.title)
    .filter(Boolean)
    .slice(0, 15)
    .join("\n");

  const metaDescs = pages
    .map((p) => p.metaDesc)
    .filter(Boolean)
    .slice(0, 10)
    .join("\n");

  const summary = crawl?.summary ?? "";

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: input.anthropicApiKey });

  const prompt = `Analyze this website and determine what it does and what industry it belongs to.

Domain: ${project.domain}
Name: ${project.name}
${summary ? `AI Summary: ${summary}` : ""}

Page titles:
${titles}

Meta descriptions:
${metaDescs}

Return ONLY valid JSON: {"siteDescription": "One sentence describing what this website/product does", "industry": "The industry or niche in 2-4 words"}

If you cannot determine the site's purpose, return: {"siteDescription": "", "industry": ""}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleaned);

    if (result.siteDescription || result.industry) {
      await projectQueries(db).update(input.projectId, {
        siteDescription: result.siteDescription || null,
        industry: result.industry || null,
        siteDescriptionSource: "auto",
        industrySource: "auto",
      });
      log.info("Auto-site-description completed", {
        projectId: input.projectId,
        industry: result.industry,
      });
    }
  } catch (err) {
    log.error("Auto-site-description failed", { error: String(err) });
  }
}
