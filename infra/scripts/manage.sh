#!/bin/bash
# Helper script for common project tasks

COMMAND=$1

case $COMMAND in
  "db:push")
    pnpm --filter @llm-boost/db exec drizzle-kit push
    ;;
  "db:generate")
    pnpm --filter @llm-boost/db exec drizzle-kit generate
    ;;
  "db:migrate")
    pnpm --filter @llm-boost/db exec drizzle-kit migrate
    ;;
  "deploy:api")
    pnpm --filter @llm-boost/api exec wrangler deploy
    ;;
  *)
    echo "Usage: ./infra/scripts/manage.sh [db:push|db:generate|db:migrate|deploy:api]"
    exit 1
    ;;
esac
