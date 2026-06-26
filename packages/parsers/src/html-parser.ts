/**
 * Lightweight HTML parser using regex (no DOM required in Workers).
 * Extracts title, meta, headings, schema, OG tags, links, images, and word count.
 */

export interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
  schemaTypes: string[];
  ogTags: Record<string, string>;
  internalLinks: string[];
  externalLinks: string[];
  imagesWithoutAlt: number;
  hasRobotsMeta: boolean;
  robotsDirectives: string[];
  structuredData: unknown[];
  wordCount: number;
  hreflang: Array<{ lang: string; href: string }>;
  analyticsTools: string[];
}

/** Signatures for detecting web-analytics / tag-manager tools in page HTML. */
const ANALYTICS_SIGNATURES: Array<{ tool: string; patterns: RegExp[] }> = [
  {
    tool: "gtm",
    patterns: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]+/],
  },
  {
    tool: "ga4",
    patterns: [
      /googletagmanager\.com\/gtag\/js/i,
      /gtag\s*\(/i,
      /\bG-[A-Z0-9]{8,}\b/,
    ],
  },
  {
    tool: "universal-analytics",
    patterns: [/google-analytics\.com\/analytics\.js/i, /\bUA-\d{4,}-\d+\b/],
  },
  { tool: "plausible", patterns: [/plausible\.io\/js/i] },
  { tool: "fathom", patterns: [/cdn\.usefathom\.com/i] },
  { tool: "matomo", patterns: [/matomo\.js/i, /piwik\.js/i] },
  { tool: "segment", patterns: [/cdn\.segment\.com\/analytics\.js/i] },
  { tool: "mixpanel", patterns: [/cdn\.mxpnl\.com/i, /mixpanel/i] },
  {
    tool: "amplitude",
    patterns: [/cdn\.amplitude\.com/i, /amplitude\.getInstance/i],
  },
  { tool: "hotjar", patterns: [/static\.hotjar\.com/i, /\bhj\s*\(/i] },
  { tool: "clarity", patterns: [/clarity\.ms\/tag/i] },
  { tool: "cloudflare", patterns: [/static\.cloudflareinsights\.com/i] },
];

function detectAnalyticsTools(html: string): string[] {
  const found: string[] = [];
  for (const { tool, patterns } of ANALYTICS_SIGNATURES) {
    if (patterns.some((p) => p.test(html))) found.push(tool);
  }
  return found;
}

function matchAll(html: string, regex: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    results.push(m);
  }
  return results;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function getAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i");
  const m = re.exec(tag);
  return m ? m[1] : null;
}

export function parseHtml(html: string, pageUrl: string): ParsedPage {
  const baseUrl = new URL(pageUrl);

  // Title
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? stripTags(titleMatch[1]).trim() : null;

  // Meta description
  const metaDescMatch =
    /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i.exec(
      html,
    ) ??
    /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+name\s*=\s*["']description["']/i.exec(
      html,
    );
  const metaDescription = metaDescMatch ? metaDescMatch[1] : null;

  // Canonical
  const canonicalMatch =
    /<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']*)["']/i.exec(
      html,
    );
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null;

  // hreflang alternates (rel=alternate with an hreflang attr, attrs in any order)
  const hreflang: Array<{ lang: string; href: string }> = [];
  for (const m of matchAll(
    html,
    /<link\b[^>]*\brel\s*=\s*["']alternate["'][^>]*>/gi,
  )) {
    const tag = m[0];
    const lang = getAttr(tag, "hreflang");
    const href = getAttr(tag, "href");
    if (lang && href) hreflang.push({ lang: lang.trim(), href: href.trim() });
  }

  // Analytics / tag-manager detection
  const analyticsTools = detectAnalyticsTools(html);

  // Headings
  function extractHeadings(level: number): string[] {
    const re = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
    return matchAll(html, re).map((m) => stripTags(m[1]));
  }
  const h1 = extractHeadings(1);
  const h2 = extractHeadings(2);
  const h3 = extractHeadings(3);
  const h4 = extractHeadings(4);
  const h5 = extractHeadings(5);
  const h6 = extractHeadings(6);

  // OG tags
  const ogTags: Record<string, string> = {};
  const ogMatches = matchAll(
    html,
    /<meta[^>]+property\s*=\s*["'](og:[^"']*)["'][^>]+content\s*=\s*["']([^"']*)["']/gi,
  );
  for (const m of ogMatches) {
    ogTags[m[1]] = m[2];
  }
  // Also match content before property
  const ogMatches2 = matchAll(
    html,
    /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+property\s*=\s*["'](og:[^"']*)["']/gi,
  );
  for (const m of ogMatches2) {
    ogTags[m[2]] = m[1];
  }

  // Structured data (JSON-LD). Flatten @graph containers and bare arrays into
  // their individual typed nodes so a `{ @context, @graph: [...] }` wrapper
  // (very common) is read as real entities rather than a typeless blob.
  const structuredData: unknown[] = [];
  const schemaTypes: string[] = [];
  const collectSchemaNode = (node: Record<string, unknown>): void => {
    structuredData.push(node);
    const t = node["@type"];
    if (typeof t === "string") {
      schemaTypes.push(t);
    } else if (Array.isArray(t)) {
      for (const x of t) if (typeof x === "string") schemaTypes.push(x);
    }
  };
  const visitSchema = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visitSchema(item);
      return;
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const graph = obj["@graph"];
      if (Array.isArray(graph)) {
        if (obj["@type"]) collectSchemaNode(obj);
        for (const child of graph) visitSchema(child);
        return;
      }
      collectSchemaNode(obj);
    }
  };
  const jsonLdMatches = matchAll(
    html,
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of jsonLdMatches) {
    try {
      visitSchema(JSON.parse(m[1]));
    } catch {
      // invalid JSON-LD
    }
  }

  // Links
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const linkMatches = matchAll(html, /<a[^>]+href\s*=\s*["']([^"'#]*)["']/gi);
  for (const m of linkMatches) {
    const href = m[1].trim();
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) {
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === baseUrl.hostname) {
        internalLinks.push(resolved.pathname);
      } else {
        externalLinks.push(resolved.href);
      }
    } catch {
      // invalid URL
    }
  }

  // Images without alt
  const imgMatches = matchAll(html, /<img[^>]*>/gi);
  let imagesWithoutAlt = 0;
  for (const m of imgMatches) {
    const alt = getAttr(m[0], "alt");
    if (alt === null || alt.trim() === "") {
      imagesWithoutAlt++;
    }
  }

  // Robots meta
  const robotsMetaMatch =
    /<meta[^>]+name\s*=\s*["']robots["'][^>]+content\s*=\s*["']([^"']*)["']/i.exec(
      html,
    );
  const hasRobotsMeta = !!robotsMetaMatch;
  const robotsDirectives = robotsMetaMatch
    ? robotsMetaMatch[1].split(",").map((d) => d.trim().toLowerCase())
    : [];

  // Word count (text content only)
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = textOnly ? textOnly.split(/\s+/).length : 0;

  return {
    title,
    metaDescription,
    canonicalUrl,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    schemaTypes,
    ogTags,
    internalLinks,
    externalLinks,
    imagesWithoutAlt,
    hasRobotsMeta,
    robotsDirectives,
    structuredData,
    wordCount,
    hreflang,
    analyticsTools,
  };
}
