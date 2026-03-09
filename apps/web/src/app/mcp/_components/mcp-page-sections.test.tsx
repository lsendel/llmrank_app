import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { McpPageLayout } from "./mcp-page-sections";

describe("mcp page sections", () => {
  it("renders the extracted MCP marketing layout", () => {
    render(<McpPageLayout totalTools={27} />);

    expect(
      screen.getByRole("heading", { name: "MCP Server for AI Coding Agents" }),
    ).toBeInTheDocument();
    expect(screen.getByText("27 Available Tools")).toBeInTheDocument();
    expect(screen.getByText("Quick Start")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("ChatGPT / HTTP")).toBeInTheDocument();
    expect(screen.getByText("Pre-built Prompts")).toBeInTheDocument();
    expect(screen.getByText("MCP Endpoint")).toBeInTheDocument();
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create Free Account" }),
    ).toHaveAttribute("href", "/sign-up");
  });
});
