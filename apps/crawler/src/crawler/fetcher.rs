use governor::{Quota, RateLimiter};
use reqwest::Client;
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::RwLock;
use url::Url;

#[derive(Error, Debug)]
pub enum FetchError {
    #[error("Request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),
    #[error("Rate limiter error")]
    RateLimitError,
}

/// Result of a successful HTTP fetch.
#[derive(Debug, Clone)]
pub struct FetchResult {
    pub status_code: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
    pub final_url: String,
}

type DomainLimiter = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// HTTP fetcher with per-domain rate limiting.
///
/// Each domain gets its own rate limiter so crawling subdomain assets
/// or future multi-domain support won't bottleneck on a single limiter.
#[derive(Clone)]
pub struct RateLimitedFetcher {
    client: Client,
    domain_limiters: Arc<RwLock<HashMap<String, Arc<DomainLimiter>>>>,
    rate_per_second: u32,
}

impl RateLimitedFetcher {
    /// Create a new rate-limited fetcher.
    ///
    /// - `rate_per_second`: maximum requests per second per domain (e.g. 2)
    /// - `timeout_secs`: per-request timeout in seconds (e.g. 30)
    /// - `user_agent`: custom User-Agent header string
    pub fn new(rate_per_second: u32, timeout_secs: u64, user_agent: &str) -> Self {
        let client = Client::builder()
            .user_agent(user_agent)
            .timeout(Duration::from_secs(timeout_secs))
            .redirect(reqwest::redirect::Policy::limited(10))
            .gzip(true)
            .pool_max_idle_per_host(20)
            .build()
            .expect("Failed to build HTTP client");

        RateLimitedFetcher {
            client,
            domain_limiters: Arc::new(RwLock::new(HashMap::new())),
            rate_per_second: rate_per_second.max(1),
        }
    }

    /// Get or create a rate limiter for the given domain.
    async fn get_limiter(&self, domain: &str) -> Arc<DomainLimiter> {
        // Fast path: check read lock
        {
            let limiters = self.domain_limiters.read().await;
            if let Some(limiter) = limiters.get(domain) {
                return limiter.clone();
            }
        }

        // Slow path: create new limiter under write lock
        let mut limiters = self.domain_limiters.write().await;
        limiters
            .entry(domain.to_string())
            .or_insert_with(|| {
                let rate = NonZeroU32::new(self.rate_per_second).unwrap();
                let quota = Quota::per_second(rate);
                Arc::new(RateLimiter::direct(quota))
            })
            .clone()
    }

    /// Fetch a URL, waiting for rate limit clearance first.
    /// Rate limiting is applied per-domain.
    pub async fn fetch(&self, url: &str) -> Result<FetchResult, FetchError> {
        // Extract domain for per-domain rate limiting
        let domain = Url::parse(url)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
            .unwrap_or_default();

        let limiter = self.get_limiter(&domain).await;
        limiter.until_ready().await;

        let response = self.client.get(url).send().await?;

        let status_code = response.status().as_u16();
        let final_url = response.url().to_string();

        // Collect response headers
        let mut headers = HashMap::new();
        for (name, value) in response.headers().iter() {
            if let Ok(v) = value.to_str() {
                headers.insert(name.to_string(), v.to_string());
            }
        }

        let body = response.text().await?;

        Ok(FetchResult {
            status_code,
            body,
            headers,
            final_url,
        })
    }
}
