# LLM Rank

AI-Readiness SEO Platform — crawl websites, score pages across 37 factors, and get actionable recommendations to increase visibility in AI-generated responses.

## Why LLM Rank?

AI assistants are becoming the primary way people find information. When ChatGPT, Claude, Perplexity, Gemini 3, Codex, or Meta AI generate answers, they pull from web content — but not all content is equally visible. LLM Rank analyzes your site and tells you exactly what to fix.

## Supported AI Platforms

LLM Rank monitors and optimizes your visibility across:

- **ChatGPT** — OpenAI's conversational assistant
- **Claude** — Anthropic's AI assistant
- **Perplexity** — AI-powered search engine
- **Gemini** — Google's multimodal AI
- **Google AI Mode** — Google's AI-powered search experience
- **Copilot** — Microsoft's AI assistant (Bing-powered)
- **Grok** — xAI's conversational assistant with real-time web search
- **Meta AI** — Meta's AI assistant powered by Llama

## How It Works

1. **Crawl** — Submit your domain; our Rust-based crawler analyzes every page
2. **Score** — 37-factor scoring engine rates Technical (25%), Content (30%), AI Readiness (30%), and Performance (15%)
3. **Fix** — Prioritized recommendations with severity levels and projected impact
4. **Monitor** — Scheduled recrawls track your progress over time

## Scoring

Each page receives a composite score (0–100) and letter grade:

| Grade | Score  | Meaning                                |
| ----- | ------ | -------------------------------------- |
| A     | 90–100 | Excellent AI visibility                |
| B     | 80–89  | Good, minor improvements possible      |
| C     | 70–79  | Fair, several issues to address        |
| D     | 60–69  | Poor, significant gaps                 |
| F     | < 60   | Critical issues blocking AI visibility |

Critical issues include missing `llms.txt`, blocked AI crawlers, `noindex` directives, and missing metadata.

## Tech Stack

- **Frontend:** Next.js on Cloudflare Pages
- **API:** Cloudflare Workers (Hono)
- **Database:** Neon PostgreSQL (Drizzle ORM)
- **Crawler:** Rust (Axum + Tokio) on Fly.io
- **LLM Scoring:** Anthropic (content analysis) + OpenAI (visibility checks)
- **Billing:** Stripe

## Plans

|                  | Free | Starter ($79/mo) | Pro ($149/mo) | Agency ($299/mo) |
| ---------------- | ---- | ---------------- | ------------- | ---------------- |
| Pages per crawl  | 10   | 100              | 500           | 2,000            |
| Crawls per month | 2    | 10               | 30            | Unlimited        |
| Projects         | 1    | 5                | 20            | 50               |

## Development

```bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm test       # Run all tests
pnpm typecheck  # Typecheck all packages
```

## Deployment

CI auto-deploys on push to `main`:

- **Cloudflare** (API, Report Worker, Web) — `.github/workflows/deploy-cloudflare.yml`
- **Fly.io** (Crawler, Report Service) — `.github/workflows/deploy-fly.yml`

See `CLAUDE.md` for full deployment docs and manual commands.

## License

Proprietary. All rights reserved.
