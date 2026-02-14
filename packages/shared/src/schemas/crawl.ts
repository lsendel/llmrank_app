import { z } from "zod";

// Cloudflare -> Hetzner: Job submission payload
export const CrawlJobPayloadSchema = z.object({
  job_id: z.string(),
  callback_url: z.string().url(),
  config: z.object({
    seed_urls: z.array(z.string().url()),
    max_pages: z.number().int().min(1).max(2000),
    max_depth: z.number().int().min(1).max(10),
    respect_robots: z.boolean().default(true),
    run_lighthouse: z.boolean().default(true),
    extract_schema: z.boolean().default(true),
    extract_links: z.boolean().default(true),
    check_llms_txt: z.boolean().default(true),
    user_agent: z.string().default("AISEOBot/1.0"),
    rate_limit_ms: z.number().int().default(1000),
    timeout_s: z.number().int().default(30),
  }),
});

// Extracted data from a single page
export const ExtractedDataSchema = z.object({
  h1: z.array(z.string()),
  h2: z.array(z.string()),
  h3: z.array(z.string()),
  h4: z.array(z.string()),
  h5: z.array(z.string()),
  h6: z.array(z.string()),
  schema_types: z.array(z.string()),
  internal_links: z.array(z.string()),
  external_links: z.array(z.string()),
  images_without_alt: z.number().int(),
  has_robots_meta: z.boolean(),
  robots_directives: z.array(z.string()),
  og_tags: z.record(z.string()).optional(),
  structured_data: z.array(z.unknown()).optional(),
  // Readability (Tier 1)
  flesch_score: z.number().nullable().optional(),
  flesch_classification: z.string().nullable().optional(),
  // Text-to-HTML ratio (Tier 2)
  text_html_ratio: z.number().nullable().optional(),
  text_length: z.number().int().nullable().optional(),
  html_length: z.number().int().nullable().optional(),
  // PDF links (Tier 2)
  pdf_links: z.array(z.string()).optional().default([]),
  // CORS (Tier 2)
  cors_unsafe_blank_links: z.number().int().optional().default(0),
  cors_mixed_content: z.number().int().optional().default(0),
  cors_has_issues: z.boolean().optional().default(false),
});

// Lighthouse results for a page
export const LighthouseResultSchema = z.object({
  performance: z.number().min(0).max(1),
  seo: z.number().min(0).max(1),
  accessibility: z.number().min(0).max(1),
  best_practices: z.number().min(0).max(1),
  lh_r2_key: z.string().optional(),
});

// Single page result from crawler
export const CrawlPageResultSchema = z.object({
  url: z.string().url(),
  status_code: z.number().int(),
  title: z.string().nullable(),
  meta_description: z.string().nullable(),
  canonical_url: z.string().nullable(),
  word_count: z.number().int(),
  content_hash: z.string(),
  html_r2_key: z.string(),
  extracted: ExtractedDataSchema,
  lighthouse: LighthouseResultSchema.nullable().optional(),
  timing_ms: z.number(),
  redirect_chain: z
    .array(
      z.object({
        url: z.string(),
        status_code: z.number().int(),
      }),
    )
    .optional()
    .default([]),
});

// Hetzner -> Cloudflare: Batch result callback
export const CrawlResultBatchSchema = z.object({
  job_id: z.string(),
  batch_index: z.number().int(),
  is_final: z.boolean(),
  pages: z.array(CrawlPageResultSchema),
  stats: z.object({
    pages_found: z.number().int(),
    pages_crawled: z.number().int(),
    pages_errored: z.number().int(),
    elapsed_s: z.number(),
  }),
});

export type CrawlJobPayload = z.infer<typeof CrawlJobPayloadSchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
export type LighthouseResult = z.infer<typeof LighthouseResultSchema>;
export type CrawlPageResult = z.infer<typeof CrawlPageResultSchema>;
export type CrawlResultBatch = z.infer<typeof CrawlResultBatchSchema>;
