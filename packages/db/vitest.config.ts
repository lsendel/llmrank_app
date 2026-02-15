import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/helpers/setup.ts"],
    testTimeout: 15000,
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/queries/**"],
      thresholds: { lines: 85 },
    },
  },
});
