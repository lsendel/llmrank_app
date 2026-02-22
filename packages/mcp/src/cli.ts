#!/usr/bin/env node

import { createMcpServer } from "./server";

const apiBaseUrl = process.env.LLM_BOOST_API_URL ?? "https://api.llmrank.app";
const apiToken = process.env.LLM_BOOST_API_TOKEN;

if (!apiToken) {
  process.stderr.write(
    "Error: LLM_BOOST_API_TOKEN environment variable is required.\n" +
      "Get your API token at https://llmrank.app/dashboard/settings\n",
  );
  process.exit(1);
}

if (!apiToken.startsWith("llmb_")) {
  process.stderr.write(
    'Error: Invalid token format. Token must start with "llmb_"\n',
  );
  process.exit(1);
}

const server = createMcpServer({ apiBaseUrl, apiToken });

server.start().catch((err) => {
  process.stderr.write(`Failed to start MCP server: ${err.message}\n`);
  process.exit(1);
});
