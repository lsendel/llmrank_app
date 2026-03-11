import { describe, it, expect, beforeEach } from "vitest";
import { createDeploymentService } from "../../services/deployment-service";
import type { DeploymentManifest } from "@llm-boost/shared";

class MockKV {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  clear() {
    this.store.clear();
  }
}

describe("DeploymentService", () => {
  let kv: MockKV;
  let service: ReturnType<typeof createDeploymentService>;

  beforeEach(() => {
    kv = new MockKV();
    service = createDeploymentService({ kv });
  });

  describe("recordDeployment", () => {
    it("should record deployment manifest", async () => {
      const manifest: DeploymentManifest = {
        version: "v1.0.0",
        timestamp: Date.now(),
        gitCommit: "abc123",
        gitBranch: "main",
        services: {
          api: { version: "v1.0.0", deployedAt: Date.now() },
        },
        migrations: {
          applied: ["001_initial.sql"],
          rollbackAvailable: false,
        },
        environment: "production",
      };

      await service.recordDeployment(manifest);

      const current = await service.getCurrentDeployment();
      expect(current).toEqual(manifest);
    });

    it("should maintain deployment history", async () => {
      const manifest1: DeploymentManifest = {
        version: "v1.0.0",
        timestamp: Date.now(),
        gitCommit: "abc123",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: false },
        environment: "production",
      };

      const manifest2: DeploymentManifest = {
        version: "v1.1.0",
        timestamp: Date.now(),
        gitCommit: "def456",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: false },
        environment: "production",
      };

      await service.recordDeployment(manifest1);
      await service.recordDeployment(manifest2);

      const history = await service.getDeploymentHistory();
      expect(history).toHaveLength(2);
      expect(history[0].version).toBe("v1.1.0");
      expect(history[1].version).toBe("v1.0.0");
    });

    it("should limit history to 50 deployments", async () => {
      // Record 60 deployments
      for (let i = 0; i < 60; i++) {
        await service.recordDeployment({
          version: `v1.${i}.0`,
          timestamp: Date.now(),
          gitCommit: `commit${i}`,
          gitBranch: "main",
          services: {},
          migrations: { applied: [], rollbackAvailable: false },
          environment: "production",
        });
      }

      const history = await service.getDeploymentHistory(100);
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe("getCurrentDeployment", () => {
    it("should return null when no deployment recorded", async () => {
      const current = await service.getCurrentDeployment();
      expect(current).toBeNull();
    });

    it("should return current deployment", async () => {
      const manifest: DeploymentManifest = {
        version: "v1.0.0",
        timestamp: Date.now(),
        gitCommit: "abc123",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: false },
        environment: "production",
      };

      await service.recordDeployment(manifest);

      const current = await service.getCurrentDeployment();
      expect(current?.version).toBe("v1.0.0");
    });
  });

  describe("getDeploymentHistory", () => {
    it("should return empty array when no history", async () => {
      const history = await service.getDeploymentHistory();
      expect(history).toEqual([]);
    });

    it("should limit history results", async () => {
      for (let i = 0; i < 20; i++) {
        await service.recordDeployment({
          version: `v1.${i}.0`,
          timestamp: Date.now(),
          gitCommit: `commit${i}`,
          gitBranch: "main",
          services: {},
          migrations: { applied: [], rollbackAvailable: false },
          environment: "production",
        });
      }

      const history = await service.getDeploymentHistory(5);
      expect(history).toHaveLength(5);
    });
  });

  describe("rollback", () => {
    it("should fail when no previous deployment", async () => {
      const result = await service.rollback();

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "No previous deployment available for rollback",
      );
    });

    it("should succeed in dry-run mode", async () => {
      await service.recordDeployment({
        version: "v1.0.0",
        timestamp: Date.now(),
        gitCommit: "abc123",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: true },
        environment: "production",
      });

      await service.recordDeployment({
        version: "v1.1.0",
        timestamp: Date.now(),
        gitCommit: "def456",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: true },
        environment: "production",
      });

      const result = await service.rollback({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.previousVersion).toBe("v1.1.0");
      expect(result.newVersion).toBe("v1.0.0");
      expect(result.servicesRolledBack).toEqual(["dry-run"]);
    });

    it("should warn about migration rollback unavailability", async () => {
      await service.recordDeployment({
        version: "v1.0.0",
        timestamp: Date.now(),
        gitCommit: "abc123",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: false },
        environment: "production",
      });

      await service.recordDeployment({
        version: "v1.1.0",
        timestamp: Date.now(),
        gitCommit: "def456",
        gitBranch: "main",
        services: {},
        migrations: { applied: ["002_new.sql"], rollbackAvailable: false },
        environment: "production",
      });

      const result = await service.rollback({ dryRun: true });

      expect(result.errors).toContain(
        "Database migrations cannot be automatically rolled back. Manual intervention required.",
      );
    });
  });

  describe("checkDeploymentHealth", () => {
    it("should return unhealthy when no deployment", async () => {
      const status = await service.checkDeploymentHealth();

      expect(status.healthy).toBe(false);
      expect(status.version).toBe("unknown");
      expect(status.canRollback).toBe(false);
    });

    it("should check service health", async () => {
      await service.recordDeployment({
        version: "v1.0.0",
        timestamp: Date.now(),
        gitCommit: "abc123",
        gitBranch: "main",
        services: {
          api: {
            version: "v1.0.0",
            deployedAt: Date.now(),
            healthCheckUrl: "https://api.example.com/health",
          },
        },
        migrations: { applied: [], rollbackAvailable: false },
        environment: "production",
      });

      const status = await service.checkDeploymentHealth();

      expect(status.version).toBe("v1.0.0");
      expect(status.services).toBeDefined();
    });
  });

  describe("autoRollbackIfUnhealthy", () => {
    it("should return null when deployment is healthy", async () => {
      await service.recordDeployment({
        version: "v1.0.0",
        timestamp: Date.now(),
        gitCommit: "abc123",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: false },
        environment: "production",
      });

      const result = await service.autoRollbackIfUnhealthy();
      expect(result).toBeNull();
    });

    it("should return null when deployment is old", async () => {
      await service.recordDeployment({
        version: "v1.0.0",
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        gitCommit: "abc123",
        gitBranch: "main",
        services: {},
        migrations: { applied: [], rollbackAvailable: false },
        environment: "production",
      });

      const result = await service.autoRollbackIfUnhealthy();
      expect(result).toBeNull();
    });
  });
});
