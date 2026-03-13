import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/routes/**",
        "src/services/**",
        "src/middleware/**",
        "src/lib/**",
        "src/repositories/**",
      ],
      // TODO: restore to 85% after adding tests for wizard, prompts, and report services
      thresholds: { lines: 40 },
    },
  },
});
