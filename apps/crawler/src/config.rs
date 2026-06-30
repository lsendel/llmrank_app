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
    /// Remote Lighthouse offload URL. `None` (default) = run locally via the
    /// Chromium the Dockerfile provisions. Set `LIGHTHOUSE_REMOTE_URL` to offload
    /// (also the instant kill-switch for the local path — no redeploy needed).
    pub lighthouse_remote_url: Option<String>,
    /// Max pages to audit with Lighthouse per crawl (sampling cap). `0` = no cap.
    pub max_lighthouse_pages: usize,
    /// Per-audit timeout (seconds). Short so a hung audit resolves fast.
    pub lighthouse_timeout_s: u64,
    /// Stop attempting Lighthouse after this many consecutive failures in a
    /// crawl (circuit-breaker; `0` = disabled).
    pub lighthouse_failure_threshold: usize,
    pub max_concurrent_renderers: usize,
    pub renderer_script_path: String,
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

        // Default to LOCAL Lighthouse: empty/unset means run in-crawler.
        let lighthouse_remote_url = env::var("LIGHTHOUSE_REMOTE_URL")
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
            lighthouse_remote_url,
            max_lighthouse_pages,
            lighthouse_timeout_s,
            lighthouse_failure_threshold,
            max_concurrent_renderers,
            renderer_script_path,
            batch_page_threshold,
            batch_interval_secs,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    Missing(&'static str),
    #[error("Invalid value for {0}: {1}")]
    InvalidValue(&'static str, &'static str),
}
