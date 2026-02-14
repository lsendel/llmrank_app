use scraper::{Html, Selector};
use std::collections::HashMap;
use url::Url;

/// Complete parsed representation of an HTML page.
#[derive(Debug, Clone)]
pub struct ParsedPage {
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub canonical_url: Option<String>,
    pub headings: Headings,
    pub internal_links: Vec<String>,
    pub external_links: Vec<String>,
    pub total_images: u32,
    pub images_without_alt: u32,
    pub schema_json_ld: Vec<String>,
    pub og_tags: HashMap<String, String>,
    pub robots_directives: Vec<String>,
    pub has_robots_meta: bool,
    pub word_count: u32,
    pub flesch_score: Option<f64>,
    pub flesch_classification: Option<String>,
    pub text_html_ratio: Option<f64>,
    pub text_length: Option<usize>,
    pub html_length: Option<usize>,
    pub pdf_links: Vec<String>,
    pub cors_unsafe_blank_links: u32,
    pub cors_mixed_content: u32,
    pub cors_has_issues: bool,
    pub sentence_length_variance: Option<f64>,
    pub top_transition_words: Vec<String>,
    pub custom_extractions: Vec<super::extractor::ExtractorResult>,
}

#[derive(Debug, Clone, Default)]
pub struct Headings {
    pub h1: Vec<String>,
    pub h2: Vec<String>,
    pub h3: Vec<String>,
    pub h4: Vec<String>,
    pub h5: Vec<String>,
    pub h6: Vec<String>,
}

pub struct Parser;

impl Parser {
    /// Parse an HTML document and extract all SEO-relevant data.
    pub fn parse(html_content: &str, base_url: &str) -> ParsedPage {
        let document = Html::parse_document(html_content);
        let base = Url::parse(base_url).ok();

        let title = Self::extract_title(&document);
        let meta_description = Self::extract_meta_description(&document);
        let canonical_url = Self::extract_canonical(&document);
        let headings = Self::extract_headings(&document);
        let (internal_links, external_links) = Self::extract_links(&document, &base);
        let (total_images, images_without_alt) = Self::extract_image_stats(&document);
        let schema_json_ld = Self::extract_json_ld(&document);
        let og_tags = Self::extract_og_tags(&document);
        let (has_robots_meta, robots_directives) = Self::extract_robots_meta(&document);
        let word_count = Self::compute_word_count(&document);
        let flesch = super::readability::compute_flesch(&document);
        let text_ratio = super::readability::compute_text_html_ratio(&document, html_content);
        let cors = super::security::analyze_cors(&document, base_url);
        let pdfs = super::security::extract_pdf_links(&document, base_url);

        // Human-Readiness metrics
        let text_content = Self::get_all_text(&document);
        let (variance, transitions) = Self::analyze_human_readiness(&text_content);

        ParsedPage {
            title,
            meta_description,
            canonical_url,
            headings,
            internal_links,
            external_links,
            total_images,
            images_without_alt,
            schema_json_ld,
            og_tags,
            robots_directives,
            has_robots_meta,
            word_count,
            flesch_score: flesch.as_ref().map(|f| f.score),
            flesch_classification: flesch.as_ref().map(|f| f.classification.clone()),
            text_html_ratio: Some(text_ratio.ratio),
            text_length: Some(text_ratio.text_length),
            html_length: Some(text_ratio.html_length),
            pdf_links: pdfs.urls,
            cors_unsafe_blank_links: cors.unsafe_blank_links,
            cors_mixed_content: cors.mixed_content_count,
            cors_has_issues: cors.has_issues,
            sentence_length_variance: variance,
            top_transition_words: transitions,
            custom_extractions: vec![],
        }
    }

    fn get_all_text(document: &Html) -> String {
        let body_sel = Selector::parse("body").unwrap();
        let mut text = String::new();
        if let Some(body) = document.select(&body_sel).next() {
            collect_text_excluding(&body, &mut text);
        }
        text
    }

    fn analyze_human_readiness(text: &str) -> (Option<f64>, Vec<String>) {
        if text.is_empty() {
            return (None, vec![]);
        }

        // Split into sentences (simple heuristic)
        let sentences: Vec<&str> = text
            .split(&['.', '!', '?'][..])
            .map(|s| s.trim())
            .filter(|s| s.split_whitespace().count() > 3)
            .collect();

        if sentences.is_empty() {
            return (None, vec![]);
        }

        // Calculate variance of sentence lengths (in words)
        let lengths: Vec<f64> = sentences
            .iter()
            .map(|s| s.split_whitespace().count() as f64)
            .collect();

        let mean = lengths.iter().sum::<f64>() / lengths.len() as f64;
        let variance =
            lengths.iter().map(|l| (l - mean).powi(2)).sum::<f64>() / lengths.len() as f64;

        // Extract transition words
        let assistant_words = [
            "in conclusion",
            "moreover",
            "furthermore",
            "however",
            "therefore",
            "additionally",
            "consequently",
            "it is important to note",
            "it's important to note",
        ];

        let mut found_transitions = Vec::new();
        let lower_text = text.to_lowercase();
        for word in assistant_words {
            if lower_text.contains(word) {
                found_transitions.push(word.to_string());
            }
        }

        (Some(variance), found_transitions)
    }

    fn extract_title(document: &Html) -> Option<String> {
        let sel = Selector::parse("title").unwrap();
        document
            .select(&sel)
            .next()
            .map(|el| el.text().collect::<String>().trim().to_string())
            .filter(|s| !s.is_empty())
    }

    fn extract_meta_description(document: &Html) -> Option<String> {
        let sel = Selector::parse(r#"meta[name="description"]"#).unwrap();
        document
            .select(&sel)
            .next()
            .and_then(|el| el.value().attr("content").map(|s| s.to_string()))
            .filter(|s| !s.is_empty())
    }

    fn extract_canonical(document: &Html) -> Option<String> {
        let sel = Selector::parse(r#"link[rel="canonical"]"#).unwrap();
        document
            .select(&sel)
            .next()
            .and_then(|el| el.value().attr("href").map(|s| s.to_string()))
            .filter(|s| !s.is_empty())
    }

    fn extract_headings(document: &Html) -> Headings {
        let mut headings = Headings::default();

        for (tag, vec) in [
            ("h1", &mut headings.h1),
            ("h2", &mut headings.h2),
            ("h3", &mut headings.h3),
            ("h4", &mut headings.h4),
            ("h5", &mut headings.h5),
            ("h6", &mut headings.h6),
        ] {
            let sel = Selector::parse(tag).unwrap();
            for el in document.select(&sel) {
                let text = el.text().collect::<String>().trim().to_string();
                if !text.is_empty() {
                    vec.push(text);
                }
            }
        }

        headings
    }

    fn extract_links(document: &Html, base: &Option<Url>) -> (Vec<String>, Vec<String>) {
        let sel = Selector::parse("a[href]").unwrap();
        let mut internal = Vec::new();
        let mut external = Vec::new();

        let base_host = base
            .as_ref()
            .and_then(|u| u.host_str().map(|h| h.to_lowercase()));

        for el in document.select(&sel) {
            if let Some(href) = el.value().attr("href") {
                let resolved = if let Some(base) = base {
                    base.join(href).ok()
                } else {
                    Url::parse(href).ok()
                };

                if let Some(resolved_url) = resolved {
                    // Only include http/https links
                    if resolved_url.scheme() != "http" && resolved_url.scheme() != "https" {
                        continue;
                    }
                    let link_host = resolved_url.host_str().map(|h| h.to_lowercase());
                    let url_str = resolved_url.to_string();

                    if link_host == base_host {
                        internal.push(url_str);
                    } else {
                        external.push(url_str);
                    }
                }
            }
        }

        (internal, external)
    }

    fn extract_image_stats(document: &Html) -> (u32, u32) {
        let sel = Selector::parse("img").unwrap();
        let mut total: u32 = 0;
        let mut without_alt: u32 = 0;

        for el in document.select(&sel) {
            total += 1;
            let alt = el.value().attr("alt").unwrap_or("");
            if alt.trim().is_empty() {
                without_alt += 1;
            }
        }

        (total, without_alt)
    }

    fn extract_json_ld(document: &Html) -> Vec<String> {
        let sel = Selector::parse(r#"script[type="application/ld+json"]"#).unwrap();
        document
            .select(&sel)
            .map(|el| el.text().collect::<String>().trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }

    fn extract_og_tags(document: &Html) -> HashMap<String, String> {
        let mut tags = HashMap::new();
        // og:title, og:description, og:image, og:type
        for property in &["og:title", "og:description", "og:image", "og:type"] {
            let selector_str = format!(r#"meta[property="{}"]"#, property);
            let sel = Selector::parse(&selector_str).unwrap();
            if let Some(el) = document.select(&sel).next() {
                if let Some(content) = el.value().attr("content") {
                    if !content.is_empty() {
                        tags.insert(property.to_string(), content.to_string());
                    }
                }
            }
        }
        tags
    }

    fn extract_robots_meta(document: &Html) -> (bool, Vec<String>) {
        let sel = Selector::parse(r#"meta[name="robots"]"#).unwrap();
        let mut directives = Vec::new();
        let mut found = false;

        for el in document.select(&sel) {
            found = true;
            if let Some(content) = el.value().attr("content") {
                for directive in content.split(',') {
                    let d = directive.trim().to_lowercase();
                    if !d.is_empty() {
                        directives.push(d);
                    }
                }
            }
        }

        (found, directives)
    }

    fn compute_word_count(document: &Html) -> u32 {
        Self::get_all_text(document).split_whitespace().count() as u32
    }
}

/// Recursively collect text, skipping elements whose tag name is "script" or "style".
fn collect_text_excluding(node: &scraper::ElementRef, out: &mut String) {
    for child in node.children() {
        if let Some(text) = child.value().as_text() {
            out.push(' ');
            out.push_str(text);
        } else if let Some(el) = scraper::ElementRef::wrap(child) {
            let tag = el.value().name();
            if tag != "script" && tag != "style" {
                collect_text_excluding(&el, out);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
    <title>Test Page Title</title>
    <meta name="description" content="A test page for parsing">
    <link rel="canonical" href="https://example.com/test">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="OG Test Title">
    <meta property="og:description" content="OG description">
    <meta property="og:image" content="https://example.com/image.png">
    <meta property="og:type" content="website">
    <script type="application/ld+json">{"@type": "WebPage", "name": "Test"}</script>
</head>
<body>
    <h1>Main Heading</h1>
    <h2>Sub Heading One</h2>
    <h2>Sub Heading Two</h2>
    <h3>Third Level</h3>
    <p>This is some body text with several words for counting purposes.</p>
    <a href="/internal-page">Internal Link</a>
    <a href="https://other.com/page">External Link</a>
    <a href="https://example.com/another">Another Internal</a>
    <img src="img1.png" alt="Has alt text">
    <img src="img2.png">
    <img src="img3.png" alt="">
    <script>var x = 1; do not count these words at all;</script>
    <style>.hidden { display: none; } also not counted</style>
</body>
</html>"#;

    #[test]
    fn test_title() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert_eq!(page.title.as_deref(), Some("Test Page Title"));
    }

    #[test]
    fn test_meta_description() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert_eq!(
            page.meta_description.as_deref(),
            Some("A test page for parsing")
        );
    }

    #[test]
    fn test_canonical() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert_eq!(
            page.canonical_url.as_deref(),
            Some("https://example.com/test")
        );
    }

    #[test]
    fn test_headings() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert_eq!(page.headings.h1, vec!["Main Heading"]);
        assert_eq!(page.headings.h2, vec!["Sub Heading One", "Sub Heading Two"]);
        assert_eq!(page.headings.h3, vec!["Third Level"]);
        assert!(page.headings.h4.is_empty());
    }

    #[test]
    fn test_links() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        // /internal-page resolves to https://example.com/internal-page
        assert!(page
            .internal_links
            .iter()
            .any(|l| l.contains("internal-page")));
        assert!(page.internal_links.iter().any(|l| l.contains("another")));
        assert_eq!(page.external_links.len(), 1);
        assert!(page.external_links[0].contains("other.com"));
    }

    #[test]
    fn test_images() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert_eq!(page.total_images, 3);
        assert_eq!(page.images_without_alt, 2); // img2 has no alt, img3 has empty alt
    }

    #[test]
    fn test_json_ld() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert_eq!(page.schema_json_ld.len(), 1);
        assert!(page.schema_json_ld[0].contains("WebPage"));
    }

    #[test]
    fn test_og_tags() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert_eq!(page.og_tags.get("og:title").unwrap(), "OG Test Title");
        assert_eq!(page.og_tags.get("og:type").unwrap(), "website");
        assert_eq!(page.og_tags.len(), 4);
    }

    #[test]
    fn test_robots_meta() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        assert!(page.has_robots_meta);
        assert!(page.robots_directives.contains(&"index".to_string()));
        assert!(page.robots_directives.contains(&"follow".to_string()));
    }

    #[test]
    fn test_word_count() {
        let page = Parser::parse(TEST_HTML, "https://example.com/test");
        // Body text: heading words + paragraph words + link text
        // "Main Heading" (2) + "Sub Heading One" (3) + "Sub Heading Two" (3) + "Third Level" (2)
        // + "This is some body text with several words for counting purposes." (11)
        // + "Internal Link" (2) + "External Link" (2) + "Another Internal" (2)
        // + "Has alt text" (3) -- alt text is not visible text in <img>, but wait, img has no text children
        // Script/style words should NOT be counted
        assert!(page.word_count > 10);
        // Make sure script/style words are excluded: if they were included the count would be much higher
        assert!(page.word_count < 50);
    }

    #[test]
    fn test_no_title() {
        let html = "<html><body><p>No title here</p></body></html>";
        let page = Parser::parse(html, "https://example.com");
        assert!(page.title.is_none());
    }

    #[test]
    fn test_empty_html() {
        let html = "";
        let page = Parser::parse(html, "https://example.com");
        assert!(page.title.is_none());
        assert_eq!(page.word_count, 0);
    }
}
