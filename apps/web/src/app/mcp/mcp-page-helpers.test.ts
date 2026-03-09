import { describe, expect, it } from "vitest";
import {
  MCP_IDE_CONFIGS,
  getIdeConfigContent,
  getMcpServerSchema,
  getTotalMcpTools,
} from "./mcp-page-helpers";

describe("mcp page helpers", () => {
  it("computes the total MCP tool count", () => {
    expect(getTotalMcpTools()).toBe(27);
  });

  it("formats IDE config content by transport type", () => {
    expect(getIdeConfigContent(MCP_IDE_CONFIGS[0])).toContain(
      "claude mcp add llm-boost",
    );
    expect(getIdeConfigContent(MCP_IDE_CONFIGS[1])).toContain(
      '"LLM_BOOST_API_TOKEN": "llmb_xxx"',
    );
    expect(
      getIdeConfigContent(MCP_IDE_CONFIGS[MCP_IDE_CONFIGS.length - 1]),
    ).toContain("Endpoint: https://mcp.llmrank.app/v1/mcp");
  });

  it("builds the MCP software application schema", () => {
    const schema = getMcpServerSchema();

    expect(schema["@type"]).toBe("SoftwareApplication");
    expect(schema.downloadUrl).toContain("@llmrank.app/mcp");
    expect(schema.featureList).toContain("27 MCP tools for SEO analysis");
  });
});
