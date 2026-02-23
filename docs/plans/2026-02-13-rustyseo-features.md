# RustySEO Feature Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the highest-value features from RustySEO into LLM Rank across all tiers — readability scoring, text-to-HTML ratio, redirect chain analysis, PDF detection, CORS analysis, topic clustering, server log analysis with AI bot tracking, and custom data extractors.

**Architecture:** DDD with bounded contexts. New extraction happens in the Rust crawler (same layer). New domain types as value objects in `packages/shared`. Scoring factors in `packages/scoring`. Server log analysis as a new domain in `packages/shared` + `packages/db` + API routes. Custom extractors configured via API, executed in Rust.

**Tech Stack:** Rust (scraper, reqwest), TypeScript, Drizzle ORM, Neon PostgreSQL, Hono Workers, Next.js 15, SWR, shadcn/ui

**DDD Principles:**

- **Value Objects:** `FleschScore`, `TextHtmlRatio`, `RedirectChain`, `CORSReport`, `TopicCluster` — immutable, no identity
- **Entities:** `ServerLogEntry`, `CustomExtractor` — persisted with identity
- **Domain Services:** Pure functions in scoring/shared — no side effects
- **Bounded Contexts:** Crawl Extraction (Rust) | Scoring (TS) | Log Analysis (TS) | Custom Extraction (Rust+TS)

---

### Task 1: Rust — Add Readability Analysis (Flesch + Text Ratio)

**Files:**

- Create: `apps/crawler/src/crawler/readability.rs`
- Modify: `apps/crawler/src/crawler/parser.rs`
- Modify: `apps/crawler/src/crawler/mod.rs`

**Step 1: Create readability.rs with value objects**

Create `apps/crawler/src/crawler/readability.rs`:

```rust
use scraper::{Html, Selector};
use serde::Serialize;

// ─── Value Objects ──────────────────────────────────────────────────

/// Flesch Reading Ease score — immutable value object.
/// Formula: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
#[derive(Debug, Clone, Serialize)]
pub struct FleschScore {
    pub score: f64,
    pub classification: String,
    pub sentence_count: u32,
    pub syllable_count: u32,
}

/// Text-to-HTML ratio — immutable value object.
/// Higher ratio = more content vs markup = better for AI crawlers.
#[derive(Debug, Clone, Serialize)]
pub struct TextHtmlRatio {
    pub text_length: usize,
    pub html_length: usize,
    pub ratio: f64,
}

// ─── Domain Logic ───────────────────────────────────────────────────

/// Compute Flesch Reading Ease from paragraph text.
/// Ported from RustySEO's flesch_reader.rs.
pub fn compute_flesch(document: &Html) -> Option<FleschScore> {
    let p_sel = Selector::parse("p").ok()?;
    let text: String = document
        .select(&p_sel)
        .map(|el| el.text().collect::<String>())
        .collect::<Vec<_>>()
        .join(" ");

    if text.trim().is_empty() {
        return None;
    }

    let sentences = count_sentences(&text);
    let words = count_words(&text);
    let syllables = count_syllables(&text);

    if sentences == 0 || words == 0 {
        return None;
    }

    let score = 206.835
        - 1.015 * (words as f64 / sentences as f64)
        - 84.6 * (syllables as f64 / words as f64);

    // Clamp to 0-100 range
    let score = score.clamp(0.0, 100.0);
    let classification = classify_flesch(score);

    Some(FleschScore {
        score,
        classification,
        sentence_count: sentences,
        syllable_count: syllables,
    })
}

/// Compute text-to-HTML ratio from the full document.
pub fn compute_text_html_ratio(document: &Html, raw_html: &str) -> TextHtmlRatio {
    let body_sel = Selector::parse("body").unwrap();
    let text_length = document
        .select(&body_sel)
        .next()
        .map(|body| body.text().collect::<String>().trim().len())
        .unwrap_or(0);

    let html_length = raw_html.len();
    let ratio = if html_length > 0 {
        (text_length as f64 / html_length as f64) * 100.0
    } else {
        0.0
    };

    TextHtmlRatio {
        text_length,
        html_length,
        ratio,
    }
}

// ─── Private Helpers ────────────────────────────────────────────────

fn count_sentences(text: &str) -> u32 {
    text.chars()
        .filter(|c| *c == '.' || *c == '!' || *c == '?')
        .count()
        .max(1) as u32
}

fn count_words(text: &str) -> u32 {
    text.split_whitespace().count() as u32
}

fn count_syllables(text: &str) -> u32 {
    text.split_whitespace()
        .map(|word| count_word_syllables(word))
        .sum()
}

fn count_word_syllables(word: &str) -> u32 {
    let word = word.to_lowercase();
    let vowels = ['a', 'e', 'i', 'o', 'u'];
    let mut count = 0u32;
    let mut prev_vowel = false;

    for ch in word.chars() {
        if vowels.contains(&ch) {
            if !prev_vowel {
                count += 1;
            }
            prev_vowel = true;
        } else {
            prev_vowel = false;
        }
    }

    // Adjust for silent 'e'
    if word.ends_with('e') && count > 1 {
        count -= 1;
    }

    count.max(1)
}

fn classify_flesch(score: f64) -> String {
    match score {
        s if s >= 90.0 => "Very Easy".to_string(),
        s if s >= 80.0 => "Easy".to_string(),
        s if s >= 70.0 => "Fairly Easy".to_string(),
        s if s >= 60.0 => "Standard".to_string(),
        s if s >= 50.0 => "Fairly Difficult".to_string(),
        s if s >= 30.0 => "Difficult".to_string(),
        _ => "Very Difficult".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flesch_simple_text() {
        let html = Html::parse_document("<html><body><p>The cat sat on the mat. The dog ran fast.</p></body></html>");
        let result = compute_flesch(&html).unwrap();
        assert!(result.score > 70.0, "Simple text should be easy to read");
        assert_eq!(result.sentence_count, 2);
    }

    #[test]
    fn test_flesch_empty() {
        let html = Html::parse_document("<html><body></body></html>");
        assert!(compute_flesch(&html).is_none());
    }

    #[test]
    fn test_text_html_ratio() {
        let raw = "<html><body><p>Hello world</p></body></html>";
        let doc = Html::parse_document(raw);
        let ratio = compute_text_html_ratio(&doc, raw);
        assert!(ratio.ratio > 0.0);
        assert!(ratio.ratio < 100.0);
        assert_eq!(ratio.html_length, raw.len());
    }

    #[test]
    fn test_classify_flesch() {
        assert_eq!(classify_flesch(95.0), "Very Easy");
        assert_eq!(classify_flesch(65.0), "Standard");
        assert_eq!(classify_flesch(20.0), "Very Difficult");
    }

    #[test]
    fn test_syllable_count() {
        assert_eq!(count_word_syllables("cat"), 1);
        assert_eq!(count_word_syllables("hello"), 2);
        assert_eq!(count_word_syllables("beautiful"), 3);
    }
}
```

**Step 2: Run Rust tests**

Run: `cd apps/crawler && cargo test readability`
Expected: All tests pass

**Step 3: Register module and extend ParsedPage**

In `apps/crawler/src/crawler/mod.rs`, add:

```rust
pub mod readability;
```

In `apps/crawler/src/crawler/parser.rs`, add to `ParsedPage`:

```rust
pub flesch_score: Option<f64>,
pub flesch_classification: Option<String>,
pub text_html_ratio: Option<f64>,
pub text_length: Option<usize>,
pub html_length: Option<usize>,
```

In `Parser::parse()`, after `let word_count = ...`:

```rust
let flesch = readability::compute_flesch(&document);
let text_ratio = readability::compute_text_html_ratio(&document, html_content);
```

And populate the new fields in the returned `ParsedPage`:

```rust
flesch_score: flesch.as_ref().map(|f| f.score),
flesch_classification: flesch.as_ref().map(|f| f.classification.clone()),
text_html_ratio: Some(text_ratio.ratio),
text_length: Some(text_ratio.text_length),
html_length: Some(text_ratio.html_length),
```

**Step 4: Run all Rust tests**

Run: `cd apps/crawler && cargo test`
Expected: All existing + new tests pass

**Step 5: Commit**

```bash
git add apps/crawler/src/crawler/readability.rs apps/crawler/src/crawler/parser.rs apps/crawler/src/crawler/mod.rs
git commit -m "feat(crawler): add readability analysis — Flesch score + text-to-HTML ratio"
```

---

### Task 2: Rust — Add Redirect Chain, PDF Detection, CORS Analysis

**Files:**

- Create: `apps/crawler/src/crawler/security.rs`
- Modify: `apps/crawler/src/crawler/parser.rs`
- Modify: `apps/crawler/src/crawler/fetcher.rs`
- Modify: `apps/crawler/src/crawler/mod.rs`

**Step 1: Extend FetchResult with redirect chain**

In `apps/crawler/src/crawler/fetcher.rs`, add a value object:

```rust
/// A single hop in a redirect chain — immutable value object.
#[derive(Debug, Clone, serde::Serialize)]
pub struct RedirectHop {
    pub url: String,
    pub status_code: u16,
}
```

Add to `FetchResult`:

```rust
pub redirect_chain: Vec<RedirectHop>,
```

Modify `RateLimitedFetcher::fetch()` to disable automatic redirects and follow manually:

Replace the client builder's `.redirect(reqwest::redirect::Policy::limited(10))` with `.redirect(reqwest::redirect::Policy::none())`.

Then in the `fetch()` method, add manual redirect following (max 10 hops):

```rust
pub async fn fetch(&self, url: &str) -> Result<FetchResult, FetchError> {
    let domain = Url::parse(url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
        .unwrap_or_default();

    let limiter = self.get_limiter(&domain).await;
    limiter.until_ready().await;

    let mut current_url = url.to_string();
    let mut redirect_chain = Vec::new();
    let max_redirects = 10;

    for _ in 0..max_redirects {
        let response = self.client.get(&current_url).send().await?;
        let status = response.status().as_u16();

        if (300..400).contains(&status) {
            redirect_chain.push(RedirectHop {
                url: current_url.clone(),
                status_code: status,
            });
            if let Some(location) = response.headers().get("location") {
                let next = location.to_str().unwrap_or_default();
                // Resolve relative redirects
                current_url = if next.starts_with("http") {
                    next.to_string()
                } else if let Ok(base) = Url::parse(&current_url) {
                    base.join(next).map(|u| u.to_string()).unwrap_or(next.to_string())
                } else {
                    next.to_string()
                };
                continue;
            }
        }

        // Final response — collect headers and body
        let final_url = response.url().to_string();
        let mut headers = HashMap::new();
        for (name, value) in response.headers().iter() {
            if let Ok(v) = value.to_str() {
                headers.insert(name.to_string(), v.to_string());
            }
        }
        let body = response.text().await?;

        return Ok(FetchResult {
            status_code: status,
            body,
            headers,
            final_url,
            redirect_chain,
        });
    }

    Err(FetchError::RequestFailed(reqwest::Error::from(
        std::io::Error::new(std::io::ErrorKind::Other, "Too many redirects"),
    )))
}
```

Note: The error handling for too-many-redirects may need adjustment based on reqwest's actual error types. If `reqwest::Error::from(io::Error)` doesn't compile, create a new `FetchError::TooManyRedirects` variant instead.

**Step 2: Create security.rs for CORS + PDF analysis**

Create `apps/crawler/src/crawler/security.rs`:

```rust
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
/// Ported from RustySEO's cross_origin.rs.
pub fn analyze_cors(document: &Html, page_url: &str) -> CORSReport {
    let is_https = page_url.starts_with("https://");

    // 1. Unsafe target="_blank" links (missing rel="noopener")
    let unsafe_blank_links = count_unsafe_blank_links(document);

    // 2. Mixed content (HTTP resources on HTTPS page)
    let mixed_content_count = if is_https {
        count_mixed_content(document)
    } else {
        0
    };

    // 3. Missing crossorigin attributes on cross-origin resources
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
/// Ported from RustySEO's pdf_selector.rs.
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
            // Resolve relative URL
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
        if let Ok(sel) = Selector::parse(&selector_str) {
            for el in document.select(&sel) {
                if let Some(src) = el.value().attr(tag_attr.1) {
                    if src.starts_with("http://") {
                        count += 1;
                    }
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
        if let Ok(sel) = Selector::parse(&selector_str) {
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
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cors_unsafe_blank() {
        let html = Html::parse_document(r#"<a href="x" target="_blank">bad</a><a href="y" target="_blank" rel="noopener">ok</a>"#);
        let report = analyze_cors(&html, "https://example.com");
        assert_eq!(report.unsafe_blank_links, 1);
    }

    #[test]
    fn test_cors_mixed_content() {
        let html = Html::parse_document(r#"<img src="http://evil.com/img.png"><img src="https://safe.com/img.png">"#);
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
        let html = Html::parse_document(r#"<a href="/docs/report.pdf">PDF</a><a href="https://other.com/file.PDF">Other</a><a href="/page">Not PDF</a>"#);
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
```

**Step 3: Register module and extend ParsedPage**

In `apps/crawler/src/crawler/mod.rs`, add:

```rust
pub mod security;
```

In `apps/crawler/src/crawler/parser.rs`, add to `ParsedPage`:

```rust
pub pdf_links: Vec<String>,
pub cors_unsafe_blank_links: u32,
pub cors_mixed_content: u32,
pub cors_has_issues: bool,
```

In `Parser::parse()`, add after existing extractions:

```rust
let cors = security::analyze_cors(&document, base_url);
let pdfs = security::extract_pdf_links(&document, base_url);
```

And populate new fields:

```rust
pdf_links: pdfs.urls,
cors_unsafe_blank_links: cors.unsafe_blank_links,
cors_mixed_content: cors.mixed_content_count,
cors_has_issues: cors.has_issues,
```

**Step 4: Run all Rust tests**

Run: `cd apps/crawler && cargo test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add apps/crawler/src/crawler/security.rs apps/crawler/src/crawler/parser.rs apps/crawler/src/crawler/fetcher.rs apps/crawler/src/crawler/mod.rs
git commit -m "feat(crawler): add redirect chain tracking, PDF detection, and CORS analysis"
```

---

### Task 3: Shared — Extend Schemas with New Extraction Fields

**Files:**

- Modify: `packages/shared/src/schemas/crawl.ts`

**Step 1: Extend ExtractedDataSchema**

Add these fields to `ExtractedDataSchema` in `packages/shared/src/schemas/crawl.ts`:

```typescript
// After existing fields (images_without_alt, has_robots_meta, etc.)

// Readability (Tier 1)
flesch_score: z.number().nullable().optional(),
flesch_classification: z.string().nullable().optional(),

// Text-to-HTML ratio (Tier 2)
text_html_ratio: z.number().nullable().optional(),
text_length: z.number().int().nullable().optional(),
html_length: z.number().int().nullable().optional(),

// PDF links (Tier 2)
pdf_links: z.array(z.string()).optional().default([]),

// CORS (Tier 2)
cors_unsafe_blank_links: z.number().int().optional().default(0),
cors_mixed_content: z.number().int().optional().default(0),
cors_has_issues: z.boolean().optional().default(false),
```

Add to `CrawlPageResultSchema`:

```typescript
// After timing_ms
redirect_chain: z.array(z.object({
  url: z.string(),
  status_code: z.number().int(),
})).optional().default([]),
```

**Step 2: Run shared tests**

Run: `pnpm test --filter @llm-boost/shared`
Expected: All tests pass (Zod schema validation tests should still work since new fields are optional)

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/shared`
Expected: Clean

**Step 4: Commit**

```bash
git add packages/shared/src/schemas/crawl.ts
git commit -m "feat(shared): extend schemas with readability, CORS, PDF, and redirect fields"
```

---

### Task 4: Shared — Add 8 New Issue Definitions

**Files:**

- Modify: `packages/shared/src/constants/issues.ts`

**Step 1: Add new issue codes**

Add these 8 definitions to `ISSUE_DEFINITIONS` in the appropriate category sections:

After `SITEMAP_LOW_COVERAGE` (end of Technical section), add:

```typescript
  REDIRECT_CHAIN: {
    code: "REDIRECT_CHAIN",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page has a redirect chain with 3+ hops",
    recommendation:
      "Reduce redirect chains to a single hop. Each intermediate redirect adds latency and confuses AI crawlers.",
    effortLevel: "medium",
  },
  CORS_MIXED_CONTENT: {
    code: "CORS_MIXED_CONTENT",
    category: "technical",
    severity: "warning",
    scoreImpact: -5,
    message: "HTTPS page loads resources over insecure HTTP",
    recommendation:
      "Update all resource URLs to use HTTPS. Mixed content is blocked by browsers and penalized by crawlers.",
    effortLevel: "low",
    implementationSnippet: `<!-- Change http:// to https:// -->\n<img src="https://cdn.example.com/image.png" />`,
  },
  CORS_UNSAFE_LINKS: {
    code: "CORS_UNSAFE_LINKS",
    category: "technical",
    severity: "info",
    scoreImpact: -3,
    message: "External links with target=\"_blank\" are missing rel=\"noopener\"",
    recommendation:
      "Add rel=\"noopener noreferrer\" to all external links that open in a new tab.",
    effortLevel: "low",
    implementationSnippet: `<a href="https://external.com" target="_blank" rel="noopener noreferrer">Link</a>`,
  },
```

After `MISSING_FAQ_STRUCTURE` (end of Content section), add:

```typescript
  POOR_READABILITY: {
    code: "POOR_READABILITY",
    category: "content",
    severity: "warning",
    scoreImpact: -10,
    message: "Content readability is below recommended level (Flesch score < 50)",
    recommendation:
      "Simplify language: use shorter sentences, common words, and active voice. Target Flesch score of 60+.",
    effortLevel: "medium",
  },
  LOW_TEXT_HTML_RATIO: {
    code: "LOW_TEXT_HTML_RATIO",
    category: "content",
    severity: "warning",
    scoreImpact: -8,
    message: "Text-to-HTML ratio is below 15% — page is code-heavy with little visible content",
    recommendation:
      "Increase visible text content relative to HTML markup. Remove unnecessary wrappers, inline styles, and bloated templates.",
    effortLevel: "medium",
  },
```

After `INVALID_SCHEMA` (end of AI Readiness section), add:

```typescript
  HAS_PDF_CONTENT: {
    code: "HAS_PDF_CONTENT",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: 0,
    message: "Page links to PDF documents that AI models can index",
    recommendation:
      "Ensure PDF content is also available as HTML for better AI discoverability. Add summaries of PDF content on the linking page.",
    effortLevel: "medium",
  },
  PDF_ONLY_CONTENT: {
    code: "PDF_ONLY_CONTENT",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -5,
    message: "Page appears to primarily link to PDF content without HTML alternatives",
    recommendation:
      "Create HTML versions of important PDF content. AI models struggle to extract and cite PDF content compared to well-structured HTML.",
    effortLevel: "high",
  },
  AI_CONTENT_EXTRACTABLE: {
    code: "AI_CONTENT_EXTRACTABLE",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: 0,
    message: "Content is well-structured for AI extraction (high text ratio, good readability)",
    recommendation: "No action needed — content structure is optimized for AI crawlers.",
    effortLevel: "low",
  },
```

**Step 2: Update issue code comment count**

Change the comment:

```typescript
// All issue codes (37 original + 3 sitemap quality)
```

to:

```typescript
// All issue codes (37 original + 3 sitemap + 8 RustySEO = 48 factors)
```

**Step 3: Run shared tests**

Run: `pnpm test --filter @llm-boost/shared`
Expected: All pass

**Step 4: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/shared`
Expected: Clean

**Step 5: Commit**

```bash
git add packages/shared/src/constants/issues.ts
git commit -m "feat(shared): add 8 new issue definitions — readability, CORS, redirect, PDF"
```

---

### Task 5: Scoring — Add Readability + Text Ratio Factors (TDD)

**Files:**

- Modify: `packages/scoring/src/factors/content.ts`
- Modify: `packages/scoring/src/__tests__/content.test.ts` (or create if not exists)

**Step 1: Write failing tests**

Add tests (create file if needed at `packages/scoring/src/__tests__/content-new.test.ts`):

```typescript
import { describe, test, expect } from "vitest";
import { scoreContentFactors } from "../factors/content";
import type { PageData } from "../types";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title for SEO Analysis",
    metaDescription:
      "A description that is between 120 and 160 characters long so it passes the meta description length validation check properly.",
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc123",
    extracted: {
      h1: ["Test"],
      h2: ["Sub"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
      internal_links: ["a", "b", "c"],
      external_links: ["x"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      flesch_score: null,
      flesch_classification: null,
      text_html_ratio: null,
      text_length: null,
      html_length: null,
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
    },
    lighthouse: null,
    llmScores: null,
    ...overrides,
  };
}

describe("Readability scoring", () => {
  test("POOR_READABILITY: deducts -10 when flesch < 50", () => {
    const page = makePage({
      extracted: {
        ...makePage().extracted,
        flesch_score: 35,
        flesch_classification: "Difficult",
      },
    });
    const result = scoreContentFactors(page);
    expect(result.issues.some((i) => i.code === "POOR_READABILITY")).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  test("no deduction when flesch >= 60", () => {
    const page = makePage({
      extracted: {
        ...makePage().extracted,
        flesch_score: 72,
        flesch_classification: "Fairly Easy",
      },
    });
    const result = scoreContentFactors(page);
    expect(result.issues.some((i) => i.code === "POOR_READABILITY")).toBe(
      false,
    );
  });

  test("no deduction when flesch is null (not computed)", () => {
    const page = makePage();
    const result = scoreContentFactors(page);
    expect(result.issues.some((i) => i.code === "POOR_READABILITY")).toBe(
      false,
    );
  });
});

describe("Text-to-HTML ratio scoring", () => {
  test("LOW_TEXT_HTML_RATIO: deducts -8 when ratio < 15%", () => {
    const page = makePage({
      extracted: { ...makePage().extracted, text_html_ratio: 8.5 },
    });
    const result = scoreContentFactors(page);
    expect(result.issues.some((i) => i.code === "LOW_TEXT_HTML_RATIO")).toBe(
      true,
    );
  });

  test("no deduction when ratio >= 15%", () => {
    const page = makePage({
      extracted: { ...makePage().extracted, text_html_ratio: 35 },
    });
    const result = scoreContentFactors(page);
    expect(result.issues.some((i) => i.code === "LOW_TEXT_HTML_RATIO")).toBe(
      false,
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test --filter @llm-boost/scoring`
Expected: FAIL (POOR_READABILITY and LOW_TEXT_HTML_RATIO not implemented yet)

**Step 3: Implement factors in content.ts**

Add to `scoreContentFactors()` in `packages/scoring/src/factors/content.ts`, before the `return` statement:

```typescript
// POOR_READABILITY: -10 if flesch < 50, -5 if flesch 50-59
const flesch = page.extracted.flesch_score;
if (flesch != null) {
  if (flesch < 50) {
    deduct("POOR_READABILITY", -10, {
      fleschScore: flesch,
      classification: page.extracted.flesch_classification,
    });
  } else if (flesch < 60) {
    deduct("POOR_READABILITY", -5, {
      fleschScore: flesch,
      classification: page.extracted.flesch_classification,
    });
  }
}

// LOW_TEXT_HTML_RATIO: -8 if ratio < 15%
const textRatio = page.extracted.text_html_ratio;
if (textRatio != null && textRatio < 15) {
  deduct("LOW_TEXT_HTML_RATIO", -8, {
    textHtmlRatio: Math.round(textRatio * 100) / 100,
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test --filter @llm-boost/scoring`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/scoring/src/factors/content.ts packages/scoring/src/__tests__/
git commit -m "feat(scoring): add readability + text-to-HTML ratio factors with tests"
```

---

### Task 6: Scoring — Add Redirect, CORS, and PDF Factors (TDD)

**Files:**

- Modify: `packages/scoring/src/factors/technical.ts`
- Modify: `packages/scoring/src/factors/ai-readiness.ts`
- Modify: `packages/scoring/src/types.ts`
- Create or extend test file

**Step 1: Extend PageData type**

In `packages/scoring/src/types.ts`, add to `PageData`:

```typescript
  // Redirect chain from fetcher
  redirectChain?: Array<{ url: string; status_code: number }>;
```

**Step 2: Write failing tests**

Create `packages/scoring/src/__tests__/technical-new.test.ts`:

```typescript
import { describe, test, expect } from "vitest";
import { scoreTechnicalFactors } from "../factors/technical";
import type { PageData } from "../types";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title for SEO Analysis",
    metaDescription:
      "A description that is between 120 and 160 characters long so it passes the meta description length validation check properly.",
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc123",
    extracted: {
      h1: ["Test"],
      h2: ["Sub"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
      internal_links: ["a", "b", "c"],
      external_links: ["x"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: { "og:title": "t", "og:description": "d", "og:image": "i" },
      flesch_score: null,
      flesch_classification: null,
      text_html_ratio: null,
      text_length: null,
      html_length: null,
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
    },
    lighthouse: null,
    llmScores: null,
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
    },
    ...overrides,
  };
}

describe("Redirect chain scoring", () => {
  test("REDIRECT_CHAIN: deducts -8 when 3+ hops", () => {
    const page = makePage({
      redirectChain: [
        { url: "http://example.com", status_code: 301 },
        { url: "https://example.com", status_code: 301 },
        { url: "https://example.com/test", status_code: 301 },
      ],
    });
    const result = scoreTechnicalFactors(page);
    expect(result.issues.some((i) => i.code === "REDIRECT_CHAIN")).toBe(true);
  });

  test("no deduction for 1-2 hop redirects", () => {
    const page = makePage({
      redirectChain: [{ url: "http://example.com", status_code: 301 }],
    });
    const result = scoreTechnicalFactors(page);
    expect(result.issues.some((i) => i.code === "REDIRECT_CHAIN")).toBe(false);
  });
});

describe("CORS scoring", () => {
  test("CORS_MIXED_CONTENT: deducts -5", () => {
    const page = makePage({
      extracted: { ...makePage().extracted, cors_mixed_content: 3 },
    });
    const result = scoreTechnicalFactors(page);
    expect(result.issues.some((i) => i.code === "CORS_MIXED_CONTENT")).toBe(
      true,
    );
  });

  test("CORS_UNSAFE_LINKS: deducts -3", () => {
    const page = makePage({
      extracted: { ...makePage().extracted, cors_unsafe_blank_links: 5 },
    });
    const result = scoreTechnicalFactors(page);
    expect(result.issues.some((i) => i.code === "CORS_UNSAFE_LINKS")).toBe(
      true,
    );
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `pnpm test --filter @llm-boost/scoring`
Expected: FAIL

**Step 4: Implement factors**

In `packages/scoring/src/factors/technical.ts`, add before the `return`:

```typescript
// REDIRECT_CHAIN: -8 if 3+ hops
if (page.redirectChain && page.redirectChain.length >= 3) {
  deduct("REDIRECT_CHAIN", -8, {
    hops: page.redirectChain.length,
    chain: page.redirectChain.map((h) => `${h.status_code} ${h.url}`),
  });
}

// CORS_MIXED_CONTENT: -5 if any mixed content
if (
  page.extracted.cors_mixed_content &&
  page.extracted.cors_mixed_content > 0
) {
  deduct("CORS_MIXED_CONTENT", -5, {
    mixedContentCount: page.extracted.cors_mixed_content,
  });
}

// CORS_UNSAFE_LINKS: -3 if unsafe blank links
if (
  page.extracted.cors_unsafe_blank_links &&
  page.extracted.cors_unsafe_blank_links > 0
) {
  deduct("CORS_UNSAFE_LINKS", -3, {
    unsafeBlankLinks: page.extracted.cors_unsafe_blank_links,
  });
}
```

In `packages/scoring/src/factors/ai-readiness.ts`, add before the `return`:

```typescript
// PDF_ONLY_CONTENT: -5 if page is thin but links to PDFs
const pdfLinks = page.extracted.pdf_links ?? [];
if (pdfLinks.length > 0 && page.wordCount < 300) {
  deduct("PDF_ONLY_CONTENT", -5, {
    pdfCount: pdfLinks.length,
    wordCount: page.wordCount,
  });
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test --filter @llm-boost/scoring`
Expected: All pass

**Step 6: Commit**

```bash
git add packages/scoring/src/factors/ packages/scoring/src/types.ts packages/scoring/src/__tests__/
git commit -m "feat(scoring): add redirect chain, CORS, and PDF scoring factors with tests"
```

---

### Task 7: Scoring — Add Topic Clustering Domain Service (TDD)

**Files:**

- Create: `packages/scoring/src/domain/topic-cluster.ts`
- Create: `packages/scoring/src/__tests__/topic-cluster.test.ts`
- Modify: `packages/scoring/src/index.ts`

**Step 1: Write failing tests**

Create `packages/scoring/src/__tests__/topic-cluster.test.ts`:

```typescript
import { describe, test, expect } from "vitest";
import {
  clusterPagesByTopic,
  type PageTopicInput,
} from "../domain/topic-cluster";

const pages: PageTopicInput[] = [
  {
    url: "/pricing",
    title: "Pricing Plans",
    headings: ["Pricing", "Free Plan", "Pro Plan"],
  },
  {
    url: "/plans",
    title: "Our Plans",
    headings: ["Plans", "Starter", "Enterprise"],
  },
  {
    url: "/blog/seo-tips",
    title: "10 SEO Tips",
    headings: ["SEO Tips", "Keyword Research", "Link Building"],
  },
  {
    url: "/blog/seo-guide",
    title: "SEO Guide",
    headings: ["Complete SEO Guide", "On-Page SEO", "Technical SEO"],
  },
  { url: "/about", title: "About Us", headings: ["Our Team", "Our Mission"] },
  {
    url: "/contact",
    title: "Contact Us",
    headings: ["Get in Touch", "Office Location"],
  },
];

describe("Topic clustering", () => {
  test("groups semantically related pages", () => {
    const clusters = clusterPagesByTopic(pages);
    expect(clusters.length).toBeGreaterThan(1);
    expect(clusters.length).toBeLessThanOrEqual(pages.length);
  });

  test("each cluster has a label and pages", () => {
    const clusters = clusterPagesByTopic(pages);
    for (const cluster of clusters) {
      expect(cluster.label).toBeTruthy();
      expect(cluster.pages.length).toBeGreaterThan(0);
    }
  });

  test("all input pages appear in exactly one cluster", () => {
    const clusters = clusterPagesByTopic(pages);
    const allUrls = clusters.flatMap((c) => c.pages.map((p) => p.url));
    expect(allUrls.sort()).toEqual(pages.map((p) => p.url).sort());
  });

  test("returns single cluster for single page", () => {
    const clusters = clusterPagesByTopic([pages[0]]);
    expect(clusters.length).toBe(1);
  });

  test("returns empty for empty input", () => {
    const clusters = clusterPagesByTopic([]);
    expect(clusters.length).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test --filter @llm-boost/scoring`
Expected: FAIL (module not found)

**Step 3: Implement topic clustering**

Create `packages/scoring/src/domain/topic-cluster.ts`:

```typescript
/**
 * Topic Clustering Domain Service — pure function, no side effects.
 *
 * Groups pages by semantic similarity using n-gram overlap on titles
 * and headings. Ported from RustySEO's ngrams.rs approach, adapted
 * to TypeScript.
 */

export interface PageTopicInput {
  url: string;
  title: string | null;
  headings: string[];
}

export interface TopicCluster {
  label: string;
  pages: PageTopicInput[];
  keywords: string[];
}

/**
 * Cluster pages by topic using bigram overlap similarity.
 * Returns groups of semantically related pages.
 */
export function clusterPagesByTopic(pages: PageTopicInput[]): TopicCluster[] {
  if (pages.length === 0) return [];
  if (pages.length === 1) {
    return [
      {
        label: extractLabel(pages[0]),
        pages: [pages[0]],
        keywords: extractKeywords(pages[0]),
      },
    ];
  }

  // Step 1: Extract bigrams for each page
  const pageBigrams = pages.map((page) => ({
    page,
    bigrams: new Set(generateBigrams(pageToText(page))),
  }));

  // Step 2: Build adjacency via Jaccard similarity > threshold
  const THRESHOLD = 0.15;
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < pageBigrams.length; i++) {
    adjacency.set(i, new Set());
  }

  for (let i = 0; i < pageBigrams.length; i++) {
    for (let j = i + 1; j < pageBigrams.length; j++) {
      const similarity = jaccardSimilarity(
        pageBigrams[i].bigrams,
        pageBigrams[j].bigrams,
      );
      if (similarity >= THRESHOLD) {
        adjacency.get(i)!.add(j);
        adjacency.get(j)!.add(i);
      }
    }
  }

  // Step 3: Connected components = clusters
  const visited = new Set<number>();
  const clusters: TopicCluster[] = [];

  for (let i = 0; i < pages.length; i++) {
    if (visited.has(i)) continue;

    const component: number[] = [];
    const stack = [i];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      component.push(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    const clusterPages = component.map((idx) => pages[idx]);
    const allKeywords = clusterPages.flatMap(extractKeywords);
    const topKeywords = mostFrequent(allKeywords, 5);

    clusters.push({
      label: topKeywords[0] ?? extractLabel(clusterPages[0]),
      pages: clusterPages,
      keywords: topKeywords,
    });
  }

  return clusters;
}

// ─── Private Helpers ────────────────────────────────────────────────

function pageToText(page: PageTopicInput): string {
  return [page.title ?? "", ...page.headings].join(" ").toLowerCase();
}

function generateBigrams(text: string): string[] {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  // Also include unigrams for better matching
  bigrams.push(...words);
  return bigrams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function extractKeywords(page: PageTopicInput): string[] {
  const text = pageToText(page);
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function extractLabel(page: PageTopicInput): string {
  return (page.title ?? page.headings[0] ?? page.url).slice(0, 50);
}

function mostFrequent(words: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "our",
  "your",
  "their",
  "we",
  "you",
  "they",
  "he",
  "she",
  "not",
  "no",
  "so",
  "if",
  "then",
  "than",
  "more",
  "most",
  "very",
  "just",
  "about",
  "also",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "all",
  "each",
  "every",
]);
```

**Step 4: Export from scoring index**

Add to `packages/scoring/src/index.ts`:

```typescript
export {
  clusterPagesByTopic,
  type PageTopicInput,
  type TopicCluster,
} from "./domain/topic-cluster";
```

**Step 5: Run tests**

Run: `pnpm test --filter @llm-boost/scoring`
Expected: All pass

**Step 6: Commit**

```bash
git add packages/scoring/src/domain/ packages/scoring/src/__tests__/topic-cluster.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): add topic clustering domain service with Jaccard bigram similarity"
```

---

### Task 8: DB + Shared — Server Log Analysis Domain (Schema + Types)

**Files:**

- Create: `packages/shared/src/domain/log-analysis.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/logs.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Create domain types in shared**

Create `packages/shared/src/domain/log-analysis.ts`:

```typescript
import { z } from "zod";

// ─── Value Objects (immutable, no identity) ─────────────────────────

/** Known AI and search engine crawler user-agent patterns. */
export const AI_CRAWLER_PATTERNS: ReadonlyArray<{
  pattern: string;
  label: string;
}> = [
  { pattern: "gptbot", label: "GPTBot (OpenAI)" },
  { pattern: "chatgpt", label: "ChatGPT-User" },
  { pattern: "claudebot", label: "ClaudeBot (Anthropic)" },
  { pattern: "anthropic", label: "Anthropic" },
  { pattern: "perplexitybot", label: "PerplexityBot" },
  { pattern: "google-extended", label: "Google Extended" },
  { pattern: "googleother", label: "Google Other" },
  { pattern: "googlebot", label: "Googlebot" },
  { pattern: "bingbot", label: "Bingbot" },
  { pattern: "applebot", label: "Applebot" },
  { pattern: "semrush", label: "SEMrush" },
  { pattern: "ahrefs", label: "Ahrefs" },
  { pattern: "bytespider", label: "ByteSpider (TikTok)" },
  { pattern: "ccbot", label: "CCBot (CommonCrawl)" },
] as const;

/** Classify a user-agent string into a known bot or "Unknown". */
export function classifyBot(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  for (const { pattern, label } of AI_CRAWLER_PATTERNS) {
    if (ua.includes(pattern)) return label;
  }
  return "Unknown";
}

/** Determine if a user-agent is a known crawler. */
export function isCrawler(userAgent: string): boolean {
  return classifyBot(userAgent) !== "Unknown";
}

// ─── Zod Schemas for Log Upload ─────────────────────────────────────

/** Schema for a single parsed log entry. */
export const LogEntrySchema = z.object({
  ip: z.string(),
  timestamp: z.string(),
  method: z.string(),
  path: z.string(),
  statusCode: z.number().int(),
  userAgent: z.string(),
  responseSize: z.number().int(),
  botLabel: z.string(),
  isCrawler: z.boolean(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

/** Combined log format regex (Apache/Nginx). */
export const COMBINED_LOG_REGEX =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)]\s+"(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+([^?"]+)(?:\?[^"]*)?\s+HTTP\/[0-9.]+"\s+(\d{3})\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"/;

/** Parse a single line of Apache/Nginx combined log format. */
export function parseLogLine(line: string): LogEntry | null {
  const match = line.match(COMBINED_LOG_REGEX);
  if (!match) return null;

  const [, ip, timestamp, method, path, status, size, , userAgent] = match;
  const botLabel = classifyBot(userAgent);

  return {
    ip,
    timestamp,
    method,
    path,
    statusCode: parseInt(status, 10),
    userAgent,
    responseSize: parseInt(size, 10),
    botLabel,
    isCrawler: botLabel !== "Unknown",
  };
}

/** Stats summary — immutable value object. */
export interface LogAnalysisSummary {
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  botBreakdown: Array<{ bot: string; count: number }>;
  statusBreakdown: Array<{ status: number; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

/** Compute summary statistics from parsed log entries. */
export function summarizeLogs(entries: LogEntry[]): LogAnalysisSummary {
  const crawlerEntries = entries.filter((e) => e.isCrawler);
  const uniqueIPs = new Set(entries.map((e) => e.ip)).size;

  // Bot breakdown
  const botCounts = new Map<string, number>();
  for (const e of crawlerEntries) {
    botCounts.set(e.botLabel, (botCounts.get(e.botLabel) ?? 0) + 1);
  }
  const botBreakdown = [...botCounts.entries()]
    .map(([bot, count]) => ({ bot, count }))
    .sort((a, b) => b.count - a.count);

  // Status breakdown
  const statusCounts = new Map<number, number>();
  for (const e of entries) {
    statusCounts.set(e.statusCode, (statusCounts.get(e.statusCode) ?? 0) + 1);
  }
  const statusBreakdown = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Top paths (by crawler requests)
  const pathCounts = new Map<string, number>();
  for (const e of crawlerEntries) {
    pathCounts.set(e.path, (pathCounts.get(e.path) ?? 0) + 1);
  }
  const topPaths = [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalRequests: entries.length,
    crawlerRequests: crawlerEntries.length,
    uniqueIPs,
    botBreakdown,
    statusBreakdown,
    topPaths,
  };
}
```

**Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export {
  AI_CRAWLER_PATTERNS,
  classifyBot,
  isCrawler,
  parseLogLine,
  summarizeLogs,
  LogEntrySchema,
  COMBINED_LOG_REGEX,
  type LogEntry,
  type LogAnalysisSummary,
} from "./domain/log-analysis";
```

**Step 3: Add DB table**

Add to `packages/db/src/schema.ts` after `planPriceHistory`:

```typescript
// ---------------------------------------------------------------------------
// Server Log Uploads
// ---------------------------------------------------------------------------

export const logUploads = pgTable(
  "log_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    totalRequests: integer("total_requests").notNull().default(0),
    crawlerRequests: integer("crawler_requests").notNull().default(0),
    uniqueIPs: integer("unique_ips").notNull().default(0),
    summary: jsonb("summary"), // LogAnalysisSummary JSON
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_log_uploads_project").on(t.projectId)],
);
```

**Step 4: Create log queries**

Create `packages/db/src/queries/logs.ts`:

```typescript
import { eq, desc } from "drizzle-orm";
import type { Database } from "../client";
import { logUploads } from "../schema";

export function logQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      userId: string;
      filename: string;
      totalRequests: number;
      crawlerRequests: number;
      uniqueIPs: number;
      summary: unknown;
    }) {
      const [upload] = await db.insert(logUploads).values(data).returning();
      return upload;
    },

    async listByProject(projectId: string, limit = 20) {
      return db.query.logUploads.findMany({
        where: eq(logUploads.projectId, projectId),
        orderBy: desc(logUploads.createdAt),
        limit,
      });
    },

    async getById(id: string) {
      return db.query.logUploads.findFirst({
        where: eq(logUploads.id, id),
      });
    },
  };
}
```

**Step 5: Export from db index**

Add to `packages/db/src/index.ts`:

```typescript
export { logQueries } from "./queries/logs";
```

**Step 6: Verify typecheck**

Run: `pnpm typecheck`
Expected: All packages clean

**Step 7: Commit**

```bash
git add packages/shared/src/domain/ packages/shared/src/index.ts packages/db/src/schema.ts packages/db/src/queries/logs.ts packages/db/src/index.ts
git commit -m "feat: add server log analysis domain — types, parser, DB schema, queries"
```

---

### Task 9: API — Server Log Upload + Analysis Endpoints

**Files:**

- Create: `packages/api/src/routes/logs.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Create log routes**

Create `packages/api/src/routes/logs.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { logQueries } from "@llm-boost/db";
import { parseLogLine, summarizeLogs, type LogEntry } from "@llm-boost/shared";

export const logRoutes = new Hono<AppEnv>();

// ─── POST /:projectId/upload — Upload + analyze server log file ────

logRoutes.post("/:projectId/upload", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const body = await c.req.json<{ filename: string; content: string }>();
  if (!body.content || !body.filename) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "filename and content required",
        },
      },
      422,
    );
  }

  // Parse log lines
  const lines = body.content.split("\n").filter((l) => l.trim().length > 0);
  const entries: LogEntry[] = [];
  for (const line of lines) {
    const entry = parseLogLine(line);
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "No valid log entries found",
        },
      },
      422,
    );
  }

  // Compute summary
  const summary = summarizeLogs(entries);

  // Persist
  const upload = await logQueries(db).create({
    projectId,
    userId,
    filename: body.filename,
    totalRequests: summary.totalRequests,
    crawlerRequests: summary.crawlerRequests,
    uniqueIPs: summary.uniqueIPs,
    summary,
  });

  return c.json({ data: { id: upload.id, summary } });
});

// ─── GET /:projectId — List log uploads for project ────────────────

logRoutes.get("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const uploads = await logQueries(db).listByProject(projectId);
  return c.json({ data: uploads });
});

// ─── GET /detail/:id — Get a specific log upload with summary ──────

logRoutes.get("/detail/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const upload = await logQueries(db).getById(c.req.param("id"));
  if (!upload) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Log upload not found" } },
      404,
    );
  }
  return c.json({ data: upload });
});
```

**Step 2: Register in index.ts**

Add to `packages/api/src/index.ts`:

```typescript
import { logRoutes } from "./routes/logs";
// ...
app.route("/api/logs", logRoutes);
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/api`
Expected: Clean

**Step 4: Commit**

```bash
git add packages/api/src/routes/logs.ts packages/api/src/index.ts
git commit -m "feat(api): add server log upload and analysis endpoints"
```

---

### Task 10: Frontend — Server Log Analysis Dashboard

**Files:**

- Create: `apps/web/src/app/dashboard/projects/[id]/logs/page.tsx`
- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add API client methods + types**

Add to `apps/web/src/lib/api.ts`:

Types (after existing types):

```typescript
export interface LogUpload {
  id: string;
  projectId: string;
  filename: string;
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  summary: LogAnalysisSummary;
  createdAt: string;
}

export interface LogAnalysisSummary {
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  botBreakdown: Array<{ bot: string; count: number }>;
  statusBreakdown: Array<{ status: number; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}
```

Methods (add `logs` section to `api` object):

```typescript
  // ── Logs ──────────────────────────────────────────────────────────
  logs: {
    async upload(
      token: string,
      projectId: string,
      data: { filename: string; content: string },
    ): Promise<{ id: string; summary: LogAnalysisSummary }> {
      const res = await apiClient.post<ApiEnvelope<{ id: string; summary: LogAnalysisSummary }>>(
        `/api/logs/${projectId}/upload`,
        data,
        { token },
      );
      return res.data;
    },

    async list(token: string, projectId: string): Promise<LogUpload[]> {
      const res = await apiClient.get<ApiEnvelope<LogUpload[]>>(
        `/api/logs/${projectId}`,
        { token },
      );
      return res.data;
    },
  },
```

**Step 2: Create log analysis page**

Create `apps/web/src/app/dashboard/projects/[id]/logs/page.tsx`:

A "use client" page with:

- File upload area (drag-and-drop or file input accepting `.log`, `.txt` files)
- On upload: read file as text, POST to API, display results
- Summary stat cards: Total Requests, Crawler Requests, Unique IPs, AI Bot %
- Bot breakdown table (sorted by count)
- Top crawled paths table (sorted by count)
- Uses `useApiSWR` for listing past uploads

The page should import shadcn Card, Badge, Button, Input components and lucide icons (Upload, Bot, Globe, FileText).

Implementation:

- `useApiSWR` to fetch `api.logs.list(token, projectId)`
- File input `onChange` reads `FileReader.readAsText()`, then calls `api.logs.upload()`
- Display bot breakdown with colored badges for AI bots (GPTBot green, ClaudeBot purple, etc.)
- Display top paths as a simple table

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/web`
Expected: Clean

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/projects/[id]/logs/ apps/web/src/lib/api.ts
git commit -m "feat(web): add server log analysis dashboard with bot tracking"
```

---

### Task 11: DB + API — Custom Extractor Configuration (CRUD)

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/extractors.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/api/src/routes/extractors.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/shared/src/schemas/crawl.ts`

**Step 1: Add DB table**

Add to `packages/db/src/schema.ts`:

```typescript
// ---------------------------------------------------------------------------
// Custom Extractors
// ---------------------------------------------------------------------------

export const customExtractors = pgTable(
  "custom_extractors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // "css_selector" | "regex"
    selector: text("selector").notNull(), // CSS selector or regex pattern
    attribute: text("attribute"), // e.g., "text", "href", "src", or null for text content
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_extractors_project").on(t.projectId)],
);
```

**Step 2: Create extractor queries**

Create `packages/db/src/queries/extractors.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import type { Database } from "../client";
import { customExtractors } from "../schema";

export function extractorQueries(db: Database) {
  return {
    async listByProject(projectId: string) {
      return db.query.customExtractors.findMany({
        where: eq(customExtractors.projectId, projectId),
      });
    },

    async create(data: {
      projectId: string;
      name: string;
      type: string;
      selector: string;
      attribute?: string;
    }) {
      const [extractor] = await db
        .insert(customExtractors)
        .values(data)
        .returning();
      return extractor;
    },

    async update(
      id: string,
      projectId: string,
      data: { name?: string; selector?: string; attribute?: string },
    ) {
      const [updated] = await db
        .update(customExtractors)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(customExtractors.id, id),
            eq(customExtractors.projectId, projectId),
          ),
        )
        .returning();
      return updated;
    },

    async remove(id: string, projectId: string) {
      await db
        .delete(customExtractors)
        .where(
          and(
            eq(customExtractors.id, id),
            eq(customExtractors.projectId, projectId),
          ),
        );
    },
  };
}
```

**Step 3: Export from db index**

```typescript
export { extractorQueries } from "./queries/extractors";
```

**Step 4: Create API routes**

Create `packages/api/src/routes/extractors.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { extractorQueries } from "@llm-boost/db";

export const extractorRoutes = new Hono<AppEnv>();

// GET /:projectId — list extractors
extractorRoutes.get("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const extractors = await extractorQueries(db).listByProject(
    c.req.param("projectId"),
  );
  return c.json({ data: extractors });
});

// POST /:projectId — create extractor
extractorRoutes.post("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const body = await c.req.json<{
    name: string;
    type: string;
    selector: string;
    attribute?: string;
  }>();

  if (!body.name || !body.type || !body.selector) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "name, type, and selector required",
        },
      },
      422,
    );
  }

  if (body.type !== "css_selector" && body.type !== "regex") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "type must be css_selector or regex",
        },
      },
      422,
    );
  }

  const extractor = await extractorQueries(db).create({ ...body, projectId });
  return c.json({ data: extractor }, 201);
});

// PUT /:projectId/:id — update extractor
extractorRoutes.put("/:projectId/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const updated = await extractorQueries(db).update(
    c.req.param("id"),
    c.req.param("projectId"),
    await c.req.json(),
  );
  if (!updated) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Extractor not found" } },
      404,
    );
  }
  return c.json({ data: updated });
});

// DELETE /:projectId/:id — remove extractor
extractorRoutes.delete("/:projectId/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  await extractorQueries(db).remove(
    c.req.param("id"),
    c.req.param("projectId"),
  );
  return c.json({ data: { deleted: true } });
});
```

**Step 5: Register in index.ts**

```typescript
import { extractorRoutes } from "./routes/extractors";
// ...
app.route("/api/extractors", extractorRoutes);
```

**Step 6: Extend CrawlJobPayload with extractor configs**

In `packages/shared/src/schemas/crawl.ts`, add to `CrawlJobPayloadSchema.config`:

```typescript
custom_extractors: z.array(z.object({
  name: z.string(),
  type: z.enum(["css_selector", "regex"]),
  selector: z.string(),
  attribute: z.string().nullable().optional(),
})).optional().default([]),
```

**Step 7: Verify typecheck**

Run: `pnpm typecheck`
Expected: All clean

**Step 8: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/queries/extractors.ts packages/db/src/index.ts packages/api/src/routes/extractors.ts packages/api/src/index.ts packages/shared/src/schemas/crawl.ts
git commit -m "feat: add custom extractor CRUD — DB schema, queries, API routes"
```

---

### Task 12: Rust — Custom Extractor Execution During Crawl

**Files:**

- Create: `apps/crawler/src/crawler/extractor.rs`
- Modify: `apps/crawler/src/crawler/parser.rs`
- Modify: `apps/crawler/src/crawler/mod.rs`

**Step 1: Create extractor module**

Create `apps/crawler/src/crawler/extractor.rs`:

```rust
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
            Some("href") => el.value().attr("href").map(|s| s.to_string()),
            Some("src") => el.value().attr("src").map(|s| s.to_string()),
            Some(attr) => el.value().attr(attr).map(|s| s.to_string()),
            None => {
                let text = el.text().collect::<String>().trim().to_string();
                if text.is_empty() { None } else { Some(text) }
            }
        })
        .collect()
}

fn extract_by_regex(html: &str, pattern: &str) -> Vec<String> {
    match Regex::new(pattern) {
        Ok(re) => re
            .captures_iter(html)
            .filter_map(|cap| cap.get(1).or_else(|| cap.get(0)).map(|m| m.as_str().to_string()))
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
        let html = Html::parse_document(r#"<div class="price">$99</div><div class="price">$149</div>"#);
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
```

**Step 2: Add `regex` crate to Cargo.toml**

In `apps/crawler/Cargo.toml`, add under `[dependencies]`:

```toml
regex = "1"
```

**Step 3: Register module and integrate with ParsedPage**

In `apps/crawler/src/crawler/mod.rs`:

```rust
pub mod extractor;
```

Add to `ParsedPage`:

```rust
pub custom_extractions: Vec<extractor::ExtractorResult>,
```

In `Parser::parse()`, add after existing extractions:

```rust
// Custom extractors are run separately via run_extractors() after parsing
```

Initialize in `ParsedPage` construction:

```rust
custom_extractions: vec![], // Populated by caller via extractor::run_extractors()
```

**Step 4: Run tests**

Run: `cd apps/crawler && cargo test extractor`
Expected: All pass

Run: `cd apps/crawler && cargo test`
Expected: All pass

**Step 5: Commit**

```bash
git add apps/crawler/src/crawler/extractor.rs apps/crawler/src/crawler/parser.rs apps/crawler/src/crawler/mod.rs apps/crawler/Cargo.toml apps/crawler/Cargo.lock
git commit -m "feat(crawler): add custom extractor execution — CSS selector + regex"
```

---

### Task 13: Final Verification

**Step 1: Run all TypeScript tests**

Run: `pnpm test`
Expected: All existing + new tests pass (150+)

**Step 2: Typecheck all packages**

Run: `pnpm typecheck`
Expected: All 7+ packages clean

**Step 3: Run Rust tests**

Run: `cd apps/crawler && cargo test`
Expected: All tests pass (30+ existing + new)

**Step 4: Build frontend**

Run: `pnpm build --filter @llm-boost/web`
Expected: Compiles successfully

**Step 5: Commit any final adjustments**

```bash
git add -A
git status
# Only commit if there are changes
git commit -m "chore: final verification — all tests pass, typecheck clean"
```
