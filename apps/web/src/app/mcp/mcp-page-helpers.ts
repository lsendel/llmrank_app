import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bug,
  Code,
  Eye,
  FileText,
  Globe,
  Key,
  Lightbulb,
  Search,
  TrendingUp,
  Wrench,
} from "lucide-react";

export type McpToolCategory = {
  name: string;
  icon: LucideIcon;
  tools: { name: string; desc: string }[];
};

export type McpIdeConfig =
  | { name: string; id: string; type: "cli"; command: string }
  | { name: string; id: string; type: "json"; path: string; config: string }
  | { name: string; id: string; type: "http"; endpoint: string; auth: string };

export const MCP_PACKAGE_URL = "https://www.npmjs.com/package/@llmrank.app/mcp";

export const MCP_PAGE_METADATA: Metadata = {
  title: "MCP Server for AI Coding Agents | Claude, Cursor, VS Code, ChatGPT",
  description:
    "Connect your AI coding agent to LLM Rank via Model Context Protocol (MCP). 27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT. Crawl sites, score pages, and fix AI-readiness issues from your IDE.",
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
    "LLM Rank",
  ],
  alternates: { canonical: "/mcp" },
  openGraph: {
    title: "MCP Server for AI Coding Agents | LLM Rank",
    description:
      "27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT via Model Context Protocol. Crawl, score, and fix your site from your IDE.",
    url: "https://llmrank.app/mcp",
    siteName: "LLM Rank",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP Server for AI Coding Agents | LLM Rank",
    description:
      "27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT via Model Context Protocol.",
  },
};

const buildMcpJsonConfig = (config: unknown) => JSON.stringify(config, null, 2);

export const MCP_WEBPAGE_SCHEMA = {
  title: "MCP Server for AI Coding Agents",
  description:
    "27 SEO tools for Claude Code, Cursor, VS Code, Windsurf, and ChatGPT via Model Context Protocol.",
  path: "/mcp",
  type: "WebPage" as const,
};

export const MCP_BREADCRUMBS = [
  { name: "Home", path: "/" },
  { name: "MCP Server", path: "/mcp" },
];

export const MCP_TOOL_CATEGORIES: McpToolCategory[] = [
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

export const MCP_IDE_CONFIGS: McpIdeConfig[] = [
  {
    name: "Claude Code",
    id: "claude-code",
    type: "cli",
    command: `claude mcp add llm-boost \\
  --env LLM_BOOST_API_TOKEN=llmb_xxx \\
  -- npx -y @llmrank.app/mcp`,
  },
  {
    name: "Cursor",
    id: "cursor",
    type: "json",
    path: "~/.cursor/mcp.json",
    config: buildMcpJsonConfig({
      mcpServers: {
        "llm-boost": {
          command: "npx",
          args: ["-y", "@llmrank.app/mcp"],
          env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
        },
      },
    }),
  },
  {
    name: "Claude Desktop",
    id: "claude-desktop",
    type: "json",
    path: "claude_desktop_config.json",
    config: buildMcpJsonConfig({
      mcpServers: {
        "llm-boost": {
          command: "npx",
          args: ["-y", "@llmrank.app/mcp"],
          env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
        },
      },
    }),
  },
  {
    name: "VS Code",
    id: "vscode",
    type: "json",
    path: ".vscode/mcp.json",
    config: buildMcpJsonConfig({
      servers: {
        "llm-boost": {
          command: "npx",
          args: ["-y", "@llmrank.app/mcp"],
          env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
        },
      },
    }),
  },
  {
    name: "Windsurf",
    id: "windsurf",
    type: "json",
    path: "~/.codeium/windsurf/mcp_config.json",
    config: buildMcpJsonConfig({
      mcpServers: {
        "llm-boost": {
          command: "npx",
          args: ["-y", "@llmrank.app/mcp"],
          env: { LLM_BOOST_API_TOKEN: "llmb_xxx" },
        },
      },
    }),
  },
  {
    name: "ChatGPT / HTTP",
    id: "chatgpt",
    type: "http",
    endpoint: "https://mcp.llmrank.app/v1/mcp",
    auth: "OAuth 2.1 with PKCE (auto-discovered via /.well-known/oauth-authorization-server)",
  },
];

export const MCP_FAQ_ITEMS = [
  {
    question: "What is the Model Context Protocol (MCP)?",
    answer:
      "MCP is an open standard created by Anthropic that lets AI coding agents connect to external tools and data sources. It provides a unified way for IDEs like Claude Code, Cursor, VS Code, and ChatGPT to call tools — in this case, the 27 SEO tools from LLM Rank.",
  },
  {
    question: "Which AI coding agents support MCP?",
    answer:
      "Claude Code, Cursor, Claude Desktop, VS Code (via Copilot), Windsurf, ChatGPT, and Perplexity all support MCP servers. LLM Rank works with all of them — use stdio transport for local IDEs or the HTTP endpoint for cloud-based agents.",
  },
  {
    question: "Do I need a paid plan to use the MCP server?",
    answer:
      "The MCP server works with any LLM Rank plan, including the free tier. Free accounts can crawl up to 10 pages per crawl with 2 crawls per month. Paid plans unlock higher limits and additional features like competitor analysis.",
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

export const MCP_PROMPTS = [
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
];

export const MCP_HTTP_TRANSPORT_ITEMS = [
  {
    name: "MCP Endpoint",
    icon: Globe,
    value: "https://mcp.llmrank.app/v1/mcp",
  },
  {
    name: "OAuth Discovery",
    icon: Key,
    value: "/.well-known/oauth-authorization-server",
  },
  {
    name: "Resource Metadata",
    icon: TrendingUp,
    value: "/.well-known/oauth-protected-resource",
  },
];

export const MCP_HEADER_LINKS = [
  { href: "/integrations", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
];

export const MCP_FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/integrations", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
  { href: "/scan", label: "Free Scan" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function getTotalMcpTools() {
  return MCP_TOOL_CATEGORIES.reduce(
    (sum, category) => sum + category.tools.length,
    0,
  );
}

export function getIdeConfigContent(config: McpIdeConfig) {
  if (config.type === "cli") return config.command;
  if (config.type === "json") return config.config;
  return `Endpoint: ${config.endpoint}\nAuth: ${config.auth}`;
}

export function getMcpServerSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "@llmrank.app/mcp",
    alternateName: "LLM Rank MCP Server",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "MCP Server",
    operatingSystem: "Cross-platform",
    url: "https://llmrank.app/mcp",
    downloadUrl: MCP_PACKAGE_URL,
    installUrl: MCP_PACKAGE_URL,
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
      name: "LLM Rank",
      url: "https://llmrank.app",
    },
  };
}
