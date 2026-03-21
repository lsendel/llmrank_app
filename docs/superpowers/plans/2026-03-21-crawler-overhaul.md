# Crawler Overhaul — 28 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Rust crawler with 28 improvements across parallelization, reliability, discovery, data quality, and operations.

**Architecture:** The crawler is an Axum HTTP server on Fly.io. Jobs arrive via HMAC-authenticated POST, get queued via mpsc, and processed with concurrent Tokio tasks. Pages are fetched with per-domain rate limiting, parsed for content/links, optionally Lighthouse-audited and JS-rendered, then batched back to the Cloudflare Workers API via HMAC-signed callbacks. Changes are incremental — each task modifies specific files without breaking the existing flow.

**Tech Stack:** Rust (Axum, Tokio, reqwest, governor, scraper), Node.js (Lighthouse, JS renderer), Fly.io deployment

**Key files:**

- `apps/crawler/src/jobs/mod.rs` — Job lifecycle, batching, worker loop (746 lines)
- `apps/crawler/src/crawler/fetcher.rs` — HTTP client with per-domain rate limiting (133 lines)
- `apps/crawler/src/crawler/frontier.rs` — BFS URL queue with dedup (215 lines)
- `apps/crawler/src/crawler/robots.rs` — robots.txt parser (267 lines)
- `apps/crawler/src/crawler/sitemap.rs` — Sitemap fetcher/parser (190 lines)
- `apps/crawler/src/crawler/parser.rs` — HTML extraction (537 lines)
- `apps/crawler/src/crawler/mod.rs` — CrawlEngine orchestrator
- `apps/crawler/src/server/routes.rs` — HTTP handlers (77 lines)
- `apps/crawler/src/config.rs` — Environment config (108 lines)
- `apps/crawler/src/models.rs` — Data models (220 lines)
- `apps/crawler/Cargo.toml` — Dependencies

**Execution mode:** YOLO — execute all tasks sequentially without confirmation. `cargo check` after each task, `cargo test` after test-related tasks, single commit per task group.

---

## Task 1: Concurrent Sitemap Fetching (Item #1)

**Files:**

- Modify: `apps/crawler/src/crawler/sitemap.rs`

- [ ] **Step 1: Replace sequential child sitemap fetching with parallel using FuturesUnordered**

In `fetch_sitemap_urls`, the child sitemap loop is currently:

```rust
for child_url in &child_urls {
    if let Some(child_xml) = fetch_xml(&client, child_url).await {
        extract_locs(&loc_re, &child_xml, &mut all_urls);
    }
}
```

Replace with parallel fetch using `futures::stream::FuturesUnordered`:

```rust
use futures::stream::{FuturesUnordered, StreamExt};

// Inside the sitemapindex branch:
let mut futures: FuturesUnordered<_> = child_urls
    .iter()
    .map(|url| {
        let client = client.clone();
        let url = url.clone();
        async move { fetch_xml(&client, &url).await }
    })
    .collect();

while let Some(result) = futures.next().await {
    if let Some(child_xml) = result {
        extract_locs(&loc_re, &child_xml, &mut all_urls);
    }
}
```

Also parallelize the top-level loop over `sitemap_urls` the same way — fetch all robots.txt-declared sitemaps concurrently.

- [ ] **Step 2: Add `futures` dependency to Cargo.toml**

```toml
futures = "0.3"
```

- [ ] **Step 3: Run `cargo check` and `cargo test`**

Run: `cd apps/crawler && cargo check && cargo test`
Expected: All compile, existing sitemap tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/crawler/src/crawler/sitemap.rs apps/crawler/Cargo.toml
git commit -m "perf: parallelize sitemap fetching with FuturesUnordered"
```

---

## Task 2: HTTP/2, DNS Cache, Connection Pooling (Items #3, #4, #8)

**Files:**

- Modify: `apps/crawler/src/crawler/fetcher.rs`
- Modify: `apps/crawler/Cargo.toml`

- [ ] **Step 1: Enable HTTP/2 and trust-dns resolver in reqwest**

In `Cargo.toml`, change reqwest features:

```toml
reqwest = { version = "0.13", features = ["json", "gzip", "hickory-dns"] }
```

The `hickory-dns` feature enables async DNS resolution with built-in caching. reqwest already supports HTTP/2 by default (via hyper h2), and `pool_max_idle_per_host(20)` already provides connection pooling. Adding hickory-dns adds DNS caching.

- [ ] **Step 2: Run `cargo check`**

Run: `cd apps/crawler && cargo check`
Expected: Compiles with new DNS resolver.

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/Cargo.toml
git commit -m "perf: enable DNS caching via hickory-dns resolver"
```

---

## Task 3: Adaptive Rate Limiting (Item #7)

**Files:**

- Modify: `apps/crawler/src/crawler/fetcher.rs`

- [ ] **Step 1: Add adaptive rate limiting that backs off on 429/503 and speeds up on success**

Add fields to `RateLimitedFetcher`:

```rust
pub struct RateLimitedFetcher {
    client: Client,
    domain_limiters: Arc<RwLock<HashMap<String, Arc<DomainLimiter>>>>,
    rate_per_second: u32,
    /// Track consecutive successes per domain to adaptively increase rate
    domain_stats: Arc<RwLock<HashMap<String, DomainStats>>>,
}

struct DomainStats {
    consecutive_successes: u32,
    current_rate: u32,
    backoff_until: Option<tokio::time::Instant>,
}
```

In `fetch()`, after getting the response:

- On 429 or 503: set `backoff_until` to `Instant::now() + Duration::from_secs(5 * 2^failures)`, cap at 60s. Reset `consecutive_successes`.
- On success: increment `consecutive_successes`. Every 20 consecutive successes, increase `current_rate` by 1 (up to `rate_per_second * 3`).
- Before fetching: check `backoff_until`; if set and in the future, `tokio::time::sleep_until` it.

- [ ] **Step 2: Run `cargo check`**

Run: `cd apps/crawler && cargo check`

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/crawler/fetcher.rs
git commit -m "perf: adaptive rate limiting with backoff on 429/503"
```

---

## Task 4: Retry with Exponential Backoff (Item #9)

**Files:**

- Modify: `apps/crawler/src/crawler/fetcher.rs`

- [ ] **Step 1: Add retry logic to `fetch()` method**

Wrap the fetch call in a retry loop (max 3 attempts):

```rust
pub async fn fetch(&self, url: &str) -> Result<FetchResult, FetchError> {
    let domain = /* ... existing domain extraction ... */;
    let limiter = self.get_limiter(&domain).await;

    let max_retries = 3u32;
    let mut last_error = None;

    for attempt in 0..max_retries {
        if attempt > 0 {
            let delay = Duration::from_millis(500 * 2u64.pow(attempt - 1));
            tokio::time::sleep(delay).await;
            tracing::debug!(url = %url, attempt, "Retrying fetch");
        }

        limiter.until_ready().await;

        match self.client.get(url).send().await {
            Ok(response) => {
                let status_code = response.status().as_u16();
                // Don't retry client errors (4xx) except 429
                if status_code >= 400 && status_code < 500 && status_code != 429 {
                    // Return as-is (4xx is a valid result, not a retry-able error)
                }
                // Retry on 429 and 5xx
                if (status_code == 429 || status_code >= 500) && attempt < max_retries - 1 {
                    tracing::warn!(url = %url, status = status_code, "Retryable status");
                    last_error = Some(FetchError::RequestFailed(
                        reqwest::Error::from(/* ... */)));
                    continue;
                }
                // Build and return FetchResult with headers, body, etc.
                /* ... existing response parsing ... */
                return Ok(result);
            }
            Err(e) => {
                if attempt < max_retries - 1 && (e.is_timeout() || e.is_connect()) {
                    tracing::warn!(url = %url, error = %e, attempt, "Retryable error");
                    last_error = Some(FetchError::RequestFailed(e));
                    continue;
                }
                return Err(FetchError::RequestFailed(e));
            }
        }
    }

    Err(last_error.unwrap_or(FetchError::RateLimitError))
}
```

Note: For 429/5xx retries, capture the response body and headers before deciding to retry. If it's the last attempt, return the response as a `FetchResult` with the error status code rather than discarding it.

- [ ] **Step 2: Run `cargo check` and `cargo test`**

Run: `cd apps/crawler && cargo check && cargo test`

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/crawler/fetcher.rs
git commit -m "feat: retry with exponential backoff on timeout/5xx/429"
```

---

## Task 5: Circuit Breaker (Item #10)

**Files:**

- Create: `apps/crawler/src/crawler/circuit_breaker.rs`
- Modify: `apps/crawler/src/crawler/mod.rs` (add `pub mod circuit_breaker;`)
- Modify: `apps/crawler/src/crawler/fetcher.rs`

- [ ] **Step 1: Create circuit breaker module**

```rust
// apps/crawler/src/crawler/circuit_breaker.rs
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::Instant;

#[derive(Debug, Clone)]
enum State {
    Closed,
    Open { until: Instant },
    HalfOpen,
}

#[derive(Debug, Clone)]
struct DomainCircuit {
    state: State,
    failure_count: u32,
}

pub struct CircuitBreaker {
    circuits: Arc<RwLock<HashMap<String, DomainCircuit>>>,
    failure_threshold: u32,   // e.g., 5
    recovery_timeout_secs: u64, // e.g., 30
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, recovery_timeout_secs: u64) -> Self { /* ... */ }

    /// Returns true if the domain is allowed (circuit closed or half-open).
    pub async fn is_allowed(&self, domain: &str) -> bool { /* ... */ }

    /// Record a success — resets failure count, closes circuit.
    pub async fn record_success(&self, domain: &str) { /* ... */ }

    /// Record a failure — increments count, opens circuit at threshold.
    pub async fn record_failure(&self, domain: &str) { /* ... */ }
}
```

- [ ] **Step 2: Integrate into fetcher — check circuit before fetch, record success/failure after**

In `RateLimitedFetcher`, add `circuit_breaker: Arc<CircuitBreaker>` field. In `fetch()`:

```rust
if !self.circuit_breaker.is_allowed(&domain).await {
    return Err(FetchError::CircuitOpen);
}
// ... existing fetch logic ...
// On success: self.circuit_breaker.record_success(&domain).await;
// On failure: self.circuit_breaker.record_failure(&domain).await;
```

Add `CircuitOpen` variant to `FetchError`.

- [ ] **Step 3: Register module in `crawler/mod.rs`**

Add: `pub mod circuit_breaker;`

- [ ] **Step 4: Run `cargo check`**

- [ ] **Step 5: Commit**

```bash
git add apps/crawler/src/crawler/circuit_breaker.rs apps/crawler/src/crawler/mod.rs apps/crawler/src/crawler/fetcher.rs
git commit -m "feat: circuit breaker per domain — open after 5 consecutive failures"
```

---

## Task 6: Graceful Timeout Handling (Item #11)

**Files:**

- Modify: `apps/crawler/src/crawler/fetcher.rs`

- [ ] **Step 1: Classify errors by type in FetchError**

```rust
#[derive(Error, Debug)]
pub enum FetchError {
    #[error("DNS resolution failed: {0}")]
    DnsError(String),
    #[error("Connection failed: {0}")]
    ConnectionError(String),
    #[error("Request timed out: {0}")]
    TimeoutError(String),
    #[error("Request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),
    #[error("Rate limiter error")]
    RateLimitError,
    #[error("Circuit breaker open for domain")]
    CircuitOpen,
}
```

In the retry loop's `Err(e)` branch, classify:

```rust
Err(e) => {
    let classified = if e.is_timeout() {
        FetchError::TimeoutError(e.to_string())
    } else if e.is_connect() {
        FetchError::ConnectionError(e.to_string())
    } else if format!("{e}").contains("dns") || format!("{e}").contains("resolve") {
        FetchError::DnsError(e.to_string())
    } else {
        FetchError::RequestFailed(e)
    };
    // ... retry or return classified
}
```

- [ ] **Step 2: Log the classified error type in jobs/mod.rs when crawl_page returns Err**

- [ ] **Step 3: Run `cargo check`**

- [ ] **Step 4: Commit**

```bash
git add apps/crawler/src/crawler/fetcher.rs apps/crawler/src/jobs/mod.rs
git commit -m "feat: classify fetch errors — DNS, connection, timeout for better diagnostics"
```

---

## Task 7: robots.txt `Allow:` Directive Support (Item #22)

**Files:**

- Modify: `apps/crawler/src/crawler/robots.rs`

- [ ] **Step 1: Add `Allow` parsing and precedence logic**

Change `rules` from `HashMap<String, Vec<String>>` to:

```rust
struct RobotsRule {
    path: String,
    allow: bool,
}

// rules: HashMap<String, Vec<RobotsRule>>
```

In `parse_robots_txt`, handle `"allow"` key:

```rust
"allow" => {
    for agent in &current_agents {
        rules.entry(agent.clone()).or_default().push(RobotsRule {
            path: value.to_string(),
            allow: true,
        });
    }
}
"disallow" => {
    for agent in &current_agents {
        rules.entry(agent.clone()).or_default().push(RobotsRule {
            path: value.to_string(),
            allow: false,
        });
    }
}
```

In `is_allowed`, use longest-match precedence (standard robots.txt spec):

```rust
// Find the longest matching rule
let mut best_match: Option<&RobotsRule> = None;
for rule in rules {
    if rule.path.is_empty() { continue; }
    if path.starts_with(&rule.path) {
        if best_match.is_none() || rule.path.len() > best_match.unwrap().path.len() {
            best_match = Some(rule);
        }
    }
}
match best_match {
    Some(rule) => rule.allow,
    None => true, // default allow
}
```

- [ ] **Step 2: Add tests for Allow directive**

```rust
#[test]
fn test_allow_overrides_disallow() {
    let content = "User-agent: *\nDisallow: /private/\nAllow: /private/public\n";
    let checker = RobotsChecker::from_content(content);
    assert!(!checker.is_allowed("https://example.com/private/secret", "*"));
    assert!(checker.is_allowed("https://example.com/private/public", "*"));
}
```

- [ ] **Step 3: Run `cargo test`**

Run: `cd apps/crawler && cargo test`

- [ ] **Step 4: Commit**

```bash
git add apps/crawler/src/crawler/robots.rs
git commit -m "feat: robots.txt Allow directive with longest-match precedence"
```

---

## Task 8: Dynamic max_child_sitemaps (Item #16) + Recursive Sitemap Index (Item #18)

**Files:**

- Modify: `apps/crawler/src/crawler/sitemap.rs`
- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Make max_child_sitemaps dynamic based on max_pages**

In `jobs/mod.rs`, change the hardcoded value:

```rust
let max_child = (crawl_config.max_pages as usize / 100).max(10).min(100);
let sitemap_result = crate::crawler::sitemap::fetch_sitemap_urls(
    &sitemap_urls_from_robots,
    d,
    max_child,
).await;
```

- [ ] **Step 2: Add recursive sitemap index handling**

In `sitemap.rs`, when processing a child sitemap that is itself a `<sitemapindex>`, recurse (with a depth limit of 3):

Add `max_depth` parameter to `fetch_sitemap_urls` and track current depth. If a child is also a sitemapindex and depth < max_depth, process it recursively.

```rust
pub async fn fetch_sitemap_urls(
    sitemap_urls: &[String],
    seed_domain: &str,
    max_child_sitemaps: usize,
    max_depth: usize, // new parameter, default 3
) -> SitemapResult {
    fetch_sitemap_urls_inner(sitemap_urls, seed_domain, max_child_sitemaps, max_depth, 0).await
}

async fn fetch_sitemap_urls_inner(
    sitemap_urls: &[String],
    seed_domain: &str,
    max_child_sitemaps: usize,
    max_depth: usize,
    current_depth: usize,
) -> SitemapResult { /* ... */ }
```

- [ ] **Step 3: Update call site in jobs/mod.rs to pass depth**

- [ ] **Step 4: Run `cargo check` and `cargo test`**

- [ ] **Step 5: Commit**

```bash
git add apps/crawler/src/crawler/sitemap.rs apps/crawler/src/jobs/mod.rs
git commit -m "feat: dynamic sitemap limits + recursive sitemap index support"
```

---

## Task 9: Concurrent Page Crawling with Backpressure (Item #2)

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs`
- Modify: `apps/crawler/src/config.rs`

- [ ] **Step 1: Increase default concurrent fetches and add semaphore-based backpressure**

In `config.rs`, change default `MAX_CONCURRENT_FETCHES` from `10` to `50`.

In `jobs/mod.rs`, the current pattern uses `JoinSet` with a target concurrency. Verify the existing JoinSet pattern properly bounds concurrency. If it fills the JoinSet up to `max_concurrent_fetches` and only pops from frontier when a slot opens, it's already correct. If not, add a `tokio::sync::Semaphore`:

```rust
let semaphore = Arc::new(tokio::sync::Semaphore::new(config.max_concurrent_fetches));

// In the worker loop:
loop {
    // Wait for a permit
    let permit = semaphore.clone().acquire_owned().await.unwrap();
    if let Some((url, depth)) = frontier.next() {
        let engine = engine.clone();
        join_set.spawn(async move {
            let result = engine.crawl_page(&url, &job_id).await;
            drop(permit); // release after completion
            (url, depth, result)
        });
    } else if join_set.is_empty() {
        break;
    } else {
        // Wait for a task to complete before checking frontier again
        if let Some(result) = join_set.join_next().await { /* process */ }
    }
}
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs apps/crawler/src/config.rs
git commit -m "perf: increase concurrent fetches to 50 with semaphore backpressure"
```

---

## Task 10: Batch Callback Chunking (Item #5) + Pipeline Scoring (Item #6)

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs`

These are already partially implemented — batches are sent when `batch_pages.len() >= threshold (25)` OR `time >= 15s`. The current implementation already streams results in chunks. The improvement is:

- [ ] **Step 1: Reduce batch threshold for faster pipeline start**

Change defaults in `config.rs`: `BATCH_PAGE_THRESHOLD` from 25 to 10, `BATCH_INTERVAL_SECS` from 15 to 10. This means the API starts scoring sooner.

- [ ] **Step 2: Ensure batches include `site_context` on every batch, not just the first**

In the batch construction in `jobs/mod.rs`, attach the `site_context` to every `CrawlPageResult` in the batch (it's site-level data the API needs for scoring). Verify this is already happening — if `site_context` is only set on the first page of the first batch, copy it to all pages.

- [ ] **Step 3: Run `cargo check`**

- [ ] **Step 4: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs apps/crawler/src/config.rs
git commit -m "perf: reduce batch threshold to 10 pages for faster pipeline scoring"
```

---

## Task 11: Content Deduplication During Crawl (Item #23)

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Track content hashes during crawl and skip duplicates**

Add a `HashSet<String>` for content hashes seen so far:

```rust
let mut content_hashes_seen: HashSet<String> = HashSet::new();

// After crawling a page successfully:
if !page_result.content_hash.is_empty() {
    if !content_hashes_seen.insert(page_result.content_hash.clone()) {
        tracing::debug!(url = %url, hash = %page_result.content_hash, "Skipping duplicate content");
        stats.pages_errored += 1; // Count as skipped
        continue; // Don't add to batch
    }
}
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs
git commit -m "feat: skip duplicate content during crawl via content hash dedup"
```

---

## Task 12: Canonical URL Resolution (Item #24)

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Track canonicals and prefer canonical URLs**

After crawling a page, check if it has a canonical URL that differs from the crawled URL. If so, and if the canonical hasn't been crawled yet, add it to the frontier with priority and mark the current URL as a duplicate:

```rust
// After successful page crawl:
if let Some(ref canonical) = page_result.canonical_url {
    if canonical != &url && !canonical.is_empty() {
        // Add canonical to frontier if not seen
        frontier.add_discovered(&[canonical.clone()], depth);
        // Mark this page as having a different canonical
        // The API-side scoring can handle dedup via canonical
    }
}
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs
git commit -m "feat: add canonical URLs to frontier for preferred crawling"
```

---

## Task 13: Page Importance Prioritization (Item #25)

**Files:**

- Modify: `apps/crawler/src/crawler/frontier.rs`

- [ ] **Step 1: Add priority scoring to FrontierEntry**

Change `FrontierEntry` to include a priority:

```rust
#[derive(Debug, Clone, Eq, PartialEq)]
struct FrontierEntry {
    url: String,
    depth: u32,
    priority: u32, // higher = more important
}

impl Ord for FrontierEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Primary: higher priority first. Secondary: shallower depth first.
        self.priority.cmp(&other.priority)
            .then_with(|| Reverse(self.depth).cmp(&Reverse(other.depth)))
    }
}
```

Add `add_discovered_with_priority` method:

```rust
pub fn add_discovered_with_priority(&mut self, urls: &[String], depth: u32, priority: u32) {
    // Same as add_discovered but with priority
}
```

In `jobs/mod.rs`:

- Seed URLs: priority 100
- Sitemap URLs: priority 80
- Discovered internal links: priority 50
- Deep links (depth > 3): priority 20

- [ ] **Step 2: Update existing tests for new field**

- [ ] **Step 3: Run `cargo test`**

- [ ] **Step 4: Commit**

```bash
git add apps/crawler/src/crawler/frontier.rs apps/crawler/src/jobs/mod.rs
git commit -m "feat: priority-based frontier — homepage and sitemap URLs crawled first"
```

---

## Task 14: RSS/Atom Feed Discovery (Item #20) + Hreflang Discovery (Item #21)

**Files:**

- Modify: `apps/crawler/src/crawler/parser.rs`
- Modify: `apps/crawler/src/models.rs`

- [ ] **Step 1: Extract RSS/Atom feed URLs and hreflang links from HTML**

In `parser.rs`, add extraction for:

```rust
// RSS/Atom feeds: <link rel="alternate" type="application/rss+xml" href="...">
// Atom feeds: <link rel="alternate" type="application/atom+xml" href="...">
let feed_urls: Vec<String> = document
    .select(&Selector::parse("link[rel='alternate'][type*='xml']").unwrap())
    .filter_map(|el| el.value().attr("href").map(String::from))
    .collect();

// Hreflang: <link rel="alternate" hreflang="..." href="...">
let hreflang_urls: Vec<String> = document
    .select(&Selector::parse("link[rel='alternate'][hreflang]").unwrap())
    .filter_map(|el| el.value().attr("href").map(String::from))
    .collect();
```

Add these to `ExtractedData` in `models.rs`:

```rust
pub feed_urls: Vec<String>,
pub hreflang_urls: Vec<String>,
```

- [ ] **Step 2: In jobs/mod.rs, add feed and hreflang URLs to frontier**

```rust
// After page crawl, add discovered feed and hreflang URLs:
if crawl_config.extract_links {
    frontier.add_discovered(&page_result.extracted.hreflang_urls, depth + 1);
    // Feed URLs typically point to XML, not HTML pages — skip adding to frontier
    // but include in extracted data for the API
}
```

- [ ] **Step 3: Run `cargo check`**

- [ ] **Step 4: Commit**

```bash
git add apps/crawler/src/crawler/parser.rs apps/crawler/src/models.rs apps/crawler/src/jobs/mod.rs
git commit -m "feat: discover RSS/Atom feeds and hreflang alternate URLs"
```

---

## Task 15: Structured Data Extraction Improvements (Item #27)

**Files:**

- Modify: `apps/crawler/src/crawler/parser.rs`

- [ ] **Step 1: Extract specific schema types (FAQ, HowTo, BreadcrumbList) from JSON-LD**

The parser already extracts `structured_data` as raw JSON-LD. Add typed extraction:

```rust
// In ExtractedData, add:
pub schema_types: Vec<String>, // e.g., ["Article", "FAQPage", "BreadcrumbList"]
pub has_faq_schema: bool,
pub has_howto_schema: bool,
pub has_breadcrumb_schema: bool,
```

In the parser, after extracting JSON-LD blocks:

```rust
let mut schema_types = Vec::new();
for sd in &structured_data {
    if let Some(t) = sd.get("@type").and_then(|v| v.as_str()) {
        schema_types.push(t.to_string());
    }
    // Handle @type as array
    if let Some(arr) = sd.get("@type").and_then(|v| v.as_array()) {
        for t in arr {
            if let Some(s) = t.as_str() {
                schema_types.push(s.to_string());
            }
        }
    }
}
let has_faq_schema = schema_types.iter().any(|t| t == "FAQPage");
let has_howto_schema = schema_types.iter().any(|t| t == "HowTo");
let has_breadcrumb_schema = schema_types.iter().any(|t| t == "BreadcrumbList");
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/crawler/parser.rs apps/crawler/src/models.rs
git commit -m "feat: extract FAQ, HowTo, BreadcrumbList schema types from JSON-LD"
```

---

## Task 16: HTTP Cache Headers (Item #26)

**Files:**

- Modify: `apps/crawler/src/crawler/fetcher.rs`
- Modify: `apps/crawler/src/models.rs`

- [ ] **Step 1: Capture ETag and Last-Modified from response headers**

These are already captured in `FetchResult.headers`. Add convenience fields to `CrawlPageResult` in models:

```rust
pub etag: Option<String>,
pub last_modified: Option<String>,
```

In `crawler/mod.rs` where `CrawlPageResult` is built from `FetchResult`, populate:

```rust
etag: fetch_result.headers.get("etag").cloned(),
last_modified: fetch_result.headers.get("last-modified").cloned(),
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/crawler/fetcher.rs apps/crawler/src/models.rs apps/crawler/src/crawler/mod.rs
git commit -m "feat: capture ETag and Last-Modified for future incremental crawls"
```

---

## Task 17: Health Check with Metrics (Item #15)

**Files:**

- Modify: `apps/crawler/src/server/routes.rs`
- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Add metrics to health endpoint**

Add a `metrics()` method to `JobManager` that returns:

```rust
pub struct CrawlMetrics {
    pub active_jobs: usize,
    pub queued_jobs: usize,
    pub total_pages_crawled: u64,
    pub total_pages_errored: u64,
    pub uptime_secs: u64,
}
```

Track these in `JobManager` using `Arc<AtomicU64>` counters.

Update `health()` handler:

```rust
pub async fn health(State(state): State<AppState>) -> impl IntoResponse {
    let metrics = state.job_manager.metrics().await;
    Json(json!({
        "status": "ok",
        "active_jobs": metrics.active_jobs,
        "queued_jobs": metrics.queued_jobs,
        "total_pages_crawled": metrics.total_pages_crawled,
        "total_pages_errored": metrics.total_pages_errored,
        "uptime_secs": metrics.uptime_secs,
    }))
}
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/server/routes.rs apps/crawler/src/jobs/mod.rs
git commit -m "feat: health endpoint with active jobs, pages crawled, error rate metrics"
```

---

## Task 18: Resume Interrupted Crawls (Item #12)

**Files:**

- Create: `apps/crawler/src/crawler/checkpoint.rs`
- Modify: `apps/crawler/src/crawler/mod.rs`
- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Create checkpoint module for frontier persistence**

```rust
// apps/crawler/src/crawler/checkpoint.rs
use serde::{Serialize, Deserialize};
use std::collections::HashSet;
use std::path::Path;

#[derive(Serialize, Deserialize)]
pub struct CrawlCheckpoint {
    pub job_id: String,
    pub seen_urls: HashSet<String>,
    pub pending_urls: Vec<(String, u32)>, // (url, depth)
    pub pages_crawled: usize,
    pub batch_index: u32,
}

impl CrawlCheckpoint {
    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        let json = serde_json::to_string(self)?;
        std::fs::write(path, json)
    }

    pub fn load(path: &Path) -> std::io::Result<Self> {
        let json = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&json)?)
    }

    pub fn checkpoint_path(job_id: &str) -> std::path::PathBuf {
        std::path::PathBuf::from(format!("/tmp/crawl-checkpoint-{}.json", job_id))
    }
}
```

- [ ] **Step 2: Save checkpoint every N batches in jobs/mod.rs**

After sending each batch callback, save checkpoint:

```rust
if batch_index % 5 == 0 {
    let checkpoint = CrawlCheckpoint { /* ... */ };
    let _ = checkpoint.save(&CrawlCheckpoint::checkpoint_path(&payload.job_id));
}
```

On crawl completion, delete checkpoint file.

- [ ] **Step 3: On job start, check for existing checkpoint and resume if found**

- [ ] **Step 4: Register module and run `cargo check`**

- [ ] **Step 5: Commit**

```bash
git add apps/crawler/src/crawler/checkpoint.rs apps/crawler/src/crawler/mod.rs apps/crawler/src/jobs/mod.rs
git commit -m "feat: checkpoint frontier state for crawl resume on restart"
```

---

## Task 19: JavaScript Rendering for SPA Sites (Item #17)

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Detect SPA pages and re-fetch links via JS renderer**

After crawling the seed URL (first page), check if the HTML body has minimal content (< 500 bytes of text, few internal links). If so, use the existing JS renderer to extract links:

```rust
// After crawling the first page:
let first_result = &batch_pages[0];
let text_length = first_result.word_count;
let link_count = first_result.extracted.internal_links.len();

if text_length < 50 && link_count < 3 {
    tracing::info!(job_id = %payload.job_id, "SPA detected — using JS renderer for link discovery");
    // The JS renderer is already integrated — it runs for every page if available.
    // The key improvement: ensure renderer-discovered links are added to frontier.
    if let Some(ref renderer) = engine.renderer {
        if let Ok(rendered_links) = renderer.extract_links(&first_result.url).await {
            frontier.add_discovered(&rendered_links, 1);
            tracing::info!(
                job_id = %payload.job_id,
                links = rendered_links.len(),
                "JS renderer discovered additional links"
            );
        }
    }
}
```

This leverages the existing `renderer/mod.rs` which spawns Node.js + Puppeteer.

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs
git commit -m "feat: detect SPA sites and use JS renderer for link discovery"
```

---

## Task 20: Crawl Progress Streaming via SSE (Item #28)

**Files:**

- Modify: `apps/crawler/src/server/routes.rs`
- Modify: `apps/crawler/src/jobs/mod.rs`
- Modify: `apps/crawler/src/lib.rs`

- [ ] **Step 1: Add SSE endpoint for real-time crawl progress**

```rust
// In routes.rs:
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::stream::Stream;
use tokio_stream::wrappers::BroadcastStream;

pub async fn crawl_events(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let rx = state.job_manager.subscribe_events(&job_id).await;
    let stream = BroadcastStream::new(rx).filter_map(|msg| {
        match msg {
            Ok(event) => Some(Ok(Event::default().data(event))),
            Err(_) => None,
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}
```

- [ ] **Step 2: Add broadcast channel to JobManager**

In `jobs/mod.rs`, add `tokio::sync::broadcast::Sender<String>` per job. After each batch or significant event, send a JSON event:

```rust
let _ = event_tx.send(serde_json::to_string(&json!({
    "type": "progress",
    "pages_crawled": stats.pages_crawled,
    "pages_found": stats.pages_found,
    "pages_errored": stats.pages_errored,
    "batch_index": batch_index,
})).unwrap());
```

- [ ] **Step 3: Register route in lib.rs**

```rust
.route("/api/v1/jobs/:id/events", get(routes::crawl_events))
```

- [ ] **Step 4: Add `tokio-stream` dependency**

```toml
tokio-stream = "0.1"
```

- [ ] **Step 5: Run `cargo check`**

- [ ] **Step 6: Commit**

```bash
git add apps/crawler/src/server/routes.rs apps/crawler/src/jobs/mod.rs apps/crawler/src/lib.rs apps/crawler/Cargo.toml
git commit -m "feat: SSE endpoint for real-time crawl progress streaming"
```

---

## Task 21: Crawl Cancellation Improvements (Item #29)

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Send partial results on cancellation**

Currently `cancel()` calls `cancel_token.cancel()` and `join_set.abort_all()`. Improve to:

1. Send any accumulated `batch_pages` as a final batch before aborting
2. Set `is_final: true` on the cancellation batch
3. Include a `cancelled: true` field in the callback

```rust
// In the cancellation handling section of the worker loop:
if cancel_token.is_cancelled() {
    tracing::info!(job_id = %payload.job_id, "Crawl cancelled — sending partial results");
    if !batch_pages.is_empty() {
        // Send accumulated pages as final batch
        send_batch(&callback_client, /* ... */, true /* is_final */).await;
    }
    break;
}
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs
git commit -m "feat: send partial results on crawl cancellation"
```

---

## Task 22: Per-Site Crawl Profiles (Item #30)

**Files:**

- Modify: `apps/crawler/src/models.rs`
- Modify: `apps/crawler/src/jobs/mod.rs`

- [ ] **Step 1: Add profile hints to CrawlConfig**

```rust
// In CrawlConfig (models.rs), add optional fields:
pub known_rate_limit: Option<u32>,    // Learned rate limit from previous crawls
pub is_spa: Option<bool>,            // Known SPA from previous crawls
pub previous_page_count: Option<u32>, // Pages found in last crawl
```

These are passed from the API when starting a crawl (the API can store them from previous crawl results).

- [ ] **Step 2: Use profile hints in job processing**

```rust
// In jobs/mod.rs, use hints to configure the crawl:
let effective_rate = crawl_config.known_rate_limit
    .unwrap_or(crawl_config.rate_limit_ms as u32);

let use_renderer_for_discovery = crawl_config.is_spa.unwrap_or(false);
```

- [ ] **Step 3: Run `cargo check`**

- [ ] **Step 4: Commit**

```bash
git add apps/crawler/src/models.rs apps/crawler/src/jobs/mod.rs
git commit -m "feat: per-site crawl profiles — use learned hints from previous crawls"
```

---

## Task 23: Follow Redirects Robustly (Item #19)

**Files:**

- Modify: `apps/crawler/src/crawler/fetcher.rs`

- [ ] **Step 1: Track full redirect chain in FetchResult**

Currently `redirect_chain` is always empty in the FetchResult. reqwest follows redirects automatically but doesn't expose the chain. Use reqwest's redirect policy to capture intermediate hops:

```rust
use reqwest::redirect::Policy;

// In RateLimitedFetcher::new(), use a custom redirect policy that tracks hops:
// Store redirect chain in a thread-local or Arc<Mutex<Vec<RedirectHop>>>
// Alternatively, disable auto-redirect and follow manually:

let client = Client::builder()
    .user_agent(user_agent)
    .timeout(Duration::from_secs(timeout_secs))
    .redirect(Policy::none()) // Disable auto-redirect
    .gzip(true)
    .pool_max_idle_per_host(20)
    .build()
    .expect("Failed to build HTTP client");
```

Then in `fetch()`, manually follow redirects up to 10 hops:

```rust
let mut current_url = url.to_string();
let mut chain = Vec::new();

for _ in 0..10 {
    let response = self.client.get(&current_url).send().await?;
    let status = response.status();

    if status.is_redirection() {
        if let Some(location) = response.headers().get("location") {
            let next = location.to_str().unwrap_or_default();
            chain.push(RedirectHop {
                url: current_url.clone(),
                status_code: status.as_u16(),
            });
            // Resolve relative URLs
            current_url = Url::parse(&current_url)
                .and_then(|base| base.join(next))
                .map(|u| u.to_string())
                .unwrap_or_else(|_| next.to_string());
            continue;
        }
    }

    // Final response
    return Ok(FetchResult {
        status_code: status.as_u16(),
        body: response.text().await?,
        headers: /* ... */,
        final_url: current_url,
        redirect_chain: chain,
    });
}
```

- [ ] **Step 2: Run `cargo check`**

- [ ] **Step 3: Commit**

```bash
git add apps/crawler/src/crawler/fetcher.rs
git commit -m "feat: track full redirect chain with manual redirect following"
```

---

## Task 24: Final — Full Build, Test, Deploy

**Files:** All modified files

- [ ] **Step 1: Run full build**

```bash
cd apps/crawler && cargo build --release 2>&1
```

- [ ] **Step 2: Run all tests**

```bash
cd apps/crawler && cargo test 2>&1
```

- [ ] **Step 3: Fix any compilation or test errors**

- [ ] **Step 4: Final commit with all remaining changes**

```bash
git add -A apps/crawler/
git commit -m "chore: crawler overhaul — final build verification"
```

- [ ] **Step 5: Push and deploy**

```bash
git push origin main
```

Monitor Fly.io deploy: `gh run list --limit 1 --json status,conclusion`

- [ ] **Step 6: Verify deployment — trigger test crawl for families.care**

Use browser to start crawl from dashboard. Check crawler logs:

```bash
flyctl logs -a llmrank-crawler --no-tail | grep "families" | head -20
```

Verify: sitemap discovery returns > 0 URLs, pages crawl concurrently, batches stream back to API.
