use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub shared_secret: String,
    pub api_base_url: String, // Base URL for the Cloudflare API
    pub r2_access_key: String,
    pub r2_secret_key: String,
    pub r2_endpoint: String,
    pub r2_bucket: String,
    pub port: u16,
    pub max_concurrent_jobs: usize,
    pub max_concurrent_fetches: usize,
    pub max_concurrent_lighthouse: usize,
    /// Audit backend: `"psi"` (PageSpeed Insights, the default — no local
    /// browser), `"local"` (Chromium subprocess; hangs on Fly), or `"off"`.
    pub lighthouse_mode: String,
    /// PageSpeed Insights API key (optional; PSI works keyless at lower quota).
    pub pagespeed_api_key: Option<String>,
    /// Max pages to audit with Lighthouse per crawl (sampling cap). `0` = no cap.
    pub max_lighthouse_pages: usize,
    /// Per-audit timeout (seconds).
    pub lighthouse_timeout_s: u64,
    /// Stop attempting Lighthouse after this many consecutive failures in a
    /// crawl (circuit-breaker; `0` = disabled).
    pub lighthouse_failure_threshold: usize,
    pub max_concurrent_renderers: usize,
    pub renderer_script_path: String,
    /// Whether the headless-Chromium JS renderer is enabled at all. Default
    /// **off**: the renderer spawns `node`+Chromium, which hangs/crashes on the
    /// 2 GB Fly host (returns empty stdout → "EOF while parsing" on every page).
    /// SSR sites are fully covered by the raw-HTML fallback, so this stays off
    /// unless `JS_RENDER_ENABLED` is explicitly truthy. Read once at process
    /// start, so toggling it via `flyctl` env + machine restart takes effect
    /// without a code redeploy.
    pub renderer_enabled: bool,
    /// Per-render subprocess timeout (seconds). The spawn also sets
    /// `kill_on_drop(true)` so a hung/timed-out render can't leak a child.
    pub renderer_timeout_s: u64,
    pub batch_page_threshold: usize,
    pub batch_interval_secs: u64,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let shared_secret =
            env::var("SHARED_SECRET").map_err(|_| ConfigError::Missing("SHARED_SECRET"))?;
        let api_base_url =
            env::var("API_BASE_URL").map_err(|_| ConfigError::Missing("API_BASE_URL"))?;
        let r2_access_key =
            env::var("R2_ACCESS_KEY").map_err(|_| ConfigError::Missing("R2_ACCESS_KEY"))?;
        let r2_secret_key =
            env::var("R2_SECRET_KEY").map_err(|_| ConfigError::Missing("R2_SECRET_KEY"))?;
        let r2_endpoint =
            env::var("R2_ENDPOINT").map_err(|_| ConfigError::Missing("R2_ENDPOINT"))?;
        let r2_bucket = env::var("R2_BUCKET").map_err(|_| ConfigError::Missing("R2_BUCKET"))?;

        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|_| ConfigError::InvalidValue("PORT", "must be a valid u16"))?;

        let max_concurrent_jobs = env::var("MAX_CONCURRENT_JOBS")
            .unwrap_or_else(|_| "5".to_string())
            .parse::<usize>()
            .map_err(|_| {
                ConfigError::InvalidValue("MAX_CONCURRENT_JOBS", "must be a valid usize")
            })?;

        let max_concurrent_fetches = env::var("MAX_CONCURRENT_FETCHES")
            .unwrap_or_else(|_| "50".to_string())
            .parse::<usize>()
            .map_err(|_| {
                ConfigError::InvalidValue("MAX_CONCURRENT_FETCHES", "must be a valid usize")
            })?;

        let max_concurrent_lighthouse = env::var("MAX_CONCURRENT_LIGHTHOUSE")
            .unwrap_or_else(|_| "2".to_string())
            .parse::<usize>()
            .map_err(|_| {
                ConfigError::InvalidValue("MAX_CONCURRENT_LIGHTHOUSE", "must be a valid usize")
            })?;

        // Audit backend: default to PageSpeed Insights (no local browser).
        let lighthouse_mode = env::var("LIGHTHOUSE_MODE")
            .ok()
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "psi".to_string());

        // PSI key: PAGESPEED_API_KEY, falling back to GOOGLE_API_KEY.
        let pagespeed_api_key = env::var("PAGESPEED_API_KEY")
            .or_else(|_| env::var("GOOGLE_API_KEY"))
            .ok()
            .filter(|s| !s.trim().is_empty());

        let max_lighthouse_pages = env::var("MAX_LIGHTHOUSE_PAGES")
            .unwrap_or_else(|_| "25".to_string())
            .parse::<usize>()
            .map_err(|_| {
                ConfigError::InvalidValue("MAX_LIGHTHOUSE_PAGES", "must be a valid usize")
            })?;

        let lighthouse_timeout_s = env::var("LIGHTHOUSE_TIMEOUT_S")
            .unwrap_or_else(|_| "20".to_string())
            .parse::<u64>()
            .map_err(|_| {
                ConfigError::InvalidValue("LIGHTHOUSE_TIMEOUT_S", "must be a valid u64")
            })?;

        let lighthouse_failure_threshold = env::var("LIGHTHOUSE_FAILURE_THRESHOLD")
            .unwrap_or_else(|_| "3".to_string())
            .parse::<usize>()
            .map_err(|_| {
                ConfigError::InvalidValue("LIGHTHOUSE_FAILURE_THRESHOLD", "must be a valid usize")
            })?;

        let max_concurrent_renderers = env::var("MAX_CONCURRENT_RENDERERS")
            .unwrap_or_else(|_| "3".to_string())
            .parse::<usize>()
            .map_err(|_| {
                ConfigError::InvalidValue("MAX_CONCURRENT_RENDERERS", "must be a valid usize")
            })?;

        let renderer_script_path = env::var("RENDERER_SCRIPT_PATH")
            .unwrap_or_else(|_| "/app/scripts/render-links.mjs".to_string());

        // JS renderer is OFF unless explicitly enabled. Chromium-on-Fly is
        // broken (empty stdout → EOF parse error per page); SSR raw-HTML
        // fallback covers our targets. Accepts true/1/yes/on (case-insensitive).
        let renderer_enabled = env::var("JS_RENDER_ENABLED")
            .ok()
            .map(|s| parse_bool_flag(&s))
            .unwrap_or(false);

        let renderer_timeout_s = env::var("RENDERER_TIMEOUT_S")
            .unwrap_or_else(|_| "15".to_string())
            .parse::<u64>()
            .map_err(|_| {
                ConfigError::InvalidValue("RENDERER_TIMEOUT_S", "must be a valid u64")
            })?;

        let batch_page_threshold = env::var("BATCH_PAGE_THRESHOLD")
            .unwrap_or_else(|_| "10".to_string())
            .parse::<usize>()
            .map_err(|_| {
                ConfigError::InvalidValue("BATCH_PAGE_THRESHOLD", "must be a valid usize")
            })?;

        let batch_interval_secs = env::var("BATCH_INTERVAL_SECS")
            .unwrap_or_else(|_| "10".to_string())
            .parse::<u64>()
            .map_err(|_| ConfigError::InvalidValue("BATCH_INTERVAL_SECS", "must be a valid u64"))?;

        Ok(Config {
            shared_secret,
            api_base_url,
            r2_access_key,
            r2_secret_key,
            r2_endpoint,
            r2_bucket,
            port,
            max_concurrent_jobs,
            max_concurrent_fetches,
            max_concurrent_lighthouse,
            lighthouse_mode,
            pagespeed_api_key,
            max_lighthouse_pages,
            lighthouse_timeout_s,
            lighthouse_failure_threshold,
            max_concurrent_renderers,
            renderer_script_path,
            renderer_enabled,
            renderer_timeout_s,
            batch_page_threshold,
            batch_interval_secs,
        })
    }
}

/// Parse a truthy boolean env flag. `true`/`1`/`yes`/`on` (case-insensitive,
/// surrounding whitespace ignored) are truthy; everything else is false.
fn parse_bool_flag(raw: &str) -> bool {
    matches!(
        raw.trim().to_ascii_lowercase().as_str(),
        "true" | "1" | "yes" | "on"
    )
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    Missing(&'static str),
    #[error("Invalid value for {0}: {1}")]
    InvalidValue(&'static str, &'static str),
}

#[cfg(test)]
mod tests {
    use super::parse_bool_flag;

    #[test]
    fn truthy_values_parse_true() {
        for v in ["true", "TRUE", "True", "1", "yes", "YES", "on", "ON", " on "] {
            assert!(parse_bool_flag(v), "expected {v:?} to be truthy");
        }
    }

    #[test]
    fn falsy_and_garbage_values_parse_false() {
        for v in ["false", "FALSE", "0", "no", "off", "", "  ", "enable", "maybe"] {
            assert!(!parse_bool_flag(v), "expected {v:?} to be falsy");
        }
    }
}
