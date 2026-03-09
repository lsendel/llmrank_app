import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePageLayout } from "./home-page-sections";

let mockSignedIn = false;

vi.mock("@/lib/auth-hooks", () => ({
  SignedIn: ({ children }: { children: ReactNode }) =>
    mockSignedIn ? <>{children}</> : null,
  SignedOut: ({ children }: { children: ReactNode }) =>
    mockSignedIn ? null : <>{children}</>,
}));

describe("home page sections", () => {
  beforeEach(() => {
    mockSignedIn = false;
  });

  it("renders the extracted homepage marketing layout for signed-out users", () => {
    render(<HomePageLayout />);

    expect(
      screen.getByRole("heading", {
        name: /Rank in ChatGPT, Claude & Perplexity/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("The 37 AI Ranking Factors")).toBeInTheDocument();
    expect(screen.getByText("Built for B2B Growth Teams")).toBeInTheDocument();
    expect(
      screen.getByText("Why AI Search Optimization Matters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Run Free AI Audit" }),
    ).toHaveAttribute("href", "/scan");
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("shows the dashboard CTA for signed-in users", () => {
    mockSignedIn = true;

    render(<HomePageLayout />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });
});
