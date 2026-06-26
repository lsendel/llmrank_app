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

/** Max child sitemaps to fetch when expanding an index (bounds fan-out). */
const MAX_CHILD_SITEMAPS = 50;
/** Cap on URLs collected from children (bounds memory on huge sites). */
const MAX_URLS = 5000;

const NOT_FOUND: SitemapAnalysis = {
  exists: false,
  isValid: false,
  urlCount: 0,
  staleUrlCount: 0,
  urls: [],
  lastmodDates: [],
};

async function fetchSitemapText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AISEOBot/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/**
 * Fetch and analyze a sitemap.xml from a domain. When the sitemap is an index,
 * recurse one level into the child sitemaps so urlCount reflects real page
 * count (not the number of child sitemaps) — keeps SITEMAP_LOW_COVERAGE honest.
 */
export async function analyzeSitemap(domain: string): Promise<SitemapAnalysis> {
  const xml = await fetchSitemapText(`https://${domain}/sitemap.xml`);
  if (xml === null) return NOT_FOUND;

  const top = parseSitemapXml(xml);
  const isIndex = !/<urlset/i.test(xml) && /<sitemapindex/i.test(xml);
  if (!top.isValid || !isIndex) return top;

  // top.urls are the child sitemap locations — expand them.
  const children = top.urls.slice(0, MAX_CHILD_SITEMAPS);
  const childXmls = await Promise.all(children.map(fetchSitemapText));

  let urlCount = 0;
  let staleUrlCount = 0;
  const urls: string[] = [];
  const lastmodDates: string[] = [];
  for (const childXml of childXmls) {
    if (!childXml) continue;
    const child = parseSitemapXml(childXml);
    urlCount += child.urlCount;
    staleUrlCount += child.staleUrlCount;
    lastmodDates.push(...child.lastmodDates);
    if (urls.length < MAX_URLS) {
      urls.push(...child.urls.slice(0, MAX_URLS - urls.length));
    }
  }

  // If no children could be fetched, fall back to the index-level view.
  if (urlCount === 0) return top;
  return { exists: true, isValid: true, urlCount, staleUrlCount, urls, lastmodDates };
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
    // A sitemap is valid if it's either a <urlset> or a <sitemapindex>.
    // sitemapindex is the standard way to split large sites into child sitemaps.
    isValid: hasUrlset || hasSitemapIndex,
    urlCount: urls.length,
    staleUrlCount,
    urls,
    lastmodDates,
  };
}
