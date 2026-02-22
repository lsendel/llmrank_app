export { createMcpServer } from "./server";
export type { McpServerConfig } from "./server";

// Re-export for gateway / HTTP transport consumers
export { registerAllTools } from "./tools/register";
export { registerAllResources } from "./resources/register";
export { registerAllPrompts } from "./prompts/register";
export { createApiClient } from "./client/api-client";
export type { ApiClient } from "./client/api-client";
export type { ToolContext } from "./tools/types";
