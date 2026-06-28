/**
 * Canonical registry of issue codes that have a working "AI Fix", and the kind
 * of artifact each fix produces.
 *
 * This is the SINGLE SOURCE OF TRUTH shared by:
 *  - the API (`fix-generator-service` prompts + the `fixType` persisted on a
 *    generated fix), and
 *  - the web UI (the "AI Fix" button gate + download filenames).
 *
 * Previously the same map was hand-duplicated in `ai-fix-button.tsx` and
 * `fix-generator-service.ts`, so the frontend gate could silently disagree with
 * the backend prompts. The backend `FIX_PROMPTS` keys MUST stay equal to these
 * codes — a parity unit test (`fix-codes-parity.test.ts`) enforces it.
 *
 * `META_DESC_LENGTH` / `TITLE_LENGTH` are aliases of the corresponding
 * `MISSING_*` codes: a wrong-length field is regenerated to spec the same way a
 * missing one is.
 */
export const FIX_TYPE_BY_CODE: Record<string, string> = {
  MISSING_META_DESC: "meta_description",
  META_DESC_LENGTH: "meta_description",
  MISSING_TITLE: "title_tag",
  TITLE_LENGTH: "title_tag",
  NO_STRUCTURED_DATA: "json_ld",
  MISSING_LLMS_TXT: "llms_txt",
  NO_FAQ_SECTION: "faq_section",
  MISSING_SUMMARY: "summary_section",
  MISSING_ALT_TEXT: "alt_text",
  MISSING_OG_TAGS: "og_tags",
  MISSING_CANONICAL: "canonical",
  BAD_HEADING_HIERARCHY: "heading_structure",
  AI_CRAWLER_BLOCKED: "robots_txt",
  MISSING_SPEAKABLE: "speakable",
  THIN_CONTENT_FOR_AI: "content_expansion",
};

/** Issue codes that have a working AI fix. Derived from {@link FIX_TYPE_BY_CODE}. */
export const SUPPORTED_FIX_CODES: ReadonlySet<string> = new Set(
  Object.keys(FIX_TYPE_BY_CODE),
);
