import type { ExtractedData } from "@llm-boost/shared";
import type { PageData } from "../../../types";

/**
 * A golden-set fixture: a fully-specified page-scoring INPUT (`PageData`) plus
 * the reason it exists. The scoring engine is run over `page` and the result is
 * committed as a golden snapshot (see `golden.test.ts`).
 *
 * `tags` group fixtures so the distribution guards can reason about the set
 * (e.g. "content-bearing pages", "the readability lock pair").
 */
export interface GoldenFixture {
  /** Stable snapshot key. NEVER rename without regenerating the snapshot. */
  id: string;
  /** Human summary of what real-world page this models and what it locks in. */
  description: string;
  tags: FixtureTag[];
  page: PageData;
}

export type FixtureTag =
  | "healthcare" // families.care-style clinical/directory content
  | "generic-seo" // ordinary marketing / SaaS / blog SEO content
  | "clean" // a well-built page that should score highly
  | "edge" // a deliberately broken / degenerate page
  | "readability" // exercises POOR_READABILITY (locks #112/#116)
  | "llm-gating" // exercises the llmContentScores gating (#108/#114)
  | "error"; // 4xx/5xx short-circuit pages

/**
 * A realistic, well-structured healthcare landing page that scores a clean 100
 * (grade A, zero issues) under the current engine. Every fixture is a shallow
 * override of this base, so a fixture only has to declare what it changes — the
 * incidental factors stay healthy, which is what keeps the distribution guards
 * meaningful (a factor that fires across the set is then a real signal, not an
 * artifact of a broken base).
 */
export function base(): PageData {
  return {
    url: "https://families.care/services/in-home-senior-care",
    statusCode: 200,
    title: "In-Home Senior Care Services | Families Care", // 45 chars (30-60)
    metaDescription:
      "Compassionate in-home senior care: personal care, companionship, and skilled nursing. Compare local caregivers, costs, and availability in your area today.", // 156 chars (120-160)
    canonicalUrl: "https://families.care/services/in-home-senior-care",
    wordCount: 820,
    contentHash: "base-hash-clean",
    extracted: {
      h1: ["In-Home Senior Care Services"],
      // NOTE: no heading may start with a question word (how/what/why/…) or a
      // "?" — that would trip the NO_DIRECT_ANSWERS detector and pollute every
      // fixture that inherits this base. Keep the healthy base free of ALL
      // deductible signals so each fixture isolates the factor it targets.
      h2: ["Types of Care We Provide", "Key Takeaways", "Pricing and Coverage"],
      h3: ["Personal Care", "Companion Care", "Skilled Nursing"],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["WebPage", "Organization"],
      internal_links: ["/caregivers", "/pricing", "/locations"],
      // .gov link → authoritative citation + E-E-A-T signal.
      external_links: [
        "https://www.medicare.gov/coverage/home-health-services",
      ],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "In-Home Senior Care Services",
        "og:description": "Compassionate in-home senior care in your area.",
        "og:image": "https://families.care/og/senior-care.png",
      },
      structured_data: [
        { "@type": "WebPage", name: "In-Home Senior Care", description: "…" },
        {
          "@type": "Organization",
          name: "Families Care",
          url: "https://families.care",
        },
      ],
      // Structural readability: short average sentence length → NOT flagged,
      // even though the vocabulary-driven Flesch below is "difficult". This is
      // the whole point of #116 — see the readability fixtures for the lock.
      avg_sentence_length: 16,
      flesch_score: 52,
      flesch_classification: "Fairly Difficult",
      text_html_ratio: 42,
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: 26,
      top_transition_words: ["however", "therefore", "for example"],
    },
    lighthouse: {
      performance: 0.95,
      seo: 0.96,
      accessibility: 0.93,
      best_practices: 0.92,
    },
    llmScores: null,
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
      contentHashes: new Map(),
    },
  };
}

/**
 * Build a fixture as a shallow override of {@link base}. `extracted` and
 * `siteContext` are merged one level deep so a fixture can flip a single field
 * without restating the whole healthy object.
 *
 * Pass `siteContext: null` to model a page crawled with no site-level context
 * (the engine skips all site-level factors then).
 */
export function makeFixture(
  id: string,
  description: string,
  tags: FixtureTag[],
  overrides: {
    page?: Partial<Omit<PageData, "extracted" | "siteContext">>;
    extracted?: Partial<ExtractedData>;
    siteContext?: Partial<NonNullable<PageData["siteContext"]>> | null;
  } = {},
): GoldenFixture {
  const b = base();
  const siteContext =
    overrides.siteContext === null
      ? undefined
      : { ...b.siteContext!, ...overrides.siteContext };
  return {
    id,
    description,
    tags,
    page: {
      ...b,
      ...overrides.page,
      extracted: { ...b.extracted, ...overrides.extracted },
      siteContext,
    },
  };
}
