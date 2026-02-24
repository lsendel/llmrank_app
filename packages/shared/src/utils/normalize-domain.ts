/**
 * Normalize a domain input: strip protocol, www., trailing slash, path, query, fragment.
 * Preserves subdomains other than www. Returns lowercase.
 */
export function normalizeDomain(input: string): string {
  let d = input.trim();
  if (!d) return "";

  // Strip protocol
  d = d.replace(/^https?:\/\//i, "");

  // Strip www. prefix (but not other subdomains)
  d = d.replace(/^www\./i, "");

  // Extract just the hostname (strip path, query, fragment)
  // Use the first segment before /, ?, or #
  const hostEnd = d.search(/[/?#]/);
  if (hostEnd !== -1) {
    d = d.slice(0, hostEnd);
  }

  // Strip any trailing dots or slashes
  d = d.replace(/[./]+$/, "");

  return d.toLowerCase();
}
