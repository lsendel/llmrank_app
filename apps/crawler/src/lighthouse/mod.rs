use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::Semaphore;

use crate::models::LighthouseResult;

#[derive(Error, Debug)]
pub enum LighthouseError {
    #[error("Lighthouse process failed: {0}")]
    ProcessError(String),
    #[error("Lighthouse timed out after {0}s")]
    Timeout(u64),
    #[error("Failed to parse Lighthouse JSON output: {0}")]
    ParseError(String),
    #[error("Lighthouse CLI not found")]
    NotInstalled,
}

/// Lighthouse runner that either runs locally or offloads to a remote service.
#[derive(Clone)]
pub struct LighthouseRunner {
    semaphore: Arc<Semaphore>,
    timeout_secs: u64,
    api_url: Option<String>, // remote audit URL; None = run locally
    /// Remaining per-crawl audit budget (sampling cap). `None` = unlimited.
    /// Shared across clones so all pages of a crawl draw from one budget.
    budget: Option<Arc<AtomicUsize>>,
}

impl LighthouseRunner {
    /// Create a new runner. `max_pages` is the per-crawl Lighthouse sampling cap
    /// (`0` = unlimited).
    pub fn new(max_concurrent: usize, api_url: Option<String>, max_pages: usize) -> Self {
        LighthouseRunner {
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            timeout_secs: 60,
            api_url,
            budget: if max_pages > 0 {
                Some(Arc::new(AtomicUsize::new(max_pages)))
            } else {
                None
            },
        }
    }

    /// Claim one unit of the per-crawl audit budget. Returns `true` if this page
    /// should be audited, `false` if the sampling cap is exhausted. Unlimited
    /// when no budget is set.
    fn try_claim_budget(&self) -> bool {
        match &self.budget {
            None => true,
            Some(b) => b
                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| {
                    if n > 0 {
                        Some(n - 1)
                    } else {
                        None
                    }
                })
                .is_ok(),
        }
    }

    /// Run a Lighthouse audit. Returns `Ok(None)` when the page is sampled out
    /// by the per-crawl budget (not audited — distinct from `Err`, an audit
    /// failure). Offloads to a remote service when `api_url` is set.
    pub async fn run_lighthouse(
        &self,
        url: &str,
    ) -> Result<Option<LighthouseResult>, LighthouseError> {
        if !self.try_claim_budget() {
            return Ok(None);
        }

        let _permit = self
            .semaphore
            .acquire()
            .await
            .map_err(|e| LighthouseError::ProcessError(e.to_string()))?;

        if let Some(ref api_base) = self.api_url {
            return self.run_remote_audit(url, api_base).await.map(Some);
        }

        self.run_local_audit(url).await.map(Some)
    }

    async fn run_remote_audit(
        &self,
        url: &str,
        api_base: &str,
    ) -> Result<LighthouseResult, LighthouseError> {
        let client = reqwest::Client::new();
        let resp = client
            .post(format!("{}/api/browser/audit", api_base))
            .json(&serde_json::json!({ "url": url }))
            .send()
            .await
            .map_err(|e| LighthouseError::ProcessError(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(LighthouseError::ProcessError(format!(
                "API error: {}",
                resp.status()
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| LighthouseError::ParseError(e.to_string()))?;

        let data = body
            .get("data")
            .ok_or_else(|| LighthouseError::ParseError("Missing data key".into()))?;

        serde_json::from_value(data.clone()).map_err(|e| LighthouseError::ParseError(e.to_string()))
    }

    async fn run_local_audit(&self, url: &str) -> Result<LighthouseResult, LighthouseError> {
        let url_owned = url.to_string();
        let timeout = self.timeout_secs;

        // Run lighthouse CLI as a subprocess
        let output = tokio::time::timeout(
            Duration::from_secs(timeout),
            tokio::process::Command::new("lighthouse")
                .arg(&url_owned)
                .arg("--output=json")
                .arg("--quiet")
                .arg("--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-extensions --disable-background-networking --no-first-run")
                .output(),
        )
        .await
        .map_err(|_| LighthouseError::Timeout(timeout))?
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                LighthouseError::NotInstalled
            } else {
                LighthouseError::ProcessError(e.to_string())
            }
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(LighthouseError::ProcessError(format!(
                "Exit code {:?}: {}",
                output.status.code(),
                stderr
            )));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| LighthouseError::ParseError(e.to_string()))?;

        // Extract scores from the categories
        let categories = json
            .get("categories")
            .ok_or_else(|| LighthouseError::ParseError("Missing 'categories' key".into()))?;

        let performance = extract_score(categories, "performance")?;
        let seo = extract_score(categories, "seo")?;
        let accessibility = extract_score(categories, "accessibility")?;
        let best_practices = extract_score(categories, "best-practices")?;

        Ok(LighthouseResult {
            performance,
            seo,
            accessibility,
            best_practices,
            lh_r2_key: None,
        })
    }
}

/// Extract a category score from Lighthouse JSON output.
fn extract_score(categories: &serde_json::Value, category: &str) -> Result<f64, LighthouseError> {
    categories
        .get(category)
        .and_then(|c| c.get("score"))
        .and_then(|s| s.as_f64())
        .ok_or_else(|| {
            LighthouseError::ParseError(format!("Missing score for category '{}'", category))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_score() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "performance": {"score": 0.85},
                "seo": {"score": 0.92},
                "accessibility": {"score": 0.78},
                "best-practices": {"score": 0.95}
            }"#,
        )
        .unwrap();

        assert!((extract_score(&json, "performance").unwrap() - 0.85).abs() < f64::EPSILON);
        assert!((extract_score(&json, "seo").unwrap() - 0.92).abs() < f64::EPSILON);
        assert!((extract_score(&json, "accessibility").unwrap() - 0.78).abs() < f64::EPSILON);
        assert!((extract_score(&json, "best-practices").unwrap() - 0.95).abs() < f64::EPSILON);
    }

    #[test]
    fn test_extract_score_missing() {
        let json: serde_json::Value = serde_json::from_str(r#"{}"#).unwrap();
        assert!(extract_score(&json, "performance").is_err());
    }

    #[test]
    fn test_budget_caps_audits() {
        // max_pages = 2 → first two pages claim, third is sampled out.
        let runner = LighthouseRunner::new(1, None, 2);
        assert!(runner.try_claim_budget());
        assert!(runner.try_claim_budget());
        assert!(!runner.try_claim_budget());
        assert!(!runner.try_claim_budget());
    }

    #[test]
    fn test_budget_unlimited_when_zero() {
        // max_pages = 0 → no cap, every page is audited.
        let runner = LighthouseRunner::new(1, None, 0);
        for _ in 0..100 {
            assert!(runner.try_claim_budget());
        }
    }

    #[test]
    fn test_budget_shared_across_clones() {
        // Clones share one budget (the crawler clones the runner per page).
        let runner = LighthouseRunner::new(1, None, 1);
        let clone = runner.clone();
        assert!(runner.try_claim_budget());
        assert!(!clone.try_claim_budget());
    }
}
