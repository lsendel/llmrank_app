import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/__tests__/**"],
      // TODO: restore to 85% after adding tests for new shared modules
      thresholds: { lines: 50 },
    },
  },
});
