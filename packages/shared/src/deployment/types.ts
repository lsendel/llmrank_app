/**
 * Deployment tracking and rollback types
 */

export interface DeploymentManifest {
  version: string;
  timestamp: number;
  gitCommit: string;
  gitBranch: string;
  services: {
    api?: ServiceVersion;
    web?: ServiceVersion;
    crawler?: ServiceVersion;
    reportWorker?: ServiceVersion;
    mcpGateway?: ServiceVersion;
  };
  migrations: {
    applied: string[];
    rollbackAvailable: boolean;
  };
  featureFlags?: Record<string, boolean>;
  environment: "production" | "staging" | "development";
}

export interface ServiceVersion {
  version: string;
  deployedAt: number;
  healthCheckUrl?: string;
  rollbackVersion?: string;
}

export interface DeploymentStatus {
  version: string;
  healthy: boolean;
  services: {
    name: string;
    healthy: boolean;
    message?: string;
  }[];
  canRollback: boolean;
  rollbackTarget?: string;
}

export interface RollbackOptions {
  service?: "api" | "web" | "crawler" | "all";
  skipHealthCheck?: boolean;
  dryRun?: boolean;
  reason?: string;
}

export interface RollbackResult {
  success: boolean;
  previousVersion: string;
  newVersion: string;
  servicesRolledBack: string[];
  errors?: string[];
  duration: number;
}

export const DEPLOYMENT_MANIFEST_KEY = "deployment:manifest:current";
export const DEPLOYMENT_HISTORY_KEY = "deployment:history";
export const MAX_DEPLOYMENT_HISTORY = 50;
