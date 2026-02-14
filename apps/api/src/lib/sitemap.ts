/**
 * Sitemap fetcher and analyzer.
 * Fetches /sitemap.xml, parses URLs, checks freshness and format validity.
 */

export interface SitemapAnalysis {
  exists: boolean;
  isValid: boolean;
  urlCount: number;
  staleUrlCount: number;
  urls: string[];
  lastmodDates: string[];
}

/**
 * Fetch and analyze a sitemap.xml from a domain.
 */
export async function analyzeSitemap(domain: string): Promise<SitemapAnalysis> {
  const sitemapUrl = `https://${domain}/sitemap.xml`;

  try {
    const response = await fetch(sitemapUrl, {
      headers: { "User-Agent": "AISEOBot/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        exists: false,
        isValid: false,
        urlCount: 0,
        staleUrlCount: 0,
        urls: [],
        lastmodDates: [],
      };
    }

    const xml = await response.text();
    return parseSitemapXml(xml);
  } catch {
    return {
      exists: false,
      isValid: false,
      urlCount: 0,
      staleUrlCount: 0,
      urls: [],
      lastmodDates: [],
    };
  }
}

function matchAllRegex(text: string, regex: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    results.push(m);
  }
  return results;
}

/**
 * Parse sitemap XML and extract URLs and lastmod dates.
 */
export function parseSitemapXml(xml: string): SitemapAnalysis {
  // Check for basic sitemap structure
  const hasUrlset = /<urlset/i.test(xml);
  const hasSitemapIndex = /<sitemapindex/i.test(xml);

  if (!hasUrlset && !hasSitemapIndex) {
    return {
      exists: true,
      isValid: false,
      urlCount: 0,
      staleUrlCount: 0,
      urls: [],
      lastmodDates: [],
    };
  }

  // Extract <loc> tags
  const locMatches = matchAllRegex(xml, /<loc>\s*(.*?)\s*<\/loc>/gi);
  const urls = locMatches.map((m) => m[1].trim());

  // Extract <lastmod> tags
  const lastmodMatches = matchAllRegex(
    xml,
    /<lastmod>\s*(.*?)\s*<\/lastmod>/gi,
  );
  const lastmodDates = lastmodMatches.map((m) => m[1].trim());

  // Count stale URLs (lastmod > 12 months ago)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  let staleUrlCount = 0;
  for (const dateStr of lastmodDates) {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime()) && date < twelveMonthsAgo) {
        staleUrlCount++;
      }
    } catch {
      // Skip unparseable dates
    }
  }

  return {
    exists: true,
    isValid: hasUrlset,
    urlCount: urls.length,
    staleUrlCount,
    urls,
    lastmodDates,
  };
}
