use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::crawler::fetcher::RedirectHop;

// --- Crawl Configuration ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlConfig {
    pub seed_urls: Vec<String>,
    pub max_pages: u32,
    pub max_depth: u32,
    #[serde(default = "default_true")]
    pub respect_robots: bool,
    #[serde(default = "default_true")]
    pub run_lighthouse: bool,
    #[serde(default = "default_true")]
    pub extract_schema: bool,
    #[serde(default = "default_true")]
    pub extract_links: bool,
    #[serde(default = "default_true")]
    pub check_llms_txt: bool,
    #[serde(default = "default_user_agent")]
    pub user_agent: String,
    #[serde(default = "default_rate_limit_ms")]
    pub rate_limit_ms: u32,
    #[serde(default = "default_timeout_s")]
    pub timeout_s: u32,
    #[serde(default = "default_true")]
    pub run_js_render: bool,
}

fn default_true() -> bool {
    true
}

fn default_user_agent() -> String {
    "AISEOBot/1.0".to_string()
}

fn default_rate_limit_ms() -> u32 {
    1000
}

fn default_timeout_s() -> u32 {
    30
}

// --- Job Payload ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlJobPayload {
    pub job_id: String,
    pub callback_url: String,
    pub config: CrawlConfig,
}

// --- Extracted Link ---

/// A link extracted from a page with metadata for backlink tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedLink {
    pub url: String,
    pub anchor_text: String,
    pub rel: String, // e.g. "nofollow", "sponsored", "" for dofollow
    pub is_external: bool,
}

// --- Extracted Data ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedData {
    pub h1: Vec<String>,
    pub h2: Vec<String>,
    pub h3: Vec<String>,
    pub h4: Vec<String>,
    pub h5: Vec<String>,
    pub h6: Vec<String>,
    pub schema_types: Vec<String>,
    pub internal_links: Vec<String>,
    pub external_links: Vec<String>,
    #[serde(default)]
    pub external_link_details: Vec<ExtractedLink>,
    pub images_without_alt: u32,
    pub has_robots_meta: bool,
    pub robots_directives: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub og_tags: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured_data: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flesch_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flesch_classification: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_html_ratio: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html_length: Option<usize>,
    #[serde(default)]
    pub pdf_links: Vec<String>,
    #[serde(default)]
    pub cors_unsafe_blank_links: u32,
    #[serde(default)]
    pub cors_mixed_content: u32,
    #[serde(default)]
    pub cors_has_issues: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sentence_length_variance: Option<f64>,
    #[serde(default)]
    pub top_transition_words: Vec<String>,
}

// --- Lighthouse Result ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LighthouseResult {
    pub performance: f64,
    pub seo: f64,
    pub accessibility: f64,
    pub best_practices: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lh_r2_key: Option<String>,
}

// --- Site Context ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SitemapAnalysis {
    pub is_valid: bool,
    pub url_count: u32,
    pub stale_url_count: u32,
    pub discovered_page_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteContext {
    pub has_llms_txt: bool,
    pub ai_crawlers_blocked: Vec<String>,
    pub has_sitemap: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sitemap_analysis: Option<SitemapAnalysis>,
    pub content_hashes: HashMap<String, String>, // hash -> url
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_time_ms: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size_bytes: Option<u64>,
}

// --- Crawl Page Result ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlPageResult {
    pub url: String,
    pub status_code: u16,
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub canonical_url: Option<String>,
    pub word_count: u32,
    pub content_hash: String,
    pub html_r2_key: String,
    pub extracted: ExtractedData,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lighthouse: Option<LighthouseResult>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub js_rendered_link_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub site_context: Option<SiteContext>,
    pub timing_ms: u64,
    #[serde(default)]
    pub redirect_chain: Vec<RedirectHop>,
}

// --- Crawl Stats ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlStats {
    pub pages_found: u32,
    pub pages_crawled: u32,
    pub pages_errored: u32,
    pub elapsed_s: f64,
}

// --- Crawl Result Batch ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlResultBatch {
    pub job_id: String,
    pub batch_index: u32,
    pub is_final: bool,
    pub pages: Vec<CrawlPageResult>,
    pub stats: CrawlStats,
}

// --- Job Status ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatusKind {
    Pending,
    Queued,
    Crawling,
    Scoring,
    Complete,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatus {
    pub job_id: String,
    pub status: JobStatusKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stats: Option<CrawlStats>,
}
