export const IssueSeverity = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
} as const;

export type IssueSeverity = (typeof IssueSeverity)[keyof typeof IssueSeverity];

export const IssueCategory = {
  TECHNICAL: "technical",
  CONTENT: "content",
  AI_READINESS: "ai_readiness",
  PERFORMANCE: "performance",
} as const;

export type IssueCategory = (typeof IssueCategory)[keyof typeof IssueCategory];

export interface IssueDefinition {
  code: string;
  category: IssueCategory;
  severity: IssueSeverity;
  scoreImpact: number;
  message: string;
  recommendation: string;
}

// All 37 issue codes from requirements Section 7
export const ISSUE_DEFINITIONS: Record<string, IssueDefinition> = {
  // --- Technical SEO (13 factors) ---
  MISSING_TITLE: {
    code: "MISSING_TITLE",
    category: "technical",
    severity: "critical",
    scoreImpact: -15,
    message: "Page is missing a title tag or title is outside 30-60 characters",
    recommendation:
      "Add a unique, descriptive title tag between 30-60 characters that includes the page's primary topic.",
  },
  MISSING_META_DESC: {
    code: "MISSING_META_DESC",
    category: "technical",
    severity: "warning",
    scoreImpact: -10,
    message: "Page is missing a meta description or it is outside 120-160 characters",
    recommendation:
      "Add a meta description of 120-160 characters that summarizes this page's key topic.",
  },
  MISSING_H1: {
    code: "MISSING_H1",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page is missing an H1 heading",
    recommendation:
      "Add exactly one H1 heading that clearly describes the page's main topic.",
  },
  MULTIPLE_H1: {
    code: "MULTIPLE_H1",
    category: "technical",
    severity: "warning",
    scoreImpact: -5,
    message: "Page has multiple H1 headings",
    recommendation:
      "Reduce to a single H1 heading. Convert additional H1s to H2 or lower.",
  },
  HEADING_HIERARCHY: {
    code: "HEADING_HIERARCHY",
    category: "technical",
    severity: "info",
    scoreImpact: -3,
    message: "Heading hierarchy has skipped levels (e.g., H1 to H3 without H2)",
    recommendation:
      "Ensure headings follow a logical hierarchy: H1 > H2 > H3 without skipping levels.",
  },
  BROKEN_LINKS: {
    code: "BROKEN_LINKS",
    category: "technical",
    severity: "warning",
    scoreImpact: -5, // per broken link, max -20
    message: "Page contains broken internal links",
    recommendation: "Fix or remove broken internal links to improve crawlability.",
  },
  MISSING_CANONICAL: {
    code: "MISSING_CANONICAL",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page is missing a canonical URL tag",
    recommendation:
      "Add a canonical tag pointing to the preferred URL for this page.",
  },
  NOINDEX_SET: {
    code: "NOINDEX_SET",
    category: "technical",
    severity: "critical",
    scoreImpact: -20,
    message: "Page has a noindex robots directive",
    recommendation:
      "Remove the noindex directive if this page should be discoverable by AI search engines.",
  },
  MISSING_ALT_TEXT: {
    code: "MISSING_ALT_TEXT",
    category: "technical",
    severity: "warning",
    scoreImpact: -3, // per image, max -15
    message: "Images are missing alt text attributes",
    recommendation:
      "Add descriptive alt text to all images to improve accessibility and AI understanding.",
  },
  HTTP_STATUS: {
    code: "HTTP_STATUS",
    category: "technical",
    severity: "critical",
    scoreImpact: -25,
    message: "Page returned a 4xx or 5xx HTTP status code",
    recommendation:
      "Fix the server error or redirect. Pages must return 200 status to be indexed.",
  },
  MISSING_OG_TAGS: {
    code: "MISSING_OG_TAGS",
    category: "technical",
    severity: "info",
    scoreImpact: -5,
    message: "Page is missing Open Graph tags (og:title, og:description, og:image)",
    recommendation:
      "Add og:title, og:description, and og:image meta tags for better social and AI sharing.",
  },
  SLOW_RESPONSE: {
    code: "SLOW_RESPONSE",
    category: "technical",
    severity: "warning",
    scoreImpact: -10,
    message: "Server response time exceeds 2 seconds",
    recommendation:
      "Optimize server response time to under 2 seconds. Check hosting, caching, and database queries.",
  },
  MISSING_SITEMAP: {
    code: "MISSING_SITEMAP",
    category: "technical",
    severity: "info",
    scoreImpact: -5,
    message: "No valid sitemap.xml found",
    recommendation: "Create and submit a sitemap.xml to help crawlers discover all pages.",
  },

  // --- Content Quality (9 factors) ---
  THIN_CONTENT: {
    code: "THIN_CONTENT",
    category: "content",
    severity: "warning",
    scoreImpact: -15, // -15 if < 200 words, -8 if 200-499
    message: "Page has insufficient content",
    recommendation:
      "Expand content to at least 500 words of substantive, topic-relevant text.",
  },
  CONTENT_DEPTH: {
    code: "CONTENT_DEPTH",
    category: "content",
    severity: "warning",
    scoreImpact: 0, // Mapped from LLM score 0-100 to 0-20 range
    message: "Content lacks depth and comprehensive topic coverage",
    recommendation:
      "Expand coverage of subtopics, add supporting data, examples, and expert analysis.",
  },
  CONTENT_CLARITY: {
    code: "CONTENT_CLARITY",
    category: "content",
    severity: "warning",
    scoreImpact: 0,
    message: "Content readability and structure need improvement",
    recommendation:
      "Improve clarity with shorter paragraphs, subheadings, bullet points, and plain language.",
  },
  CONTENT_AUTHORITY: {
    code: "CONTENT_AUTHORITY",
    category: "content",
    severity: "warning",
    scoreImpact: 0,
    message: "Content lacks authority signals (citations, data, expert language)",
    recommendation:
      "Add citations, statistics, expert quotes, and authoritative sources to build credibility.",
  },
  DUPLICATE_CONTENT: {
    code: "DUPLICATE_CONTENT",
    category: "content",
    severity: "warning",
    scoreImpact: -15,
    message: "Page content is a duplicate of another page in this project",
    recommendation:
      "Consolidate duplicate pages using canonical tags or merge the content.",
  },
  STALE_CONTENT: {
    code: "STALE_CONTENT",
    category: "content",
    severity: "info",
    scoreImpact: -5,
    message: "Content appears to be over 12 months old without updates",
    recommendation:
      "Update content with current information, statistics, and recent developments.",
  },
  NO_INTERNAL_LINKS: {
    code: "NO_INTERNAL_LINKS",
    category: "content",
    severity: "warning",
    scoreImpact: -8,
    message: "Page has fewer than 2 internal links to relevant content",
    recommendation:
      "Add at least 2-3 internal links to related pages to improve discoverability.",
  },
  EXCESSIVE_LINKS: {
    code: "EXCESSIVE_LINKS",
    category: "content",
    severity: "info",
    scoreImpact: -3,
    message: "External links exceed internal links by more than 3:1 ratio",
    recommendation:
      "Balance your link profile by adding more internal links relative to external ones.",
  },
  MISSING_FAQ_STRUCTURE: {
    code: "MISSING_FAQ_STRUCTURE",
    category: "content",
    severity: "info",
    scoreImpact: -5,
    message: "Content addressing questions does not use Q&A format",
    recommendation:
      "Structure common questions using FAQ format with clear question headings and concise answers.",
  },

  // --- AI Readiness (10 factors) ---
  MISSING_LLMS_TXT: {
    code: "MISSING_LLMS_TXT",
    category: "ai_readiness",
    severity: "critical",
    scoreImpact: -20,
    message: "No llms.txt file found at /llms.txt",
    recommendation:
      "Create an llms.txt file at /llms.txt to explicitly permit AI crawlers and provide structured metadata about your site.",
  },
  AI_CRAWLER_BLOCKED: {
    code: "AI_CRAWLER_BLOCKED",
    category: "ai_readiness",
    severity: "critical",
    scoreImpact: -25,
    message: "robots.txt blocks one or more AI crawlers (GPTBot, ClaudeBot, PerplexityBot)",
    recommendation:
      "Remove Disallow rules for AI user agents (GPTBot, ClaudeBot, PerplexityBot) in robots.txt.",
  },
  NO_STRUCTURED_DATA: {
    code: "NO_STRUCTURED_DATA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -15,
    message: "Page has no JSON-LD structured data",
    recommendation:
      "Add JSON-LD structured data (at minimum: Organization, WebPage, and Article/FAQPage as appropriate).",
  },
  INCOMPLETE_SCHEMA: {
    code: "INCOMPLETE_SCHEMA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -8,
    message: "Structured data is present but missing required properties",
    recommendation:
      "Complete all required properties in your JSON-LD schema markup.",
  },
  CITATION_WORTHINESS: {
    code: "CITATION_WORTHINESS",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: 0, // Mapped from LLM score
    message: "Content has low citation worthiness for AI assistants",
    recommendation:
      "Add unique data, original research, clear definitions, and expert analysis that AI would want to cite.",
  },
  NO_DIRECT_ANSWERS: {
    code: "NO_DIRECT_ANSWERS",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -10,
    message: "Content does not contain direct, concise answers to likely queries",
    recommendation:
      "Add clear, concise answer paragraphs at the top of sections that directly address likely user questions.",
  },
  MISSING_ENTITY_MARKUP: {
    code: "MISSING_ENTITY_MARKUP",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: -5,
    message: "Key named entities are not marked up in schema",
    recommendation:
      "Add schema markup for key entities (people, organizations, products) mentioned in your content.",
  },
  NO_SUMMARY_SECTION: {
    code: "NO_SUMMARY_SECTION",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: -5,
    message: "Page lacks a summary or key takeaway section",
    recommendation:
      "Add a TL;DR or key takeaways section that summarizes the page's main points.",
  },
  POOR_QUESTION_COVERAGE: {
    code: "POOR_QUESTION_COVERAGE",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -10,
    message: "Content does not adequately address likely search queries for this topic",
    recommendation:
      "Research common questions about this topic and ensure your content addresses them directly.",
  },
  INVALID_SCHEMA: {
    code: "INVALID_SCHEMA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -8,
    message: "JSON-LD structured data contains parse errors",
    recommendation: "Fix JSON-LD syntax errors. Validate at schema.org or Google Rich Results Test.",
  },

  // --- Performance (5 factors) ---
  LH_PERF_LOW: {
    code: "LH_PERF_LOW",
    category: "performance",
    severity: "warning",
    scoreImpact: -20, // -20 if < 0.5, -10 if 0.5-0.79
    message: "Lighthouse Performance score is below threshold",
    recommendation:
      "Improve page performance: optimize images, reduce JavaScript, enable caching, minimize render-blocking resources.",
  },
  LH_SEO_LOW: {
    code: "LH_SEO_LOW",
    category: "performance",
    severity: "warning",
    scoreImpact: -15,
    message: "Lighthouse SEO score is below 0.8",
    recommendation:
      "Address Lighthouse SEO audit failures: ensure crawlable links, valid hreflang, proper meta tags.",
  },
  LH_A11Y_LOW: {
    code: "LH_A11Y_LOW",
    category: "performance",
    severity: "info",
    scoreImpact: -5,
    message: "Lighthouse Accessibility score is below 0.7",
    recommendation:
      "Improve accessibility: add alt text, ensure color contrast, use semantic HTML, add ARIA labels.",
  },
  LH_BP_LOW: {
    code: "LH_BP_LOW",
    category: "performance",
    severity: "info",
    scoreImpact: -5,
    message: "Lighthouse Best Practices score is below 0.8",
    recommendation:
      "Address Lighthouse best practice issues: use HTTPS, avoid deprecated APIs, fix console errors.",
  },
  LARGE_PAGE_SIZE: {
    code: "LARGE_PAGE_SIZE",
    category: "performance",
    severity: "warning",
    scoreImpact: -10,
    message: "Total page size exceeds 3MB",
    recommendation:
      "Reduce page weight below 3MB: compress images, minify CSS/JS, lazy-load below-the-fold content.",
  },
} as const;

export type IssueCode = keyof typeof ISSUE_DEFINITIONS;
