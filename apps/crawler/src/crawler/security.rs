use scraper::{Html, Selector};
use serde::Serialize;
use url::Url;

// ─── Value Objects ──────────────────────────────────────────────────

/// Cross-origin security report — immutable value object.
#[derive(Debug, Clone, Serialize, Default)]
pub struct CORSReport {
    pub unsafe_blank_links: u32,
    pub mixed_content_count: u32,
    pub missing_crossorigin: u32,
    pub has_issues: bool,
}

/// PDF links discovered on the page — immutable value object.
#[derive(Debug, Clone, Serialize, Default)]
pub struct PdfLinks {
    pub urls: Vec<String>,
}

// ─── Domain Logic ───────────────────────────────────────────────────

/// Analyze cross-origin security issues in the document.
pub fn analyze_cors(document: &Html, page_url: &str) -> CORSReport {
    let is_https = page_url.starts_with("https://");

    let unsafe_blank_links = count_unsafe_blank_links(document);
    let mixed_content_count = if is_https {
        count_mixed_content(document)
    } else {
        0
    };
    let missing_crossorigin = count_missing_crossorigin(document, page_url);

    let has_issues = unsafe_blank_links > 0 || mixed_content_count > 0 || missing_crossorigin > 0;

    CORSReport {
        unsafe_blank_links,
        mixed_content_count,
        missing_crossorigin,
        has_issues,
    }
}

/// Extract all PDF links from the document.
pub fn extract_pdf_links(document: &Html, base_url: &str) -> PdfLinks {
    let sel = match Selector::parse("a[href]") {
        Ok(s) => s,
        Err(_) => return PdfLinks::default(),
    };

    let base = Url::parse(base_url).ok();

    let urls: Vec<String> = document
        .select(&sel)
        .filter_map(|el| {
            let href = el.value().attr("href")?;
            if !href.to_lowercase().ends_with(".pdf") {
                return None;
            }
            let resolved = if let Some(ref base) = base {
                base.join(href).ok()?.to_string()
            } else {
                Url::parse(href).ok()?.to_string()
            };
            Some(resolved)
        })
        .collect();

    PdfLinks { urls }
}

// ─── Private Helpers ────────────────────────────────────────────────

fn count_unsafe_blank_links(document: &Html) -> u32 {
    let sel = Selector::parse("a[target='_blank']").unwrap();
    document
        .select(&sel)
        .filter(|el| {
            let rel = el.value().attr("rel").unwrap_or("");
            !rel.contains("noopener")
        })
        .count() as u32
}

fn count_mixed_content(document: &Html) -> u32 {
    let mut count = 0u32;
    for tag_attr in &[("img", "src"), ("script", "src"), ("link", "href")] {
        let selector_str = format!("{}[{}]", tag_attr.0, tag_attr.1);
        let sel = match Selector::parse(&selector_str) {
            Ok(s) => s,
            Err(_) => continue,
        };
        for el in document.select(&sel) {
            if let Some(src) = el.value().attr(tag_attr.1) {
                if src.starts_with("http://") {
                    count += 1;
                }
            }
        }
    }
    count
}

fn count_missing_crossorigin(document: &Html, page_url: &str) -> u32 {
    let page_host = Url::parse(page_url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_lowercase()));

    let mut count = 0u32;
    for (tag, attr) in &[("img", "src"), ("script", "src"), ("link", "href")] {
        let selector_str = format!("{}[{}]", tag, attr);
        let sel = match Selector::parse(&selector_str) {
            Ok(s) => s,
            Err(_) => continue,
        };
        for el in document.select(&sel) {
            if let Some(src) = el.value().attr(attr) {
                if src.starts_with("data:") || src.starts_with("blob:") {
                    continue;
                }
                if let Ok(src_url) = Url::parse(src) {
                    let src_host = src_url.host_str().map(|h| h.to_lowercase());
                    if src_host != page_host && el.value().attr("crossorigin").is_none() {
                        count += 1;
                    }
                }
            }
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cors_unsafe_blank() {
        let html = Html::parse_document(
            r#"<a href="x" target="_blank">bad</a><a href="y" target="_blank" rel="noopener">ok</a>"#,
        );
        let report = analyze_cors(&html, "https://example.com");
        assert_eq!(report.unsafe_blank_links, 1);
    }

    #[test]
    fn test_cors_mixed_content() {
        let html = Html::parse_document(
            r#"<img src="http://evil.com/img.png"><img src="https://safe.com/img.png">"#,
        );
        let report = analyze_cors(&html, "https://example.com");
        assert_eq!(report.mixed_content_count, 1);
    }

    #[test]
    fn test_cors_no_issues_on_http() {
        let html = Html::parse_document(r#"<img src="http://cdn.com/img.png">"#);
        let report = analyze_cors(&html, "http://example.com");
        assert_eq!(report.mixed_content_count, 0);
    }

    #[test]
    fn test_pdf_links() {
        let html = Html::parse_document(
            r#"<a href="/docs/report.pdf">PDF</a><a href="https://other.com/file.PDF">Other</a><a href="/page">Not PDF</a>"#,
        );
        let pdfs = extract_pdf_links(&html, "https://example.com");
        assert_eq!(pdfs.urls.len(), 2);
        assert!(pdfs.urls[0].contains("report.pdf"));
    }

    #[test]
    fn test_pdf_links_empty() {
        let html = Html::parse_document(r#"<a href="/page">No PDFs</a>"#);
        let pdfs = extract_pdf_links(&html, "https://example.com");
        assert!(pdfs.urls.is_empty());
    }
}
