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
    #[error("Too many redirects (max 10)")]
    TooManyRedirects,
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
/// Longer base delay used when the previous attempt hit a server-overload status
/// (429/503). These signal the origin is temporarily unavailable (cold start,
/// Hyperdrive/D1 contention), and that window often outlasts the ~3s spanned by
/// BASE_RETRY_DELAY_MS — so the page gets scored as an HTTP error. Backing off
/// harder (≈4s then 8s) gives the origin time to recover before the final try.
const SERVER_RETRY_DELAY_MS: u64 = 2000;
const MAX_BACKOFF_SECS: u64 = 60;
const BACKOFF_BASE_SECS: u64 = 5;

/// Exponential backoff before a retry attempt. When the previous attempt hit a
/// server-overload status (429/503), `server_overloaded` selects the longer
/// SERVER_RETRY_DELAY_MS base so the cumulative retry window (≈4s + 8s) outlasts
/// a transient origin-overload window instead of giving up after ~3s and scoring
/// the page as an HTTP error.
fn retry_delay_ms(server_overloaded: bool, attempt: u32) -> u64 {
    let base = if server_overloaded {
        SERVER_RETRY_DELAY_MS
    } else {
        BASE_RETRY_DELAY_MS
    };
    base * 2u64.pow(attempt)
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
            .redirect(reqwest::redirect::Policy::none())
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
    /// retry with exponential backoff, and manual redirect tracking.
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
        // Set when the previous attempt returned 429/503, so the next attempt
        // backs off harder (SERVER_RETRY_DELAY_MS) to outlast origin overload.
        let mut server_overloaded = false;

        for attempt in 0..MAX_RETRY_ATTEMPTS {
            if attempt > 0 {
                let delay = Duration::from_millis(retry_delay_ms(server_overloaded, attempt));
                tracing::warn!(
                    url = %url,
                    attempt = attempt + 1,
                    max_attempts = MAX_RETRY_ATTEMPTS,
                    delay_ms = delay.as_millis() as u64,
                    "Retrying fetch"
                );
                tokio::time::sleep(delay).await;
            }
            server_overloaded = false;

            // Manual redirect-following loop (max 10 hops)
            let mut current_url = url.to_string();
            let mut redirect_chain: Vec<RedirectHop> = Vec::new();
            let mut too_many_redirects = false;

            let result: Result<Option<FetchResult>, FetchError> = 'redirect: {
                for _ in 0..10 {
                    match self.client.get(&current_url).send().await {
                        Ok(response) => {
                            let status_code = response.status().as_u16();

                            // Check if this is a redirect
                            if (300..400).contains(&status_code) {
                                if let Some(location) = response.headers().get("location") {
                                    redirect_chain.push(RedirectHop {
                                        url: current_url.clone(),
                                        status_code,
                                    });

                                    // Resolve relative URL against current URL
                                    current_url = Url::parse(&current_url)
                                        .and_then(|base| {
                                            base.join(location.to_str().unwrap_or_default())
                                        })
                                        .map(|u| u.to_string())
                                        .unwrap_or_else(|_| {
                                            location.to_str().unwrap_or_default().to_string()
                                        });
                                    continue;
                                }
                                // No location header — treat as a normal response
                            }

                            // Non-redirect response — return result
                            // Collect response headers
                            let mut headers = HashMap::new();
                            for (name, value) in response.headers().iter() {
                                if let Ok(v) = value.to_str() {
                                    headers.insert(name.to_string(), v.to_string());
                                }
                            }

                            let body = match response.text().await {
                                Ok(b) => b,
                                Err(e) => break 'redirect Err(FetchError::classify(e)),
                            };

                            break 'redirect Ok(Some(FetchResult {
                                status_code,
                                body,
                                headers,
                                final_url: current_url,
                                redirect_chain,
                            }));
                        }
                        Err(e) => {
                            break 'redirect Err(FetchError::classify(e));
                        }
                    }
                }
                // Exhausted 10 redirect hops
                too_many_redirects = true;
                Ok(None)
            };

            if too_many_redirects {
                return Err(FetchError::TooManyRedirects);
            }

            match result {
                Ok(Some(fetch_result)) => {
                    let status_code = fetch_result.status_code;

                    // 429 or 503: may retry
                    if status_code == 429 || status_code == 503 {
                        self.record_server_backoff(&domain).await;
                        self.circuit_breaker.record_failure(&domain).await;

                        if attempt + 1 < MAX_RETRY_ATTEMPTS {
                            // Origin is overloaded; back off harder before the
                            // next attempt so the retry window outlasts the
                            // transient unavailability instead of scoring an
                            // HTTP error.
                            server_overloaded = true;
                            tracing::warn!(
                                url = %url,
                                status = status_code,
                                attempt = attempt + 1,
                                "Server rate limit/unavailable, will retry"
                            );
                            continue;
                        }
                    } else if (500..600).contains(&status_code) && status_code != 503 {
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
                    }

                    // Success (2xx) or non-retryable response
                    if (200..300).contains(&status_code) {
                        self.record_success(&domain).await;
                        self.circuit_breaker.record_success(&domain).await;
                    }

                    return Ok(fetch_result);
                }
                Ok(None) => {
                    // Should not reach here (handled by too_many_redirects above)
                    return Err(FetchError::TooManyRedirects);
                }
                Err(classified) => {
                    if classified.is_retryable() && attempt + 1 < MAX_RETRY_ATTEMPTS {
                        self.circuit_breaker.record_failure(&domain).await;
                        last_error = Some(classified);
                        continue;
                    }

                    self.circuit_breaker.record_failure(&domain).await;
                    return Err(classified);
                }
            }
        }

        // Should only reach here if all retries exhausted via continue
        Err(last_error.unwrap_or(FetchError::RateLimitError))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_backoff_uses_base_delay() {
        // attempt 1 -> 1s, attempt 2 -> 2s (cumulative ~3s window)
        assert_eq!(retry_delay_ms(false, 1), 1000);
        assert_eq!(retry_delay_ms(false, 2), 2000);
    }

    #[test]
    fn server_overload_backoff_is_longer() {
        // attempt 1 -> 4s, attempt 2 -> 8s (cumulative ~12s window)
        assert_eq!(retry_delay_ms(true, 1), 4000);
        assert_eq!(retry_delay_ms(true, 2), 8000);
    }

    #[test]
    fn server_overload_window_outlasts_normal_window() {
        // The whole point: a 429/503 retry must wait materially longer than a
        // generic-error retry, so a transient origin-overload window is ridden
        // out rather than scored as an HTTP error.
        let normal: u64 = (1..MAX_RETRY_ATTEMPTS)
            .map(|a| retry_delay_ms(false, a))
            .sum();
        let overloaded: u64 = (1..MAX_RETRY_ATTEMPTS)
            .map(|a| retry_delay_ms(true, a))
            .sum();
        assert!(
            overloaded >= normal * 3,
            "overloaded window {overloaded}ms should be >= 3x normal {normal}ms"
        );
    }
}
