import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingPageLayout } from "./pricing-page-sections";

let mockSignedIn = false;

vi.mock("@/lib/auth-hooks", () => ({
  SignedIn: ({ children }: { children: ReactNode }) =>
    mockSignedIn ? <>{children}</> : null,
  SignedOut: ({ children }: { children: ReactNode }) =>
    mockSignedIn ? null : <>{children}</>,
}));

vi.mock("../billing-toggle", () => ({
  PricingCards: () => <div>Pricing cards placeholder</div>,
}));

describe("pricing page sections", () => {
  beforeEach(() => {
    mockSignedIn = false;
  });

  it("renders the extracted pricing marketing layout for signed-out users", () => {
    render(<PricingPageLayout />);

    expect(
      screen.getByRole("heading", { name: /Simple, transparent pricing/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pricing cards placeholder")).toBeInTheDocument();
    expect(screen.getByText("Full feature comparison")).toBeInTheDocument();
    expect(screen.getByText("Pricing FAQ")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start Free Audit" }),
    ).toHaveAttribute("href", "/scan");
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("shows the dashboard CTA for signed-in users", () => {
    mockSignedIn = true;

    render(<PricingPageLayout />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });
});
