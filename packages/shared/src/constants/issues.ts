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

export const EffortLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type EffortLevel = (typeof EffortLevel)[keyof typeof EffortLevel];

export interface IssueDefinition {
  code: string;
  category: IssueCategory;
  severity: IssueSeverity;
  scoreImpact: number;
  message: string;
  recommendation: string;
  effortLevel: EffortLevel;
  implementationSnippet?: string;
}

// All issue codes (37 original + 3 sitemap + 8 RustySEO = 48 factors)
export const ISSUE_DEFINITIONS: Record<string, IssueDefinition> = {
  // --- Technical SEO (13 + 3 sitemap = 16 factors) ---
  MISSING_TITLE: {
    code: "MISSING_TITLE",
    category: "technical",
    severity: "critical",
    scoreImpact: -15,
    message: "Page is missing a title tag or title is outside 30-60 characters",
    recommendation:
      "Add a unique, descriptive title tag between 30-60 characters that includes the page's primary topic.",
    effortLevel: "low",
    implementationSnippet: `<title>Your Page Topic — Brand Name</title>`,
  },
  MISSING_META_DESC: {
    code: "MISSING_META_DESC",
    category: "technical",
    severity: "warning",
    scoreImpact: -10,
    message:
      "Page is missing a meta description or it is outside 120-160 characters",
    recommendation:
      "Add a meta description of 120-160 characters that summarizes this page's key topic.",
    effortLevel: "low",
    implementationSnippet: `<meta name="description" content="A concise summary of this page's content in 120-160 characters." />`,
  },
  MISSING_H1: {
    code: "MISSING_H1",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page is missing an H1 heading",
    recommendation:
      "Add exactly one H1 heading that clearly describes the page's main topic.",
    effortLevel: "low",
    implementationSnippet: `<h1>Your Page's Main Topic</h1>`,
  },
  MULTIPLE_H1: {
    code: "MULTIPLE_H1",
    category: "technical",
    severity: "warning",
    scoreImpact: -5,
    message: "Page has multiple H1 headings",
    recommendation:
      "Reduce to a single H1 heading. Convert additional H1s to H2 or lower.",
    effortLevel: "low",
    implementationSnippet: `<!-- Change extra <h1> tags to <h2> -->\n<h2>Secondary Section Title</h2>`,
  },
  HEADING_HIERARCHY: {
    code: "HEADING_HIERARCHY",
    category: "technical",
    severity: "info",
    scoreImpact: -3,
    message: "Heading hierarchy has skipped levels (e.g., H1 to H3 without H2)",
    recommendation:
      "Ensure headings follow a logical hierarchy: H1 > H2 > H3 without skipping levels.",
    effortLevel: "low",
  },
  BROKEN_LINKS: {
    code: "BROKEN_LINKS",
    category: "technical",
    severity: "warning",
    scoreImpact: -5, // per broken link, max -20
    message: "Page contains broken internal links",
    recommendation:
      "Fix or remove broken internal links to improve crawlability.",
    effortLevel: "medium",
  },
  MISSING_CANONICAL: {
    code: "MISSING_CANONICAL",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page is missing a canonical URL tag",
    recommendation:
      "Add a canonical tag pointing to the preferred URL for this page.",
    effortLevel: "low",
    implementationSnippet: `<link rel="canonical" href="https://example.com/preferred-url" />`,
  },
  NOINDEX_SET: {
    code: "NOINDEX_SET",
    category: "technical",
    severity: "critical",
    scoreImpact: -20,
    message: "Page has a noindex robots directive",
    recommendation:
      "Remove the noindex directive if this page should be discoverable by AI search engines.",
    effortLevel: "low",
    implementationSnippet: `<!-- Remove this tag: -->\n<!-- <meta name="robots" content="noindex"> -->`,
  },
  MISSING_ALT_TEXT: {
    code: "MISSING_ALT_TEXT",
    category: "technical",
    severity: "warning",
    scoreImpact: -3, // per image, max -15
    message: "Images are missing alt text attributes",
    recommendation:
      "Add descriptive alt text to all images to improve accessibility and AI understanding.",
    effortLevel: "low",
    implementationSnippet: `<img src="photo.jpg" alt="Descriptive text about the image content" />`,
  },
  HTTP_STATUS: {
    code: "HTTP_STATUS",
    category: "technical",
    severity: "critical",
    scoreImpact: -25,
    message: "Page returned a 4xx or 5xx HTTP status code",
    recommendation:
      "Fix the server error or redirect. Pages must return 200 status to be indexed.",
    effortLevel: "high",
  },
  MISSING_OG_TAGS: {
    code: "MISSING_OG_TAGS",
    category: "technical",
    severity: "info",
    scoreImpact: -5,
    message:
      "Page is missing Open Graph tags (og:title, og:description, og:image)",
    recommendation:
      "Add og:title, og:description, and og:image meta tags for better social and AI sharing.",
    effortLevel: "low",
    implementationSnippet: `<meta property="og:title" content="Page Title" />\n<meta property="og:description" content="Page description" />\n<meta property="og:image" content="https://example.com/image.jpg" />`,
  },
  SLOW_RESPONSE: {
    code: "SLOW_RESPONSE",
    category: "technical",
    severity: "warning",
    scoreImpact: -10,
    message: "Server response time exceeds 2 seconds",
    recommendation:
      "Optimize server response time to under 2 seconds. Check hosting, caching, and database queries.",
    effortLevel: "high",
  },
  MISSING_SITEMAP: {
    code: "MISSING_SITEMAP",
    category: "technical",
    severity: "info",
    scoreImpact: -5,
    message: "No valid sitemap.xml found",
    recommendation:
      "Create and submit a sitemap.xml to help crawlers discover all pages.",
    effortLevel: "medium",
    implementationSnippet: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n    <lastmod>2025-01-01</lastmod>\n  </url>\n</urlset>`,
  },
  SITEMAP_INVALID_FORMAT: {
    code: "SITEMAP_INVALID_FORMAT",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message:
      "Sitemap XML is malformed or does not follow the sitemaps.org schema",
    recommendation:
      "Fix sitemap.xml to follow the sitemaps.org/schemas/sitemap/0.9 standard. Validate at xml-sitemaps.com.",
    effortLevel: "medium",
    implementationSnippet: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n</urlset>`,
  },
  SITEMAP_STALE_URLS: {
    code: "SITEMAP_STALE_URLS",
    category: "technical",
    severity: "info",
    scoreImpact: -3,
    message: "Sitemap contains URLs with lastmod dates older than 12 months",
    recommendation:
      "Update <lastmod> dates in your sitemap to reflect when pages were actually last modified.",
    effortLevel: "low",
    implementationSnippet: `<url>\n  <loc>https://example.com/page</loc>\n  <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n</url>`,
  },
  SITEMAP_LOW_COVERAGE: {
    code: "SITEMAP_LOW_COVERAGE",
    category: "technical",
    severity: "warning",
    scoreImpact: -5,
    message: "Sitemap lists fewer than 50% of discovered pages",
    recommendation:
      "Ensure your sitemap includes all indexable pages. Use a sitemap generator or CMS plugin to auto-generate.",
    effortLevel: "medium",
  },
  REDIRECT_CHAIN: {
    code: "REDIRECT_CHAIN",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page has a redirect chain with 3+ hops",
    recommendation:
      "Reduce redirect chains to a single hop. Each intermediate redirect adds latency and confuses AI crawlers.",
    effortLevel: "medium",
  },
  CORS_MIXED_CONTENT: {
    code: "CORS_MIXED_CONTENT",
    category: "technical",
    severity: "warning",
    scoreImpact: -5,
    message: "HTTPS page loads resources over insecure HTTP",
    recommendation:
      "Update all resource URLs to use HTTPS. Mixed content is blocked by browsers and penalized by crawlers.",
    effortLevel: "low",
    implementationSnippet: `<!-- Change http:// to https:// -->\n<img src="https://cdn.example.com/image.png" />`,
  },
  CORS_UNSAFE_LINKS: {
    code: "CORS_UNSAFE_LINKS",
    category: "technical",
    severity: "info",
    scoreImpact: -3,
    message: 'External links with target="_blank" are missing rel="noopener"',
    recommendation:
      'Add rel="noopener noreferrer" to all external links that open in a new tab.',
    effortLevel: "low",
    implementationSnippet: `<a href="https://external.com" target="_blank" rel="noopener noreferrer">Link</a>`,
  },

  // --- Content Quality (9 + 2 = 11 factors) ---
  THIN_CONTENT: {
    code: "THIN_CONTENT",
    category: "content",
    severity: "warning",
    scoreImpact: -15, // -15 if < 200 words, -8 if 200-499
    message: "Page has insufficient content",
    recommendation:
      "Expand content to at least 500 words of substantive, topic-relevant text.",
    effortLevel: "high",
  },
  CONTENT_DEPTH: {
    code: "CONTENT_DEPTH",
    category: "content",
    severity: "warning",
    scoreImpact: 0, // Mapped from LLM score 0-100 to 0-20 range
    message: "Content lacks depth and comprehensive topic coverage",
    recommendation:
      "Expand coverage of subtopics, add supporting data, examples, and expert analysis.",
    effortLevel: "high",
  },
  CONTENT_CLARITY: {
    code: "CONTENT_CLARITY",
    category: "content",
    severity: "warning",
    scoreImpact: 0,
    message: "Content readability and structure need improvement",
    recommendation:
      "Improve clarity with shorter paragraphs, subheadings, bullet points, and plain language.",
    effortLevel: "medium",
  },
  CONTENT_AUTHORITY: {
    code: "CONTENT_AUTHORITY",
    category: "content",
    severity: "warning",
    scoreImpact: 0,
    message:
      "Content lacks authority signals (citations, data, expert language)",
    recommendation:
      "Add citations, statistics, expert quotes, and authoritative sources to build credibility.",
    effortLevel: "high",
  },
  DUPLICATE_CONTENT: {
    code: "DUPLICATE_CONTENT",
    category: "content",
    severity: "warning",
    scoreImpact: -15,
    message: "Page content is a duplicate of another page in this project",
    recommendation:
      "Consolidate duplicate pages using canonical tags or merge the content.",
    effortLevel: "medium",
    implementationSnippet: `<link rel="canonical" href="https://example.com/original-page" />`,
  },
  STALE_CONTENT: {
    code: "STALE_CONTENT",
    category: "content",
    severity: "info",
    scoreImpact: -5,
    message: "Content appears to be over 12 months old without updates",
    recommendation:
      "Update content with current information, statistics, and recent developments.",
    effortLevel: "medium",
  },
  NO_INTERNAL_LINKS: {
    code: "NO_INTERNAL_LINKS",
    category: "content",
    severity: "warning",
    scoreImpact: -8,
    message: "Page has fewer than 2 internal links to relevant content",
    recommendation:
      "Add at least 2-3 internal links to related pages to improve discoverability.",
    effortLevel: "low",
    implementationSnippet: `<a href="/related-topic">Learn more about related topic</a>`,
  },
  EXCESSIVE_LINKS: {
    code: "EXCESSIVE_LINKS",
    category: "content",
    severity: "info",
    scoreImpact: -3,
    message: "External links exceed internal links by more than 3:1 ratio",
    recommendation:
      "Balance your link profile by adding more internal links relative to external ones.",
    effortLevel: "low",
  },
  MISSING_FAQ_STRUCTURE: {
    code: "MISSING_FAQ_STRUCTURE",
    category: "content",
    severity: "info",
    scoreImpact: -5,
    message: "Content addressing questions does not use Q&A format",
    recommendation:
      "Structure common questions using FAQ format with clear question headings and concise answers.",
    effortLevel: "medium",
    implementationSnippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "What is...?",\n    "acceptedAnswer": { "@type": "Answer", "text": "..." }\n  }]\n}\n</script>`,
  },
  POOR_READABILITY: {
    code: "POOR_READABILITY",
    category: "content",
    severity: "warning",
    scoreImpact: -10,
    message:
      "Content readability is below recommended level (Flesch score < 50)",
    recommendation:
      "Simplify language: use shorter sentences, common words, and active voice. Target Flesch score of 60+.",
    effortLevel: "medium",
  },
  LOW_TEXT_HTML_RATIO: {
    code: "LOW_TEXT_HTML_RATIO",
    category: "content",
    severity: "warning",
    scoreImpact: -8,
    message:
      "Text-to-HTML ratio is below 15% — page is code-heavy with little visible content",
    recommendation:
      "Increase visible text content relative to HTML markup. Remove unnecessary wrappers, inline styles, and bloated templates.",
    effortLevel: "medium",
  },
  AI_ASSISTANT_SPEAK: {
    code: "AI_ASSISTANT_SPEAK",
    category: "content",
    severity: "warning",
    scoreImpact: -10,
    message: "Content uses transition words common in AI-generated text",
    recommendation:
      "Remove common AI transition words like 'In conclusion', 'Moreover', and 'It is important to note'. Use more natural, varied language.",
    effortLevel: "low",
  },
  UNIFORM_SENTENCE_LENGTH: {
    code: "UNIFORM_SENTENCE_LENGTH",
    category: "content",
    severity: "info",
    scoreImpact: -5,
    message:
      "Sentence lengths are too uniform, which can look machine-generated",
    recommendation:
      "Vary your sentence length to create natural 'burstiness' and rhythm. Mix short, impactful sentences with longer descriptive ones.",
    effortLevel: "medium",
  },
  LOW_EEAT_SCORE: {
    code: "LOW_EEAT_SCORE",
    category: "content",
    severity: "warning",
    scoreImpact: -15,
    message: "Content lacks personal experience markers (E-E-A-T)",
    recommendation:
      "Incorporate first-person anecdotes, unique data, or specific case studies. AI search engines prioritize content that demonstrates real-world experience over generic information.",
    effortLevel: "high",
  },
  MISSING_AUTHORITATIVE_CITATIONS: {
    code: "MISSING_AUTHORITATIVE_CITATIONS",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: -5,
    message:
      "Page lacks links to high-authority external sources (.gov, .edu, or major media)",
    recommendation:
      "Cite and link to authoritative external sources to verify your claims. This helps LLMs like Gemini and Perplexity validate your content's accuracy.",
    effortLevel: "medium",
  },

  // --- AI Readiness (10 + 3 = 13 factors) ---
  MISSING_LLMS_TXT: {
    code: "MISSING_LLMS_TXT",
    category: "ai_readiness",
    severity: "critical",
    scoreImpact: -20,
    message: "No llms.txt file found at /llms.txt",
    recommendation:
      "Create an llms.txt file at /llms.txt to explicitly permit AI crawlers and provide structured metadata about your site.",
    effortLevel: "low",
    implementationSnippet: `# /llms.txt\n# Site: Example.com\n# Description: Brief description of your site\n# Topics: topic1, topic2\n\nAllow: *`,
  },
  AI_CRAWLER_BLOCKED: {
    code: "AI_CRAWLER_BLOCKED",
    category: "ai_readiness",
    severity: "critical",
    scoreImpact: -25,
    message:
      "robots.txt blocks one or more AI crawlers (GPTBot, ClaudeBot, PerplexityBot)",
    recommendation:
      "Remove Disallow rules for AI user agents (GPTBot, ClaudeBot, PerplexityBot) in robots.txt.",
    effortLevel: "low",
    implementationSnippet: `# robots.txt — allow AI crawlers\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /`,
  },
  NO_STRUCTURED_DATA: {
    code: "NO_STRUCTURED_DATA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -15,
    message: "Page has no JSON-LD structured data",
    recommendation:
      "Add JSON-LD structured data (at minimum: Organization, WebPage, and Article/FAQPage as appropriate).",
    effortLevel: "medium",
    implementationSnippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "Page Title",\n  "description": "Page description"\n}\n</script>`,
  },
  INCOMPLETE_SCHEMA: {
    code: "INCOMPLETE_SCHEMA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -8,
    message: "Structured data is present but missing required properties",
    recommendation:
      "Complete all required properties in your JSON-LD schema markup.",
    effortLevel: "medium",
  },
  CITATION_WORTHINESS: {
    code: "CITATION_WORTHINESS",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: 0, // Mapped from LLM score
    message: "Content has low citation worthiness for AI assistants",
    recommendation:
      "Add unique data, original research, clear definitions, and expert analysis that AI would want to cite.",
    effortLevel: "high",
  },
  NO_DIRECT_ANSWERS: {
    code: "NO_DIRECT_ANSWERS",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -10,
    message:
      "Content does not contain direct, concise answers to likely queries",
    recommendation:
      "Add clear, concise answer paragraphs at the top of sections that directly address likely user questions.",
    effortLevel: "medium",
  },
  MISSING_ENTITY_MARKUP: {
    code: "MISSING_ENTITY_MARKUP",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: -5,
    message: "Key named entities are not marked up in schema",
    recommendation:
      "Add schema markup for key entities (people, organizations, products) mentioned in your content.",
    effortLevel: "medium",
  },
  NO_SUMMARY_SECTION: {
    code: "NO_SUMMARY_SECTION",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: -5,
    message: "Page lacks a summary or key takeaway section",
    recommendation:
      "Add a TL;DR or key takeaways section that summarizes the page's main points.",
    effortLevel: "low",
    implementationSnippet: `<h2>Key Takeaways</h2>\n<ul>\n  <li>First main point</li>\n  <li>Second main point</li>\n  <li>Third main point</li>\n</ul>`,
  },
  POOR_QUESTION_COVERAGE: {
    code: "POOR_QUESTION_COVERAGE",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -10,
    message:
      "Content does not adequately address likely search queries for this topic",
    recommendation:
      "Research common questions about this topic and ensure your content addresses them directly.",
    effortLevel: "high",
  },
  INVALID_SCHEMA: {
    code: "INVALID_SCHEMA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -8,
    message: "JSON-LD structured data contains parse errors",
    recommendation:
      "Fix JSON-LD syntax errors. Validate at schema.org or Google Rich Results Test.",
    effortLevel: "medium",
  },
  HAS_PDF_CONTENT: {
    code: "HAS_PDF_CONTENT",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: 0,
    message: "Page links to PDF documents that AI models can index",
    recommendation:
      "Ensure PDF content is also available as HTML for better AI discoverability. Add summaries of PDF content on the linking page.",
    effortLevel: "medium",
  },
  PDF_ONLY_CONTENT: {
    code: "PDF_ONLY_CONTENT",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -5,
    message:
      "Page appears to primarily link to PDF content without HTML alternatives",
    recommendation:
      "Create HTML versions of important PDF content. AI models struggle to extract and cite PDF content compared to well-structured HTML.",
    effortLevel: "high",
  },
  AI_CONTENT_EXTRACTABLE: {
    code: "AI_CONTENT_EXTRACTABLE",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: 0,
    message:
      "Content is well-structured for AI extraction (high text ratio, good readability)",
    recommendation:
      "No action needed — content structure is optimized for AI crawlers.",
    effortLevel: "low",
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
    effortLevel: "high",
  },
  LH_SEO_LOW: {
    code: "LH_SEO_LOW",
    category: "performance",
    severity: "warning",
    scoreImpact: -15,
    message: "Lighthouse SEO score is below 0.8",
    recommendation:
      "Address Lighthouse SEO audit failures: ensure crawlable links, valid hreflang, proper meta tags.",
    effortLevel: "medium",
  },
  LH_A11Y_LOW: {
    code: "LH_A11Y_LOW",
    category: "performance",
    severity: "info",
    scoreImpact: -5,
    message: "Lighthouse Accessibility score is below 0.7",
    recommendation:
      "Improve accessibility: add alt text, ensure color contrast, use semantic HTML, add ARIA labels.",
    effortLevel: "medium",
  },
  LH_BP_LOW: {
    code: "LH_BP_LOW",
    category: "performance",
    severity: "info",
    scoreImpact: -5,
    message: "Lighthouse Best Practices score is below 0.8",
    recommendation:
      "Address Lighthouse best practice issues: use HTTPS, avoid deprecated APIs, fix console errors.",
    effortLevel: "medium",
  },
  LARGE_PAGE_SIZE: {
    code: "LARGE_PAGE_SIZE",
    category: "performance",
    severity: "warning",
    scoreImpact: -10,
    message: "Total page size exceeds 3MB",
    recommendation:
      "Reduce page weight below 3MB: compress images, minify CSS/JS, lazy-load below-the-fold content.",
    effortLevel: "high",
  },
} as const;

export type IssueCode = keyof typeof ISSUE_DEFINITIONS;
