/**
 * Deployment tracking and rollback service
 */

import type {
  DeploymentManifest,
  DeploymentStatus,
  RollbackOptions,
  RollbackResult,
} from "@llm-boost/shared";
import {
  DEPLOYMENT_MANIFEST_KEY,
  DEPLOYMENT_HISTORY_KEY,
  MAX_DEPLOYMENT_HISTORY,
} from "@llm-boost/shared";

export interface DeploymentServiceDeps {
  kv: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
  fetch?: typeof fetch;
}

export function createDeploymentService(deps: DeploymentServiceDeps) {
  return {
    /**
     * Record a new deployment
     */
    async recordDeployment(manifest: DeploymentManifest): Promise<void> {
      // Store current manifest
      await deps.kv.put(DEPLOYMENT_MANIFEST_KEY, JSON.stringify(manifest));

      // Add to history
      const historyJson = await deps.kv.get(DEPLOYMENT_HISTORY_KEY);
      const history: DeploymentManifest[] = historyJson
        ? JSON.parse(historyJson)
        : [];

      history.unshift(manifest);

      // Keep only last N deployments
      if (history.length > MAX_DEPLOYMENT_HISTORY) {
        history.splice(MAX_DEPLOYMENT_HISTORY);
      }

      await deps.kv.put(DEPLOYMENT_HISTORY_KEY, JSON.stringify(history));
    },

    /**
     * Get current deployment manifest
     */
    async getCurrentDeployment(): Promise<DeploymentManifest | null> {
      const manifestJson = await deps.kv.get(DEPLOYMENT_MANIFEST_KEY);
      if (!manifestJson) return null;
      return JSON.parse(manifestJson);
    },

    /**
     * Get deployment history
     */
    async getDeploymentHistory(
      limit: number = 10,
    ): Promise<DeploymentManifest[]> {
      const historyJson = await deps.kv.get(DEPLOYMENT_HISTORY_KEY);
      if (!historyJson) return [];

      const history: DeploymentManifest[] = JSON.parse(historyJson);
      return history.slice(0, limit);
    },

    /**
     * Check deployment health
     */
    async checkDeploymentHealth(): Promise<DeploymentStatus> {
      const manifest = await this.getCurrentDeployment();

      if (!manifest) {
        return {
          version: "unknown",
          healthy: false,
          services: [],
          canRollback: false,
        };
      }

      const serviceChecks = await Promise.allSettled([
        this.checkServiceHealth(
          manifest.services.api?.healthCheckUrl ?? "/health",
          "api",
        ),
        this.checkServiceHealth(
          manifest.services.web?.healthCheckUrl ?? "/health",
          "web",
        ),
        this.checkServiceHealth(
          manifest.services.crawler?.healthCheckUrl,
          "crawler",
        ),
      ]);

      const services = serviceChecks.map((result, idx) => {
        const name = ["api", "web", "crawler"][idx];
        if (result.status === "fulfilled") {
          return result.value;
        }
        return {
          name,
          healthy: false,
          message: "Health check failed",
        };
      });

      const allHealthy = services.every((s) => s.healthy);

      // Can rollback if there's deployment history
      const history = await this.getDeploymentHistory(2);
      const canRollback = history.length > 1;
      const rollbackTarget = canRollback ? history[1].version : undefined;

      return {
        version: manifest.version,
        healthy: allHealthy,
        services,
        canRollback,
        rollbackTarget,
      };
    },

    /**
     * Check individual service health
     */
    async checkServiceHealth(
      healthCheckUrl: string | undefined,
      serviceName: string,
    ): Promise<{ name: string; healthy: boolean; message?: string }> {
      if (!healthCheckUrl) {
        return { name: serviceName, healthy: true, message: "No health check" };
      }

      if (!deps.fetch) {
        return {
          name: serviceName,
          healthy: true,
          message: "Fetch not available",
        };
      }

      try {
        const response = await deps.fetch(healthCheckUrl, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          return { name: serviceName, healthy: true };
        }

        return {
          name: serviceName,
          healthy: false,
          message: `HTTP ${response.status}`,
        };
      } catch (error) {
        return {
          name: serviceName,
          healthy: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    /**
     * Perform rollback to previous version
     */
    async rollback(options: RollbackOptions = {}): Promise<RollbackResult> {
      const startTime = Date.now();
      const errors: string[] = [];

      // Get current and target versions
      const history = await this.getDeploymentHistory(2);

      if (history.length < 2) {
        return {
          success: false,
          previousVersion: history[0]?.version ?? "unknown",
          newVersion: "none",
          servicesRolledBack: [],
          errors: ["No previous deployment available for rollback"],
          duration: Date.now() - startTime,
        };
      }

      const current = history[0];
      const target = history[1];

      // Check migrations
      if (!target.migrations.rollbackAvailable && !options.skipHealthCheck) {
        errors.push(
          "Database migrations cannot be automatically rolled back. Manual intervention required.",
        );
      }

      // In dry-run mode, just validate
      if (options.dryRun) {
        return {
          success: true,
          previousVersion: current.version,
          newVersion: target.version,
          servicesRolledBack: ["dry-run"],
          errors: errors.length > 0 ? errors : undefined,
          duration: Date.now() - startTime,
        };
      }

      // Perform rollback by updating manifest to previous version
      // In production, this would trigger actual service rollbacks via CI/CD
      await this.recordDeployment({
        ...target,
        timestamp: Date.now(),
        featureFlags: {
          ...target.featureFlags,
          rollback_in_progress: true,
        },
      });

      const servicesRolledBack: string[] = [];

      if (!options.service || options.service === "all") {
        servicesRolledBack.push("api", "web", "crawler", "reportWorker");
      } else {
        servicesRolledBack.push(options.service);
      }

      return {
        success: errors.length === 0,
        previousVersion: current.version,
        newVersion: target.version,
        servicesRolledBack,
        errors: errors.length > 0 ? errors : undefined,
        duration: Date.now() - startTime,
      };
    },

    /**
     * Auto-rollback if health checks fail
     */
    async autoRollbackIfUnhealthy(
      thresholdSeconds: number = 300,
    ): Promise<RollbackResult | null> {
      const status = await this.checkDeploymentHealth();

      if (status.healthy) {
        return null;
      }

      const manifest = await this.getCurrentDeployment();
      if (!manifest) {
        return null;
      }

      // Check if deployment is recent (within threshold)
      const deploymentAge = Date.now() - manifest.timestamp;
      if (deploymentAge > thresholdSeconds * 1000) {
        // Deployment is old, don't auto-rollback
        return null;
      }

      if (!status.canRollback) {
        return null;
      }

      // Perform automatic rollback
      return await this.rollback({
        reason: `Auto-rollback due to health check failure: ${status.services
          .filter((s) => !s.healthy)
          .map((s) => s.name)
          .join(", ")}`,
      });
    },
  };
}

export type DeploymentService = ReturnType<typeof createDeploymentService>;
