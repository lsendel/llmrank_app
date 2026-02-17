/**
 * 7-Dimension scoring model.
 *
 * Replaces the legacy 4-pillar model (Technical/Content/AI Readiness/Performance)
 * with finer-grained dimensions that map directly to actionable site capabilities.
 *
 * Total weights sum to 1.0 (100%).
 */

// ---------------------------------------------------------------------------
// Dimension IDs (const tuple for type extraction)
// ---------------------------------------------------------------------------

export const DIMENSION_IDS = [
  "llms_txt",
  "robots_crawlability",
  "sitemap",
  "schema_markup",
  "meta_tags",
  "bot_access",
  "content_citeability",
] as const;

export type DimensionId = (typeof DIMENSION_IDS)[number];

// ---------------------------------------------------------------------------
// Display names
// ---------------------------------------------------------------------------

export const DIMENSION_DISPLAY_NAMES: Record<DimensionId, string> = {
  llms_txt: "llms.txt",
  robots_crawlability: "Robots & Crawlability",
  sitemap: "Sitemap",
  schema_markup: "Schema Markup",
  meta_tags: "Meta Tags & Discovery",
  bot_access: "Bot Access & Performance",
  content_citeability: "Content & Citeability",
};

// ---------------------------------------------------------------------------
// Weights (must sum to 1.0)
// ---------------------------------------------------------------------------

export type DimensionWeights = Record<DimensionId, number>;

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  llms_txt: 0.1,
  robots_crawlability: 0.15,
  sitemap: 0.1,
  schema_markup: 0.15,
  meta_tags: 0.1,
  bot_access: 0.15,
  content_citeability: 0.25,
};

// ---------------------------------------------------------------------------
// Dimension metadata (id + label + weight in one object for iteration)
// ---------------------------------------------------------------------------

export interface DimensionDef {
  id: DimensionId;
  label: string;
  weight: number;
}

export const DIMENSIONS: Record<DimensionId, DimensionDef> = {
  llms_txt: {
    id: "llms_txt",
    label: DIMENSION_DISPLAY_NAMES.llms_txt,
    weight: DEFAULT_DIMENSION_WEIGHTS.llms_txt,
  },
  robots_crawlability: {
    id: "robots_crawlability",
    label: DIMENSION_DISPLAY_NAMES.robots_crawlability,
    weight: DEFAULT_DIMENSION_WEIGHTS.robots_crawlability,
  },
  sitemap: {
    id: "sitemap",
    label: DIMENSION_DISPLAY_NAMES.sitemap,
    weight: DEFAULT_DIMENSION_WEIGHTS.sitemap,
  },
  schema_markup: {
    id: "schema_markup",
    label: DIMENSION_DISPLAY_NAMES.schema_markup,
    weight: DEFAULT_DIMENSION_WEIGHTS.schema_markup,
  },
  meta_tags: {
    id: "meta_tags",
    label: DIMENSION_DISPLAY_NAMES.meta_tags,
    weight: DEFAULT_DIMENSION_WEIGHTS.meta_tags,
  },
  bot_access: {
    id: "bot_access",
    label: DIMENSION_DISPLAY_NAMES.bot_access,
    weight: DEFAULT_DIMENSION_WEIGHTS.bot_access,
  },
  content_citeability: {
    id: "content_citeability",
    label: DIMENSION_DISPLAY_NAMES.content_citeability,
    weight: DEFAULT_DIMENSION_WEIGHTS.content_citeability,
  },
};

// ---------------------------------------------------------------------------
// Score type (0-100 per dimension)
// ---------------------------------------------------------------------------

export type DimensionScores = Record<DimensionId, number>;
