import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolContext } from "./types";
import { registerProjectTools } from "./projects";
import { registerCrawlTools } from "./crawls";
import { registerPageTools } from "./pages";
import { registerScoreTools } from "./scores";

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerProjectTools(server, ctx);
  registerCrawlTools(server, ctx);
  registerPageTools(server, ctx);
  registerScoreTools(server, ctx);
}
