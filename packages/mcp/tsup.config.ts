import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Bundle workspace dependency so npm users don't need it
  noExternal: ["@llm-boost/shared"],
  // Keep SDK + zod as peer deps
  external: ["@modelcontextprotocol/sdk", "zod"],
});
