# AI-Readiness Score Fixes — Design

**Date:** 2026-02-16
**Score:** 89 (B) → Target: 95+ (A)
**Report:** ai-readiness-report-detailed.pdf (8 pages, 35 issues)

## Decisions

- **Keep noindex on /sign-in, /sign-up** — correct SEO practice, accept score penalty
- **Full content overhaul** — expand all pages to 500+ words, Flesch 60+
- **Fix all public pages** — including 4 uncovered pages (scan/results, leaderboard, report/[token], share/[token])
- **Investigate Performance 0** — determine if crawler issue or actual performance problem

## Phase 1: Technical Infrastructure

### 1. OG Tags (8 pages, -2pts each)

- Add default `og:image` to root layout metadata (1200x630 social card)
- Ensure `og:title`, `og:description` present on every public page
- Add `generateMetadata()` for dynamic routes

### 2. Title Tag Audit (3 pages, -8pts each)

- Audit all titles for 30-60 character range
- Fix titles that are too long or missing
- Add metadata exports for pages that lack them

### 3. Metadata for Uncovered Pages

- `/scan/results` — static metadata export
- `/leaderboard` — static metadata export
- `/report/[token]` — `generateMetadata()` pulling from API
- `/share/[token]` — `generateMetadata()` pulling from API

### 4. Internal Links (1 page, -4pts)

- Add cross-links between related pages
- Footer CTAs linking to pricing, scan, integrations

## Phase 2: Content Overhaul

### Per-Page Content Strategy

| Page            | Current | Target | Strategy                                         |
| --------------- | ------- | ------ | ------------------------------------------------ |
| `/`             | ~300w   | 500+   | Expand "How it works", add benefits, FAQ section |
| `/pricing`      | ~250w   | 500+   | Feature comparison prose, FAQ section            |
| `/integrations` | ~200w   | 500+   | Expand descriptions, add details                 |
| `/scan`         | ~150w   | 500+   | "What we check" details, FAQ                     |
| `/terms`        | ~800+   | Keep   | Improve readability (Flesch 60+)                 |
| `/privacy`      | ~600+   | Keep   | Improve readability (Flesch 60+)                 |
| `/sign-in`      | ~150w   | 300+   | Expand benefits (keeping noindex)                |
| `/sign-up`      | ~200w   | 300+   | Expand value props (keeping noindex)             |

### Readability (7 pages, -4pts each)

- Shorter sentences, active voice, common words
- Target Flesch Reading Ease 60+

### Direct Answers (1 page, -4pts)

- Add answer paragraphs at top of sections addressing likely queries

### Authoritative Citations (3 pages, -2pts each)

- Link to Google Search Central, W3C, industry research
- Add to relevant content sections

### FAQ Structure (2 pages, -2pts each)

- Add FAQ sections with FAQPage JSON-LD schema
- Use clear question headings + concise answers

## Phase 3: Performance Investigation

- Review scoring engine Performance factors
- Check if crawler collected Lighthouse data
- If data missing: fix crawler Lighthouse integration
- If actual issues: address Core Web Vitals (LCP, CLS, INP)

## Expected Impact

| Issue                   | Points Recovered     |
| ----------------------- | -------------------- |
| MISSING_TITLE           | +24                  |
| MISSING_OG_TAGS         | +16                  |
| THIN_CONTENT            | +32                  |
| POOR_READABILITY        | +28                  |
| NO_DIRECT_ANSWERS       | +4                   |
| NO_INTERNAL_LINKS       | +4                   |
| AUTHORITATIVE_CITATIONS | +6                   |
| FAQ_STRUCTURE           | +4                   |
| **Total**               | **+118 distributed** |
