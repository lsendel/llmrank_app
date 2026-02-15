import { beforeAll } from "vitest";
import { truncateAll } from "./test-db";

beforeAll(async () => {
  // Skip truncation when no database URL is available (unit-test / mock-only mode)
  if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) return;
  await truncateAll();
});
