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
    let totalClicks = 0;
    let totalImpressions = 0;
    const indexedPages: { url: string; status: string }[] = [];

    for (const e of gscEnrichments) {
      const d = e.data as Record<string, unknown>;

      // Accumulate totals from per-page enrichments
      totalClicks += Number(d.totalClicks ?? 0);
      totalImpressions += Number(d.totalImpressions ?? 0);

      // Collect indexed status (from URL Inspection API)
      if (d.indexedStatus && typeof d.indexedStatus === "string") {
        // pageUrl may be stored on the enrichment row or inferred from context
        const url = String(d.pageUrl ?? d.url ?? "");
        if (url) {
          indexedPages.push({ url, status: d.indexedStatus });
        }
      }

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

    // Deduplicate queries by query string (sum impressions/clicks, average position)
    let topQueries: {
      query: string;
      impressions: number;
      clicks: number;
      position: number;
    }[] = [];

    if (allQueries.length > 0) {
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

      topQueries = Array.from(queryMap.entries())
        .map(([query, data]) => ({
          query,
          impressions: data.impressions,
          clicks: data.clicks,
          position:
            Math.round(
              (data.positions.reduce((a, b) => a + b, 0) /
                data.positions.length) *
                10,
            ) / 10,
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20);
    }

    // Always return GSC data when enrichment rows exist — even with no queries,
    // the UI should show indexed status or a "no queries yet" message rather than
    // the misleading "Sync failed" card.
    gsc = { topQueries, totalClicks, totalImpressions, indexedPages };
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
      // Support both field names: avgEngagement (legacy) and engagementDuration (fetcher)
      const engagement = d.avgEngagement ?? d.engagementDuration;
      if (engagement != null) {
        totalEngagement += Number(engagement);
        engagementCount++;
      }

      // Support single-page format: { pageUrl|url, sessions }
      const pageUrl = d.pageUrl ?? d.url;
      if (pageUrl && d.sessions != null) {
        const existing = pagesMap.get(String(pageUrl)) ?? 0;
        pagesMap.set(String(pageUrl), existing + Number(d.sessions));
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

  // ---------------------------------------------------------------------------
  // Meta: Social engagement and ad performance
  // ---------------------------------------------------------------------------
  const metaEnrichments = enrichments.filter((e) => e.provider === "meta");
  let meta: ReportIntegrationData["meta"] = null;
  if (metaEnrichments.length > 0) {
    let totalShares = 0;
    let totalReactions = 0;
    let totalComments = 0;
    const pageEngagement: { url: string; engagement: number }[] = [];

    let hasAdData = false;
    let totalAdSpend = 0;
    let totalAdClicks = 0;
    let totalAdImpressions = 0;
    const adPages: { url: string; clicks: number; spend: number }[] = [];

    for (const e of metaEnrichments) {
      const d = e.data as Record<string, unknown>;
      const shares = Number(d.shares ?? 0);
      const reactions = Number(d.reactions ?? 0);
      const comments = Number(d.comments ?? 0);

      totalShares += shares;
      totalReactions += reactions;
      totalComments += comments;

      const engagement = shares + reactions + comments;
      const url = String(d.pageUrl ?? d.url ?? "");
      if (url && engagement > 0) {
        pageEngagement.push({ url, engagement });
      }

      if (d.adClicks != null || d.adSpend != null) {
        hasAdData = true;
        const adClicks = Number(d.adClicks ?? 0);
        const adSpend = Number(d.adSpend ?? 0);
        totalAdClicks += adClicks;
        totalAdSpend += adSpend;
        totalAdImpressions += Number(d.adImpressions ?? 0);
        if (url && (adClicks > 0 || adSpend > 0)) {
          adPages.push({ url, clicks: adClicks, spend: adSpend });
        }
      }
    }

    meta = {
      totalShares,
      totalReactions,
      totalComments,
      topSocialPages: pageEngagement
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 20),
      adSummary: hasAdData
        ? {
            spend: Math.round(totalAdSpend * 100) / 100,
            clicks: totalAdClicks,
            impressions: totalAdImpressions,
          }
        : null,
      topAdPages: hasAdData
        ? adPages.sort((a, b) => b.clicks - a.clicks).slice(0, 20)
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  // PSI: Core Web Vitals and lab performance scores
  // ---------------------------------------------------------------------------
  const psiEnrichments = enrichments.filter((e) => e.provider === "psi");
  let psi: ReportIntegrationData["psi"] = null;
  if (psiEnrichments.length > 0) {
    let totalPerf = 0;
    let perfCount = 0;
    let totalLcp = 0;
    let lcpCount = 0;
    let totalCls = 0;
    let clsCount = 0;
    let totalFcp = 0;
    let fcpCount = 0;
    let cwvPass = 0;
    const pageScores: {
      url: string;
      score: number;
      lcp: number | null;
      cls: number | null;
    }[] = [];

    for (const e of psiEnrichments) {
      const d = e.data as Record<string, unknown>;
      const score = Number(d.labPerformanceScore ?? 0);
      if (score > 0) {
        totalPerf += score;
        perfCount++;
      }

      const lcp = d.lcp as Record<string, unknown> | undefined;
      const cls = d.cls as Record<string, unknown> | undefined;
      const fcp = d.fcp as Record<string, unknown> | undefined;

      if (lcp?.value != null) {
        totalLcp += Number(lcp.value);
        lcpCount++;
      }
      if (cls?.value != null) {
        totalCls += Number(cls.value);
        clsCount++;
      }
      if (fcp?.value != null) {
        totalFcp += Number(fcp.value);
        fcpCount++;
      }

      const crux = String(d.cruxOverall ?? "");
      if (crux === "FAST" || crux === "AVERAGE") cwvPass++;

      const url = String(d.pageUrl ?? d.url ?? "");
      if (url && score > 0) {
        pageScores.push({
          url,
          score: Math.round(score * 100),
          lcp: lcp?.value != null ? Number(lcp.value) : null,
          cls: cls?.value != null ? Number(cls.value) : null,
        });
      }
    }

    psi = {
      avgPerformanceScore:
        perfCount > 0 ? Math.round((totalPerf / perfCount) * 100) : 0,
      avgLcp: lcpCount > 0 ? Math.round((totalLcp / lcpCount) * 10) / 10 : null,
      avgCls:
        clsCount > 0 ? Math.round((totalCls / clsCount) * 1000) / 1000 : null,
      avgFcp: fcpCount > 0 ? Math.round((totalFcp / fcpCount) * 10) / 10 : null,
      cwvPassRate:
        psiEnrichments.length > 0
          ? Math.round((cwvPass / psiEnrichments.length) * 100)
          : 0,
      pageScores: pageScores.sort((a, b) => a.score - b.score).slice(0, 20),
    };
  }

  // If ALL are null, return null (no usable integration data)
  if (!gsc && !ga4 && !clarity && !meta && !psi) return null;

  return { gsc, ga4, clarity, meta, psi };
}
