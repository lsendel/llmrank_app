# Analytics Environment Variables

This document lists all secrets and environment variables required for the analytics features (GA4, Cloudflare Analytics, and first-party AI traffic tracking).

## Web (`apps/web`) -- Client-Side Analytics

These are public env vars set in `.env.local` (or your deployment platform) and embedded in the browser bundle.

| Variable                         | Required | Description                                                                        | Where to get it                                                      |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`  | Optional | GA4 measurement ID (e.g. `G-XXXXXXXXXX`) for tracking visits to llmrank.app itself | GA4 Admin > Data Streams > Measurement ID                            |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | Optional | Cloudflare Web Analytics beacon token                                              | Cloudflare dashboard > Analytics & Logs > Web Analytics > site token |
| `NEXT_PUBLIC_POSTHOG_KEY`        | Optional | PostHog project API key for product analytics                                      | PostHog > Project Settings > API Key                                 |
| `NEXT_PUBLIC_POSTHOG_HOST`       | Optional | PostHog ingest host (defaults to `https://us.i.posthog.com`)                       | PostHog > Project Settings                                           |
| `NEXT_PUBLIC_API_URL`            | Required | Base URL for the API (used by AI traffic tab to fetch analytics data)              | `https://api.llmrank.app` in production                              |

## API (`apps/api`) -- Server-Side Secrets

Set via `npx wrangler secret put <NAME> --name llm-boost-api` or in `.dev.vars` for local development.

### GA4 Server-Side Event Tracking

Used by `apps/api/src/lib/ga4.ts` (`trackGA4Server`) to send server-side events to GA4 via the Measurement Protocol.

| Secret               | Required | Description                                                          | Where to get it                                                      |
| -------------------- | -------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GA4_MEASUREMENT_ID` | Optional | Same GA4 measurement ID as the client-side one (e.g. `G-XXXXXXXXXX`) | GA4 Admin > Data Streams > Measurement ID                            |
| `GA4_API_SECRET`     | Optional | GA4 Measurement Protocol API secret                                  | GA4 Admin > Data Streams > Measurement Protocol API secrets > Create |

**Note:** These are not yet declared in the `Bindings` type in `apps/api/src/index.ts` and `trackGA4Server` is not yet wired into any route. They will need to be added to the Bindings type and called from the appropriate route when server-side GA4 tracking is activated.

### Google OAuth (for GA4 Integration data fetching)

Used by `packages/integrations/src/fetchers/ga4.ts` to pull GA4 analytics data into user dashboards (bounce rate, sessions, engagement). Users connect their own Google Analytics via OAuth.

| Secret                       | Required | Description                    | Where to get it                                                             |
| ---------------------------- | -------- | ------------------------------ | --------------------------------------------------------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID`     | Yes      | Google OAuth 2.0 client ID     | Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes      | Google OAuth 2.0 client secret | Same as above                                                               |

These are already declared in the API Bindings type and listed in `wrangler.toml` secrets comment.

## First-Party AI Traffic Tracking

The first-party analytics system (`apps/api/src/routes/analytics.ts`) does **not** require any additional secrets. It uses a JavaScript snippet served from the API (`/s/analytics.js`) that sends beacon events to `/analytics/collect`. All data is stored in the Neon PostgreSQL database using existing `DATABASE_URL`.

## Setting Secrets

```bash
# Cloudflare Workers secrets (API)
echo "<value>" | npx wrangler secret put GA4_MEASUREMENT_ID --name llm-boost-api
echo "<value>" | npx wrangler secret put GA4_API_SECRET --name llm-boost-api

# Web env vars -- add to .env.local or Cloudflare Pages environment variables
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=your-cf-token
```
