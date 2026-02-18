use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::Semaphore;

#[derive(Error, Debug)]
pub enum RendererError {
    #[error("Renderer process failed: {0}")]
    ProcessError(String),
    #[error("Renderer timed out after {0}s")]
    Timeout(u64),
    #[error("Failed to parse renderer JSON output: {0}")]
    ParseError(String),
    #[error("Renderer script reported error: {0}")]
    ScriptError(String),
}

/// A single link extracted by the JS renderer.
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct RenderedLink {
    pub url: String,
    pub anchor_text: String,
    pub rel: String,
}

#[derive(Debug, serde::Deserialize)]
struct RenderOutput {
    #[serde(default)]
    links: Option<Vec<RenderedLink>>,
    #[serde(default)]
    error: Option<String>,
}

/// Headless Chromium link renderer, following the LighthouseRunner pattern.
#[derive(Clone)]
pub struct JsRenderer {
    semaphore: Arc<Semaphore>,
    timeout_secs: u64,
    script_path: String,
}

impl JsRenderer {
    pub fn new(max_concurrent: usize, script_path: String) -> Self {
        JsRenderer {
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            timeout_secs: 15,
            script_path,
        }
    }

    /// Render a page via headless Chromium and extract all `<a href>` links.
    pub async fn render_links(&self, url: &str) -> Result<Vec<RenderedLink>, RendererError> {
        let _permit = self
            .semaphore
            .acquire()
            .await
            .map_err(|e| RendererError::ProcessError(e.to_string()))?;

        let output = tokio::time::timeout(
            Duration::from_secs(self.timeout_secs),
            tokio::process::Command::new("node")
                .arg(&self.script_path)
                .arg(url)
                .output(),
        )
        .await
        .map_err(|_| RendererError::Timeout(self.timeout_secs))?
        .map_err(|e| RendererError::ProcessError(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        let parsed: RenderOutput = serde_json::from_str(&stdout)
            .map_err(|e| RendererError::ParseError(format!("{}: {}", e, stdout)))?;

        if let Some(err) = parsed.error {
            return Err(RendererError::ScriptError(err));
        }

        Ok(parsed.links.unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_success_output() {
        let json =
            r#"{"links":[{"url":"https://example.com/page","anchor_text":"Page","rel":""}]}"#;
        let parsed: RenderOutput = serde_json::from_str(json).unwrap();
        let links = parsed.links.unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].url, "https://example.com/page");
        assert_eq!(links[0].anchor_text, "Page");
        assert_eq!(links[0].rel, "");
    }

    #[test]
    fn test_parse_error_output() {
        let json = r#"{"error":"Navigation timeout"}"#;
        let parsed: RenderOutput = serde_json::from_str(json).unwrap();
        assert!(parsed.links.is_none());
        assert_eq!(parsed.error.unwrap(), "Navigation timeout");
    }

    #[test]
    fn test_parse_empty_links() {
        let json = r#"{"links":[]}"#;
        let parsed: RenderOutput = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.links.unwrap().len(), 0);
    }

    #[test]
    fn test_parse_with_rel_attributes() {
        let json = r#"{"links":[
            {"url":"https://a.com","anchor_text":"A","rel":"nofollow"},
            {"url":"https://b.com","anchor_text":"B","rel":"sponsored nofollow"}
        ]}"#;
        let parsed: RenderOutput = serde_json::from_str(json).unwrap();
        let links = parsed.links.unwrap();
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].rel, "nofollow");
        assert_eq!(links[1].rel, "sponsored nofollow");
    }

    #[test]
    fn test_parse_invalid_json() {
        let json = "not json at all";
        let result = serde_json::from_str::<RenderOutput>(json);
        assert!(result.is_err());
    }
}
