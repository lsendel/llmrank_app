use governor::{Quota, RateLimiter};
use reqwest::Client;
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::RwLock;
use tokio::time::Instant;
use url::Url;

use super::circuit_breaker::CircuitBreaker;

/// A single hop in a redirect chain — immutable value object.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RedirectHop {
    pub url: String,
    pub status_code: u16,
}

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

impl FetchError {
    /// Classify a reqwest error into a more specific FetchError variant.
    fn classify(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            FetchError::TimeoutError(e.to_string())
        } else if e.is_connect() {
            // Check for DNS errors by inspecting the error chain
            let msg = e.to_string();
            if msg.contains("dns error")
                || msg.contains("resolve")
                || msg.contains("no record found")
                || msg.contains("failed to lookup")
            {
                FetchError::DnsError(msg)
            } else {
                FetchError::ConnectionError(msg)
            }
        } else {
            FetchError::RequestFailed(e)
        }
    }

    /// Whether this error is retryable (timeouts, connection errors).
    fn is_retryable(&self) -> bool {
        matches!(
            self,
            FetchError::DnsError(_) | FetchError::ConnectionError(_) | FetchError::TimeoutError(_)
        )
    }
}

/// Result of a successful HTTP fetch.
#[derive(Debug, Clone)]
pub struct FetchResult {
    pub status_code: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
    pub final_url: String,
    pub redirect_chain: Vec<RedirectHop>,
}

type DomainLimiter = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// Per-domain adaptive backoff state.
struct DomainStats {
    consecutive_successes: u32,
    backoff_until: Option<Instant>,
    backoff_count: u32,
}

/// HTTP fetcher with per-domain rate limiting, adaptive backoff,
/// retry with exponential backoff, and circuit breaker.
#[derive(Clone)]
pub struct RateLimitedFetcher {
    client: Client,
    domain_limiters: Arc<RwLock<HashMap<String, Arc<DomainLimiter>>>>,
    rate_per_second: u32,
    domain_stats: Arc<RwLock<HashMap<String, DomainStats>>>,
    circuit_breaker: Arc<CircuitBreaker>,
}

const MAX_RETRY_ATTEMPTS: u32 = 3;
const BASE_RETRY_DELAY_MS: u64 = 500;
const MAX_BACKOFF_SECS: u64 = 60;
const BACKOFF_BASE_SECS: u64 = 5;

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
            domain_stats: Arc::new(RwLock::new(HashMap::new())),
            circuit_breaker: Arc::new(CircuitBreaker::new(5, 30)),
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

    /// Check and apply adaptive backoff for a domain.
    async fn apply_adaptive_backoff(&self, domain: &str) {
        let backoff_until = {
            let stats = self.domain_stats.read().await;
            stats.get(domain).and_then(|s| s.backoff_until)
        };

        if let Some(until) = backoff_until {
            if Instant::now() < until {
                tokio::time::sleep_until(until).await;
            }
        }
    }

    /// Record a server-side rate limit or error (429/503) for adaptive backoff.
    async fn record_server_backoff(&self, domain: &str) {
        let mut stats = self.domain_stats.write().await;
        let entry = stats.entry(domain.to_string()).or_insert(DomainStats {
            consecutive_successes: 0,
            backoff_until: None,
            backoff_count: 0,
        });

        let delay_secs = (BACKOFF_BASE_SECS * 2u64.pow(entry.backoff_count)).min(MAX_BACKOFF_SECS);
        entry.backoff_until = Some(Instant::now() + Duration::from_secs(delay_secs));
        entry.backoff_count += 1;
        entry.consecutive_successes = 0;
    }

    /// Record a successful request for adaptive backoff tracking.
    async fn record_success(&self, domain: &str) {
        let mut stats = self.domain_stats.write().await;
        let entry = stats.entry(domain.to_string()).or_insert(DomainStats {
            consecutive_successes: 0,
            backoff_until: None,
            backoff_count: 0,
        });
        entry.consecutive_successes += 1;
        entry.backoff_count = 0;
    }

    /// Fetch a URL with rate limiting, adaptive backoff, circuit breaker,
    /// and retry with exponential backoff.
    pub async fn fetch(&self, url: &str) -> Result<FetchResult, FetchError> {
        // Extract domain for per-domain rate limiting
        let domain = Url::parse(url)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
            .unwrap_or_default();

        // Circuit breaker check
        if !self.circuit_breaker.is_allowed(&domain).await {
            return Err(FetchError::CircuitOpen);
        }

        // Per-domain rate limiter
        let limiter = self.get_limiter(&domain).await;
        limiter.until_ready().await;

        // Adaptive backoff: wait if the domain is in backoff
        self.apply_adaptive_backoff(&domain).await;

        // Retry loop with exponential backoff
        let mut last_error: Option<FetchError> = None;

        for attempt in 0..MAX_RETRY_ATTEMPTS {
            if attempt > 0 {
                // Calculate retry delay based on the attempt
                let delay = Duration::from_millis(BASE_RETRY_DELAY_MS * 2u64.pow(attempt));
                tracing::warn!(
                    url = %url,
                    attempt = attempt + 1,
                    max_attempts = MAX_RETRY_ATTEMPTS,
                    delay_ms = delay.as_millis() as u64,
                    "Retrying fetch"
                );
                tokio::time::sleep(delay).await;
            }

            match self.client.get(url).send().await {
                Ok(response) => {
                    let status_code = response.status().as_u16();

                    // 429 or 5xx: may retry
                    if status_code == 429 || status_code == 503 {
                        self.record_server_backoff(&domain).await;
                        self.circuit_breaker.record_failure(&domain).await;

                        if attempt + 1 < MAX_RETRY_ATTEMPTS {
                            tracing::warn!(
                                url = %url,
                                status = status_code,
                                attempt = attempt + 1,
                                "Server rate limit/unavailable, will retry"
                            );
                            continue;
                        }
                    } else if (500..600).contains(&status_code) && status_code != 503 {
                        // Other 5xx errors: retry
                        self.circuit_breaker.record_failure(&domain).await;

                        if attempt + 1 < MAX_RETRY_ATTEMPTS {
                            tracing::warn!(
                                url = %url,
                                status = status_code,
                                attempt = attempt + 1,
                                "Server error, will retry"
                            );
                            continue;
                        }
                    } else if (400..500).contains(&status_code) && status_code != 429 {
                        // 4xx (except 429): don't retry, return as normal result
                    }

                    // Success (2xx) or non-retryable response: record and return
                    if (200..300).contains(&status_code) {
                        self.record_success(&domain).await;
                        self.circuit_breaker.record_success(&domain).await;
                    }

                    let final_url = response.url().to_string();

                    // Collect response headers
                    let mut headers = HashMap::new();
                    for (name, value) in response.headers().iter() {
                        if let Ok(v) = value.to_str() {
                            headers.insert(name.to_string(), v.to_string());
                        }
                    }

                    let body = response.text().await?;

                    return Ok(FetchResult {
                        status_code,
                        body,
                        headers,
                        final_url,
                        redirect_chain: Vec::new(),
                    });
                }
                Err(e) => {
                    let classified = FetchError::classify(e);

                    // Only retry on retryable errors (timeout, connection)
                    if classified.is_retryable() && attempt + 1 < MAX_RETRY_ATTEMPTS {
                        self.circuit_breaker.record_failure(&domain).await;
                        last_error = Some(classified);
                        continue;
                    }

                    // Non-retryable or final attempt
                    self.circuit_breaker.record_failure(&domain).await;
                    return Err(classified);
                }
            }
        }

        // Should only reach here if all retries exhausted via continue
        Err(last_error.unwrap_or(FetchError::RateLimitError))
    }
}
