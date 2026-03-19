import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../lib/error-handler";
import { PaginationSchema } from "@llm-boost/shared";

export const queueRoutes = new Hono<AppEnv>();

queueRoutes.use("*", authMiddleware);

// GET / - List queued/active jobs
queueRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const query = PaginationSchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });

  if (!query.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid pagination parameters",
          details: query.error.flatten(),
        },
      },
      422,
    );
  }

  const { crawlService } = c.get("container");

  try {
    // We'll need to add listActive method to crawlService
    const result = await crawlService.listActiveForUser(userId, query.data);
    return c.json(result);
  } catch (error) {
    return handleServiceError(c, error);
  }
});
