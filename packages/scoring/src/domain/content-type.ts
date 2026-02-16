export type ContentTypeId =
  | "blog_post"
  | "news_article"
  | "product"
  | "landing_page"
  | "documentation"
  | "support"
  | "case_study"
  | "about"
  | "unknown";

export interface ContentTypeResult {
  type: ContentTypeId;
  confidence: number; // 0-1 heuristic confidence
  signals: string[];
}

const SCHEMA_MAP: Record<string, ContentTypeId> = {
  Article: "blog_post",
  BlogPosting: "blog_post",
  NewsArticle: "news_article",
  TechArticle: "documentation",
  Report: "case_study",
  FAQPage: "support",
  HowTo: "support",
  QAPage: "support",
  Product: "product",
  ProductModel: "product",
  Service: "landing_page",
  WebApplication: "product",
  CaseStudy: "case_study",
};

const PATH_RULES: Array<{
  pattern: RegExp;
  type: ContentTypeId;
  weight: number;
  signal: string;
}> = [
  {
    pattern: /(blog|insights|stories|library)/,
    type: "blog_post",
    weight: 1.5,
    signal: "URL contains blog keyword",
  },
  {
    pattern: /(news|press|updates|announcements|release-notes)/,
    type: "news_article",
    weight: 1.5,
    signal: "News path keyword",
  },
  {
    pattern: /(docs|documentation|developers|api|kb)/,
    type: "documentation",
    weight: 2,
    signal: "Documentation path keyword",
  },
  {
    pattern: /(support|help|knowledge|faq|troubleshoot)/,
    type: "support",
    weight: 1.5,
    signal: "Support/help path keyword",
  },
  {
    pattern: /(product|features|platform|capabilities)/,
    type: "product",
    weight: 1,
    signal: "Product-focused path",
  },
  {
    pattern: /(solutions|services|why-|platform)/,
    type: "landing_page",
    weight: 1,
    signal: "Solution/landing keyword",
  },
  {
    pattern: /(case-stud|customers|success-stories)/,
    type: "case_study",
    weight: 1.5,
    signal: "Case study keyword",
  },
  {
    pattern: /(about|company|team|culture|careers)/,
    type: "about",
    weight: 1,
    signal: "About/company keyword",
  },
];

export function detectContentType(
  url: string,
  schemaTypes?: string[] | null,
): ContentTypeResult {
  const scores = new Map<ContentTypeId, number>();
  const signals: string[] = [];

  const addScore = (type: ContentTypeId, score: number, signal: string) => {
    scores.set(type, (scores.get(type) ?? 0) + score);
    signals.push(`${type}:${signal}`);
  };

  if (schemaTypes?.length) {
    for (const schemaType of schemaTypes) {
      const mapped = SCHEMA_MAP[schemaType as keyof typeof SCHEMA_MAP];
      if (mapped) {
        addScore(mapped, 2, `schema:${schemaType}`);
      }
    }
  }

  try {
    const { pathname } = new URL(url);
    const normalized = pathname.toLowerCase();
    for (const rule of PATH_RULES) {
      if (rule.pattern.test(normalized)) {
        addScore(rule.type, rule.weight, rule.signal);
      }
    }

    // News heuristic: /YYYY/MM/ or /2024/ style paths
    if (/\/(19|20)\d{2}\//.test(normalized)) {
      addScore("news_article", 1, "dated-path");
    }
  } catch (_error) {
    // ignore invalid URLs
  }

  let bestType: ContentTypeId = "unknown";
  let bestScore = 0;
  for (const [type, score] of scores.entries()) {
    if (score > bestScore) {
      bestType = type;
      bestScore = score;
    }
  }

  return {
    type: bestType,
    confidence: Math.min(1, bestScore / 4),
    signals,
  };
}
