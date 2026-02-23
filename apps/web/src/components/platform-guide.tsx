"use client";

import { useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Shield,
  Info,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Slug-to-display-name mapping (consistent with API response platform names)
// ---------------------------------------------------------------------------

const PLATFORM_META: Record<
  string,
  { displayName: string; description: string; icon: string; docUrl: string }
> = {
  chatgpt: {
    displayName: "ChatGPT",
    description:
      "OpenAI's conversational AI focuses on structured data, schema markup, and clear content hierarchy. GPTBot crawls your site to build training data, so allowing access is critical.",
    icon: "\u{1F916}",
    docUrl: "https://platform.openai.com/docs/bots",
  },
  claude: {
    displayName: "Claude",
    description:
      "Anthropic's assistant values well-cited, factual content with clear sourcing. ClaudeBot indexes your content, and llms.txt is the primary discovery mechanism.",
    icon: "\u{1F7E0}",
    docUrl: "https://docs.anthropic.com/en/docs/claude-ai",
  },
  perplexity: {
    displayName: "Perplexity",
    description:
      "AI-powered search engine that prioritizes citable content, freshness signals, and authoritative sources. PerplexityBot crawls for real-time answers.",
    icon: "\u{1F50D}",
    docUrl: "https://docs.perplexity.ai",
  },
  gemini: {
    displayName: "Gemini",
    description:
      "Google's AI leverages existing SEO signals (E-E-A-T, structured data, PageRank) plus AI-specific factors. Google-Extended controls Gemini's training access.",
    icon: "\u{1F48E}",
    docUrl: "https://ai.google.dev/gemini-api/docs",
  },
  gemini_ai_mode: {
    displayName: "Gemini AI Mode",
    description:
      "Google's AI Overview blends traditional search ranking with AI synthesis. Appearing in AI Mode requires strong citation signals and structured markup.",
    icon: "\u2728",
    docUrl: "https://ai.google.dev/gemini-api/docs",
  },
  copilot: {
    displayName: "Copilot",
    description:
      "Microsoft's AI assistant uses Bing index signals plus content quality. Strong traditional SEO fundamentals (meta tags, sitemap, page speed) matter most.",
    icon: "\u{1F537}",
    docUrl: "https://learn.microsoft.com/en-us/copilot/",
  },
  grok: {
    displayName: "Grok",
    description:
      "xAI's assistant values real-time content, direct clear answers, and quotable statements. Content freshness and factual density are key ranking signals.",
    icon: "\u26A1",
    docUrl: "https://docs.x.ai",
  },
};

// Reverse lookup: display name -> slug
const DISPLAY_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PLATFORM_META).map(([slug, meta]) => [meta.displayName, slug]),
);

function slugForDisplayName(displayName: string): string {
  return DISPLAY_NAME_TO_SLUG[displayName] ?? displayName.toLowerCase();
}

// ---------------------------------------------------------------------------
// Recommendation data keyed by factor
// ---------------------------------------------------------------------------

const FACTOR_RECOMMENDATIONS: Record<
  string,
  { howToFix: string; whyItMatters: string }
> = {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PlatformGuideProps {
  projectId: string;
  platform: string;
  crawlId?: string;
}

export function PlatformGuide({
  projectId,
  platform,
  crawlId,
}: PlatformGuideProps) {
  const { data: allPlatforms, isLoading } = useApiSWR(
    crawlId ? `platform-readiness-${crawlId}` : null,
    useCallback(() => api.platformReadiness.get(crawlId!), [crawlId]),
  );

  const meta = PLATFORM_META[platform];
  const displayName = meta?.displayName ?? platform;

  // Find this platform's readiness data from the API response
  const readiness = allPlatforms?.find(
    (p) => slugForDisplayName(p.platform) === platform,
  );

  const passCount = readiness?.checks.filter((c) => c.pass).length ?? 0;
  const totalCount = readiness?.checks.length ?? 0;
  const passRate =
    totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const criticalFails =
    readiness?.checks.filter((c) => !c.pass && c.importance === "critical") ??
    [];
  const importantFails =
    readiness?.checks.filter((c) => !c.pass && c.importance === "important") ??
    [];
  const recommendedFails =
    readiness?.checks.filter(
      (c) => !c.pass && c.importance === "recommended",
    ) ?? [];
  const passing = readiness?.checks.filter((c) => c.pass) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <span>{meta?.icon ?? "\u{1F916}"}</span>
            {displayName} Optimization Guide
          </h1>
          <p className="mt-1 text-muted-foreground">{meta?.description}</p>
        </div>
        {readiness && (
          <div className="flex flex-col items-end shrink-0">
            <span
              className={cn(
                "text-3xl font-bold",
                readiness.score >= 80
                  ? "text-success"
                  : readiness.score >= 60
                    ? "text-warning"
                    : "text-destructive",
              )}
            >
              {readiness.score}
            </span>
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Grade {readiness.grade}
            </span>
          </div>
        )}
      </div>

      {/* Progress summary */}
      {readiness && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {passCount} of {totalCount} checks passing
              </span>
              <span className="font-medium">{passRate}%</span>
            </div>
            <Progress value={passRate} className="h-2" />
            <div className="mt-4 flex flex-wrap gap-3">
              {criticalFails.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {criticalFails.length} critical
                </Badge>
              )}
              {importantFails.length > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 border-warning text-warning"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {importantFails.length} important
                </Badge>
              )}
              {recommendedFails.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Info className="h-3 w-3" />
                  {recommendedFails.length} recommended
                </Badge>
              )}
              {passing.length > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 border-success text-success"
                >
                  <CheckCircle className="h-3 w-3" />
                  {passing.length} passing
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Loading readiness data...
            </p>
          </CardContent>
        </Card>
      )}

      {/* No crawl data */}
      {!crawlId && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Run a crawl to see your {displayName} readiness score and
              personalized recommendations.
            </p>
            <Link
              href={`/dashboard/projects/${projectId}?tab=overview`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Go to project overview
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Critical issues */}
      {criticalFails.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <XCircle className="h-4 w-4" />
              Critical Issues ({criticalFails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {criticalFails.map((check) => (
                <FactorDetail key={check.factor} check={check} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important issues */}
      {importantFails.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <AlertTriangle className="h-4 w-4" />
              Important Improvements ({importantFails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {importantFails.map((check) => (
                <FactorDetail key={check.factor} check={check} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended */}
      {recommendedFails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-muted-foreground" />
              Recommended Improvements ({recommendedFails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendedFails.map((check) => (
                <FactorDetail key={check.factor} check={check} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passing checks */}
      {passing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-success">
              <CheckCircle className="h-4 w-4" />
              Passing Checks ({passing.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {passing.map((check) => (
                <li
                  key={check.factor}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                  <span>{check.label}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {check.importance}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Platform-specific tips */}
      {readiness && readiness.tips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              {displayName} Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {readiness.tips.map((tip, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Shield className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Documentation link */}
      {meta?.docUrl && (
        <div className="text-center">
          <a
            href={meta.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {displayName} Developer Documentation
          </a>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Factor detail sub-component
// ---------------------------------------------------------------------------

interface FactorCheck {
  factor: string;
  label: string;
  importance: "critical" | "important" | "recommended";
  pass: boolean;
}

function FactorDetail({ check }: { check: FactorCheck }) {
  const rec = FACTOR_RECOMMENDATIONS[check.factor];

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{check.label}</h4>
        <Badge
          variant={
            check.importance === "critical" ? "destructive" : "secondary"
          }
          className="text-[10px]"
        >
          {check.importance}
        </Badge>
      </div>
      {rec && (
        <>
          <p className="text-xs text-muted-foreground">{rec.whyItMatters}</p>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium mb-1">How to fix:</p>
            <p className="text-xs text-muted-foreground">{rec.howToFix}</p>
          </div>
        </>
      )}
    </div>
  );
}
