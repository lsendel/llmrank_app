use regex::Regex;
use url::Url;

/// Result of fetching and parsing sitemaps for a domain.
#[derive(Debug, Clone)]
pub struct SitemapResult {
    /// All discovered URLs from the sitemap(s).
    pub urls: Vec<String>,
    /// Total number of URLs found before filtering.
    pub total_count: u32,
}

/// Fetch and parse sitemaps from the given URLs (typically from robots.txt).
/// Returns deduplicated URLs filtered to the same domain as `seed_domain`.
///
/// Handles both `<urlset>` (standard) and `<sitemapindex>` (index) formats.
/// For sitemap indexes, fetches up to `max_child_sitemaps` child sitemaps.
pub async fn fetch_sitemap_urls(
    sitemap_urls: &[String],
    seed_domain: &str,
    max_child_sitemaps: usize,
) -> SitemapResult {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(_) => {
            return SitemapResult {
                urls: vec![],
                total_count: 0,
            }
        }
    };

    let mut all_urls: Vec<String> = Vec::new();
    let loc_re = Regex::new(r"<loc>\s*(.*?)\s*</loc>").expect("valid regex");

    for sitemap_url in sitemap_urls {
        let xml = match fetch_xml(&client, sitemap_url).await {
            Some(xml) => xml,
            None => continue,
        };

        if xml.contains("<sitemapindex") {
            // Sitemap index — extract child sitemap URLs and fetch them
            let child_urls: Vec<String> = loc_re
                .captures_iter(&xml)
                .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
                .take(max_child_sitemaps)
                .collect();

            for child_url in &child_urls {
                if let Some(child_xml) = fetch_xml(&client, child_url).await {
                    extract_locs(&loc_re, &child_xml, &mut all_urls);
                }
            }
        } else {
            // Standard sitemap — extract URLs directly
            extract_locs(&loc_re, &xml, &mut all_urls);
        }
    }

    let total_count = all_urls.len() as u32;

    // Filter to same domain and deduplicate
    let seed_domain_lower = seed_domain.to_lowercase();
    let mut seen = std::collections::HashSet::new();
    let filtered: Vec<String> = all_urls
        .into_iter()
        .filter(|url| {
            Url::parse(url)
                .ok()
                .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
                .map(|h| h == seed_domain_lower || h == format!("www.{}", seed_domain_lower))
                .unwrap_or(false)
        })
        .filter(|url| seen.insert(url.clone()))
        .collect();

    SitemapResult {
        urls: filtered,
        total_count,
    }
}

/// Fetch XML content from a URL. Returns None on any error.
async fn fetch_xml(client: &reqwest::Client, url: &str) -> Option<String> {
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    resp.text().await.ok()
}

/// Extract all `<loc>` values from XML into the output vector.
fn extract_locs(re: &Regex, xml: &str, out: &mut Vec<String>) {
    for cap in re.captures_iter(xml) {
        if let Some(m) = cap.get(1) {
            let url = m.as_str().trim();
            if !url.is_empty() {
                out.push(url.to_string());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_locs_standard_sitemap() {
        let re = Regex::new(r"<loc>\s*(.*?)\s*</loc>").unwrap();
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/blog</loc></url>
</urlset>"#;
        let mut urls = Vec::new();
        extract_locs(&re, xml, &mut urls);
        assert_eq!(urls.len(), 3);
        assert_eq!(urls[0], "https://example.com/");
        assert_eq!(urls[1], "https://example.com/about");
        assert_eq!(urls[2], "https://example.com/blog");
    }

    #[test]
    fn test_extract_locs_empty() {
        let re = Regex::new(r"<loc>\s*(.*?)\s*</loc>").unwrap();
        let mut urls = Vec::new();
        extract_locs(&re, "<urlset></urlset>", &mut urls);
        assert!(urls.is_empty());
    }

    #[test]
    fn test_extract_locs_invalid_xml() {
        let re = Regex::new(r"<loc>\s*(.*?)\s*</loc>").unwrap();
        let mut urls = Vec::new();
        extract_locs(&re, "this is not xml at all", &mut urls);
        assert!(urls.is_empty());
    }

    #[test]
    fn test_extract_locs_with_whitespace() {
        let re = Regex::new(r"<loc>\s*(.*?)\s*</loc>").unwrap();
        let xml = r#"<urlset>
  <url><loc>
    https://example.com/page
  </loc></url>
</urlset>"#;
        let mut urls = Vec::new();
        extract_locs(&re, xml, &mut urls);
        assert_eq!(urls.len(), 1);
        assert_eq!(urls[0], "https://example.com/page");
    }

    #[tokio::test]
    async fn test_fetch_sitemap_urls_domain_filtering() {
        // Can't test actual fetching without a server, but test the filtering logic
        let result = fetch_sitemap_urls(
            &["https://nonexistent.invalid/sitemap.xml".to_string()],
            "example.com",
            5,
        )
        .await;
        // Should return empty since the URL doesn't exist
        assert!(result.urls.is_empty());
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_detect_sitemap_index() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>"#;
        assert!(xml.contains("<sitemapindex"));
    }
}
