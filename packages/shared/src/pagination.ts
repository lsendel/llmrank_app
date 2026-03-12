import { z } from "zod";

/**
 * Cursor-based pagination parameters
 */
export const PaginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(200)
    .default(50)
    .describe("Number of items per page (max 200)"),
  cursor: z
    .string()
    .optional()
    .describe("Cursor for pagination (opaque string)"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Helper to create a paginated response
 */
export function createPaginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number,
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

  return {
    data,
    pagination: {
      limit,
      nextCursor,
      hasMore,
    },
  };
}

/**
 * Offset-based pagination parameters (legacy, for backwards compatibility)
 */
export const OffsetPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).describe("Page number"),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(200)
    .default(50)
    .describe("Items per page"),
});

export type OffsetPaginationQuery = z.infer<typeof OffsetPaginationQuerySchema>;

/**
 * Offset-based paginated response
 */
export interface OffsetPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
