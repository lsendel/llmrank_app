import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

const GA4_DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const GA4_ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";

/**
 * Auto-detect the GA4 property ID by listing account summaries
 * and matching data streams against the project domain.
 */
async function findPropertyId(
  domain: string,
  accessToken: string,
): Promise<string> {
  const res = await fetch(`${GA4_ADMIN_API}/accountSummaries`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`GA4 Admin API error: ${res.status}`);
  }

  const data: {
    accountSummaries?: {
      propertySummaries?: {
        property: string;
        displayName?: string;
      }[];
    }[];
  } = await res.json();

  const bare = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();

  // Collect all property IDs
  const allProperties: { id: string; displayName: string }[] = [];
  for (const account of data.accountSummaries ?? []) {
    for (const prop of account.propertySummaries ?? []) {
      const id = prop.property.replace("properties/", "");
      allProperties.push({
        id,
        displayName: (prop.displayName || "").toLowerCase(),
      });
    }
  }

  if (allProperties.length === 0) {
    throw new Error("No GA4 properties found for this Google account");
  }

  // Try matching by display name first (fast, no extra API calls)
  const byName = allProperties.find(
    (p) => p.displayName.includes(bare) || bare.includes(p.displayName),
  );
  if (byName) return byName.id;

  // Fall back to checking data streams for each property
  for (const prop of allProperties) {
    const streamsRes = await fetch(
      `${GA4_ADMIN_API}/properties/${prop.id}/dataStreams`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!streamsRes.ok) continue;

    const streamsData: {
      dataStreams?: {
        webStreamData?: { defaultUri?: string };
      }[];
    } = await streamsRes.json();

    for (const stream of streamsData.dataStreams ?? []) {
      const uri = (stream.webStreamData?.defaultUri || "")
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      if (uri === bare || uri === `www.${bare}` || `www.${uri}` === bare) {
        return prop.id;
      }
    }
  }

  // If only one property exists, use it as fallback
  if (allProperties.length === 1) {
    return allProperties[0].id;
  }

  throw new Error(
    `No GA4 property found matching "${bare}". Available properties: ${allProperties.map((p) => `${p.displayName} (${p.id})`).join(", ") || "none"}`,
  );
}

export async function fetchGA4Data(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const { domain, pageUrls, credentials, config } = ctx;
  const { accessToken } = credentials;

  // Use configured property ID or auto-detect from domain
  const propertyId =
    (config.propertyId as string | undefined) ||
    (await findPropertyId(domain, accessToken));

  // Run a report for the last 28 days with page path as a dimension
  const res = await fetch(
    `${GA4_DATA_API}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "sessions" },
          { name: "engagedSessions" },
          { name: "userEngagementDuration" },
        ],
        limit: 10000,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`GA4 Data API error: ${res.status}`);
  }

  const report: {
    rows?: {
      dimensionValues: { value: string }[];
      metricValues: { value: string }[];
    }[];
  } = await res.json();

  // Build a map from path to metrics
  const pathMap = new Map<
    string,
    {
      bounceRate: number;
      avgSessionDuration: number;
      sessions: number;
      engagedSessions: number;
      engagementDuration: number;
    }
  >();

  for (const row of report.rows ?? []) {
    const path = row.dimensionValues[0].value;
    pathMap.set(path, {
      bounceRate: parseFloat(row.metricValues[0].value) || 0,
      avgSessionDuration: parseFloat(row.metricValues[1].value) || 0,
      sessions: parseInt(row.metricValues[2].value, 10) || 0,
      engagedSessions: parseInt(row.metricValues[3].value, 10) || 0,
      engagementDuration: parseFloat(row.metricValues[4].value) || 0,
    });
  }

  // Match page URLs to paths
  const results: EnrichmentResult[] = [];

  for (const url of pageUrls) {
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }

    const metrics = pathMap.get(path);

    results.push({
      provider: "ga4",
      pageUrl: url,
      data: {
        bounceRate: metrics?.bounceRate ?? null,
        avgSessionDuration: metrics?.avgSessionDuration ?? null,
        sessions: metrics?.sessions ?? 0,
        engagedSessions: metrics?.engagedSessions ?? 0,
        engagementDuration: metrics?.engagementDuration ?? 0,
      },
    });
  }

  return results;
}
