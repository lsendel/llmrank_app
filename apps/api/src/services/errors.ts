import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../index";

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function handleServiceError(c: Context<AppEnv>, error: unknown) {
  if (error instanceof ServiceError) {
    c.status(error.status as StatusCode);
    return c.json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }
  throw error;
}
