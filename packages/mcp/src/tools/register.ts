import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolContext } from "./types";
import { registerProjectTools } from "./projects";
import { registerCrawlTools } from "./crawls";
import { registerPageTools } from "./pages";
import { registerScoreTools } from "./scores";
import { registerIssueTools } from "./issues";
import { registerVisibilityTools } from "./visibility";
import { registerFixTools } from "./fixes";
import { registerStrategyTools } from "./strategy";
import { registerCompetitorTools } from "./competitors";
import { registerReportTools } from "./reports";
import { registerContentTools } from "./content";
import { registerTechnicalTools } from "./technical";
import { registerKeywordTools } from "./keywords";
import { registerQueryTools } from "./queries";

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerProjectTools(server, ctx);
  registerCrawlTools(server, ctx);
  registerPageTools(server, ctx);
  registerScoreTools(server, ctx);
  registerIssueTools(server, ctx);
  registerVisibilityTools(server, ctx);
  registerFixTools(server, ctx);
  registerStrategyTools(server, ctx);
  registerCompetitorTools(server, ctx);
  registerReportTools(server, ctx);
  registerContentTools(server, ctx);
  registerTechnicalTools(server, ctx);
  registerKeywordTools(server, ctx);
  registerQueryTools(server, ctx);
}
