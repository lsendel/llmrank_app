use regex::Regex;
use scraper::{ElementRef, Html, Selector};
use serde::Serialize;
use std::sync::OnceLock;

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

/// Site-chrome tags whose paragraphs are boilerplate, not main content.
const CHROME_TAGS: [&str; 4] = ["nav", "header", "footer", "aside"];

/// Minimum words the cleaned main-content sample must yield before we trust it
/// over the full all-`<p>` text. Below this a stripped page (chrome-only, or a
/// thin fragment) can't give a fair Flesch, so we fall back. Deliberately small.
const MIN_MAIN_CONTENT_WORDS: u32 = 40;

/// Compute Flesch Reading Ease from MAIN-CONTENT paragraph text.
///
/// The Flesch score feeds the `POOR_READABILITY` factor, which fires below 60.
/// Scoring EVERY `<p>` on the page — including nav/header/footer/aside
/// boilerplate — drags the score down, firing the factor on nearly every content
/// page. So we isolate main content first, mirroring the LLM scorer's
/// `htmlToScoringText` (PR #84): prefer a `<main>`/`<article>` region (else
/// `<body>`), drop paragraphs nested under site chrome, and use that cleaned
/// sample ONLY when it is substantial AND chrome was a meaningful share of the
/// page (>25% of paragraph words). Otherwise we FALL BACK to the full all-`<p>`
/// text, so content-dense pages are unchanged (no regression).
pub fn compute_flesch(document: &Html) -> Option<FleschScore> {
    // The historical all-`<p>` sample: both the no-regression fallback and the
    // denominator for the "was chrome a meaningful share?" check.
    let full = all_paragraph_text(document);
    if full.trim().is_empty() {
        return None;
    }

    let main = main_content_paragraph_text(document);
    let full_words = count_words(&full);
    let main_words = count_words(&main);
    // Prefer the cleaned main-content text only when it carries enough words to
    // score fairly AND stripping chrome dropped >25% of the words (i.e. chrome
    // was dominating the page). On content-dense pages this leaves `full`
    // untouched — identical to the prior behaviour.
    let text = if main_words >= MIN_MAIN_CONTENT_WORDS
        && (main_words as f64) < 0.75 * (full_words as f64)
    {
        main
    } else {
        full
    };

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

    // Measure against content-relevant HTML: exclude <script>/<style>/comments
    // (and the inline JSON they carry, e.g. framework hydration payloads) so the
    // ratio reflects markup-vs-content density, not how much JS the page ships.
    // Counting raw bytes falsely flagged nearly every page on JS-heavy sites.
    let html_length = content_html_length(raw_html);
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

/// Byte length of HTML with `<script>`, `<style>` blocks and comments removed,
/// used as the text-to-HTML ratio denominator.
fn content_html_length(raw_html: &str) -> usize {
    static STRIP_RE: OnceLock<Regex> = OnceLock::new();
    let re = STRIP_RE.get_or_init(|| {
        Regex::new(r"(?is)<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>|<!--.*?-->")
            .expect("valid content-strip regex")
    });
    re.replace_all(raw_html, "").len()
}

// ─── Private Helpers ────────────────────────────────────────────────

/// Join the text of every `<p>` in the document — the historical Flesch sample
/// and the no-regression fallback.
fn all_paragraph_text(document: &Html) -> String {
    let p_sel = Selector::parse("p").expect("valid p selector");
    document
        .select(&p_sel)
        .map(|el| el.text().collect::<String>())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Join the text of main-content `<p>`s: those inside the first `<main>`/
/// `<article>` region (or `<body>` when there is none), excluding any paragraph
/// nested under site chrome (`<nav>`/`<header>`/`<footer>`/`<aside>`, wherever it
/// sits — including in-content chrome inside the region).
fn main_content_paragraph_text(document: &Html) -> String {
    let region_sel = Selector::parse("main, article").expect("valid region selector");
    let body_sel = Selector::parse("body").expect("valid body selector");
    let p_sel = Selector::parse("p").expect("valid p selector");

    let Some(root) = document
        .select(&region_sel)
        .next()
        .or_else(|| document.select(&body_sel).next())
    else {
        return String::new();
    };

    root.select(&p_sel)
        .filter(|p| !has_chrome_ancestor(p))
        .map(|el| el.text().collect::<String>())
        .collect::<Vec<_>>()
        .join(" ")
}

/// True when any ancestor of `el` is a site-chrome element.
fn has_chrome_ancestor(el: &ElementRef) -> bool {
    el.ancestors().any(|node| {
        node.value()
            .as_element()
            .is_some_and(|e| CHROME_TAGS.contains(&e.name()))
    })
}

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
    text.split_whitespace().map(count_word_syllables).sum()
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
        let html = Html::parse_document(
            "<html><body><p>The cat sat on the mat. The dog ran fast.</p></body></html>",
        );
        let result = compute_flesch(&html).unwrap();
        assert!(result.score > 70.0, "Simple text should be easy to read");
        assert_eq!(result.sentence_count, 2);
    }

    #[test]
    fn test_flesch_empty() {
        let html = Html::parse_document("<html><body></body></html>");
        assert!(compute_flesch(&html).is_none());
    }

    /// Flesch over the given text using the same formula `compute_flesch` applies,
    /// so tests can assert which sample (main-content vs. all-`<p>`) was scored.
    fn flesch_of(text: &str) -> f64 {
        let sentences = count_sentences(text);
        let words = count_words(text);
        let syllables = count_syllables(text);
        let score = 206.835
            - 1.015 * (words as f64 / sentences as f64)
            - 84.6 * (syllables as f64 / words as f64);
        score.clamp(0.0, 100.0)
    }

    #[test]
    fn test_flesch_isolates_main_content_from_chrome() {
        // Hard, polysyllabic chrome paragraphs (low Flesch) wrapping a <main> of
        // simple, easy prose (high Flesch). The score must reflect the main prose,
        // materially diverging from the all-<p> baseline.
        let html = Html::parse_document(
            "<html><body>\
             <nav><p>Comprehensive multinational telecommunications infrastructure optimization methodologies necessitate sophisticated organizational restructuring.</p></nav>\
             <header><p>Furthermore international entrepreneurial accountability frameworks demonstrate considerable administrative interoperability.</p></header>\
             <main>\
             <p>The cat sat on the mat. The dog ran in the sun. We had so much fun all day long. A bird can fly up high. The sky is blue and clear.</p>\
             <p>She ate a red plum. He read a good book. They went for a walk. Birds sing a sweet song. Kids play in the park all day.</p>\
             </main>\
             <footer><p>Consequently technological transformation initiatives accelerate unprecedented socioeconomic globalization phenomena.</p></footer>\
             </body></html>",
        );

        let result = compute_flesch(&html).unwrap();

        // The cleaned path was taken: the score equals the main-content sample,
        // NOT the all-<p> baseline.
        let main_text = main_content_paragraph_text(&html);
        let full_text = all_paragraph_text(&html);
        let main_score = flesch_of(&main_text);
        let full_score = flesch_of(&full_text);

        assert!(
            (result.score - main_score).abs() < 1e-6,
            "should score the main-content sample, got {} vs main {}",
            result.score,
            main_score,
        );
        // Materially easier than scoring all <p>s (which the chrome drags down).
        assert!(
            result.score > full_score + 10.0,
            "main-content score {} should materially beat all-<p> score {}",
            result.score,
            full_score,
        );
    }

    #[test]
    fn test_flesch_content_dense_unchanged_no_chrome() {
        // A content-dense page with no chrome and no <main>: the fallback path
        // must reproduce the historical all-<p> score exactly (no regression).
        let html = Html::parse_document(
            "<html><body>\
             <p>The history of written language spans several thousand years. Early scribes recorded harvests, trades, and laws on clay tablets.</p>\
             <p>Over centuries the alphabet evolved, and printing made books available to ordinary readers across many nations.</p>\
             <p>Today most knowledge is stored digitally, yet the craft of clear writing remains as valuable as it ever was.</p>\
             </body></html>",
        );

        let result = compute_flesch(&html).unwrap();
        let baseline = flesch_of(&all_paragraph_text(&html));
        assert!(
            (result.score - baseline).abs() < 1e-6,
            "content-dense page should keep the all-<p> score: {} vs {}",
            result.score,
            baseline,
        );
    }

    #[test]
    fn test_text_html_ratio() {
        let raw = "<html><body><p>Hello world</p></body></html>";
        let doc = Html::parse_document(raw);
        let ratio = compute_text_html_ratio(&doc, raw);
        assert!(ratio.ratio > 0.0);
        assert!(ratio.ratio < 100.0);
        // No script/style/comments to strip, so denominator == raw length.
        assert_eq!(ratio.html_length, raw.len());
    }

    #[test]
    fn test_text_html_ratio_excludes_script_style_comments() {
        // Same visible text, but heavy <script>/<style> payloads + a comment.
        // The ratio must reflect content density, not how much JS the page ships.
        let raw = format!(
            "<html><head><style>{}</style></head><body><!-- {} --><p>Hello world</p><script>{}</script></body></html>",
            "a{{color:red}}".repeat(50),
            "x".repeat(200),
            "var y = 1;".repeat(500),
        );
        let doc = Html::parse_document(&raw);
        let ratio = compute_text_html_ratio(&doc, &raw);
        // Denominator excludes script/style/comment bytes.
        assert!(
            ratio.html_length < raw.len(),
            "script/style should be stripped from the denominator"
        );
        assert_eq!(ratio.html_length, content_html_length(&raw));
        // Without stripping the ratio would be a tiny fraction of this.
        let raw_ratio = (ratio.text_length as f64 / raw.len() as f64) * 100.0;
        assert!(ratio.ratio > raw_ratio * 2.0);
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
