import Link from "next/link";
import { Terminal } from "lucide-react";
import {
  MCP_FAQ_ITEMS,
  MCP_FOOTER_LINKS,
  MCP_HEADER_LINKS,
  MCP_HTTP_TRANSPORT_ITEMS,
  MCP_IDE_CONFIGS,
  MCP_PACKAGE_URL,
  MCP_PROMPTS,
  MCP_TOOL_CATEGORIES,
  getIdeConfigContent,
} from "../mcp-page-helpers";

export function McpPageLayout({ totalTools }: { totalTools: number }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Rank
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {MCP_HEADER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <section className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Terminal className="h-4 w-4" />
            npm install @llmrank.app/mcp
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            MCP Server for AI Coding Agents
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {totalTools} SEO tools for Claude Code, Cursor, VS Code, Windsurf,
            and ChatGPT. Crawl sites, score pages across 37 AI-readiness
            factors, and fix issues — all from your IDE via the{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Model Context Protocol
            </a>
            .
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="#setup"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              Get Started
            </Link>
            <a
              href={MCP_PACKAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground hover:bg-muted/50"
            >
              View on npm
            </a>
          </div>
        </section>

        <section id="setup" className="mb-16 scroll-mt-20">
          <h2 className="mb-2 text-2xl font-bold">Quick Start</h2>
          <p className="mb-6 text-muted-foreground">
            1. Generate an API token at{" "}
            <Link
              href="/dashboard/settings"
              className="font-medium text-primary hover:underline"
            >
              Dashboard &rarr; Settings &rarr; API Tokens
            </Link>
            . 2. Add the MCP server to your IDE.
          </p>
          <div className="space-y-6">
            {MCP_IDE_CONFIGS.map((ide) => (
              <div
                key={ide.id}
                id={ide.id}
                className="scroll-mt-20 rounded-lg border border-border"
              >
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <h3 className="font-semibold">{ide.name}</h3>
                  {ide.type === "json" ? (
                    <span className="text-xs text-muted-foreground">
                      {ide.path}
                    </span>
                  ) : null}
                </div>
                <div className="overflow-x-auto bg-muted/30 p-4">
                  <pre className="text-sm leading-relaxed">
                    <code>{getIdeConfigContent(ide)}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p>
              <strong>Environment variables:</strong>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                LLM_BOOST_API_TOKEN
              </code>{" "}
              (required, starts with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                llmb_
              </code>
              ) and{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                LLM_BOOST_API_URL
              </code>{" "}
              (optional, defaults to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                https://api.llmrank.app
              </code>
              ).
            </p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-2 text-2xl font-bold">
            {totalTools} Available Tools
          </h2>
          <p className="mb-8 text-muted-foreground">
            Every tool includes{" "}
            <a
              href="https://modelcontextprotocol.io/docs/concepts/tools#annotations"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              MCP annotations
            </a>{" "}
            (readOnlyHint, destructiveHint) so your agent knows which tools are
            safe to call without confirmation.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {MCP_TOOL_CATEGORIES.map((category) => (
              <div
                key={category.name}
                className="rounded-lg border border-border p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <category.icon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{category.name}</h3>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {category.tools.length} tool
                    {category.tools.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="space-y-2">
                  {category.tools.map((tool) => (
                    <li key={tool.name} className="text-sm">
                      <code className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {tool.name}
                      </code>
                      <span className="text-muted-foreground">{tool.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-2 text-2xl font-bold">Pre-built Prompts</h2>
          <p className="mb-6 text-muted-foreground">
            Common workflows packaged as MCP prompts your agent can invoke
            directly.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {MCP_PROMPTS.map((prompt) => (
              <div
                key={prompt.name}
                className="rounded-lg border border-border p-4"
              >
                <code className="text-sm font-semibold text-primary">
                  {prompt.name}
                </code>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {prompt.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-2 text-2xl font-bold">
            HTTP Transport &amp; OAuth
          </h2>
          <p className="mb-4 text-muted-foreground">
            For cloud-based agents like ChatGPT, the MCP server is available
            over Streamable HTTP with OAuth 2.1 authentication (PKCE, RFC 8414,
            RFC 9728).
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {MCP_HTTP_TRANSPORT_ITEMS.map((item) => (
              <div
                key={item.name}
                className="rounded-lg border border-border p-4"
              >
                <item.icon className="mb-2 h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold">{item.name}</h3>
                <code className="mt-1 block text-xs text-muted-foreground">
                  {item.value}
                </code>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Supports{" "}
            <a
              href="https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              MCP Authorization Spec
            </a>
            : Dynamic Client Registration (RFC 7591), PKCE with S256,
            WWW-Authenticate with resource_metadata, and token refresh.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {MCP_FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group rounded-lg border border-border"
              >
                <summary className="cursor-pointer px-5 py-4 font-medium">
                  {item.question}
                </summary>
                <p className="px-5 pb-4 text-sm text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-muted/40 p-8 text-center">
          <h2 className="text-xl font-bold">
            Start using LLM Rank from your IDE
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a free account, generate an API token, and add the MCP server
            to your IDE in under 2 minutes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Create Free Account
            </Link>
            <a
              href={MCP_PACKAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:text-primary"
            >
              npm package &rarr;
            </a>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Rank</span>
          {MCP_FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
