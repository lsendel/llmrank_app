// Detects a "summary / key takeaways / conclusion" heading — multilingual.
//
// LLM Rank crawls sites in many languages (the `.care` family alone spans
// Spanish, German, French, Portuguese, Italian, and Dutch), but the original
// NO_SUMMARY_SECTION check matched an English-only keyword list, so every
// non-English page that *did* have a summary section was wrongly penalized.
// This is the single source of truth for that detection, used by both the
// legacy `factors` engine and the `dimensions` engine.

/**
 * Normalize a heading before matching:
 * - strip combining diacritics so accented terms ("Conclusion", "Resume",
 *   "Uberblick", "Visao Geral") reduce to ASCII, which also lets JS's
 *   ASCII-only `\b` word boundaries fire at the edges of each term;
 * - fold curly apostrophes to straight ("L'essentiel").
 */
function foldHeading(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks
    .replace(/[\u2018\u2019]/g, "'"); // curly -> straight apostrophe
}

// Summary / key-takeaways / conclusion vocabulary across the languages we score.
// Entries are ASCII because headings are diacritic-folded first (see foldHeading).
// Tokens shared across languages (e.g. "conclusion" en/fr, "overview") appear
// once; language-specific spellings are listed explicitly.
const SUMMARY_HEADING_PATTERN =
  /\b(summary|in summary|key takeaways?|tl;?dr|conclusions?|overview|highlights?|in brief|resumen|en resumen|en breve|conclusiones|puntos clave|aspectos destacados|descripcion general|vision general|zusammenfassung|fazit|uberblick|im uberblick|das wichtigste|kernpunkte|auf einen blick|resume|en bref|points cles|apercu|l'essentiel|points a retenir|resumo|em resumo|conclusao|pontos[- ]chave|visao geral|destaques|riassunto|in sintesi|conclusione|punti chiave|panoramica|in breve|samenvatting|conclusie|in het kort|kernpunten|overzicht|belangrijkste punten)\b/i;

/**
 * True when any heading reads as a summary / key-takeaways / conclusion section,
 * in any of the supported languages.
 */
export function hasSummaryHeading(headings: readonly string[]): boolean {
  return headings.some((h) => SUMMARY_HEADING_PATTERN.test(foldHeading(h)));
}
