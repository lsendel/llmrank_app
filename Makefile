# LLM Boost — Production Deployment
# Usage:
#   make deploy          — deploy all services
#   make deploy-db       — push schema to Neon
#   make deploy-api      — deploy API Worker
#   make deploy-report-worker — deploy Report Worker
#   make deploy-web      — deploy Next.js web app
#   make deploy-crawler  — deploy Rust crawler to Fly.io
#   make deploy-reports  — deploy report service to Fly.io

.PHONY: deploy deploy-db deploy-api deploy-report-worker deploy-web deploy-crawler deploy-reports

# Load DATABASE_URL from .env if present
ifneq (,$(wildcard .env))
  include .env
  export
endif

deploy: deploy-db deploy-api deploy-report-worker deploy-web deploy-crawler deploy-reports
	@echo ""
	@echo "All services deployed successfully."

deploy-db:
	@echo "==> Pushing database schema to Neon..."
	cd packages/db && npx drizzle-kit push

deploy-api:
	@echo "==> Deploying API Worker to Cloudflare..."
	cd apps/api && npx wrangler deploy

deploy-report-worker:
	@echo "==> Deploying Report Worker to Cloudflare..."
	cd apps/report-worker && npx wrangler deploy

deploy-web:
	@echo "==> Building and deploying web app to Cloudflare..."
	cd apps/web && npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy

deploy-crawler:
	@echo "==> Deploying crawler to Fly.io..."
	cd apps/crawler && fly deploy

deploy-reports:
	@echo "==> Deploying report service to Fly.io..."
	fly deploy --config apps/report-service/fly.toml --dockerfile apps/report-service/Dockerfile
