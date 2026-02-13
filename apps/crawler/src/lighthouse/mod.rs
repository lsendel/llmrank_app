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

/// Lighthouse runner that limits concurrency via a semaphore.
#[derive(Clone)]
pub struct LighthouseRunner {
    semaphore: Arc<Semaphore>,
    timeout_secs: u64,
}

impl LighthouseRunner {
    /// Create a new runner with the given concurrency limit.
    pub fn new(max_concurrent: usize) -> Self {
        LighthouseRunner {
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            timeout_secs: 60,
        }
    }

    /// Run a Lighthouse audit on the given URL.
    /// Acquires a semaphore permit (blocking if at max concurrency).
    pub async fn run_lighthouse(&self, url: &str) -> Result<LighthouseResult, LighthouseError> {
        let _permit = self
            .semaphore
            .acquire()
            .await
            .map_err(|e| LighthouseError::ProcessError(e.to_string()))?;

        let url_owned = url.to_string();
        let timeout = self.timeout_secs;

        // Run lighthouse CLI as a subprocess
        let output = tokio::time::timeout(
            Duration::from_secs(timeout),
            tokio::process::Command::new("lighthouse")
                .arg(&url_owned)
                .arg("--output=json")
                .arg("--quiet")
                .arg("--chrome-flags=--headless --no-sandbox")
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
fn extract_score(
    categories: &serde_json::Value,
    category: &str,
) -> Result<f64, LighthouseError> {
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
}
