import type { ReportIntegrationData } from "./types";

export interface RawEnrichment {
  provider: string;
  data: Record<string, unknown>;
}

/**
 * Aggregates integration enrichments (GSC, GA4, Clarity) into report-ready format.
 * Returns null if no enrichments provided or if none of the known providers have data.
 */
export function aggregateIntegrations(
  enrichments: RawEnrichment[],
): ReportIntegrationData | null {
  if (enrichments.length === 0) return null;

  const gscEnrichments = enrichments.filter((e) => e.provider === "gsc");
  const ga4Enrichments = enrichments.filter((e) => e.provider === "ga4");
  const clarityEnrichments = enrichments.filter(
    (e) => e.provider === "clarity",
  );

  // ---------------------------------------------------------------------------
  // GSC: Extract queries sorted by impressions, top 20
  // ---------------------------------------------------------------------------
  let gsc: ReportIntegrationData["gsc"] = null;
  if (gscEnrichments.length > 0) {
    const allQueries: {
      query: string;
      impressions: number;
      clicks: number;
      position: number;
    }[] = [];

    for (const e of gscEnrichments) {
      const d = e.data as Record<string, unknown>;

      // Support array-of-queries format: { queries: [...] }
      if (d.queries && Array.isArray(d.queries)) {
        for (const q of d.queries) {
          allQueries.push({
            query: String((q as Record<string, unknown>).query ?? ""),
            impressions: Number(
              (q as Record<string, unknown>).impressions ?? 0,
            ),
            clicks: Number((q as Record<string, unknown>).clicks ?? 0),
            position: Number((q as Record<string, unknown>).position ?? 0),
          });
        }
      }

      // Support single-query format: { query, impressions, clicks, position }
      if (d.query) {
        allQueries.push({
          query: String(d.query),
          impressions: Number(d.impressions ?? 0),
          clicks: Number(d.clicks ?? 0),
          position: Number(d.position ?? 0),
        });
      }
    }

    if (allQueries.length > 0) {
      // Deduplicate by query string (sum impressions/clicks, average position)
      const queryMap = new Map<
        string,
        { impressions: number; clicks: number; positions: number[] }
      >();
      for (const q of allQueries) {
        const existing = queryMap.get(q.query);
        if (existing) {
          existing.impressions += q.impressions;
          existing.clicks += q.clicks;
          existing.positions.push(q.position);
        } else {
          queryMap.set(q.query, {
            impressions: q.impressions,
            clicks: q.clicks,
            positions: [q.position],
          });
        }
      }

      const deduped = Array.from(queryMap.entries()).map(([query, data]) => ({
        query,
        impressions: data.impressions,
        clicks: data.clicks,
        position:
          Math.round(
            (data.positions.reduce((a, b) => a + b, 0) /
              data.positions.length) *
              10,
          ) / 10,
      }));

      gsc = {
        topQueries: deduped
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 20),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // GA4: Aggregate bounce rate, engagement, top pages
  // ---------------------------------------------------------------------------
  let ga4: ReportIntegrationData["ga4"] = null;
  if (ga4Enrichments.length > 0) {
    let totalBounce = 0;
    let totalEngagement = 0;
    let bounceCount = 0;
    let engagementCount = 0;
    const pagesMap = new Map<string, number>();

    for (const e of ga4Enrichments) {
      const d = e.data as Record<string, unknown>;

      if (d.bounceRate != null) {
        totalBounce += Number(d.bounceRate);
        bounceCount++;
      }
      if (d.avgEngagement != null) {
        totalEngagement += Number(d.avgEngagement);
        engagementCount++;
      }

      // Support single-page format: { url, sessions }
      if (d.url && d.sessions != null) {
        const existing = pagesMap.get(String(d.url)) ?? 0;
        pagesMap.set(String(d.url), existing + Number(d.sessions));
      }

      // Support pages array format: { pages: [{ url, sessions }] }
      if (d.pages && Array.isArray(d.pages)) {
        for (const p of d.pages) {
          const page = p as Record<string, unknown>;
          if (page.url) {
            const existing = pagesMap.get(String(page.url)) ?? 0;
            pagesMap.set(
              String(page.url),
              existing + Number(page.sessions ?? 0),
            );
          }
        }
      }
    }

    ga4 = {
      bounceRate:
        bounceCount > 0 ? Math.round((totalBounce / bounceCount) * 10) / 10 : 0,
      avgEngagement:
        engagementCount > 0
          ? Math.round((totalEngagement / engagementCount) * 10) / 10
          : 0,
      topPages: Array.from(pagesMap.entries())
        .map(([url, sessions]) => ({ url, sessions }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 20),
    };
  }

  // ---------------------------------------------------------------------------
  // Clarity: UX scores and rage click pages
  // ---------------------------------------------------------------------------
  let clarity: ReportIntegrationData["clarity"] = null;
  if (clarityEnrichments.length > 0) {
    let totalUx = 0;
    let uxCount = 0;
    const ragePages = new Set<string>();

    for (const e of clarityEnrichments) {
      const d = e.data as Record<string, unknown>;

      if (d.uxScore != null) {
        totalUx += Number(d.uxScore);
        uxCount++;
      }
      if (d.rageClicks && Array.isArray(d.rageClicks)) {
        for (const page of d.rageClicks) {
          ragePages.add(String(page));
        }
      }
      if (d.rageClickUrl) {
        ragePages.add(String(d.rageClickUrl));
      }
    }

    clarity = {
      avgUxScore: uxCount > 0 ? Math.round((totalUx / uxCount) * 10) / 10 : 0,
      rageClickPages: Array.from(ragePages),
    };
  }

  // If ALL three are null, return null (no usable integration data)
  if (!gsc && !ga4 && !clarity) return null;

  return { gsc, ga4, clarity };
}
