# LLM Rank — Production Deployment
# Usage:
#   make deploy              — deploy all services in dependency order
#   make deploy-cloudflare   — deploy all Cloudflare services (db → api + report-worker → web)
#   make deploy-fly          — deploy all Fly.io services (crawler + report-service)
#   make deploy-db           — push schema to Neon
#   make deploy-api          — deploy API Worker
#   make deploy-report-worker — deploy Report Worker
#   make deploy-web          — build (OpenNext) and deploy web app
#   make deploy-crawler      — deploy Rust crawler to Fly.io
#   make deploy-reports      — deploy report service to Fly.io

.PHONY: deploy deploy-cloudflare deploy-fly deploy-db deploy-api deploy-report-worker deploy-web deploy-crawler deploy-reports

# Load DATABASE_URL from .env if present
ifneq (,$(wildcard .env))
  include .env
  export
endif

deploy: deploy-cloudflare deploy-fly
	@echo ""
	@echo "All services deployed successfully."

deploy-cloudflare: deploy-db deploy-api deploy-report-worker deploy-web

deploy-fly: deploy-crawler deploy-reports

deploy-db:
	@echo "==> Pushing database schema to Neon..."
	cd packages/db && npx drizzle-kit push

deploy-api: deploy-db
	@echo "==> Deploying API Worker to Cloudflare..."
	cd apps/api && npx wrangler deploy

deploy-report-worker: deploy-db
	@echo "==> Deploying Report Worker to Cloudflare..."
	cd apps/report-worker && npx wrangler deploy

deploy-web: deploy-api deploy-report-worker
	@echo "==> Building and deploying web app to Cloudflare..."
	cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc

deploy-crawler:
	@echo "==> Deploying crawler to Fly.io..."
	cd apps/crawler && flyctl deploy -a llmrank-crawler

deploy-reports:
	@echo "==> Deploying report service to Fly.io..."
	cd apps/report-service && flyctl deploy -a llm-boost-reports

baseline:
	@echo "==> Baselining to master..."
	git add .
	git commit -m "chore: baseline to master"
	git push origin main
