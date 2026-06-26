import { classifyTraffic } from "@llm-boost/shared";
import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

/**
 * Cloudflare AI-crawler analytics.
 *
 * Reads the customer's own Cloudflare zone via the GraphQL Analytics API to
 * surface REAL AI-crawler traffic (GPTBot, ClaudeBot, PerplexityBot, …) hitting
 * each page — the server-side signal a client-side JS beacon can never see,
 * because AI crawlers don't execute JavaScript.
 *
 * The emitted `data.aiCrawler` shape is provider-agnostic: a future Vercel /
 * Fastly / Akamai / raw-Logpush fetcher can produce the same normalized
 * structure so downstream reporting doesn't care which CDN sourced it.
 */

const CF_API = "https://api.cloudflare.com/client/v4";
const CF_GRAPHQL = `${CF_API}/graphql`;
/** httpRequestsAdaptiveGroups caps a single response at 10k rows. */
const GROUP_LIMIT = 5000;
const DEFAULT_WINDOW_DAYS = 7;

/** Provider-agnostic per-page crawler-activity payload. */
export interface CrawlerActivity {
  /** AI-bot request counts keyed by provider (chatgpt, claude, perplexity…). */
  byProvider: Record<string, number>;
  /** Total AI-bot requests across providers in the window. */
  total: number;
  windowDays: number;
  source: string;
  /** True if the row cap may have truncated long-tail paths. */
  truncated: boolean;
}

interface ZoneLookupResponse {
  result?: Array<{ id: string; name: string }>;
}

interface GraphQLResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequestsAdaptiveGroups?: Array<{
          count: number;
          dimensions: { clientRequestPath: string; userAgent: string };
        }>;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** Resolve the zone id for a domain, trying the apex if the exact name misses. */
async function resolveZoneId(
  token: string,
  domain: string,
): Promise<string | null> {
  const apex = domain.replace(/^www\./, "");
  for (const name of domain === apex ? [domain] : [domain, apex]) {
    const res = await fetch(
      `${CF_API}/zones?name=${encodeURIComponent(name)}`,
      {
        headers: authHeaders(token),
      },
    );
    if (!res.ok) {
      throw new Error(`Cloudflare zone lookup failed: ${res.status}`);
    }
    const body = (await res.json()) as ZoneLookupResponse;
    const zone = body.result?.[0];
    if (zone) return zone.id;
  }
  return null;
}

const ANALYTICS_QUERY = `
query AICrawlers($zoneTag: String!, $since: Time!, $until: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        limit: ${GROUP_LIMIT}
        filter: { datetime_geq: $since, datetime_leq: $until }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { clientRequestPath userAgent }
      }
    }
  }
}`;

export async function fetchCloudflareData(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const token = ctx.credentials.apiKey;
  if (!token)
    throw new Error("Cloudflare integration is missing its API token");

  const windowDays =
    typeof ctx.config.windowDays === "number"
      ? ctx.config.windowDays
      : DEFAULT_WINDOW_DAYS;

  const zoneId =
    typeof ctx.config.zoneId === "string" && ctx.config.zoneId
      ? ctx.config.zoneId
      : await resolveZoneId(token, ctx.domain);
  if (!zoneId) {
    throw new Error(
      `No Cloudflare zone found for ${ctx.domain}. Is the domain on this account?`,
    );
  }

  const until = new Date();
  const since = new Date(until.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const res = await fetch(CF_GRAPHQL, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      query: ANALYTICS_QUERY,
      variables: {
        zoneTag: zoneId,
        since: since.toISOString(),
        until: until.toISOString(),
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Cloudflare GraphQL request failed: ${res.status}`);
  }
  const body = (await res.json()) as GraphQLResponse;
  if (body.errors?.length) {
    throw new Error(`Cloudflare GraphQL error: ${body.errors[0].message}`);
  }

  const groups =
    body.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
  const truncated = groups.length >= GROUP_LIMIT;

  // Aggregate AI-bot requests by request path → provider → count.
  const byPath = new Map<string, Map<string, number>>();
  for (const g of groups) {
    const { sourceType, aiProvider } = classifyTraffic(
      g.dimensions.userAgent,
      null,
    );
    if (sourceType !== "ai_bot" || !aiProvider) continue;
    const path = g.dimensions.clientRequestPath || "/";
    const providers = byPath.get(path) ?? new Map<string, number>();
    providers.set(aiProvider, (providers.get(aiProvider) ?? 0) + g.count);
    byPath.set(path, providers);
  }

  // Map aggregated paths back to the crawled page URLs.
  const results: EnrichmentResult[] = [];
  for (const url of ctx.pageUrls) {
    let path: string;
    try {
      path = new URL(url).pathname || "/";
    } catch {
      continue;
    }
    const providers = byPath.get(path);
    if (!providers) continue;
    const byProvider = Object.fromEntries(providers);
    const total = Object.values(byProvider).reduce((a, b) => a + b, 0);
    const activity: CrawlerActivity = {
      byProvider,
      total,
      windowDays,
      source: "cloudflare",
      truncated,
    };
    results.push({
      provider: "cloudflare",
      pageUrl: url,
      data: { aiCrawler: activity },
    });
  }

  return results;
}
