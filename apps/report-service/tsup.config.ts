import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  noExternal: [
    "@llm-boost/db",
    "@llm-boost/reports",
    "@llm-boost/shared",
    "@llm-boost/llm",
    "@llm-boost/narrative",
    "@llm-boost/pipeline",
    "@llm-boost/parsers",
    "@llm-boost/repositories",
    "@llm-boost/scoring",
  ],
});
