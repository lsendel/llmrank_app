import { render, screen, waitFor } from "@testing-library/react";
import { IntegrationCatalogClient } from "./catalog-client";
import type { BillingInfo, IntegrationCatalogItem } from "@/lib/api";
import { vi } from "vitest";

let mockSignedIn = false;
let mockCatalog: IntegrationCatalogItem[] = [];
let mockBilling: BillingInfo | undefined;
let mockProjects: Array<{ id: string; name: string }> = [];
let mockProjectIntegrations: Array<{
  provider: string;
  enabled: boolean;
  hasCredentials: boolean;
}> = [];

const mockUseApiSWR = vi.fn();

vi.mock("@/lib/auth-hooks", () => ({
  useUser: () => ({ isSignedIn: mockSignedIn }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (key: string | null) => mockUseApiSWR(key),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

const GSC_ITEM: IntegrationCatalogItem = {
  id: "gsc",
  provider: "gsc",
  name: "Google Search Console",
  description: "GSC",
  features: ["f1"],
  availability: "available_now",
  access: "requires_auth",
  minPlan: "pro",
  authType: "oauth2",
};

const GA4_ITEM: IntegrationCatalogItem = {
  id: "ga4",
  provider: "ga4",
  name: "Google Analytics 4",
  description: "GA4",
  features: ["f1"],
  availability: "available_now",
  access: "requires_auth",
  minPlan: "agency",
  authType: "oauth2",
};

const MCP_ITEM: IntegrationCatalogItem = {
  id: "mcp",
  provider: null,
  name: "MCP Server",
  description: "MCP",
  features: ["f1"],
  availability: "available_now",
  access: "public",
  minPlan: null,
  authType: "oauth2",
  link: "/mcp",
};

const WORDPRESS_ITEM: IntegrationCatalogItem = {
  id: "wordpress",
  provider: null,
  name: "WordPress Plugin",
  description: "WP",
  features: ["f1"],
  availability: "coming_soon",
  access: "requires_auth",
  minPlan: null,
  authType: "api_key",
};

function configureSWR() {
  mockUseApiSWR.mockImplementation((key: string | null) => {
    if (!key) return { data: undefined };
    if (key === "integration-catalog") return { data: mockCatalog };
    if (key === "billing-info") return { data: mockBilling };
    if (key === "integrations-projects-page")
      return { data: { data: mockProjects } };
    if (key.startsWith("integrations-catalog-"))
      return { data: mockProjectIntegrations };
    return { data: undefined };
  });
}

describe("IntegrationCatalogClient", () => {
  beforeEach(() => {
    mockSignedIn = false;
    mockCatalog = [];
    mockBilling = undefined;
    mockProjects = [];
    mockProjectIntegrations = [];
    mockUseApiSWR.mockReset();
  });

  it("shows explicit signed-out and coming-soon states", () => {
    mockCatalog = [GSC_ITEM, MCP_ITEM, WORDPRESS_ITEM];
    configureSWR();

    render(<IntegrationCatalogClient />);

    expect(
      screen.getByRole("link", { name: "Sign In to Connect" }),
    ).toHaveAttribute("href", "/sign-in");
    expect(
      screen.getByRole("link", { name: "View Setup Guide" }),
    ).toHaveAttribute("href", "/mcp");
    expect(screen.getByRole("button", { name: "Coming Soon" })).toBeDisabled();
  });

  it("routes signed-in users without projects to project creation", () => {
    mockSignedIn = true;
    mockCatalog = [GSC_ITEM];
    mockBilling = {
      plan: "pro",
      crawlCreditsRemaining: 10,
      crawlCreditsTotal: 10,
      maxPagesPerCrawl: 1000,
      maxDepth: 4,
      maxProjects: 3,
    };
    mockProjects = [];
    configureSWR();

    render(<IntegrationCatalogClient />);

    expect(
      screen.getByRole("link", { name: "Create a Project" }),
    ).toHaveAttribute("href", "/dashboard/projects/new");
  });

  it("shows connected state after provider is already linked", async () => {
    mockSignedIn = true;
    mockCatalog = [GSC_ITEM];
    mockBilling = {
      plan: "pro",
      crawlCreditsRemaining: 10,
      crawlCreditsTotal: 10,
      maxPagesPerCrawl: 1000,
      maxDepth: 4,
      maxProjects: 3,
    };
    mockProjects = [{ id: "proj-1", name: "Project 1" }];
    mockProjectIntegrations = [
      { provider: "gsc", enabled: true, hasCredentials: true },
    ];
    configureSWR();

    render(<IntegrationCatalogClient />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Connected" })).toHaveAttribute(
        "href",
        "/dashboard/projects/proj-1?tab=integrations",
      );
    });
  });

  it("shows upgrade path when plan does not allow provider", async () => {
    mockSignedIn = true;
    mockCatalog = [GA4_ITEM];
    mockBilling = {
      plan: "pro",
      crawlCreditsRemaining: 10,
      crawlCreditsTotal: 10,
      maxPagesPerCrawl: 1000,
      maxDepth: 4,
      maxProjects: 3,
    };
    mockProjects = [{ id: "proj-1", name: "Project 1" }];
    configureSWR();

    render(<IntegrationCatalogClient />);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Upgrade to Agency" }),
      ).toHaveAttribute("href", "/pricing");
    });
  });
});
