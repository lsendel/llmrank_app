import { Axiom } from "@axiomhq/js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  userId?: string;
  projectId?: string;
  crawlId?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  child(context: LogContext): Logger;
}

interface ObservabilityConfig {
  axiomToken?: string;
  axiomDataset?: string;
  environment?: string;
}

let axiomClient: Axiom | null = null;

/**
 * Initialize observability stack with Axiom integration
 */
export function initObservability(config: ObservabilityConfig) {
  if (config.axiomToken && config.axiomDataset) {
    axiomClient = new Axiom({
      token: config.axiomToken,
      orgId: config.axiomDataset, // Axiom uses orgId for dataset
    });
  }
}

/**
 * Create a logger with optional Axiom integration
 */
export function createLogger(
  context: LogContext = {},
  minLevel: LogLevel = "info",
  environment = "production",
): Logger {
  function log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ) {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

    const entry = {
      level,
      msg: message,
      ts: new Date().toISOString(),
      environment,
      ...context,
      ...data,
    };

    // Always log to console (captured by wrangler tail --format json)
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    fn(JSON.stringify(entry));

    // Also send to Axiom if configured (fire and forget)
    if (axiomClient) {
      axiomClient
        .ingest("logs", [entry])
        .catch((err: unknown) => console.error("Axiom ingest failed:", err));
    }
  }

  return {
    debug: (msg, data) => log("debug", msg, data),
    info: (msg, data) => log("info", msg, data),
    warn: (msg, data) => log("warn", msg, data),
    error: (msg, data) => log("error", msg, data),
    child(extra: LogContext) {
      return createLogger({ ...context, ...extra }, minLevel, environment);
    },
  };
}

/**
 * Track metrics (request duration, errors, etc.)
 */
export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export function trackMetric(metric: MetricData) {
  const entry = {
    _time: (metric.timestamp || new Date()).toISOString(),
    metric: metric.name,
    value: metric.value,
    ...metric.tags,
  };

  // Send to Axiom if configured
  if (axiomClient) {
    axiomClient
      .ingest("metrics", [entry])
      .catch((err: unknown) => console.error("Axiom metric failed:", err));
  }
}

/**
 * Flush any pending logs/metrics (call before worker termination)
 */
export async function flushObservability() {
  if (axiomClient) {
    await axiomClient.flush();
  }
}
