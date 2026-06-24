# LLM Rank — Production Deployment
# Usage:
#   make deploy              — deploy all services in dependency order
#   make deploy-cloudflare   — deploy all Cloudflare services (db → api → web)
#   make deploy-db           — push schema to Neon
#   make deploy-api          — deploy API Worker
#   make deploy-web          — build (OpenNext) and deploy web app

.PHONY: deploy deploy-cloudflare deploy-db deploy-api deploy-web

# Load DATABASE_URL from .env if present
ifneq (,$(wildcard .env))
  include .env
  export
endif

deploy: deploy-cloudflare
	@echo ""
	@echo "All services deployed successfully."

deploy-cloudflare: deploy-db deploy-api deploy-web

deploy-db:
	@echo "==> Pushing database schema to Neon..."
	cd packages/db && npx drizzle-kit push

deploy-api: deploy-db
	@echo "==> Deploying API Worker to Cloudflare..."
	cd apps/api && npx wrangler deploy

deploy-web: deploy-api
	@echo "==> Building and deploying web app to Cloudflare..."
	cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc


baseline:
	@echo "==> Baselining to master..."
	git add .
	git commit -m "chore: baseline to master"
	git push origin main
