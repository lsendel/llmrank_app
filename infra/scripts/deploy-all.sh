#!/usr/bin/env bash
set -euo pipefail

# Deploy all LLM Rank services in dependency order.
# Usage: bash infra/scripts/deploy-all.sh
#
# Prerequisites:
#   - DATABASE_URL env var set (Neon connection string)
#   - wrangler authenticated (wrangler login or CLOUDFLARE_API_TOKEN)
#   - flyctl authenticated (flyctl auth login or FLY_API_TOKEN)
#   - pnpm install already run

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== 1/5 Running DB migrations ==="
(cd "$ROOT" && pnpm --filter @llm-boost/db push)

echo "=== 2/5 Deploying API Worker ==="
(cd "$ROOT/apps/api" && npx wrangler deploy)

echo "=== 3/5 Deploying Report Worker ==="
(cd "$ROOT/apps/report-worker" && npx wrangler deploy)

echo "=== 4/5 Building & deploying Web ==="
(cd "$ROOT/apps/web" && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc)

echo "=== 5/5 Deploying Fly.io services ==="
(cd "$ROOT/apps/crawler" && flyctl deploy -a llmrank-crawler) &
(cd "$ROOT/apps/report-service" && flyctl deploy -a llm-boost-reports) &
wait

echo "=== All services deployed ==="
