# Crawler Backlink Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the Rust crawler to extract anchor text and rel attributes from external links, then POST discovered links to the API's backlinks ingestion endpoint after each crawl batch.

**Architecture:** The crawler already extracts external link URLs during HTML parsing (`parser.rs:210-244`). We enhance this to also capture anchor text and rel attributes, add a new `ExtractedLink` struct, then POST external links to `{API_BASE_URL}/api/backlinks/ingest` (HMAC-signed) alongside the existing crawl callback. The backlinks POST is decoupled from the main callback — it's a separate fire-and-forget HTTP call using the same HMAC signing pattern.

**Tech Stack:** Rust (scraper crate for HTML, reqwest for HTTP, hmac/sha2 for signing, serde for JSON)

---

### Task 1: Add `ExtractedLink` Struct to Models

**Files:**

- Modify: `apps/crawler/src/models.rs:57-98`

**Step 1: Add the `ExtractedLink` struct above `ExtractedData`**

At line 57 (before `ExtractedData`), add:

```rust
/// A link extracted from a page with metadata for backlink tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedLink {
    pub url: String,
    pub anchor_text: String,
    pub rel: String,       // e.g. "nofollow", "sponsored", "" for dofollow
    pub is_external: bool,
}
```

**Step 2: Add `external_link_details` field to `ExtractedData`**

After the existing `external_links: Vec<String>` field (line 68), add:

```rust
    #[serde(default)]
    pub external_link_details: Vec<ExtractedLink>,
```

**Step 3: Verify it compiles**

Run: `cd apps/crawler && cargo check 2>&1 | head -20`
Expected: Compile errors in `crawler/mod.rs` because `ExtractedData` initialization is missing the new field. This is expected — we'll fix it in Task 3.

**Step 4: Commit**

```bash
git add apps/crawler/src/models.rs
git commit -m "feat(crawler): add ExtractedLink struct with anchor_text and rel fields"
```

---

### Task 2: Enhance Parser Link Extraction

**Files:**

- Modify: `apps/crawler/src/crawler/parser.rs:7-33` (ParsedPage struct)
- Modify: `apps/crawler/src/crawler/parser.rs:210-244` (extract_links function)

**Step 1: Add `ExtractedLink` import and new field to `ParsedPage`**

At the top of `parser.rs`, add the import:

```rust
use crate::models::ExtractedLink;
```

In the `ParsedPage` struct, after `external_links: Vec<String>` (line 13), add:

```rust
    pub external_link_details: Vec<ExtractedLink>,
```

**Step 2: Rewrite `extract_links()` to capture anchor text and rel**

Replace the entire `extract_links` method (lines 210-244) with:

```rust
    fn extract_links(document: &Html, base: &Option<Url>) -> (Vec<String>, Vec<String>, Vec<ExtractedLink>) {
        let sel = Selector::parse("a[href]").unwrap();
        let mut internal = Vec::new();
        let mut external = Vec::new();
        let mut external_details = Vec::new();

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
                    if resolved_url.scheme() != "http" && resolved_url.scheme() != "https" {
                        continue;
                    }
                    let link_host = resolved_url.host_str().map(|h| h.to_lowercase());
                    let url_str = resolved_url.to_string();

                    if link_host == base_host {
                        internal.push(url_str);
                    } else {
                        // Capture anchor text (trimmed, max 500 chars)
                        let anchor_text = el
                            .text()
                            .collect::<String>()
                            .trim()
                            .chars()
                            .take(500)
                            .collect::<String>();

                        // Capture rel attribute
                        let rel = el
                            .value()
                            .attr("rel")
                            .unwrap_or("")
                            .to_string();

                        external_details.push(ExtractedLink {
                            url: url_str.clone(),
                            anchor_text,
                            rel,
                            is_external: true,
                        });
                        external.push(url_str);
                    }
                }
            }
        }

        (internal, external, external_details)
    }
```

**Step 3: Update `parse()` call site to destructure the new return value**

In the `parse()` function (line 57), change:

```rust
        let (internal_links, external_links) = Self::extract_links(&document, &base);
```

to:

```rust
        let (internal_links, external_links, external_link_details) = Self::extract_links(&document, &base);
```

And in the `ParsedPage` construction (line 72-98), add:

```rust
            external_link_details,
```

after the `external_links,` line.

**Step 4: Verify it compiles (parser only)**

Run: `cd apps/crawler && cargo check 2>&1 | head -20`
Expected: Still the `ExtractedData` initialization error from Task 1 — parser itself should be fine.

**Step 5: Commit**

```bash
git add apps/crawler/src/crawler/parser.rs
git commit -m "feat(crawler): extract anchor text and rel attributes from external links"
```

---

### Task 3: Wire Rich Link Data Through CrawlEngine

**Files:**

- Modify: `apps/crawler/src/crawler/mod.rs:165-191` (ExtractedData construction in crawl_page)

**Step 1: Add the new field to `ExtractedData` construction**

In `crawl_page()` (around line 165), find the `ExtractedData { ... }` block and add after `external_links`:

```rust
                external_link_details: parsed.external_link_details,
```

**Step 2: Verify it compiles cleanly**

Run: `cd apps/crawler && cargo check`
Expected: Clean compilation, no errors.

**Step 3: Commit**

```bash
git add apps/crawler/src/crawler/mod.rs
git commit -m "feat(crawler): propagate external_link_details through CrawlEngine"
```

---

### Task 4: Add Backlinks POST Function

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs`

**Step 1: Add a `BacklinksPayload` struct and `send_backlinks` function**

After the `send_callback` function (after line 468), add:

```rust
    /// POST discovered external links to the backlinks ingestion endpoint.
    /// Fire-and-forget: logs errors but does not fail the crawl job.
    async fn send_backlinks(
        client: &reqwest::Client,
        api_base_url: &str,
        links: Vec<BacklinkEntry>,
        secret: &str,
    ) {
        if links.is_empty() {
            return;
        }

        let url = format!("{}/api/backlinks/ingest", api_base_url.trim_end_matches('/'));

        let payload = serde_json::json!({
            "links": links
        });

        let body = match serde_json::to_string(&payload) {
            Ok(b) => b,
            Err(e) => {
                tracing::error!("Failed to serialize backlinks payload: {}", e);
                return;
            }
        };

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string();

        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        mac.update(timestamp.as_bytes());
        mac.update(body.as_bytes());
        let signature = format!("hmac-sha256={}", hex::encode(mac.finalize().into_bytes()));

        match client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("X-Timestamp", &timestamp)
            .header("X-Signature", &signature)
            .body(body)
            .send()
            .await
        {
            Ok(resp) => {
                tracing::info!(
                    status = resp.status().as_u16(),
                    link_count = links.len(),
                    "Backlinks POST sent"
                );
            }
            Err(e) => {
                tracing::warn!(error = %e, "Failed to POST backlinks (non-fatal)");
            }
        }
    }
```

**Step 2: Add `BacklinkEntry` struct at the top of the file (after the imports)**

After line 19, add:

```rust
/// Matches the API's backlinks ingestion payload shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BacklinkEntry {
    source_url: String,
    source_domain: String,
    target_url: String,
    target_domain: String,
    anchor_text: String,
    rel: String,
}
```

Add `Serialize, Deserialize` imports — they should already be available via `use crate::models::*;` but if not, add:

```rust
use serde::{Serialize, Deserialize};
```

**Step 3: Add a helper to convert `ExtractedLink` data into `BacklinkEntry` list**

After `BacklinkEntry`, add:

```rust
/// Collect all external link details from a batch of pages into BacklinkEntry list.
fn collect_backlink_entries(pages: &[CrawlPageResult]) -> Vec<BacklinkEntry> {
    let mut entries = Vec::new();
    for page in pages {
        let source_domain = CrawlEngine::domain_from_url(&page.url).unwrap_or_default();
        for link in &page.extracted.external_link_details {
            let target_domain = CrawlEngine::domain_from_url(&link.url).unwrap_or_default();
            if target_domain.is_empty() {
                continue;
            }
            entries.push(BacklinkEntry {
                source_url: page.url.clone(),
                source_domain: source_domain.clone(),
                target_url: link.url.clone(),
                target_domain,
                anchor_text: link.anchor_text.clone(),
                rel: link.rel.clone(),
            });
        }
    }
    entries
}
```

**Step 4: Verify it compiles**

Run: `cd apps/crawler && cargo check`
Expected: Compiles clean (the function is defined but not called yet).

**Step 5: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs
git commit -m "feat(crawler): add backlinks POST function with HMAC signing"
```

---

### Task 5: Wire Backlinks POST Into Crawl Loop

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs` (inside `run_crawl_job`)

**Step 1: After each mid-crawl batch callback, POST backlinks**

Find the batch sending block (around lines 342-367). After the `Self::send_callback(...)` call (line 358-364), add:

```rust
                        // POST external links to backlinks ingestion endpoint
                        let backlink_entries = collect_backlink_entries(&batch.pages);
                        Self::send_backlinks(
                            &callback_client,
                            &config.api_base_url,
                            backlink_entries,
                            &config.shared_secret,
                        )
                        .await;
```

**Step 2: After the final batch callback, POST backlinks**

Find the final batch send (around lines 388-394). After the `Self::send_callback(...)` call for the final batch, add:

```rust
        // POST final batch backlinks
        let backlink_entries = collect_backlink_entries(&final_batch.pages);
        Self::send_backlinks(
            &callback_client,
            &config.api_base_url,
            backlink_entries,
            &config.shared_secret,
        )
        .await;
```

**Step 3: Verify it compiles**

Run: `cd apps/crawler && cargo check`
Expected: Clean compilation.

**Step 4: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs
git commit -m "feat(crawler): wire backlinks POST into crawl batch loop"
```

---

### Task 6: Update Parser Tests

**Files:**

- Modify: `apps/crawler/src/crawler/parser.rs` (test module, lines 329-467)

**Step 1: Update existing `test_links` test to verify external_link_details**

Find `test_links` (line 396) and replace with:

```rust
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

        // Verify external_link_details
        assert_eq!(page.external_link_details.len(), 1);
        let detail = &page.external_link_details[0];
        assert!(detail.url.contains("other.com/page"));
        assert_eq!(detail.anchor_text, "External Link");
        assert!(detail.is_external);
    }
```

**Step 2: Add a test for anchor text and rel extraction**

After `test_links`, add:

```rust
    #[test]
    fn test_external_link_details_with_rel() {
        let html = r#"<!DOCTYPE html>
<html><body>
    <a href="https://sponsored.com/deal" rel="nofollow sponsored">Great Deal</a>
    <a href="https://friend.com/page" rel="noopener">Friend Site</a>
    <a href="https://plain.com/page">Plain Link</a>
    <a href="/internal">Internal</a>
</body></html>"#;
        let page = Parser::parse(html, "https://example.com");
        assert_eq!(page.external_link_details.len(), 3);

        let sponsored = page.external_link_details.iter().find(|l| l.url.contains("sponsored.com")).unwrap();
        assert_eq!(sponsored.anchor_text, "Great Deal");
        assert_eq!(sponsored.rel, "nofollow sponsored");

        let friend = page.external_link_details.iter().find(|l| l.url.contains("friend.com")).unwrap();
        assert_eq!(friend.anchor_text, "Friend Site");
        assert_eq!(friend.rel, "noopener");

        let plain = page.external_link_details.iter().find(|l| l.url.contains("plain.com")).unwrap();
        assert_eq!(plain.anchor_text, "Plain Link");
        assert_eq!(plain.rel, "");
    }
```

**Step 3: Run parser tests**

Run: `cd apps/crawler && cargo test parser -- --nocapture`
Expected: All parser tests pass (11 tests: 9 existing + 1 updated + 1 new).

**Step 4: Commit**

```bash
git add apps/crawler/src/crawler/parser.rs
git commit -m "test(crawler): add external link details tests for anchor text and rel"
```

---

### Task 7: Add Unit Test for Backlink Entry Collection

**Files:**

- Modify: `apps/crawler/src/jobs/mod.rs` (add test module at bottom)

**Step 1: Add test module**

At the bottom of `jobs/mod.rs`, add:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ExtractedData, ExtractedLink};

    fn make_page(url: &str, external_links: Vec<ExtractedLink>) -> CrawlPageResult {
        CrawlPageResult {
            url: url.to_string(),
            status_code: 200,
            title: None,
            meta_description: None,
            canonical_url: None,
            word_count: 0,
            content_hash: "abc".to_string(),
            html_r2_key: "key".to_string(),
            extracted: ExtractedData {
                h1: vec![],
                h2: vec![],
                h3: vec![],
                h4: vec![],
                h5: vec![],
                h6: vec![],
                schema_types: vec![],
                internal_links: vec![],
                external_links: vec![],
                external_link_details: external_links,
                images_without_alt: 0,
                has_robots_meta: false,
                robots_directives: vec![],
                og_tags: None,
                structured_data: None,
                flesch_score: None,
                flesch_classification: None,
                text_html_ratio: None,
                text_length: None,
                html_length: None,
                pdf_links: vec![],
                cors_unsafe_blank_links: 0,
                cors_mixed_content: 0,
                cors_has_issues: false,
                sentence_length_variance: None,
                top_transition_words: vec![],
            },
            lighthouse: None,
            site_context: None,
            timing_ms: 100,
            redirect_chain: vec![],
        }
    }

    #[test]
    fn test_collect_backlink_entries() {
        let pages = vec![make_page(
            "https://example.com/blog/post",
            vec![
                ExtractedLink {
                    url: "https://competitor.com/product".to_string(),
                    anchor_text: "check this out".to_string(),
                    rel: "nofollow".to_string(),
                    is_external: true,
                },
                ExtractedLink {
                    url: "https://reference.org/docs".to_string(),
                    anchor_text: "documentation".to_string(),
                    rel: "".to_string(),
                    is_external: true,
                },
            ],
        )];

        let entries = collect_backlink_entries(&pages);
        assert_eq!(entries.len(), 2);

        assert_eq!(entries[0].source_url, "https://example.com/blog/post");
        assert_eq!(entries[0].source_domain, "example.com");
        assert_eq!(entries[0].target_url, "https://competitor.com/product");
        assert_eq!(entries[0].target_domain, "competitor.com");
        assert_eq!(entries[0].anchor_text, "check this out");
        assert_eq!(entries[0].rel, "nofollow");

        assert_eq!(entries[1].target_domain, "reference.org");
        assert_eq!(entries[1].rel, "");
    }

    #[test]
    fn test_collect_backlink_entries_skips_invalid_urls() {
        let pages = vec![make_page(
            "https://example.com/page",
            vec![ExtractedLink {
                url: "not-a-valid-url".to_string(),
                anchor_text: "bad".to_string(),
                rel: "".to_string(),
                is_external: true,
            }],
        )];

        let entries = collect_backlink_entries(&pages);
        assert_eq!(entries.len(), 0); // Skipped because domain_from_url returns empty
    }
}
```

**Step 2: Run job tests**

Run: `cd apps/crawler && cargo test jobs -- --nocapture`
Expected: 2 new tests pass.

**Step 3: Commit**

```bash
git add apps/crawler/src/jobs/mod.rs
git commit -m "test(crawler): add unit tests for backlink entry collection"
```

---

### Task 8: Full Build + Test Verification

**Files:** None (verification only)

**Step 1: Run full cargo build**

Run: `cd apps/crawler && cargo build 2>&1 | tail -5`
Expected: `Finished` with no errors.

**Step 2: Run full test suite**

Run: `cd apps/crawler && cargo test 2>&1`
Expected: All tests pass (existing + new: ~40+ tests across parser, frontier, robots, readability, security, extractor, storage, jobs, integration).

**Step 3: Run clippy**

Run: `cd apps/crawler && cargo clippy -- -D warnings 2>&1 | tail -10`
Expected: No warnings.

**Step 4: Commit any clippy fixes if needed**

```bash
git add -A && git commit -m "fix(crawler): address clippy warnings"
```
