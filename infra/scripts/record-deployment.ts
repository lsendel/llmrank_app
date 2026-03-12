#!/usr/bin/env node
/**
 * Record deployment to KV store for rollback tracking
 *
 * Usage:
 *   pnpm tsx infra/scripts/record-deployment.ts
 *
 * Environment variables:
 *   - CF_API_TOKEN: Cloudflare API token
 *   - CF_ACCOUNT_ID: Cloudflare account ID
 *   - KV_NAMESPACE_ID: KV namespace ID
 *   - DEPLOYMENT_VERSION: Version to record (defaults to git commit)
 *   - DEPLOYMENT_ENV: Environment (production|staging|development)
 */

import { execSync } from "child_process";

interface DeploymentManifest {
  version: string;
  timestamp: number;
  gitCommit: string;
  gitBranch: string;
  services: {
    api?: { version: string; deployedAt: number; healthCheckUrl?: string };
    web?: { version: string; deployedAt: number; healthCheckUrl?: string };
    crawler?: { version: string; deployedAt: number; healthCheckUrl?: string };
    reportWorker?: {
      version: string;
      deployedAt: number;
      healthCheckUrl?: string;
    };
  };
  migrations: {
    applied: string[];
    rollbackAvailable: boolean;
  };
  environment: "production" | "staging" | "development";
}

async function recordDeployment() {
  const {
    CF_API_TOKEN,
    CF_ACCOUNT_ID,
    KV_NAMESPACE_ID,
    DEPLOYMENT_VERSION,
    DEPLOYMENT_ENV = "production",
  } = process.env;

  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !KV_NAMESPACE_ID) {
    console.error(
      "Missing required environment variables: CF_API_TOKEN, CF_ACCOUNT_ID, KV_NAMESPACE_ID",
    );
    process.exit(1);
  }

  // Get git info
  const gitCommit = execSync("git rev-parse HEAD").toString().trim();
  const gitBranch = execSync("git rev-parse --abbrev-ref HEAD")
    .toString()
    .trim();

  const version = DEPLOYMENT_VERSION || gitCommit.substring(0, 8);

  // Get migration files
  const migrations = execSync(
    'ls packages/db/migrations/*.sql 2>/dev/null || echo ""',
  )
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((path) => path.split("/").pop()!);

  const manifest: DeploymentManifest = {
    version,
    timestamp: Date.now(),
    gitCommit,
    gitBranch,
    services: {
      api: {
        version,
        deployedAt: Date.now(),
        healthCheckUrl: "https://api.llmrank.app/health",
      },
      web: {
        version,
        deployedAt: Date.now(),
        healthCheckUrl: "https://llmrank.app/api/health",
      },
      crawler: {
        version,
        deployedAt: Date.now(),
        healthCheckUrl: "https://llmrank-crawler.fly.dev/health",
      },
      reportWorker: {
        version,
        deployedAt: Date.now(),
      },
    },
    migrations: {
      applied: migrations,
      rollbackAvailable: false, // Migrations are forward-only
    },
    environment: DEPLOYMENT_ENV as "production" | "staging" | "development",
  };

  console.log("Recording deployment:", {
    version: manifest.version,
    commit: manifest.gitCommit.substring(0, 8),
    branch: manifest.gitBranch,
    environment: manifest.environment,
  });

  // Write to KV
  const kvUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/deployment:manifest:current`;

  const response = await fetch(kvUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(manifest),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to record deployment:", error);
    process.exit(1);
  }

  console.log("✅ Deployment recorded successfully");

  // Also append to history
  const historyUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/deployment:history`;

  try {
    const historyResponse = await fetch(historyUrl, {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
    });

    let history: DeploymentManifest[] = [];

    if (historyResponse.ok) {
      const historyText = await historyResponse.text();
      if (historyText) {
        history = JSON.parse(historyText);
      }
    }

    history.unshift(manifest);

    // Keep only last 50
    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    const putHistoryResponse = await fetch(historyUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(history),
    });

    if (putHistoryResponse.ok) {
      console.log(`✅ Updated deployment history (${history.length} entries)`);
    }
  } catch (error) {
    console.warn("Warning: Failed to update deployment history:", error);
  }
}

recordDeployment().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
