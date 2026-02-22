import type { Metadata } from "next";
import Link from "next/link";
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import {
  Terminal,
  Globe,
  Key,
  Wrench,
  Search,
  FileText,
  BarChart3,
  Bug,
  Eye,
  Lightbulb,
  Code,
  TrendingUp,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MCP Server for AI Coding Agents | Claude, Cursor, VS Code, ChatGPT",
  description:
    "Connect your AI coding agent to LLM Boost via Model Context Protocol (MCP). 27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT. Crawl sites, score pages, and fix AI-readiness issues from your IDE.",
  keywords: [
    "MCP server",
    "Model Context Protocol",
    "AI coding agent",
    "SEO tools",
    "Claude Code MCP",
    "Cursor MCP",
    "VS Code MCP",
    "ChatGPT MCP",
    "AI-readiness",
    "LLM Boost",
  ],
  alternates: { canonical: "/mcp" },
  openGraph: {
    title: "MCP Server for AI Coding Agents | LLM Boost",
    description:
      "27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT via Model Context Protocol. Crawl, score, and fix your site from your IDE.",
    url: "https://llmrank.app/mcp",
    siteName: "LLM Boost",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP Server for AI Coding Agents | LLM Boost",
    description:
      "27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT via Model Context Protocol.",
  },
};

const TOOL_CATEGORIES = [
  {
    name: "Projects",
    icon: Wrench,
    tools: [
      {
        name: "list_projects",
        desc: "List all projects with domains and latest scores",
      },
      {
        name: "get_project",
        desc: "Get project details including latest crawl score",
      },
      {
        name: "create_project",
        desc: "Create a new project by providing a domain",
      },
    ],
  },
  {
    name: "Crawling",
    icon: Search,
    tools: [
      {
        name: "start_crawl",
        desc: "Start a crawl scoring pages across 37 AI-readiness factors",
      },
      { name: "get_crawl_status", desc: "Check crawl progress in real time" },
      {
        name: "list_crawls",
        desc: "Get crawl history with scores and timestamps",
      },
    ],
  },
  {
    name: "Scores & Analysis",
    icon: BarChart3,
    tools: [
      {
        name: "get_site_score",
        desc: "Overall AI-readiness score with category breakdown",
      },
      {
        name: "compare_scores",
        desc: "Compare two crawls to see improvements or regressions",
      },
      {
        name: "get_score_history",
        desc: "Score trends over time across crawls",
      },
      {
        name: "list_pages",
        desc: "List crawled pages with scores, sortable by grade",
      },
      {
        name: "get_page_details",
        desc: "Full page analysis: per-category scores, issues, fixes",
      },
    ],
  },
  {
    name: "Issues & Fixes",
    icon: Bug,
    tools: [
      {
        name: "list_issues",
        desc: "All issues grouped by severity and category",
      },
      {
        name: "get_fix_recommendation",
        desc: "AI-generated fix steps with code examples",
      },
      {
        name: "generate_fix",
        desc: "Generate code snippets to resolve a specific issue",
      },
    ],
  },
  {
    name: "AI Visibility",
    icon: Eye,
    tools: [
      {
        name: "check_visibility",
        desc: "Check if your brand appears in AI search results across 6 platforms",
      },
      {
        name: "list_visibility_history",
        desc: "Track AI search presence over time",
      },
      {
        name: "suggest_queries",
        desc: "AI-suggested queries to monitor based on your content",
      },
    ],
  },
  {
    name: "Content & Technical",
    icon: Code,
    tools: [
      {
        name: "analyze_content",
        desc: "Evaluate content across 37 AI-readiness factors",
      },
      {
        name: "suggest_meta_tags",
        desc: "Generate optimized title, description, and OG tags",
      },
      {
        name: "check_llms_txt",
        desc: "Validate your llms.txt for AI crawler permissions",
      },
      {
        name: "validate_schema",
        desc: "Check structured data (JSON-LD, Schema.org)",
      },
    ],
  },
  {
    name: "Strategy",
    icon: Lightbulb,
    tools: [
      {
        name: "get_recommendations",
        desc: "Prioritized action plan ranked by effort and impact",
      },
      {
        name: "get_content_gaps",
        desc: "Topics competitors cover that you don't",
      },
      {
        name: "discover_keywords",
        desc: "AI-powered keyword discovery with search volume",
      },
      {
        name: "list_competitors",
        desc: "Competitors with AI-readiness score comparison",
      },
      {
        name: "compare_competitor",
        desc: "Side-by-side comparison with a specific competitor",
      },
    ],
  },
  {
    name: "Reports",
    icon: FileText,
    tools: [
      {
        name: "generate_report",
        desc: "Comprehensive Markdown report with scores, issues, and recommendations",
      },
    ],
  },
];

const IDE_CONFIGS = [
  {
    name: "Claude Code",
    id: "claude-code",
    type: "cli" as const,
    command: `claude mcp add llm-boost \\
  --env LLM_BOOST_API_TOKEN=llmb_xxx \\
  -- npx -y @llmrank.app/mcp`,
  },
  {
    name: "Cursor",
    id: "cursor",
    type: "json" as const,
    path: "~/.cursor/mcp.json",
    config: JSON.stringify(
      {
        mcpServers: {
          "llm-boost": {
            command: "npx",
            args: ["-y", "@llmrank.app/mcp"],
            env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    name: "Claude Desktop",
    id: "claude-desktop",
    type: "json" as const,
    path: "claude_desktop_config.json",
    config: JSON.stringify(
      {
        mcpServers: {
          "llm-boost": {
            command: "npx",
            args: ["-y", "@llmrank.app/mcp"],
            env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    name: "VS Code",
    id: "vscode",
    type: "json" as const,
    path: ".vscode/mcp.json",
    config: JSON.stringify(
      {
        servers: {
          "llm-boost": {
            command: "npx",
            args: ["-y", "@llmrank.app/mcp"],
            env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    name: "Windsurf",
    id: "windsurf",
    type: "json" as const,
    path: "~/.codeium/windsurf/mcp_config.json",
    config: JSON.stringify(
      {
        mcpServers: {
          "llm-boost": {
            command: "npx",
            args: ["-y", "@llmrank.app/mcp"],
            env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    name: "ChatGPT / HTTP",
    id: "chatgpt",
    type: "http" as const,
    endpoint: "https://mcp.llmrank.app/v1/mcp",
    auth: "OAuth 2.1 with PKCE (auto-discovered via /.well-known/oauth-authorization-server)",
  },
];

const FAQ_ITEMS = [
  {
    question: "What is the Model Context Protocol (MCP)?",
    answer:
      "MCP is an open standard created by Anthropic that lets AI coding agents connect to external tools and data sources. It provides a unified way for IDEs like Claude Code, Cursor, VS Code, and ChatGPT to call tools — in this case, the 27 SEO tools from LLM Boost.",
  },
  {
    question: "Which AI coding agents support MCP?",
    answer:
      "Claude Code, Cursor, Claude Desktop, VS Code (via Copilot), Windsurf, ChatGPT, and Perplexity all support MCP servers. LLM Boost works with all of them — use stdio transport for local IDEs or the HTTP endpoint for cloud-based agents.",
  },
  {
    question: "Do I need a paid plan to use the MCP server?",
    answer:
      "The MCP server works with any LLM Boost plan, including the free tier. Free accounts can crawl up to 10 pages per crawl with 2 crawls per month. Paid plans unlock higher limits and additional features like competitor analysis.",
  },
  {
    question: "Is the MCP server open source?",
    answer:
      "Yes, the @llmrank.app/mcp package is MIT licensed and published on npm. The source code is available on GitHub.",
  },
  {
    question: "How does the HTTP transport work for ChatGPT?",
    answer:
      "ChatGPT and other cloud-based clients use the Streamable HTTP transport at mcp.llmrank.app/v1/mcp. Authentication uses OAuth 2.1 with PKCE — the client discovers the authorization server via the /.well-known/oauth-authorization-server endpoint and completes the flow automatically.",
  },
];

function mcpServerSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "@llmrank.app/mcp",
    alternateName: "LLM Boost MCP Server",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "MCP Server",
    operatingSystem: "Cross-platform",
    url: "https://llmrank.app/mcp",
    downloadUrl: "https://www.npmjs.com/package/@llmrank.app/mcp",
    installUrl: "https://www.npmjs.com/package/@llmrank.app/mcp",
    softwareRequirements: "Node.js 18+",
    description:
      "Model Context Protocol (MCP) server providing 27 AI-readiness SEO tools for coding agents. Crawl websites, score pages across 37 factors, check AI visibility, and get actionable fixes — all from your IDE.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    featureList: [
      "27 MCP tools for SEO analysis",
      "37-factor AI-readiness scoring",
      "AI visibility checks across ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok",
      "Competitor analysis",
      "Code fix generation",
      "Report generation",
      "Works with Claude Code, Cursor, VS Code, ChatGPT, Windsurf",
    ],
    license: "https://opensource.org/licenses/MIT",
    isPartOf: {
      "@type": "SoftwareApplication",
      name: "LLM Boost",
      url: "https://llmrank.app",
    },
  };
}

export default function McpPage() {
  const totalTools = TOOL_CATEGORIES.reduce(
    (sum, cat) => sum + cat.tools.length,
    0,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={webPageSchema({
          title: "MCP Server for AI Coding Agents",
          description:
            "27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT via Model Context Protocol.",
          path: "/mcp",
          type: "WebPage",
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "MCP Server", path: "/mcp" },
        ])}
      />
      <JsonLd data={mcpServerSchema()} />
      <JsonLd data={faqSchema(FAQ_ITEMS)} />

      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Boost
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/integrations"
              className="text-muted-foreground hover:text-foreground"
            >
              Integrations
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
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
        {/* Hero */}
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
              href="https://www.npmjs.com/package/@llmrank.app/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground hover:bg-muted/50"
            >
              View on npm
            </a>
          </div>
        </section>

        {/* Quick Start */}
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
            {IDE_CONFIGS.map((ide) => (
              <div
                key={ide.id}
                id={ide.id}
                className="scroll-mt-20 rounded-lg border border-border"
              >
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <h3 className="font-semibold">{ide.name}</h3>
                  {ide.type === "json" && (
                    <span className="text-xs text-muted-foreground">
                      {ide.path}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto bg-muted/30 p-4">
                  <pre className="text-sm leading-relaxed">
                    <code>
                      {ide.type === "cli"
                        ? ide.command
                        : ide.type === "json"
                          ? ide.config
                          : `Endpoint: ${ide.endpoint}\nAuth: ${ide.auth}`}
                    </code>
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

        {/* Tool Categories */}
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
            {TOOL_CATEGORIES.map((category) => (
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

        {/* Prompts */}
        <section className="mb-16">
          <h2 className="mb-2 text-2xl font-bold">Pre-built Prompts</h2>
          <p className="mb-6 text-muted-foreground">
            Common workflows packaged as MCP prompts your agent can invoke
            directly.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: "site-audit",
                desc: "Full AI-readiness audit: scores, critical issues, and prioritized action plan",
              },
              {
                name: "fix-plan",
                desc: "Generate specific code and content fixes for your top issues",
              },
              {
                name: "competitor-analysis",
                desc: "Compare your site against competitors and identify gaps",
              },
            ].map((prompt) => (
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

        {/* HTTP Transport / OAuth */}
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
            <div className="rounded-lg border border-border p-4">
              <Globe className="mb-2 h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">MCP Endpoint</h3>
              <code className="mt-1 block text-xs text-muted-foreground">
                https://mcp.llmrank.app/v1/mcp
              </code>
            </div>
            <div className="rounded-lg border border-border p-4">
              <Key className="mb-2 h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">OAuth Discovery</h3>
              <code className="mt-1 block text-xs text-muted-foreground">
                /.well-known/oauth-authorization-server
              </code>
            </div>
            <div className="rounded-lg border border-border p-4">
              <TrendingUp className="mb-2 h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">Resource Metadata</h3>
              <code className="mt-1 block text-xs text-muted-foreground">
                /.well-known/oauth-protected-resource
              </code>
            </div>
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

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
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

        {/* CTA */}
        <section className="rounded-lg border border-border bg-muted/40 p-8 text-center">
          <h2 className="text-xl font-bold">
            Start using LLM Boost from your IDE
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
              href="https://www.npmjs.com/package/@llmrank.app/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:text-primary"
            >
              npm package &rarr;
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Boost</span>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <Link href="/integrations" className="hover:text-foreground">
            Integrations
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/scan" className="hover:text-foreground">
            Free Scan
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
