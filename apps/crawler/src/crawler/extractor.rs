use regex::Regex;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

/// Configuration for a custom data extractor — value object.
#[derive(Debug, Clone, Deserialize)]
pub struct ExtractorConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub extractor_type: String, // "css_selector" | "regex"
    pub selector: String,
    pub attribute: Option<String>,
}

/// Result of running a custom extractor — value object.
#[derive(Debug, Clone, Serialize)]
pub struct ExtractorResult {
    pub name: String,
    pub matches: Vec<String>,
}

/// Execute all custom extractors against the document.
pub fn run_extractors(
    document: &Html,
    raw_html: &str,
    configs: &[ExtractorConfig],
) -> Vec<ExtractorResult> {
    configs
        .iter()
        .map(|config| run_single_extractor(document, raw_html, config))
        .collect()
}

fn run_single_extractor(
    document: &Html,
    raw_html: &str,
    config: &ExtractorConfig,
) -> ExtractorResult {
    let matches = match config.extractor_type.as_str() {
        "css_selector" => extract_by_css(document, &config.selector, config.attribute.as_deref()),
        "regex" => extract_by_regex(raw_html, &config.selector),
        _ => vec![],
    };

    ExtractorResult {
        name: config.name.clone(),
        matches,
    }
}

fn extract_by_css(document: &Html, selector_str: &str, attribute: Option<&str>) -> Vec<String> {
    let selector = match Selector::parse(selector_str) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    document
        .select(&selector)
        .filter_map(|el| match attribute {
            Some(attr) => el.value().attr(attr).map(|s| s.to_string()),
            None => {
                let text = el.text().collect::<String>().trim().to_string();
                if text.is_empty() {
                    None
                } else {
                    Some(text)
                }
            }
        })
        .collect()
}

fn extract_by_regex(html: &str, pattern: &str) -> Vec<String> {
    match Regex::new(pattern) {
        Ok(re) => re
            .captures_iter(html)
            .filter_map(|cap| {
                cap.get(1)
                    .or_else(|| cap.get(0))
                    .map(|m| m.as_str().to_string())
            })
            .take(50) // Limit results to prevent abuse
            .collect(),
        Err(_) => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_css_text_extraction() {
        let html =
            Html::parse_document(r#"<div class="price">$99</div><div class="price">$149</div>"#);
        let config = ExtractorConfig {
            name: "prices".to_string(),
            extractor_type: "css_selector".to_string(),
            selector: ".price".to_string(),
            attribute: None,
        };
        let results = run_extractors(&html, "", &[config]);
        assert_eq!(results[0].matches, vec!["$99", "$149"]);
    }

    #[test]
    fn test_css_attribute_extraction() {
        let html = Html::parse_document(r#"<a href="/page1">A</a><a href="/page2">B</a>"#);
        let config = ExtractorConfig {
            name: "links".to_string(),
            extractor_type: "css_selector".to_string(),
            selector: "a".to_string(),
            attribute: Some("href".to_string()),
        };
        let results = run_extractors(&html, "", &[config]);
        assert_eq!(results[0].matches, vec!["/page1", "/page2"]);
    }

    #[test]
    fn test_regex_extraction() {
        let html = r#"<span>Price: $99.00</span><span>Price: $149.00</span>"#;
        let doc = Html::parse_document(html);
        let config = ExtractorConfig {
            name: "prices".to_string(),
            extractor_type: "regex".to_string(),
            selector: r"\$(\d+\.\d{2})".to_string(),
            attribute: None,
        };
        let results = run_extractors(&doc, html, &[config]);
        assert_eq!(results[0].matches, vec!["99.00", "149.00"]);
    }

    #[test]
    fn test_invalid_selector() {
        let html = Html::parse_document("<p>text</p>");
        let config = ExtractorConfig {
            name: "bad".to_string(),
            extractor_type: "css_selector".to_string(),
            selector: "[[invalid".to_string(),
            attribute: None,
        };
        let results = run_extractors(&html, "", &[config]);
        assert!(results[0].matches.is_empty());
    }
}
