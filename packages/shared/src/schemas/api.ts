import { z } from "zod";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;

// Error codes from requirements Section 11.6
export const ERROR_CODES = {
  UNAUTHORIZED: { status: 401, message: "Missing or invalid auth token" },
  FORBIDDEN: { status: 403, message: "Insufficient permissions" },
  NOT_FOUND: { status: 404, message: "Resource does not exist" },
  PLAN_LIMIT_REACHED: { status: 403, message: "Feature requires higher plan" },
  CRAWL_LIMIT_REACHED: { status: 429, message: "Monthly crawl credits exhausted" },
  CRAWL_IN_PROGRESS: { status: 409, message: "Another crawl is already running" },
  INVALID_DOMAIN: { status: 422, message: "Domain URL is unreachable or invalid" },
  HMAC_INVALID: { status: 401, message: "HMAC signature verification failed" },
  RATE_LIMITED: { status: 429, message: "Too many requests" },
} as const;
