import {
  createDb,
  projectQueries,
  userQueries,
  competitorBenchmarkQueries,
} from "@llm-boost/db";
import { createCompetitorBenchmarkService } from "./competitor-benchmark-service";
import { createCompetitorRepository } from "../repositories";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

export interface AutoCompetitorInput {
  databaseUrl: string;
  projectId: string;
  anthropicApiKey: string;
}

export async function runAutoCompetitorDiscovery(
  input: AutoCompetitorInput,
): Promise<void> {
  const log = createLogger({ context: "auto-competitor" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = PLAN_LIMITS[user.plan];
  if ((limits.competitorsPerProject ?? 0) === 0) return;

  const competitorRepo = createCompetitorRepository(db);
  const existing = await competitorRepo.listByProject(input.projectId);
  if (existing.length > 0) {
    log.info("Auto-competitor skipped: competitors already exist", {
      projectId: input.projectId,
    });
    return;
  }

  // Use LLM to suggest competitors
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: input.anthropicApiKey });

  const prompt = `Given the website domain "${project.domain}" (named "${project.name}"), identify 3 direct competitor domains. Return ONLY a JSON array of domain strings (no http/https prefix), e.g. ["competitor1.com", "competitor2.com", "competitor3.com"]. Only include real, active websites.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const domains: string[] = JSON.parse(cleaned);
    if (!Array.isArray(domains)) return;

    const benchmarkQueries = competitorBenchmarkQueries(db);
    const benchmarkService = createCompetitorBenchmarkService({
      competitorBenchmarks: {
        create: (data) => benchmarkQueries.create(data),
        listByProject: (projectId) => benchmarkQueries.listByProject(projectId),
        getLatest: (projectId, domain) =>
          benchmarkQueries.getLatest(projectId, domain),
      },
      competitors: {
        listByProject: (projectId) => competitorRepo.listByProject(projectId),
        add: (projectId, domain) => competitorRepo.add!(projectId, domain),
      },
    });

    const maxCompetitors = Math.min(
      domains.length,
      limits.competitorsPerProject ?? 3,
    );
    for (const domain of domains.slice(0, maxCompetitors)) {
      try {
        await benchmarkService.benchmarkCompetitor({
          projectId: input.projectId,
          competitorDomain: domain,
          competitorLimit: limits.competitorsPerProject ?? 3,
        });
        log.info("Auto-competitor benchmarked", { domain });
      } catch (err) {
        log.error("Auto-competitor benchmark failed", {
          domain,
          error: String(err),
        });
      }
    }
  } catch (err) {
    log.error("Auto-competitor discovery failed", { error: String(err) });
  }
}
