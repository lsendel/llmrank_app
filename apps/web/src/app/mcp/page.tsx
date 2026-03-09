import type { Metadata } from "next";
import {
  JsonLd,
  breadcrumbSchema,
  faqSchema,
  webPageSchema,
} from "@/components/seo/json-ld";
import { McpPageLayout } from "./_components/mcp-page-sections";
import {
  MCP_BREADCRUMBS,
  MCP_FAQ_ITEMS,
  MCP_PAGE_METADATA,
  MCP_WEBPAGE_SCHEMA,
  getMcpServerSchema,
  getTotalMcpTools,
} from "./mcp-page-helpers";

export const metadata: Metadata = MCP_PAGE_METADATA;

export default function McpPage() {
  return (
    <>
      <JsonLd data={webPageSchema(MCP_WEBPAGE_SCHEMA)} />
      <JsonLd data={breadcrumbSchema(MCP_BREADCRUMBS)} />
      <JsonLd data={getMcpServerSchema()} />
      <JsonLd data={faqSchema(MCP_FAQ_ITEMS)} />
      <McpPageLayout totalTools={getTotalMcpTools()} />
    </>
  );
}
