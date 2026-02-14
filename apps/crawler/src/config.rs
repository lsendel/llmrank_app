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
            .unwrap_or_else(|_| "10".to_string())
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
