pub mod extractor;
pub mod fetcher;
pub mod frontier;
pub mod parser;
pub mod readability;
pub mod robots;
pub mod security;
pub mod sitemap;

pub use fetcher::RateLimitedFetcher;
pub use parser::Parser;
pub use robots::RobotsChecker;

use std::collections::HashSet;
use std::sync::Arc;
use url::Url;

use crate::lighthouse::LighthouseRunner;
use crate::models::*;
use crate::renderer::JsRenderer;
use crate::storage::StorageClient;

/// High-level crawl engine that ties together the frontier, fetcher, parser,
/// robots checker, lighthouse runner, JS renderer, and storage client.
pub struct CrawlEngine {
    pub fetcher: RateLimitedFetcher,
    pub lighthouse: Option<LighthouseRunner>,
    pub renderer: Option<JsRenderer>,
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
        renderer: Option<JsRenderer>,
        storage: Arc<StorageClient>,
        robots: Option<RobotsChecker>,
        config: CrawlConfig,
        site_context_data: Option<SiteContext>,
    ) -> Self {
        CrawlEngine {
            fetcher,
            lighthouse,
            renderer,
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

        // Upload HTML + run Lighthouse + run JS renderer concurrently
        let html_r2_key = format!("crawls/{}/html/{}.html.gz", job_id, &content_hash[..16]);

        let is_html = is_html_content_type(&fetch_result.headers);

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
        let renderer_fut = async {
            if is_html {
                if let Some(ref renderer) = self.renderer {
                    match renderer.render_links(url).await {
                        Ok(links) => Some(links),
                        Err(e) => {
                            tracing::warn!(url = %url, error = %e, "JS renderer failed");
                            None
                        }
                    }
                } else {
                    None
                }
            } else {
                None
            }
        };

        let (html_result, mut lighthouse_result, rendered_links) =
            tokio::join!(html_upload_fut, lighthouse_fut, renderer_fut);
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

        // Merge static-parsed links with JS-rendered links
        let js_rendered_link_count = rendered_links.as_ref().map(|l| l.len() as u32);
        let (merged_internal, merged_external, merged_external_details) = merge_links(
            &parsed.internal_links,
            &parsed.external_links,
            &parsed.external_link_details,
            rendered_links.as_deref(),
            &fetch_result.final_url,
        );

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
                internal_links: merged_internal,
                external_links: merged_external,
                external_link_details: merged_external_details,
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
            js_rendered_link_count,
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

/// Check if a response's Content-Type header indicates HTML.
fn is_html_content_type(headers: &std::collections::HashMap<String, String>) -> bool {
    headers
        .get("content-type")
        .map(|ct| ct.contains("text/html"))
        .unwrap_or(true) // assume HTML if no content-type
}

/// Schemes that should be filtered out of rendered links.
fn is_navigable_url(url: &str) -> bool {
    !url.starts_with("javascript:")
        && !url.starts_with("mailto:")
        && !url.starts_with("tel:")
        && !url.starts_with("data:")
}

/// Merge static-parsed links with JS-rendered links.
/// Static links are the baseline; rendered links only ADD new URLs.
/// For external link details, static versions are preferred when both have the same URL.
pub fn merge_links(
    static_internal: &[String],
    static_external: &[String],
    static_external_details: &[ExtractedLink],
    rendered: Option<&[crate::renderer::RenderedLink]>,
    page_url: &str,
) -> (Vec<String>, Vec<String>, Vec<ExtractedLink>) {
    let rendered = match rendered {
        Some(links) if !links.is_empty() => links,
        _ => {
            return (
                static_internal.to_vec(),
                static_external.to_vec(),
                static_external_details.to_vec(),
            );
        }
    };

    let page_host = Url::parse(page_url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()));

    let mut internal_set: HashSet<String> = static_internal.iter().cloned().collect();
    let mut external_set: HashSet<String> = static_external.iter().cloned().collect();
    let external_detail_urls: HashSet<String> = static_external_details
        .iter()
        .map(|l| l.url.clone())
        .collect();

    let mut merged_internal = static_internal.to_vec();
    let mut merged_external = static_external.to_vec();
    let mut merged_external_details = static_external_details.to_vec();

    for link in rendered {
        if !is_navigable_url(&link.url) {
            continue;
        }

        let parsed_url = match Url::parse(&link.url) {
            Ok(u) => u,
            Err(_) => continue,
        };

        // Must be http/https
        if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
            continue;
        }

        let link_host = parsed_url.host_str().map(|h| h.to_string());
        let is_internal = match (&page_host, &link_host) {
            (Some(ph), Some(lh)) => ph == lh,
            _ => false,
        };

        let url_str = link.url.clone();
        if is_internal {
            if internal_set.insert(url_str.clone()) {
                merged_internal.push(url_str);
            }
        } else {
            if external_set.insert(url_str.clone()) {
                merged_external.push(url_str.clone());
            }
            // Only add external detail if we don't already have it from static parsing
            if !external_detail_urls.contains(&url_str) {
                merged_external_details.push(ExtractedLink {
                    url: url_str,
                    anchor_text: link.anchor_text.clone(),
                    rel: link.rel.clone(),
                    is_external: true,
                });
            }
        }
    }

    (merged_internal, merged_external, merged_external_details)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::renderer::RenderedLink;

    #[test]
    fn test_is_html_content_type() {
        let mut headers = std::collections::HashMap::new();
        headers.insert(
            "content-type".to_string(),
            "text/html; charset=utf-8".to_string(),
        );
        assert!(is_html_content_type(&headers));

        headers.insert("content-type".to_string(), "application/pdf".to_string());
        assert!(!is_html_content_type(&headers));

        // No content-type → assume HTML
        let empty = std::collections::HashMap::new();
        assert!(is_html_content_type(&empty));
    }

    #[test]
    fn test_merge_links_no_rendered() {
        let internal = vec!["https://example.com/a".to_string()];
        let external = vec!["https://other.com/b".to_string()];
        let details = vec![ExtractedLink {
            url: "https://other.com/b".to_string(),
            anchor_text: "B".to_string(),
            rel: "nofollow".to_string(),
            is_external: true,
        }];

        let (mi, me, md) = merge_links(
            &internal,
            &external,
            &details,
            None,
            "https://example.com/page",
        );
        assert_eq!(mi, internal);
        assert_eq!(me, external);
        assert_eq!(md.len(), 1);
    }

    #[test]
    fn test_merge_links_dedup() {
        let internal = vec!["https://example.com/a".to_string()];
        let external = vec![];
        let details = vec![];

        // Rendered has the same internal link — should not duplicate
        let rendered = vec![RenderedLink {
            url: "https://example.com/a".to_string(),
            anchor_text: "A".to_string(),
            rel: "".to_string(),
        }];

        let (mi, me, _md) = merge_links(
            &internal,
            &external,
            &details,
            Some(&rendered),
            "https://example.com/page",
        );
        assert_eq!(mi.len(), 1);
        assert_eq!(me.len(), 0);
    }

    #[test]
    fn test_merge_links_js_only_external() {
        let internal = vec![];
        let external = vec![];
        let details = vec![];

        let rendered = vec![RenderedLink {
            url: "https://other.com/new".to_string(),
            anchor_text: "New".to_string(),
            rel: "".to_string(),
        }];

        let (mi, me, md) = merge_links(
            &internal,
            &external,
            &details,
            Some(&rendered),
            "https://example.com/page",
        );
        assert_eq!(mi.len(), 0);
        assert_eq!(me, vec!["https://other.com/new".to_string()]);
        assert_eq!(md.len(), 1);
        assert_eq!(md[0].anchor_text, "New");
        assert!(md[0].is_external);
    }

    #[test]
    fn test_merge_links_js_adds_new_internal() {
        let internal = vec!["https://example.com/a".to_string()];
        let external = vec![];
        let details = vec![];

        let rendered = vec![
            RenderedLink {
                url: "https://example.com/a".to_string(),
                anchor_text: "A".to_string(),
                rel: "".to_string(),
            },
            RenderedLink {
                url: "https://example.com/b".to_string(),
                anchor_text: "B".to_string(),
                rel: "".to_string(),
            },
        ];

        let (mi, _me, _md) = merge_links(
            &internal,
            &external,
            &details,
            Some(&rendered),
            "https://example.com/page",
        );
        assert_eq!(mi.len(), 2);
        assert!(mi.contains(&"https://example.com/a".to_string()));
        assert!(mi.contains(&"https://example.com/b".to_string()));
    }

    #[test]
    fn test_merge_links_filters_non_http() {
        let internal = vec![];
        let external = vec![];
        let details = vec![];

        let rendered = vec![
            RenderedLink {
                url: "javascript:void(0)".to_string(),
                anchor_text: "".to_string(),
                rel: "".to_string(),
            },
            RenderedLink {
                url: "mailto:user@example.com".to_string(),
                anchor_text: "".to_string(),
                rel: "".to_string(),
            },
            RenderedLink {
                url: "tel:+1234567890".to_string(),
                anchor_text: "".to_string(),
                rel: "".to_string(),
            },
            RenderedLink {
                url: "https://example.com/valid".to_string(),
                anchor_text: "Valid".to_string(),
                rel: "".to_string(),
            },
        ];

        let (mi, _me, _md) = merge_links(
            &internal,
            &external,
            &details,
            Some(&rendered),
            "https://example.com/page",
        );
        assert_eq!(mi.len(), 1);
        assert_eq!(mi[0], "https://example.com/valid");
    }

    #[test]
    fn test_merge_links_prefers_static_external_details() {
        let internal = vec![];
        let external = vec!["https://other.com/page".to_string()];
        let details = vec![ExtractedLink {
            url: "https://other.com/page".to_string(),
            anchor_text: "Static anchor".to_string(),
            rel: "nofollow".to_string(),
            is_external: true,
        }];

        // Rendered has the same URL but different anchor/rel
        let rendered = vec![RenderedLink {
            url: "https://other.com/page".to_string(),
            anchor_text: "JS anchor".to_string(),
            rel: "".to_string(),
        }];

        let (_mi, me, md) = merge_links(
            &internal,
            &external,
            &details,
            Some(&rendered),
            "https://example.com/page",
        );
        // External URL list shouldn't duplicate
        assert_eq!(me.len(), 1);
        // Detail should keep the static version (nofollow), not add JS version
        assert_eq!(md.len(), 1);
        assert_eq!(md[0].anchor_text, "Static anchor");
        assert_eq!(md[0].rel, "nofollow");
    }
}
