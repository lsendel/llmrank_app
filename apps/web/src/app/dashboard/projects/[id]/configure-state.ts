export const CONFIGURE_SECTIONS = [
  "site-context",
  "crawl-defaults",
  "ai-seo-files",
  "branding",
  "scoring",
] as const;

export type ConfigureSection = (typeof CONFIGURE_SECTIONS)[number];

export const DEFAULT_CONFIGURE_SECTION: ConfigureSection = "site-context";

export function normalizeConfigureSection(
  section: string | null,
): ConfigureSection {
  if (!section) return DEFAULT_CONFIGURE_SECTION;

  const normalizedSection = section as ConfigureSection;
  return CONFIGURE_SECTIONS.includes(normalizedSection)
    ? normalizedSection
    : DEFAULT_CONFIGURE_SECTION;
}
