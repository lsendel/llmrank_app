import type { PlatformReadinessResult } from "@/lib/api";

type PlatformMeta = {
  displayName: string;
  description: string;
  icon: string;
  docUrl: string;
};

type FactorRecommendation = {
  howToFix: string;
  whyItMatters: string;
};

export type FactorCheck = PlatformReadinessResult["checks"][number];

export const PLATFORM_META: Record<string, PlatformMeta> = {
  chatgpt: {
    displayName: "ChatGPT",
    description:
      "OpenAI's conversational AI focuses on structured data, schema markup, and clear content hierarchy. GPTBot crawls your site to build training data, so allowing access is critical.",
    icon: "🤖",
    docUrl: "https://platform.openai.com/docs/bots",
  },
  claude: {
    displayName: "Claude",
    description:
      "Anthropic's assistant values well-cited, factual content with clear sourcing. ClaudeBot indexes your content, and llms.txt is the primary discovery mechanism.",
    icon: "🟠",
    docUrl: "https://docs.anthropic.com/en/docs/claude-ai",
  },
  perplexity: {
    displayName: "Perplexity",
    description:
      "AI-powered search engine that prioritizes citable content, freshness signals, and authoritative sources. PerplexityBot crawls for real-time answers.",
    icon: "🔍",
    docUrl: "https://docs.perplexity.ai",
  },
  gemini: {
    displayName: "Gemini",
    description:
      "Google's AI leverages existing SEO signals (E-E-A-T, structured data, PageRank) plus AI-specific factors. Google-Extended controls Gemini's training access.",
    icon: "💎",
    docUrl: "https://ai.google.dev/gemini-api/docs",
  },
  gemini_ai_mode: {
    displayName: "Gemini AI Mode",
    description:
      "Google's AI Overview blends traditional search ranking with AI synthesis. Appearing in AI Mode requires strong citation signals and structured markup.",
    icon: "✨",
    docUrl: "https://ai.google.dev/gemini-api/docs",
  },
  copilot: {
    displayName: "Copilot",
    description:
      "Microsoft's AI assistant uses Bing index signals plus content quality. Strong traditional SEO fundamentals (meta tags, sitemap, page speed) matter most.",
    icon: "🔷",
    docUrl: "https://learn.microsoft.com/en-us/copilot/",
  },
  grok: {
    displayName: "Grok",
    description:
      "xAI's assistant values real-time content, direct clear answers, and quotable statements. Content freshness and factual density are key ranking signals.",
    icon: "⚡",
    docUrl: "https://docs.x.ai",
  },
};

const DISPLAY_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PLATFORM_META).map(([slug, meta]) => [meta.displayName, slug]),
);

const FACTOR_RECOMMENDATIONS: Record<string, FactorRecommendation> = {
  ai_crawlers: {
    howToFix:
      'Update your robots.txt to allow the platform\'s bot (e.g., "User-agent: GPTBot\\nAllow: /"). Test with a robots.txt validator after changes.',
    whyItMatters:
      "If the AI crawler is blocked, the platform cannot index your content and you will never appear in its responses.",
  },
  structured_data: {
    howToFix:
      "Add JSON-LD schema markup to your pages. Start with Article, Organization, and FAQ schemas. Use Google's Rich Results Test to validate.",
    whyItMatters:
      "Structured data helps AI models understand your content's context, entities, and relationships, improving extraction accuracy.",
  },
  llms_txt: {
    howToFix:
      "Create a /llms.txt file at your domain root that describes your site, key pages, and content structure in a machine-readable format.",
    whyItMatters:
      "llms.txt is the emerging standard for AI discovery. It tells language models what your site offers and how to navigate it.",
  },
  direct_answers: {
    howToFix:
      "Structure content with clear question-answer pairs. Use heading tags for questions and provide concise answers in the first paragraph. Add FAQ schema markup.",
    whyItMatters:
      "AI models extract direct answers from content. Pages with clear Q&A formatting are more likely to be cited in responses.",
  },
  title: {
    howToFix:
      "Add a descriptive, unique <title> tag to every page. Keep it under 60 characters and include your primary keyword.",
    whyItMatters:
      "Title tags are a primary signal for content relevance. AI models use them to determine what a page is about.",
  },
  meta_desc: {
    howToFix:
      "Write a compelling meta description (150-160 characters) that summarizes the page content. Include key terms naturally.",
    whyItMatters:
      "Meta descriptions provide AI models with a concise summary for ranking and snippet generation.",
  },
  sitemap: {
    howToFix:
      "Generate an XML sitemap listing all important pages. Submit it via robots.txt (Sitemap: directive) and platform webmaster tools.",
    whyItMatters:
      "Sitemaps help crawlers discover and prioritize your content, ensuring complete indexing.",
  },
  citation: {
    howToFix:
      "Include original statistics, data points, expert quotes, and unique research. Add proper source attribution and dates.",
    whyItMatters:
      "AI models prefer citing authoritative, data-rich content. Citation-worthy pages appear far more frequently in AI responses.",
  },
  content_depth: {
    howToFix:
      "Expand thin pages to 800+ words with substantive, well-structured content. Break into logical sections with descriptive headings.",
    whyItMatters:
      "Thin content lacks the depth AI models need for reliable extraction. Comprehensive pages rank higher across all platforms.",
  },
  summary: {
    howToFix:
      'Add a TL;DR or "Key Takeaways" section near the top of long-form content. Summarize the main points in 2-3 bullet points.',
    whyItMatters:
      "Summary sections give AI models a quick extraction point, making your content more likely to be featured in responses.",
  },
  faq: {
    howToFix:
      "Add an FAQ section with common questions and clear answers. Implement FAQPage schema markup for each Q&A pair.",
    whyItMatters:
      "FAQ structures directly map to how users query AI assistants, increasing your chances of being cited.",
  },
  internal_links: {
    howToFix:
      "Add 3-5 relevant internal links per page using descriptive anchor text. Create topic clusters that link related content.",
    whyItMatters:
      "Internal links help AI crawlers discover related content and understand your site's topical authority.",
  },
  questions: {
    howToFix:
      'Research common questions in your niche and create content that directly addresses them. Use "People Also Ask" as inspiration.',
    whyItMatters:
      "Covering common questions increases the chances your content matches AI search queries.",
  },
  canonical: {
    howToFix:
      'Add <link rel="canonical" href="..."> to every page pointing to the preferred URL. Ensure consistency across HTTP/HTTPS and www/non-www.',
    whyItMatters:
      "Canonical URLs prevent duplicate content confusion, ensuring AI models attribute authority to the right page.",
  },
  robots: {
    howToFix:
      "Create a robots.txt file that allows crawling of important content while blocking admin/duplicate pages.",
    whyItMatters:
      "A well-configured robots.txt ensures crawlers can access your valuable content efficiently.",
  },
  performance: {
    howToFix:
      "Optimize Core Web Vitals: compress images, minimize JavaScript, enable caching, and use a CDN. Target LCP < 2.5s.",
    whyItMatters:
      "Fast-loading pages are preferred by crawlers and correlate with higher quality signals.",
  },
  mobile: {
    howToFix:
      "Use responsive design, ensure touch targets are 48px+, and test with Google's Mobile-Friendly Test.",
    whyItMatters:
      "Mobile-first indexing means your mobile experience directly impacts crawlability and ranking.",
  },
  entity_markup: {
    howToFix:
      "Add Organization, Person, and Product schema. Link entities with sameAs properties to Wikipedia, Wikidata, and social profiles.",
    whyItMatters:
      "Entity markup helps AI models connect your content to knowledge graphs, improving entity recognition and trust.",
  },
  freshness: {
    howToFix:
      "Add datePublished and dateModified to your schema markup. Update key pages regularly with current data and dates.",
    whyItMatters:
      "Content freshness is a ranking signal. AI models prefer recent, up-to-date information for time-sensitive queries.",
  },
};

export function slugForDisplayName(displayName: string) {
  return DISPLAY_NAME_TO_SLUG[displayName] ?? displayName.toLowerCase();
}

export function getFactorRecommendation(factor: string) {
  return FACTOR_RECOMMENDATIONS[factor];
}

export function getReadinessScoreClass(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function buildPlatformGuideModel(
  platform: string,
  allPlatforms?: PlatformReadinessResult[],
) {
  const meta = PLATFORM_META[platform];
  const displayName = meta?.displayName ?? platform;
  const readiness = allPlatforms?.find(
    (entry) => slugForDisplayName(entry.platform) === platform,
  );
  const checks = readiness?.checks ?? [];
  const passCount = checks.filter((check) => check.pass).length;
  const totalCount = checks.length;
  const passRate =
    totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  return {
    meta,
    displayName,
    platformIcon: meta?.icon ?? "🤖",
    description: meta?.description,
    docUrl: meta?.docUrl,
    readiness,
    passCount,
    totalCount,
    passRate,
    criticalFails: checks.filter(
      (check) => !check.pass && check.importance === "critical",
    ),
    importantFails: checks.filter(
      (check) => !check.pass && check.importance === "important",
    ),
    recommendedFails: checks.filter(
      (check) => !check.pass && check.importance === "recommended",
    ),
    passing: checks.filter((check) => check.pass),
    scoreToneClass: readiness ? getReadinessScoreClass(readiness.score) : null,
  };
}
