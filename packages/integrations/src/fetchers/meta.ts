import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

const GRAPH_API = "https://graph.facebook.com/v21.0";
const BATCH_SIZE = 50;

interface EngagementData {
  shares: number;
  reactions: number;
  comments: number;
  ogValid: boolean;
  ogTitle: string | null;
  ogImage: string | null;
}

interface AdInsightRow {
  landingPageUrl: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

/**
 * Fetch Meta data via Graph API (social engagement) and Marketing API (ad performance).
 */
export async function fetchMetaData(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const { pageUrls, credentials, config } = ctx;
  const accessToken = credentials.accessToken;

  if (!accessToken) {
    throw new Error("Meta access token is required");
  }

  // Fetch social engagement via Graph API batch requests
  const engagementMap = await fetchEngagement(accessToken, pageUrls);

  // Fetch ad performance if adAccountId is configured
  const adAccountId = config.adAccountId as string | undefined;
  let adMap = new Map<string, AdInsightRow>();
  if (adAccountId) {
    adMap = await fetchAdInsights(accessToken, adAccountId, pageUrls);
  }

  // Merge both data sources into enrichment results
  const results: EnrichmentResult[] = [];

  for (const pageUrl of pageUrls) {
    const engagement = engagementMap.get(pageUrl);
    const adData = adMap.get(pageUrl);

    const data: Record<string, unknown> = {
      shares: engagement?.shares ?? 0,
      reactions: engagement?.reactions ?? 0,
      comments: engagement?.comments ?? 0,
      ogValid: engagement?.ogValid ?? false,
      ogTitle: engagement?.ogTitle ?? null,
      ogImage: engagement?.ogImage ?? null,
    };

    if (adData) {
      data.adImpressions = adData.impressions;
      data.adClicks = adData.clicks;
      data.adSpend = adData.spend;
      data.adConversions = adData.conversions;
    }

    results.push({
      provider: "meta",
      pageUrl,
      data,
    });
  }

  return results;
}

async function fetchEngagement(
  accessToken: string,
  pageUrls: string[],
): Promise<Map<string, EngagementData>> {
  const result = new Map<string, EngagementData>();

  // Process URLs in batches of BATCH_SIZE using Meta's Batch API
  for (let i = 0; i < pageUrls.length; i += BATCH_SIZE) {
    const batch = pageUrls.slice(i, i + BATCH_SIZE);

    const batchRequests = batch.map((url) => ({
      method: "GET",
      relative_url: `?id=${encodeURIComponent(url)}&fields=og_object{engagement},engagement`,
    }));

    const res = await fetch(`${GRAPH_API}/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: accessToken,
        batch: JSON.stringify(batchRequests),
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`Meta batch request failed: ${res.status} ${err}`);
      continue;
    }

    const batchResponses: { code: number; body: string }[] = await res.json();

    for (let j = 0; j < batchResponses.length; j++) {
      const pageUrl = batch[j];
      const response = batchResponses[j];

      if (response.code !== 200) {
        result.set(pageUrl, {
          shares: 0,
          reactions: 0,
          comments: 0,
          ogValid: false,
          ogTitle: null,
          ogImage: null,
        });
        continue;
      }

      try {
        const data = JSON.parse(response.body);
        const engagement = data.engagement ?? {};
        const ogObject = data.og_object ?? {};
        const ogEngagement = ogObject.engagement ?? {};

        result.set(pageUrl, {
          shares: Number(
            ogEngagement.share_count ?? engagement.share_count ?? 0,
          ),
          reactions: Number(
            ogEngagement.reaction_count ?? engagement.reaction_count ?? 0,
          ),
          comments: Number(
            ogEngagement.comment_count ?? engagement.comment_count ?? 0,
          ),
          ogValid: !!ogObject.id,
          ogTitle: ogObject.title ?? null,
          ogImage: ogObject.image?.[0]?.url ?? null,
        });
      } catch {
        result.set(pageUrl, {
          shares: 0,
          reactions: 0,
          comments: 0,
          ogValid: false,
          ogTitle: null,
          ogImage: null,
        });
      }
    }
  }

  return result;
}

async function fetchAdInsights(
  accessToken: string,
  adAccountId: string,
  pageUrls: string[],
): Promise<Map<string, AdInsightRow>> {
  const result = new Map<string, AdInsightRow>();

  // Normalize the ad account ID (add act_ prefix if missing)
  const accountId = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;

  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "impressions,clicks,spend,actions",
    breakdowns: "landing_page_url",
    date_preset: "last_28d",
    limit: "500",
  });

  const res = await fetch(`${GRAPH_API}/${accountId}/insights?${params}`);

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`Meta Marketing API failed: ${res.status} ${err}`);
    return result;
  }

  const data: {
    data: {
      impressions: string;
      clicks: string;
      spend: string;
      actions?: { action_type: string; value: string }[];
      landing_page_url: string;
    }[];
  } = await res.json();

  // Build a set of crawled URLs for matching
  const crawledUrlSet = new Set(pageUrls);

  for (const row of data.data ?? []) {
    const landingUrl = row.landing_page_url;
    if (!landingUrl) continue;

    // Match landing page URL against crawled page URLs
    let matchedUrl: string | null = null;
    if (crawledUrlSet.has(landingUrl)) {
      matchedUrl = landingUrl;
    } else {
      // Try partial match (e.g., with/without trailing slash or protocol differences)
      for (const pageUrl of pageUrls) {
        if (
          landingUrl.includes(pageUrl) ||
          pageUrl.includes(landingUrl) ||
          normalizeUrl(landingUrl) === normalizeUrl(pageUrl)
        ) {
          matchedUrl = pageUrl;
          break;
        }
      }
    }

    if (!matchedUrl) continue;

    const conversions =
      row.actions
        ?.filter(
          (a) =>
            a.action_type === "offsite_conversion" ||
            a.action_type === "lead" ||
            a.action_type === "purchase",
        )
        .reduce((sum, a) => sum + Number(a.value ?? 0), 0) ?? 0;

    const existing = result.get(matchedUrl);
    if (existing) {
      existing.impressions += Number(row.impressions ?? 0);
      existing.clicks += Number(row.clicks ?? 0);
      existing.spend += Number(row.spend ?? 0);
      existing.conversions += conversions;
    } else {
      result.set(matchedUrl, {
        landingPageUrl: matchedUrl,
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        spend: Number(row.spend ?? 0),
        conversions,
      });
    }
  }

  return result;
}

function normalizeUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}
