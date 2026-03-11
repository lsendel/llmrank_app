#!/usr/bin/env node
/**
 * Rollback deployment to previous version
 *
 * Usage:
 *   pnpm tsx infra/scripts/rollback-deployment.ts [--dry-run] [--service=api|web|crawler|all]
 *
 * Environment variables:
 *   - CF_API_TOKEN: Cloudflare API token
 *   - CF_ACCOUNT_ID: Cloudflare account ID
 *   - KV_NAMESPACE_ID: KV namespace ID
 */

import { execSync } from "child_process";

interface DeploymentManifest {
  version: string;
  timestamp: number;
  gitCommit: string;
  gitBranch: string;
  services: {
    api?: { version: string; deployedAt: number };
    web?: { version: string; deployedAt: number };
    crawler?: { version: string; deployedAt: number };
    reportWorker?: { version: string; deployedAt: number };
  };
  migrations: {
    applied: string[];
    rollbackAvailable: boolean;
  };
  environment: string;
}

async function getDeploymentHistory(): Promise<DeploymentManifest[]> {
  const { CF_API_TOKEN, CF_ACCOUNT_ID, KV_NAMESPACE_ID } = process.env;

  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !KV_NAMESPACE_ID) {
    throw new Error(
      "Missing required environment variables: CF_API_TOKEN, CF_ACCOUNT_ID, KV_NAMESPACE_ID",
    );
  }

  const historyUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/deployment:history`;

  const response = await fetch(historyUrl, {
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch deployment history: ${response.status}`);
  }

  const text = await response.text();
  if (!text) return [];

  return JSON.parse(text);
}

async function rollbackDeployment(options: {
  dryRun: boolean;
  service: string;
}) {
  console.log("🔄 Starting deployment rollback...");

  const history = await getDeploymentHistory();

  if (history.length < 2) {
    console.error("❌ No previous deployment available for rollback");
    process.exit(1);
  }

  const current = history[0];
  const target = history[1];

  console.log("\nCurrent deployment:", {
    version: current.version,
    commit: current.gitCommit.substring(0, 8),
    timestamp: new Date(current.timestamp).toISOString(),
  });

  console.log("\nTarget deployment:", {
    version: target.version,
    commit: target.gitCommit.substring(0, 8),
    timestamp: new Date(target.timestamp).toISOString(),
  });

  // Check migrations
  if (!target.migrations.rollbackAvailable) {
    console.warn(
      "\n⚠️  WARNING: Database migrations cannot be automatically rolled back.",
    );
    console.warn(
      "   Manual intervention may be required if schema changes were made.",
    );
  }

  if (options.dryRun) {
    console.log("\n✅ Dry run completed. Would rollback to version:", target.version);
    return;
  }

  // Confirm
  console.log("\n⚠️  This will rollback the deployment. Continue? (y/N)");
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question("", (answer: string) => {
      readline.close();

      if (answer.toLowerCase() !== "y") {
        console.log("❌ Rollback cancelled");
        process.exit(0);
      }

      performRollback(target, options.service)
        .then(resolve)
        .catch((error) => {
          console.error("❌ Rollback failed:", error);
          process.exit(1);
        });
    });
  });
}

async function performRollback(
  target: DeploymentManifest,
  service: string,
): Promise<void> {
  console.log("\n🔄 Performing rollback...");

  // Checkout target commit
  console.log(`\n1. Checking out commit ${target.gitCommit.substring(0, 8)}...`);
  execSync(`git fetch origin`, { stdio: "inherit" });
  execSync(`git checkout ${target.gitCommit}`, { stdio: "inherit" });

  // Deploy services
  if (service === "all" || service === "api") {
    console.log("\n2. Deploying API...");
    execSync("cd apps/api && npx wrangler deploy", { stdio: "inherit" });
  }

  if (service === "all" || service === "web") {
    console.log("\n3. Deploying Web...");
    execSync(
      "cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc",
      { stdio: "inherit" },
    );
  }

  if (service === "all" || service === "crawler") {
    console.log("\n4. Deploying Crawler...");
    execSync("cd apps/crawler && flyctl deploy -a llmrank-crawler", {
      stdio: "inherit",
    });
  }

  console.log("\n✅ Rollback completed successfully");
  console.log(`\nRolled back to version: ${target.version}`);
  console.log(`Commit: ${target.gitCommit.substring(0, 8)}`);
}

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const serviceArg = args.find((arg) => arg.startsWith("--service="));
const service = serviceArg ? serviceArg.split("=")[1] : "all";

if (!["api", "web", "crawler", "all"].includes(service)) {
  console.error("Invalid service. Must be: api, web, crawler, or all");
  process.exit(1);
}

rollbackDeployment({ dryRun, service }).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
