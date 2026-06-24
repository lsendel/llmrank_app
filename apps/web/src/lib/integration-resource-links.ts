export type IntegrationResourceKey =
  | "gsc"
  | "psi"
  | "ga4"
  | "clarity"
  | "meta"
  | "mcp"
  | "wordpress"
  | "slack";

export type IntegrationResourceLink = {
  href: string;
  label: string;
  external?: boolean;
};

const INTEGRATION_RESOURCE_LINKS: Record<
  IntegrationResourceKey,
  IntegrationResourceLink[]
> = {
  gsc: [
    {
      href: "https://search.google.com/search-console",
      label: "Open Search Console",
    },
    {
      href: "https://search.google.com/search-console",
      label: "Add property",
    },
  ],
  psi: [
    {
      href: "https://pagespeed.web.dev/",
      label: "Open PageSpeed Insights",
    },
    {
      href: "https://developers.google.com/speed/docs/insights/v5/get-started",
      label: "Get API key",
    },
  ],
  ga4: [
    {
      href: "https://analytics.google.com/",
      label: "Open Google Analytics",
    },
    {
      href: "https://analytics.google.com/",
      label: "Set up property",
    },
  ],
  clarity: [
    {
      href: "https://clarity.microsoft.com/projects",
      label: "Open Clarity",
    },
    {
      href: "https://clarity.microsoft.com/projects",
      label: "Add project",
    },
  ],
  meta: [
    {
      href: "https://business.facebook.com/",
      label: "Open Meta Business",
    },
    {
      href: "https://business.facebook.com/settings/ad-accounts",
      label: "Add ad account",
    },
  ],
  mcp: [
    {
      href: "/mcp",
      label: "Open MCP setup guide",
      external: false,
    },
  ],
  wordpress: [
    {
      href: "https://wordpress.org/",
      label: "Visit WordPress",
    },
  ],
  slack: [
    {
      href: "https://slack.com/",
      label: "Visit Slack",
    },
  ],
};

export function getIntegrationResourceLinks(
  key: string | null | undefined,
): IntegrationResourceLink[] {
  if (!key) return [];

  return (
    INTEGRATION_RESOURCE_LINKS[key as IntegrationResourceKey]?.slice() ?? []
  );
}
