# @llmrank.app/mcp

MCP server for [LLM Boost](https://llmrank.app) — AI-readiness SEO tools for your coding agent. Crawl sites, score pages across 37 factors, track AI visibility, and get actionable fixes to improve how AI assistants cite your content.

## Getting Started

1. **Get an API token** at [llmrank.app/dashboard/settings](https://llmrank.app/dashboard/settings) (API Tokens tab)
2. Configure the MCP server in your IDE (see below)

## Setup

### Claude Code

```bash
claude mcp add llm-boost \
  --env LLM_BOOST_API_TOKEN=llmb_xxx \
  -- npx -y @llmrank.app/mcp
```

**Team setup** — share the config with your team via `.mcp.json` (committed to git):

```bash
claude mcp add llm-boost --scope project \
  --env LLM_BOOST_API_TOKEN \
  -- npx -y @llmrank.app/mcp
```

Each team member sets `LLM_BOOST_API_TOKEN` in their shell environment (e.g. `.env`, `.zshrc`). The `.mcp.json` config is shared via git — no tokens in source control.

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "llmb_xxx"
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json` ([find config file](https://modelcontextprotocol.io/quickstart/user)):

```json
{
  "mcpServers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "llmb_xxx"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "llmb_xxx"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "llmb_xxx"
      }
    }
  }
}
```

### HTTP Transport (ChatGPT, remote clients)

For clients that support Streamable HTTP (e.g. ChatGPT, OpenAI Agents SDK), use the hosted endpoint:

```
Endpoint: https://mcp.llmrank.app/v1/mcp
Auth: Bearer <your_llmb_token>
```

The endpoint also supports OAuth 2.1 with PKCE — see `/.well-known/oauth-authorization-server` for discovery.

### Perplexity

Perplexity supports local MCP servers on macOS. Add via **Settings > Connectors** using the same JSON config as Cursor above.

## Environment Variables

| Variable              | Required | Description                                                                                                            |
| --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `LLM_BOOST_API_TOKEN` | Yes      | API token starting with `llmb_` — generate at [llmrank.app/dashboard/settings](https://llmrank.app/dashboard/settings) |
| `LLM_BOOST_API_URL`   | No       | API base URL (default: `https://api.llmrank.app`)                                                                      |

## Available Tools

### Projects

| Tool             | Description                                      |
| ---------------- | ------------------------------------------------ |
| `list_projects`  | List all projects with domains and latest scores |
| `get_project`    | Get project details including latest crawl score |
| `create_project` | Create a new project by providing a domain       |

### Crawling

| Tool               | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `start_crawl`      | Start a new crawl — scores pages across 37 AI-readiness factors |
| `get_crawl_status` | Check crawl progress (pending → crawling → scoring → complete)  |
| `list_crawls`      | Get crawl history with scores and timestamps                    |

### Scores & Analysis

| Tool                | Description                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `get_site_score`    | Overall AI-readiness score with category breakdown (Technical 25%, Content 30%, AI Readiness 30%, Performance 15%) |
| `compare_scores`    | Compare two crawls to see improvements or regressions                                                              |
| `get_score_history` | Score trends over time across crawls                                                                               |
| `list_pages`        | List crawled pages with scores, sortable and filterable by grade                                                   |
| `get_page_details`  | Full page analysis: per-category scores, all issues, and fixes                                                     |

### Issues & Fixes

| Tool                     | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `list_issues`            | All issues grouped by severity (critical/warning/info) and category    |
| `get_fix_recommendation` | AI-generated fix steps with code examples and expected score impact    |
| `generate_fix`           | Generate code snippets and content changes to resolve a specific issue |

### AI Visibility

| Tool                      | Description                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `check_visibility`        | Check if your brand appears in AI search results across 6 platforms (ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok) |
| `list_visibility_history` | Track AI search presence over time                                                                                       |
| `suggest_queries`         | AI-suggested queries to monitor based on your content and industry                                                       |

### Content & Technical

| Tool                | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `analyze_content`   | Evaluate page content across 37 AI-readiness factors        |
| `suggest_meta_tags` | Generate optimized title, description, and Open Graph tags  |
| `check_llms_txt`    | Validate your llms.txt file for AI crawler permissions      |
| `validate_schema`   | Check structured data (JSON-LD, Schema.org) for correctness |

### Strategy

| Tool                  | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `get_recommendations` | Prioritized action plan ranked by effort and impact              |
| `get_content_gaps`    | Topics competitors cover that you don't                          |
| `discover_keywords`   | AI-powered keyword discovery with search volume and AI relevance |
| `list_competitors`    | Tracked competitors with AI-readiness score comparison           |
| `compare_competitor`  | Side-by-side comparison with a specific competitor               |

### Reports

| Tool              | Description                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| `generate_report` | Comprehensive Markdown report with scores, issues, and recommendations |

## Prompts

The server includes pre-built prompts for common workflows:

- **`site-audit`** — Full AI-readiness audit: scores, critical issues, and prioritized action plan
- **`fix-plan`** — Generate specific code/content fixes for top issues
- **`competitor-analysis`** — Compare your site against competitors and identify gaps

## License

MIT
