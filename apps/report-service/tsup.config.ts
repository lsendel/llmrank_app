import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  noExternal: ["@llm-boost/db", "@llm-boost/reports", "@llm-boost/shared"],
});
