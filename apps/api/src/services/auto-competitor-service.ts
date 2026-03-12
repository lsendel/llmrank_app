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
  perplexityApiKey?: string;
  grokApiKey?: string;
}

const BLOCKED_DOMAINS = new Set([
  "wikipedia.org",
  "reddit.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "linkedin.com",
  "github.com",
  "medium.com",
  "quora.com",
  "amazon.com",
  "google.com",
]);

function extractDomains(text: string): string[] {
  const domainRegex =
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/g;
  const matches = [...text.matchAll(domainRegex)].map((m) =>
    m[1].toLowerCase().replace(/^www\./, ""),
  );
  return [...new Set(matches)];
}

function isValidCompetitorDomain(
  domain: string,
  projectDomain: string,
): boolean {
  if (!domain || domain.length < 4) return false;
  const normalized = projectDomain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
  if (domain === normalized) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (!domain.includes(".")) return false;
  return true;
}

async function queryPerplexity(
  apiKey: string,
  domain: string,
  description: string,
  industry: string,
): Promise<string[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  const query = description
    ? `What are the top 5 direct competitors to ${domain}? ${description}. Industry: ${industry}. Return only domain names, one per line.`
    : `What are the top 5 direct competitors to ${domain}? Return only domain names, one per line.`;

  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [{ role: "user", content: query }],
    max_tokens: 512,
  });

  const text = response.choices[0]?.message?.content ?? "";
  return extractDomains(text);
}

async function queryGrok(
  apiKey: string,
  domain: string,
  description: string,
  industry: string,
): Promise<string[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });

  const query = description
    ? `List the top 5 direct business competitors to ${domain}. ${description}. Industry: ${industry}. Return only domain names, one per line.`
    : `List the top 5 direct business competitors to ${domain}. Return only domain names, one per line.`;

  const response = await client.chat.completions.create({
    model: "grok-3-fast",
    messages: [{ role: "user", content: query }],
    max_tokens: 512,
  });

  const text = response.choices[0]?.message?.content ?? "";
  return extractDomains(text);
}

async function queryHaikuFallback(
  apiKey: string,
  domain: string,
  name: string,
): Promise<string[]> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Given the website domain "${domain}" (named "${name}"), identify 3 direct competitor domains. Return ONLY a JSON array of domain strings, e.g. ["competitor1.com", "competitor2.com", "competitor3.com"]`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "[]";
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const domains = JSON.parse(cleaned);
    return Array.isArray(domains) ? domains : [];
  } catch {
    return extractDomains(text);
  }
}

export async function runAutoCompetitorDiscovery(
  input: AutoCompetitorInput,
): Promise<void> {
  const log = createLogger({ context: "auto-competitor" });
  const db = createDb(input.databaseUrl);

  // Small delay to let site description service finish
  await new Promise((r) => setTimeout(r, 3000));

  // Re-fetch project for fresh siteDescription/industry
  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = PLAN_LIMITS[user.plan];
  if ((limits.competitorsPerProject ?? 0) === 0) {
    log.info("Auto-competitor skipped: plan has no competitor slots", {
      projectId: input.projectId,
    });
    return;
  }

  const competitorRepo = createCompetitorRepository(db);
  const existing = await competitorRepo.listByProject(input.projectId);
  if (existing.length > 0) {
    log.info("Auto-competitor skipped: competitors already exist", {
      projectId: input.projectId,
    });
    return;
  }

  const description = project.siteDescription ?? "";
  const industry = project.industry ?? "";

  // Query Perplexity and Grok in parallel
  const results = await Promise.allSettled([
    input.perplexityApiKey
      ? queryPerplexity(
          input.perplexityApiKey,
          project.domain,
          description,
          industry,
        )
      : Promise.resolve([]),
    input.grokApiKey
      ? queryGrok(input.grokApiKey, project.domain, description, industry)
      : Promise.resolve([]),
  ]);

  const perplexityDomains =
    results[0].status === "fulfilled" ? results[0].value : [];
  const grokDomains = results[1].status === "fulfilled" ? results[1].value : [];

  // Merge and deduplicate
  let allDomains = [...new Set([...perplexityDomains, ...grokDomains])].filter(
    (d) => isValidCompetitorDomain(d, project.domain),
  );

  // Fallback to Haiku if both returned nothing
  if (allDomains.length === 0) {
    log.info("Perplexity/Grok returned no results, falling back to Haiku", {
      projectId: input.projectId,
    });
    try {
      const haikuDomains = await queryHaikuFallback(
        input.anthropicApiKey,
        project.domain,
        project.name,
      );
      allDomains = haikuDomains.filter((d) =>
        isValidCompetitorDomain(d, project.domain),
      );
    } catch (err) {
      log.error("Haiku fallback also failed", { error: String(err) });
      return;
    }
  }

  const maxToAdd = Math.min(allDomains.length, limits.competitorsPerProject);
  const domainsToAdd = allDomains.slice(0, maxToAdd);

  log.info(
    `Auto-competitor discovered ${domainsToAdd.length} competitors (perplexity: ${perplexityDomains.length}, grok: ${grokDomains.length})`,
    { projectId: input.projectId },
  );

  // Benchmark each competitor
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
      add: (projectId, domain, source) =>
        competitorRepo.add!(projectId, domain, source),
    },
  });

  for (const domain of domainsToAdd) {
    try {
      await benchmarkService.benchmarkCompetitor({
        projectId: input.projectId,
        competitorDomain: domain,
        competitorLimit: limits.competitorsPerProject,
        source: "auto_discovered",
      });
      log.info("Auto-competitor benchmarked", { domain });
    } catch (err) {
      log.error(`Failed to benchmark ${domain}`, { error: String(err) });
    }
  }
}
