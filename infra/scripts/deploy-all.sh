#!/usr/bin/env bash
set -euo pipefail

# Deploy all LLM Rank services in dependency order.
# Usage: bash infra/scripts/deploy-all.sh
#
# Prerequisites:
#   - DATABASE_URL env var set (Neon connection string)
#   - wrangler authenticated (wrangler login or CLOUDFLARE_API_TOKEN)
#   - pnpm install already run

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== 1/3 Running DB migrations ==="
(cd "$ROOT" && pnpm --filter @llm-boost/db push)

echo "=== 2/3 Deploying API Worker ==="
(cd "$ROOT/apps/api" && npx wrangler deploy)

echo "=== 3/3 Building & deploying Web ==="
(cd "$ROOT/apps/web" && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc)

echo "=== All services deployed ==="
