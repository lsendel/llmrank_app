import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../index";
import { ServiceError } from "@llm-boost/shared";

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

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  c.status(500);
  return c.json({
    error: {
      code: "INTERNAL_ERROR",
      message,
    },
  });
}
