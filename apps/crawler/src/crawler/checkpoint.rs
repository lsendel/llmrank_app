use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize)]
pub struct CrawlCheckpoint {
    pub job_id: String,
    pub seen_urls: HashSet<String>,
    pub pending_urls: Vec<(String, u32, u32)>, // (url, depth, priority)
    pub pages_crawled: usize,
    pub batch_index: u32,
}

impl CrawlCheckpoint {
    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        let json = serde_json::to_string(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(path, json)
    }

    pub fn load(path: &Path) -> std::io::Result<Self> {
        let json = std::fs::read_to_string(path)?;
        serde_json::from_str(&json).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
    }

    pub fn path_for(job_id: &str) -> PathBuf {
        PathBuf::from(format!("/tmp/crawl-checkpoint-{}.json", job_id))
    }
}
