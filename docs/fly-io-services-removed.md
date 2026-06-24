# Fly.io Services — Removed Configuration (2026-03-31)

This document captures all Fly.io service configurations that were removed from the codebase.
Use this as a reference to re-add Fly.io deployments when ready.

---

## Services Overview

| Service        | App Name            | URL                                 | VM                   | Region |
| -------------- | ------------------- | ----------------------------------- | -------------------- | ------ |
| Rust Crawler   | `llmrank-crawler`   | `https://llmrank-crawler.fly.dev`   | shared-cpu-2x, 2GB   | iad    |
| Report Service | `llm-boost-reports` | `https://llm-boost-reports.fly.dev` | shared-cpu-1x, 512MB | iad    |

**Required secret:** `FLY_API_TOKEN` (GitHub Actions)

---

## 1. Crawler (`apps/crawler/fly.toml`)

```toml
app = "llmrank-crawler"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [http_service.concurrency]
    type = "connections"
    soft_limit = 10
    hard_limit = 25

[checks]
  [checks.health]
    type = "http"
    port = 8080
    path = "/api/v1/health"
    interval = "15s"
    timeout = "2s"
    method = "GET"
    grace_period = "30s"

[[vm]]
  size = "shared-cpu-2x"
  memory = "2gb"
  cpus = 2
```

### Crawler Dockerfile (`apps/crawler/Dockerfile`)

```dockerfile
FROM rust:1.93-slim-bookworm AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/crawler
COPY Cargo.toml Cargo.lock ./

RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src target/release/deps/crawler*

COPY src/ src/
RUN cargo build --release

FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g lighthouse@13.0.3 puppeteer-core

COPY scripts/ /app/scripts/

COPY --from=builder /usr/src/crawler/target/release/crawler /usr/local/bin/crawler

ENV CHROME_PATH=/usr/bin/chromium
ENV RENDERER_SCRIPT_PATH=/app/scripts/render-links.mjs
ENV RUST_LOG=info
ENV PORT=8080

EXPOSE 8080

CMD ["crawler"]
```

### Alternate Crawler Dockerfile (`infra/docker/Dockerfile.crawler`)

```dockerfile
FROM rust:1.93-slim-bookworm AS builder

WORKDIR /usr/src/crawler
COPY apps/crawler/Cargo.toml apps/crawler/Cargo.lock ./

RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src target/release/deps/crawler*

COPY apps/crawler/src/ src/
RUN cargo build --release

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g lighthouse@13.0.3

COPY --from=builder /usr/src/crawler/target/release/crawler /usr/local/bin/crawler

ENV CHROME_PATH=/usr/bin/chromium
ENV RUST_LOG=info
ENV PORT=3000

EXPOSE 3000

CMD ["crawler"]
```

---

## 2. Report Service (`apps/report-service/fly.toml`)

```toml
app = "llm-boost-reports"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [http_service.concurrency]
    type = "connections"
    soft_limit = 5
    hard_limit = 10

[checks]
  [checks.health]
    type = "http"
    port = 8080
    path = "/health"
    interval = "15s"
    timeout = "2s"
    method = "GET"
    grace_period = "30s"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
  cpus = 1
```

### Report Service Dockerfile (`apps/report-service/Dockerfile`)

**Critical:** Must deploy from monorepo root — needs workspace deps.

```dockerfile
FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/reports/package.json packages/reports/
COPY packages/llm/package.json packages/llm/
COPY packages/narrative/package.json packages/narrative/
COPY packages/parsers/package.json packages/parsers/
COPY packages/repositories/package.json packages/repositories/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/scoring/package.json packages/scoring/
COPY apps/report-service/package.json apps/report-service/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY packages/reports/ packages/reports/
COPY packages/llm/ packages/llm/
COPY packages/narrative/ packages/narrative/
COPY packages/parsers/ packages/parsers/
COPY packages/repositories/ packages/repositories/
COPY packages/pipeline/ packages/pipeline/
COPY packages/scoring/ packages/scoring/
COPY apps/report-service/ apps/report-service/

WORKDIR /app/apps/report-service
RUN pnpm build

FROM node:20-slim AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/reports/package.json packages/reports/
COPY packages/llm/package.json packages/llm/
COPY packages/narrative/package.json packages/narrative/
COPY packages/parsers/package.json packages/parsers/
COPY packages/repositories/package.json packages/repositories/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/scoring/package.json packages/scoring/
COPY apps/report-service/package.json apps/report-service/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=base /app/apps/report-service/dist/ apps/report-service/dist/

WORKDIR /app/apps/report-service

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

---

## 3. GitHub Actions Workflow (`.github/workflows/deploy-fly.yml`)

```yaml
name: Deploy Fly.io

on:
  push:
    branches: [main]
    paths:
      - "apps/crawler/**"
      - "apps/report-service/**"
      - "packages/pipeline/**"
      - "packages/parsers/**"
      - "packages/repositories/**"
      - "packages/scoring/**"
      - "infra/docker/Dockerfile.crawler"

jobs:
  deploy-crawler:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy -a llmrank-crawler
        working-directory: apps/crawler
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-report-service:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: >-
          flyctl deploy -a llm-boost-reports
          --dockerfile apps/report-service/Dockerfile
          --config apps/report-service/fly.toml
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## 4. Deploy Scripts

### `infra/scripts/deploy-crawler.sh`

```bash
#!/bin/bash
set -e

echo 'Deploying Crawler to Fly.io...'
cd apps/crawler

if ! command -v fly &> /dev/null; then
    echo 'Error: fly CLI not found.'
    exit 1
fi

fly deploy --ha=false
```

### Fly.io section in `infra/scripts/deploy-all.sh` (was step 4/4)

```bash
echo "=== 4/4 Deploying Fly.io services ==="
(cd "$ROOT/apps/crawler" && flyctl deploy -a llmrank-crawler) &
(cd "$ROOT" && flyctl deploy -a llm-boost-reports \
  --dockerfile apps/report-service/Dockerfile \
  --config apps/report-service/fly.toml) &
wait
```

### Makefile targets

```makefile
deploy-fly: deploy-crawler deploy-reports

deploy-crawler:
	@echo "==> Deploying crawler to Fly.io..."
	cd apps/crawler && flyctl deploy -a llmrank-crawler

deploy-reports:
	@echo "==> Deploying report service to Fly.io..."
	cd apps/report-service && flyctl deploy -a llm-boost-reports
```

---

## 5. API Environment Variables (`apps/api/wrangler.toml`)

These vars point the API to Fly.io services:

```toml
[vars]
CRAWLER_URL = "https://llmrank-crawler.fly.dev"
REPORT_SERVICE_URL = "https://llm-boost-reports.fly.dev"
```

**When re-adding:** update these to the new Fly.io URLs (or whatever hosting you choose).

---

## 6. Monitoring References (`apps/api/src/services/monitoring-service.ts`)

The monitoring service has Fly.io dashboard links in alert emails:

- `https://fly.io/apps/llmrank-crawler/monitoring`
- Health check URL: `${crawlerUrl}/api/v1/health`

---

## 7. Other References

### `infra/scripts/rollback-deployment.ts` (line ~157)

Crawler rollback via flyctl deploy command.

### `infra/scripts/record-deployment.ts` (line ~93)

Health check URL: `https://llmrank-crawler.fly.dev/health`

---

## Re-adding Checklist

When ready to restore Fly.io services:

1. Re-create `apps/crawler/fly.toml` and `apps/report-service/fly.toml`
2. Re-create `apps/crawler/Dockerfile` and `apps/report-service/Dockerfile`
3. Re-create `infra/docker/Dockerfile.crawler`
4. Re-create `.github/workflows/deploy-fly.yml`
5. Re-create `infra/scripts/deploy-crawler.sh`
6. Restore Fly.io section in `infra/scripts/deploy-all.sh`
7. Restore Makefile targets (`deploy-fly`, `deploy-crawler`, `deploy-reports`)
8. Update `apps/api/wrangler.toml` vars: `CRAWLER_URL`, `REPORT_SERVICE_URL`
9. Restore monitoring dashboard links in `monitoring-service.ts`
10. Restore rollback/record deployment scripts references
11. Ensure `FLY_API_TOKEN` GitHub secret is still configured
12. Update `CLAUDE.md` and `AGENTS.md` architecture sections
