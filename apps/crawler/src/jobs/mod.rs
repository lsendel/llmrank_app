use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::config::Config;
use crate::crawler::fetcher::RateLimitedFetcher;
use crate::crawler::frontier::Frontier;
use crate::crawler::robots::RobotsChecker;
use crate::crawler::{CrawlEngine, CrawlEngineError};
use crate::lighthouse::LighthouseRunner;
use crate::models::*;
use crate::renderer::JsRenderer;
use crate::storage::{StorageClient, StorageConfig};

type HmacSha256 = Hmac<Sha256>;

/// Matches the API's backlinks ingestion payload shape.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct BacklinkEntry {
    source_url: String,
    source_domain: String,
    target_url: String,
    target_domain: String,
    anchor_text: String,
    rel: String,
}

/// Collect all external link details from a batch of pages into BacklinkEntry list.
fn collect_backlink_entries(pages: &[CrawlPageResult]) -> Vec<BacklinkEntry> {
    let mut entries = Vec::new();
    for page in pages {
        let source_domain = CrawlEngine::domain_from_url(&page.url).unwrap_or_default();
        for link in &page.extracted.external_link_details {
            let target_domain = CrawlEngine::domain_from_url(&link.url).unwrap_or_default();
            if target_domain.is_empty() {
                continue;
            }
            entries.push(BacklinkEntry {
                source_url: page.url.clone(),
                source_domain: source_domain.clone(),
                target_url: link.url.clone(),
                target_domain,
                anchor_text: link.anchor_text.clone(),
                rel: link.rel.clone(),
            });
        }
    }
    entries
}

/// Internal state for a running or completed job.
#[derive(Debug)]
struct JobEntry {
    status: JobStatusKind,
    stats: Option<CrawlStats>,
    cancel_token: CancellationToken,
}

/// Manages crawl job lifecycle: submission, status queries, and cancellation.
#[derive(Debug)]
pub struct JobManager {
    _config: Arc<Config>,
    jobs: Arc<RwLock<HashMap<String, Arc<Mutex<JobEntry>>>>>,
    tx: mpsc::Sender<CrawlJobPayload>,
}

impl JobManager {
    /// Create a new JobManager.
    /// Spawns a background task that processes incoming jobs from the mpsc channel.
    pub fn new(config: Arc<Config>) -> Self {
        let (tx, rx) = mpsc::channel::<CrawlJobPayload>(64);
        let jobs: Arc<RwLock<HashMap<String, Arc<Mutex<JobEntry>>>>> =
            Arc::new(RwLock::new(HashMap::new()));

        let manager = JobManager {
            _config: config.clone(),
            jobs: jobs.clone(),
            tx,
        };

        // Spawn the consumer loop
        tokio::spawn(Self::process_loop(rx, jobs, config));

        manager
    }

    /// Submit a new crawl job. Returns the job_id.
    pub async fn submit(&self, payload: CrawlJobPayload) -> String {
        let job_id = payload.job_id.clone();

        let entry = Arc::new(Mutex::new(JobEntry {
            status: JobStatusKind::Queued,
            stats: None,
            cancel_token: CancellationToken::new(),
        }));

        self.jobs.write().await.insert(job_id.clone(), entry);

        if let Err(e) = self.tx.send(payload).await {
            tracing::error!("Failed to enqueue job: {}", e);
        }

        job_id
    }

    /// Cancel a running job by its ID.
    pub async fn cancel(&self, job_id: &str) {
        let jobs = self.jobs.read().await;
        if let Some(entry) = jobs.get(job_id) {
            let mut e = entry.lock().await;
            e.cancel_token.cancel();
            e.status = JobStatusKind::Cancelled;
        }
    }

    /// Get the current status of a job.
    pub async fn status(&self, job_id: &str) -> JobStatus {
        let jobs = self.jobs.read().await;
        if let Some(entry) = jobs.get(job_id) {
            let e = entry.lock().await;
            JobStatus {
                job_id: job_id.to_string(),
                status: e.status,
                stats: e.stats.clone(),
            }
        } else {
            JobStatus {
                job_id: job_id.to_string(),
                status: JobStatusKind::Pending,
                stats: None,
            }
        }
    }

    /// Background loop that takes jobs off the channel and spawns a task for each.
    async fn process_loop(
        mut rx: mpsc::Receiver<CrawlJobPayload>,
        jobs: Arc<RwLock<HashMap<String, Arc<Mutex<JobEntry>>>>>,
        config: Arc<Config>,
    ) {
        while let Some(payload) = rx.recv().await {
            let job_id = payload.job_id.clone();
            let jobs_clone = jobs.clone();
            let config_clone = config.clone();

            // Get the job entry (created during submit)
            let entry = {
                let map = jobs.read().await;
                match map.get(&job_id) {
                    Some(e) => e.clone(),
                    None => continue,
                }
            };

            tokio::spawn(async move {
                Self::run_crawl_job(payload, entry, config_clone).await;

                // Clean up is not needed -- we keep the entry for status queries.
                let _ = jobs_clone;
            });
        }
    }

    /// Execute the actual crawl job with concurrent page workers.
    async fn run_crawl_job(
        payload: CrawlJobPayload,
        entry: Arc<Mutex<JobEntry>>,
        config: Arc<Config>,
    ) {
        let cancel_token = {
            let e = entry.lock().await;
            e.cancel_token.clone()
        };

        // Mark as crawling
        {
            let mut e = entry.lock().await;
            e.status = JobStatusKind::Crawling;
        }

        let job_start = Instant::now();
        let crawl_config = payload.config.clone();

        // Set up components
        let rate_per_sec = if crawl_config.rate_limit_ms > 0 {
            (1000 / crawl_config.rate_limit_ms).max(1)
        } else {
            2
        };

        let fetcher = RateLimitedFetcher::new(
            rate_per_sec,
            crawl_config.timeout_s as u64,
            &crawl_config.user_agent,
        );

        let lighthouse_runner = if crawl_config.run_lighthouse {
            Some(LighthouseRunner::new(
                config.max_concurrent_lighthouse,
                Some(config.api_base_url.clone()),
            ))
        } else {
            None
        };

        let js_renderer = if crawl_config.run_js_render {
            Some(JsRenderer::new(
                config.max_concurrent_renderers,
                config.renderer_script_path.clone(),
            ))
        } else {
            None
        };

        let storage = Arc::new(StorageClient::new(StorageConfig {
            endpoint: config.r2_endpoint.clone(),
            access_key: config.r2_access_key.clone(),
            secret_key: config.r2_secret_key.clone(),
            bucket: config.r2_bucket.clone(),
        }));

        // Determine domain from first seed URL for robots check
        let domain = crawl_config
            .seed_urls
            .first()
            .and_then(|u| Url::parse(u).ok())
            .and_then(|u| u.host_str().map(|h| h.to_string()));

        // Initialize SiteContext data
        let mut site_context = SiteContext {
            has_llms_txt: false,
            ai_crawlers_blocked: Vec::new(),
            has_sitemap: false,
            sitemap_analysis: None,
            content_hashes: HashMap::new(),
            response_time_ms: None,
            page_size_bytes: None,
        };

        // Always fetch robots.txt for sitemap discovery and bot analysis.
        // Only use it for URL blocking when respect_robots is true.
        let mut sitemap_urls_from_robots: Vec<String> = Vec::new();
        let robots = if let Some(ref d) = domain {
            match RobotsChecker::new(d).await {
                Ok(checker) => {
                    site_context.ai_crawlers_blocked = checker.blocked_bots("/");
                    sitemap_urls_from_robots = checker.sitemaps.clone();
                    if crawl_config.respect_robots {
                        Some(checker)
                    } else {
                        None
                    }
                }
                Err(_) => None,
            }
        } else {
            None
        };

        // Fetch and parse sitemaps discovered in robots.txt
        if !sitemap_urls_from_robots.is_empty() {
            if let Some(ref d) = domain {
                let sitemap_result = crate::crawler::sitemap::fetch_sitemap_urls(
                    &sitemap_urls_from_robots,
                    d,
                    5, // max child sitemaps to fetch from index
                )
                .await;

                tracing::info!(
                    job_id = %payload.job_id,
                    sitemap_urls = sitemap_result.urls.len(),
                    total_in_sitemap = sitemap_result.total_count,
                    "Sitemap discovery complete"
                );

                site_context.has_sitemap = true;
                site_context.sitemap_analysis = Some(SitemapAnalysis {
                    is_valid: true,
                    url_count: sitemap_result.total_count,
                    stale_url_count: 0,
                    discovered_page_count: sitemap_result.urls.len() as u32,
                });

                // Filter sitemap URLs through robots.txt if applicable
                let sitemap_seed_urls: Vec<String> = if let Some(ref checker) = robots {
                    sitemap_result
                        .urls
                        .into_iter()
                        .filter(|u| checker.is_allowed(u, &crawl_config.user_agent))
                        .collect()
                } else {
                    sitemap_result.urls
                };

                // These will be added to the frontier below
                sitemap_urls_from_robots = sitemap_seed_urls;
            }
        }

        // Check llms.txt
        if crawl_config.check_llms_txt {
            if let Some(ref d) = domain {
                if crate::crawler::robots::fetch_llms_txt(d).await.is_some() {
                    site_context.has_llms_txt = true;
                }
            }
        }

        // Initialize CrawlEngine wrapped in Arc for sharing across workers
        let engine = Arc::new(CrawlEngine::new(
            fetcher,
            lighthouse_runner,
            js_renderer,
            storage,
            robots,
            crawl_config.clone(),
            Some(site_context),
        ));

        // Reuse a single HTTP client for all callbacks
        let callback_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build callback client");

        // Initialize frontier with seed URLs + sitemap-discovered URLs
        let mut frontier = Frontier::new(&crawl_config.seed_urls, crawl_config.max_depth);
        if !sitemap_urls_from_robots.is_empty() {
            let cap = crawl_config.max_pages as usize;
            let to_add: Vec<String> = sitemap_urls_from_robots.into_iter().take(cap).collect();
            tracing::info!(
                job_id = %payload.job_id,
                added = to_add.len(),
                "Adding sitemap URLs to frontier"
            );
            frontier.add_discovered(&to_add, 0);
        }
        let max_workers = config.max_concurrent_fetches;

        let mut pages_crawled: u32 = 0;
        let mut pages_errored: u32 = 0;
        let mut batch_pages: Vec<CrawlPageResult> = Vec::new();
        let mut batch_index: u32 = 0;
        let mut last_batch_time = Instant::now();
        let mut join_set: JoinSet<(String, u32, Result<CrawlPageResult, CrawlEngineError>)> =
            JoinSet::new();

        loop {
            // Fill worker slots from the frontier
            while join_set.len() < max_workers {
                // Don't exceed max pages (count in-flight tasks too)
                if pages_crawled + join_set.len() as u32 >= crawl_config.max_pages {
                    break;
                }
                if let Some((url, depth)) = frontier.next() {
                    let eng = engine.clone();
                    let jid = payload.job_id.clone();
                    join_set.spawn(async move {
                        let result = eng.crawl_page(&url, &jid).await;
                        (url, depth, result)
                    });
                } else {
                    break;
                }
            }

            // No more work: frontier empty and all workers finished
            if join_set.is_empty() {
                break;
            }

            // Wait for the next worker to finish, or cancellation
            tokio::select! {
                biased;
                _ = cancel_token.cancelled() => {
                    tracing::info!(job_id = %payload.job_id, "Job cancelled");
                    join_set.abort_all();
                    break;
                }
                Some(result) = join_set.join_next() => {
                    match result {
                        Ok((_url, depth, Ok(page_result))) => {
                            if crawl_config.extract_links {
                                frontier.add_discovered(
                                    &page_result.extracted.internal_links,
                                    depth + 1,
                                );
                            }
                            batch_pages.push(page_result);
                            pages_crawled += 1;
                        }
                        Ok((_url, _, Err(CrawlEngineError::BlockedByRobots(u)))) => {
                            tracing::debug!(url = %u, "Blocked by robots.txt");
                        }
                        Ok((url, _, Err(e))) => {
                            tracing::warn!(url = %url, error = %e, "Crawl failed");
                            pages_errored += 1;
                        }
                        Err(e) => {
                            tracing::error!("Worker task panicked: {}", e);
                            pages_errored += 1;
                        }
                    }

                    // Update stats
                    {
                        let mut e = entry.lock().await;
                        e.stats = Some(CrawlStats {
                            pages_found: frontier.pending_count() as u32
                                + pages_crawled
                                + pages_errored,
                            pages_crawled,
                            pages_errored,
                            elapsed_s: job_start.elapsed().as_secs_f64(),
                        });
                    }

                    let should_send_batch =
                        batch_pages.len() >= config.batch_page_threshold
                            || last_batch_time.elapsed().as_secs() >= config.batch_interval_secs;

                    if should_send_batch && !batch_pages.is_empty() {
                        let batch = CrawlResultBatch {
                            job_id: payload.job_id.clone(),
                            batch_index,
                            is_final: false,
                            pages: std::mem::take(&mut batch_pages),
                            stats: CrawlStats {
                                pages_found: frontier.pending_count() as u32
                                    + pages_crawled
                                    + pages_errored,
                                pages_crawled,
                                pages_errored,
                                elapsed_s: job_start.elapsed().as_secs_f64(),
                            },
                        };

                        Self::send_callback(
                            &callback_client,
                            &payload.callback_url,
                            &batch,
                            &config.shared_secret,
                        )
                        .await;

                        // POST external links to backlinks ingestion endpoint
                        let backlink_entries = collect_backlink_entries(&batch.pages);
                        Self::send_backlinks(
                            &callback_client,
                            &config.api_base_url,
                            backlink_entries,
                            &config.shared_secret,
                        )
                        .await;

                        batch_index += 1;
                        last_batch_time = Instant::now();
                    }
                }
            }
        }

        // Send final batch
        let final_stats = CrawlStats {
            pages_found: frontier.pending_count() as u32 + pages_crawled + pages_errored,
            pages_crawled,
            pages_errored,
            elapsed_s: job_start.elapsed().as_secs_f64(),
        };

        let final_batch = CrawlResultBatch {
            job_id: payload.job_id.clone(),
            batch_index,
            is_final: true,
            pages: batch_pages,
            stats: final_stats.clone(),
        };

        Self::send_callback(
            &callback_client,
            &payload.callback_url,
            &final_batch,
            &config.shared_secret,
        )
        .await;

        // POST final batch backlinks
        let backlink_entries = collect_backlink_entries(&final_batch.pages);
        Self::send_backlinks(
            &callback_client,
            &config.api_base_url,
            backlink_entries,
            &config.shared_secret,
        )
        .await;

        // Update final status
        {
            let mut e = entry.lock().await;
            if e.status != JobStatusKind::Cancelled {
                e.status = JobStatusKind::Complete;
            }
            e.stats = Some(final_stats);
        }

        tracing::info!(
            job_id = %payload.job_id,
            pages_crawled = pages_crawled,
            pages_errored = pages_errored,
            elapsed_s = job_start.elapsed().as_secs_f64(),
            "Crawl job complete"
        );
    }

    /// POST a CrawlResultBatch to the callback URL with HMAC-SHA256 authentication.
    /// Accepts a pre-built client to reuse TCP connections across batches.
    async fn send_callback(
        client: &reqwest::Client,
        callback_url: &str,
        batch: &CrawlResultBatch,
        secret: &str,
    ) {
        let body = match serde_json::to_string(batch) {
            Ok(b) => b,
            Err(e) => {
                tracing::error!("Failed to serialize batch: {}", e);
                return;
            }
        };

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string();

        // Compute HMAC-SHA256(timestamp + body)
        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        mac.update(timestamp.as_bytes());
        mac.update(body.as_bytes());
        let signature = format!("hmac-sha256={}", hex::encode(mac.finalize().into_bytes()));

        match client
            .post(callback_url)
            .header("Content-Type", "application/json")
            .header("X-Timestamp", &timestamp)
            .header("X-Signature", &signature)
            .body(body)
            .send()
            .await
        {
            Ok(resp) => {
                tracing::info!(
                    status = resp.status().as_u16(),
                    batch_index = batch.batch_index,
                    is_final = batch.is_final,
                    "Callback sent"
                );
            }
            Err(e) => {
                tracing::error!(
                    error = %e,
                    batch_index = batch.batch_index,
                    "Failed to send callback"
                );
            }
        }
    }

    /// POST discovered external links to the backlinks ingestion endpoint.
    /// Fire-and-forget: logs errors but does not fail the crawl job.
    async fn send_backlinks(
        client: &reqwest::Client,
        api_base_url: &str,
        links: Vec<BacklinkEntry>,
        secret: &str,
    ) {
        if links.is_empty() {
            return;
        }

        let link_count = links.len();
        let url = format!(
            "{}/api/backlinks/ingest",
            api_base_url.trim_end_matches('/')
        );

        let payload = serde_json::json!({
            "links": links
        });

        let body = match serde_json::to_string(&payload) {
            Ok(b) => b,
            Err(e) => {
                tracing::error!("Failed to serialize backlinks payload: {}", e);
                return;
            }
        };

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string();

        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        mac.update(timestamp.as_bytes());
        mac.update(body.as_bytes());
        let signature = format!("hmac-sha256={}", hex::encode(mac.finalize().into_bytes()));

        match client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("X-Timestamp", &timestamp)
            .header("X-Signature", &signature)
            .body(body)
            .send()
            .await
        {
            Ok(resp) => {
                tracing::info!(
                    status = resp.status().as_u16(),
                    link_count = link_count,
                    "Backlinks POST sent"
                );
            }
            Err(e) => {
                tracing::warn!(error = %e, "Failed to POST backlinks (non-fatal)");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ExtractedData, ExtractedLink};

    fn make_page(url: &str, external_links: Vec<ExtractedLink>) -> CrawlPageResult {
        CrawlPageResult {
            url: url.to_string(),
            status_code: 200,
            title: None,
            meta_description: None,
            canonical_url: None,
            word_count: 0,
            content_hash: "abc".to_string(),
            html_r2_key: "key".to_string(),
            extracted: ExtractedData {
                h1: vec![],
                h2: vec![],
                h3: vec![],
                h4: vec![],
                h5: vec![],
                h6: vec![],
                schema_types: vec![],
                internal_links: vec![],
                external_links: vec![],
                external_link_details: external_links,
                images_without_alt: 0,
                has_robots_meta: false,
                robots_directives: vec![],
                og_tags: None,
                structured_data: None,
                flesch_score: None,
                flesch_classification: None,
                text_html_ratio: None,
                text_length: None,
                html_length: None,
                pdf_links: vec![],
                cors_unsafe_blank_links: 0,
                cors_mixed_content: 0,
                cors_has_issues: false,
                sentence_length_variance: None,
                top_transition_words: vec![],
            },
            lighthouse: None,
            js_rendered_link_count: None,
            site_context: None,
            timing_ms: 100,
            redirect_chain: vec![],
        }
    }

    #[test]
    fn test_collect_backlink_entries() {
        let pages = vec![make_page(
            "https://example.com/blog/post",
            vec![
                ExtractedLink {
                    url: "https://competitor.com/product".to_string(),
                    anchor_text: "check this out".to_string(),
                    rel: "nofollow".to_string(),
                    is_external: true,
                },
                ExtractedLink {
                    url: "https://reference.org/docs".to_string(),
                    anchor_text: "documentation".to_string(),
                    rel: "".to_string(),
                    is_external: true,
                },
            ],
        )];

        let entries = collect_backlink_entries(&pages);
        assert_eq!(entries.len(), 2);

        assert_eq!(entries[0].source_url, "https://example.com/blog/post");
        assert_eq!(entries[0].source_domain, "example.com");
        assert_eq!(entries[0].target_url, "https://competitor.com/product");
        assert_eq!(entries[0].target_domain, "competitor.com");
        assert_eq!(entries[0].anchor_text, "check this out");
        assert_eq!(entries[0].rel, "nofollow");

        assert_eq!(entries[1].target_domain, "reference.org");
        assert_eq!(entries[1].rel, "");
    }

    #[test]
    fn test_collect_backlink_entries_skips_invalid_urls() {
        let pages = vec![make_page(
            "https://example.com/page",
            vec![ExtractedLink {
                url: "not-a-valid-url".to_string(),
                anchor_text: "bad".to_string(),
                rel: "".to_string(),
                is_external: true,
            }],
        )];

        let entries = collect_backlink_entries(&pages);
        assert_eq!(entries.len(), 0); // Skipped because domain_from_url returns empty
    }
}
