pub mod extractor;
pub mod fetcher;
pub mod frontier;
pub mod parser;
pub mod readability;
pub mod robots;
pub mod security;

pub use fetcher::RateLimitedFetcher;
pub use parser::Parser;
pub use robots::RobotsChecker;

use std::sync::Arc;
use url::Url;

use crate::lighthouse::LighthouseRunner;
use crate::models::*;
use crate::storage::StorageClient;

/// High-level crawl engine that ties together the frontier, fetcher, parser,
/// robots checker, lighthouse runner, and storage client.
pub struct CrawlEngine {
    pub fetcher: RateLimitedFetcher,
    pub lighthouse: Option<LighthouseRunner>,
    pub storage: Arc<StorageClient>,
    pub robots: Option<RobotsChecker>,
    pub config: CrawlConfig,
    pub site_context_data: Option<SiteContext>,
}

impl CrawlEngine {
    /// Create a new CrawlEngine from its components.
    pub fn new(
        fetcher: RateLimitedFetcher,
        lighthouse: Option<LighthouseRunner>,
        storage: Arc<StorageClient>,
        robots: Option<RobotsChecker>,
        config: CrawlConfig,
        site_context_data: Option<SiteContext>,
    ) -> Self {
        CrawlEngine {
            fetcher,
            lighthouse,
            storage,
            robots,
            config,
            site_context_data,
        }
    }

    /// Crawl a single URL and return the parsed page result.
    pub async fn crawl_page(
        &self,
        url: &str,
        job_id: &str,
    ) -> Result<CrawlPageResult, CrawlEngineError> {
        // Check robots.txt
        if let Some(ref checker) = self.robots {
            if !checker.is_allowed(url, &self.config.user_agent) {
                return Err(CrawlEngineError::BlockedByRobots(url.to_string()));
            }
        }

        let page_start = std::time::Instant::now();

        // Fetch
        let fetch_result = self
            .fetcher
            .fetch(url)
            .await
            .map_err(|e| CrawlEngineError::FetchError(e.to_string()))?;

        // Parse
        let parsed = Parser::parse(&fetch_result.body, &fetch_result.final_url);

        // Content hash
        let content_hash = {
            use sha2::Digest;
            let mut hasher = sha2::Sha256::new();
            hasher.update(fetch_result.body.as_bytes());
            hex::encode(hasher.finalize())
        };

        // Upload HTML + run Lighthouse concurrently
        let html_r2_key = format!("crawls/{}/html/{}.html.gz", job_id, &content_hash[..16]);

        let html_upload_fut = self.storage.upload_html(&html_r2_key, &fetch_result.body);
        let lighthouse_fut = async {
            if let Some(ref runner) = self.lighthouse {
                match runner.run_lighthouse(url).await {
                    Ok(result) => Some(result),
                    Err(e) => {
                        tracing::warn!(url = %url, error = %e, "Lighthouse failed");
                        None
                    }
                }
            } else {
                None
            }
        };

        let (html_result, mut lighthouse_result) = tokio::join!(html_upload_fut, lighthouse_fut);
        if let Err(e) = html_result {
            tracing::warn!(url = %url, error = %e, "Failed to upload HTML");
        }

        // Upload Lighthouse JSON (depends on lighthouse result, so sequential)
        if let Some(ref mut result) = lighthouse_result {
            let lh_key = format!(
                "crawls/{}/lighthouse/{}.json.gz",
                job_id,
                &content_hash[..16]
            );
            let lh_json = serde_json::to_string(&result).unwrap_or_default();
            if let Err(e) = self.storage.upload_json(&lh_key, &lh_json).await {
                tracing::warn!(url = %url, error = %e, "Failed to upload LH JSON");
            }
            result.lh_r2_key = Some(lh_key);
        }

        // Build extracted data
        let structured_data: Option<Vec<serde_json::Value>> = if self.config.extract_schema {
            let values: Vec<serde_json::Value> = parsed
                .schema_json_ld
                .iter()
                .filter_map(|s| serde_json::from_str(s).ok())
                .collect();
            if values.is_empty() {
                None
            } else {
                Some(values)
            }
        } else {
            None
        };

        let schema_types: Vec<String> = parsed
            .schema_json_ld
            .iter()
            .filter_map(|s| serde_json::from_str::<serde_json::Value>(s).ok())
            .filter_map(|v| {
                v.get("@type")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
            })
            .collect();

        let og_tags = if parsed.og_tags.is_empty() {
            None
        } else {
            Some(parsed.og_tags)
        };

        let timing_ms = page_start.elapsed().as_millis() as u64;

        Ok(CrawlPageResult {
            url: fetch_result.final_url,
            status_code: fetch_result.status_code,
            title: parsed.title,
            meta_description: parsed.meta_description,
            canonical_url: parsed.canonical_url,
            word_count: parsed.word_count,
            content_hash,
            html_r2_key,
            extracted: ExtractedData {
                h1: parsed.headings.h1,
                h2: parsed.headings.h2,
                h3: parsed.headings.h3,
                h4: parsed.headings.h4,
                h5: parsed.headings.h5,
                h6: parsed.headings.h6,
                schema_types,
                internal_links: parsed.internal_links,
                external_links: parsed.external_links,
                images_without_alt: parsed.images_without_alt,
                has_robots_meta: parsed.has_robots_meta,
                robots_directives: parsed.robots_directives,
                og_tags,
                structured_data,
                flesch_score: parsed.flesch_score,
                flesch_classification: parsed.flesch_classification,
                text_html_ratio: parsed.text_html_ratio,
                text_length: parsed.text_length,
                html_length: parsed.html_length,
                pdf_links: parsed.pdf_links,
                cors_unsafe_blank_links: parsed.cors_unsafe_blank_links,
                cors_mixed_content: parsed.cors_mixed_content,
                cors_has_issues: parsed.cors_has_issues,
                sentence_length_variance: parsed.sentence_length_variance,
                top_transition_words: parsed.top_transition_words,
            },
            lighthouse: lighthouse_result,
            timing_ms,
            redirect_chain: fetch_result.redirect_chain,
            site_context: self.site_context_data.clone(),
        })
    }

    /// Extract the domain from a URL string.
    pub fn domain_from_url(url: &str) -> Option<String> {
        Url::parse(url)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_string()))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CrawlEngineError {
    #[error("URL blocked by robots.txt: {0}")]
    BlockedByRobots(String),
    #[error("Fetch error: {0}")]
    FetchError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
}
