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
