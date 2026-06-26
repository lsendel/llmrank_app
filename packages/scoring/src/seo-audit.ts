/**
 * Helpers for the international-SEO + analytics audit checks shared by the v1
 * (factors) and v2 (dimensions) scoring engines.
 */

export interface HreflangEntry {
  lang: string;
  href: string;
}

/**
 * Validate an hreflang value as a BCP-47-ish language[-region/script] tag or
 * the special `x-default`. Intentionally lenient (accepts script + region
 * subtags like `zh-Hant`, `en-US`) to avoid flagging valid codes.
 */
export function isValidHreflangCode(lang: string): boolean {
  const l = lang.trim();
  if (l.toLowerCase() === "x-default") return true;
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l);
}

/** True if the hreflang set includes an `x-default` alternate. */
export function hreflangHasXDefault(
  entries: readonly HreflangEntry[],
): boolean {
  return entries.some((e) => e.lang.trim().toLowerCase() === "x-default");
}

/** Return the invalid hreflang codes in the set (empty if all valid). */
export function invalidHreflangCodes(
  entries: readonly HreflangEntry[],
): string[] {
  return entries.filter((e) => !isValidHreflangCode(e.lang)).map((e) => e.lang);
}
