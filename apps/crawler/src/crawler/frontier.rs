use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashSet};
use url::Url;

/// A URL entry in the frontier queue, ordered by depth (shallow first).
#[derive(Debug, Clone, Eq, PartialEq)]
struct FrontierEntry {
    url: String,
    depth: u32,
}

impl Ord for FrontierEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Reverse depth so BinaryHeap (max-heap) gives us shallowest first
        Reverse(self.depth).cmp(&Reverse(other.depth))
    }
}

impl PartialOrd for FrontierEntry {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// BFS URL frontier with deduplication and max-depth support.
pub struct Frontier {
    queue: BinaryHeap<FrontierEntry>,
    seen: HashSet<String>,
    max_depth: u32,
    crawled: usize,
}

impl Frontier {
    /// Create a new frontier seeded with the given URLs (all at depth 0).
    pub fn new(seed_urls: &[String], max_depth: u32) -> Self {
        let mut queue = BinaryHeap::new();
        let mut seen = HashSet::new();

        for raw_url in seed_urls {
            if let Some(normalized) = normalize_url(raw_url) {
                if seen.insert(normalized.clone()) {
                    queue.push(FrontierEntry {
                        url: normalized,
                        depth: 0,
                    });
                }
            }
        }

        Frontier {
            queue,
            seen,
            max_depth,
            crawled: 0,
        }
    }

    /// Pop the next URL to crawl (shallowest depth first).
    #[allow(clippy::should_implement_trait)]
    pub fn next(&mut self) -> Option<(String, u32)> {
        if let Some(entry) = self.queue.pop() {
            self.crawled += 1;
            Some((entry.url, entry.depth))
        } else {
            None
        }
    }

    /// Add newly discovered URLs at the given depth.
    /// URLs that have already been seen or exceed max_depth are skipped.
    pub fn add_discovered(&mut self, urls: &[String], depth: u32) {
        if depth > self.max_depth {
            return;
        }
        for raw_url in urls {
            if let Some(normalized) = normalize_url(raw_url) {
                if self.seen.insert(normalized.clone()) {
                    self.queue.push(FrontierEntry {
                        url: normalized,
                        depth,
                    });
                }
            }
        }
    }

    /// Number of URLs still in the queue.
    pub fn pending_count(&self) -> usize {
        self.queue.len()
    }

    /// Number of URLs already popped (crawled).
    pub fn crawled_count(&self) -> usize {
        self.crawled
    }
}

/// Normalize a URL by:
/// - Parsing it
/// - Removing the fragment
/// - Removing trailing slash from the path (unless path is just "/")
/// - Lowercasing the scheme and host
fn normalize_url(raw: &str) -> Option<String> {
    let mut parsed = Url::parse(raw).ok()?;
    parsed.set_fragment(None);

    // Url crate already lowercases scheme and host, so we just need
    // to handle trailing slash normalization.
    let path = parsed.path().to_string();
    if path.len() > 1 && path.ends_with('/') {
        parsed.set_path(&path[..path.len() - 1]);
    }

    Some(parsed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deduplication() {
        let seeds = vec![
            "https://example.com/page".to_string(),
            "https://example.com/page".to_string(),
            "https://example.com/page#section".to_string(), // same after normalization
        ];
        let frontier = Frontier::new(&seeds, 3);
        assert_eq!(frontier.pending_count(), 1);
    }

    #[test]
    fn test_depth_limit() {
        let seeds = vec!["https://example.com".to_string()];
        let mut frontier = Frontier::new(&seeds, 2);

        // Consume seed
        let _ = frontier.next();

        // Adding at depth 2 should work
        frontier.add_discovered(&["https://example.com/a".to_string()], 2);
        assert_eq!(frontier.pending_count(), 1);

        // Adding at depth 3 should be ignored (max_depth is 2)
        frontier.add_discovered(&["https://example.com/b".to_string()], 3);
        assert_eq!(frontier.pending_count(), 1);
    }

    #[test]
    fn test_bfs_ordering() {
        let seeds = vec!["https://example.com".to_string()];
        let mut frontier = Frontier::new(&seeds, 5);

        // Consume seed (depth 0)
        let (url, depth) = frontier.next().unwrap();
        assert_eq!(depth, 0);
        assert!(url.contains("example.com"));

        // Add URLs at varying depths
        frontier.add_discovered(&["https://example.com/deep".to_string()], 3);
        frontier.add_discovered(&["https://example.com/shallow".to_string()], 1);
        frontier.add_discovered(&["https://example.com/mid".to_string()], 2);

        // Should come out shallowest first
        let (url1, d1) = frontier.next().unwrap();
        assert_eq!(d1, 1);
        assert!(url1.contains("shallow"));

        let (_url2, d2) = frontier.next().unwrap();
        assert_eq!(d2, 2);

        let (_url3, d3) = frontier.next().unwrap();
        assert_eq!(d3, 3);

        assert!(frontier.next().is_none());
    }

    #[test]
    fn test_crawled_count() {
        let seeds = vec![
            "https://example.com/a".to_string(),
            "https://example.com/b".to_string(),
        ];
        let mut frontier = Frontier::new(&seeds, 3);
        assert_eq!(frontier.crawled_count(), 0);

        frontier.next();
        assert_eq!(frontier.crawled_count(), 1);

        frontier.next();
        assert_eq!(frontier.crawled_count(), 2);
    }

    #[test]
    fn test_normalize_trailing_slash() {
        let seeds = vec![
            "https://example.com/page/".to_string(),
            "https://example.com/page".to_string(),
        ];
        let frontier = Frontier::new(&seeds, 3);
        // Both should normalize to the same URL
        assert_eq!(frontier.pending_count(), 1);
    }

    #[test]
    fn test_add_discovered_dedup() {
        let seeds = vec!["https://example.com".to_string()];
        let mut frontier = Frontier::new(&seeds, 3);
        let _ = frontier.next();

        frontier.add_discovered(&["https://example.com/a".to_string()], 1);
        frontier.add_discovered(&["https://example.com/a".to_string()], 1);
        assert_eq!(frontier.pending_count(), 1);
    }
}
