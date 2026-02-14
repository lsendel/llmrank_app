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

export function createLogger(
  context: LogContext = {},
  minLevel: LogLevel = "info",
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
      ...context,
      ...data,
    };

    // Workers runtime: console output is captured by `wrangler tail --format json`
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    fn(JSON.stringify(entry));
  }

  return {
    debug: (msg, data) => log("debug", msg, data),
    info: (msg, data) => log("info", msg, data),
    warn: (msg, data) => log("warn", msg, data),
    error: (msg, data) => log("error", msg, data),
    child(extra: LogContext) {
      return createLogger({ ...context, ...extra }, minLevel);
    },
  };
}
