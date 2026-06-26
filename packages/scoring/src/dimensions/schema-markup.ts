import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import {
  normalizeSchemaNodes,
  schemaTypesFromNodes,
  isEntityType,
} from "../schema-utils";

// Required properties for common schema types
const SCHEMA_REQUIRED_PROPS: Record<string, string[]> = {
  Article: ["headline", "author", "datePublished"],
  WebPage: ["name", "description"],
  Organization: ["name", "url"],
  Product: ["name", "description"],
  FAQPage: ["mainEntity"],
  LocalBusiness: ["name", "address"],
};

export function scoreSchemaMarkup(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // NO_STRUCTURED_DATA: -15 if no structured_data. Normalize first so @graph
  // wrappers and bare arrays expand into their actual typed nodes.
  const structuredData = page.extracted.structured_data ?? [];
  const schemaNodes = normalizeSchemaNodes(structuredData);
  const schemaTypes = Array.from(
    new Set([
      ...page.extracted.schema_types,
      ...schemaTypesFromNodes(schemaNodes),
    ]),
  );
  if (schemaNodes.length === 0) {
    deduct(s, "NO_STRUCTURED_DATA");
  }

  // INCOMPLETE_SCHEMA: -8 if schema exists but missing required props
  if (schemaNodes.length > 0) {
    for (const schemaObj of schemaNodes) {
      const schemaType = schemaObj["@type"] as string | undefined;
      if (schemaType && SCHEMA_REQUIRED_PROPS[schemaType]) {
        const requiredProps = SCHEMA_REQUIRED_PROPS[schemaType];
        const missingProps = requiredProps.filter(
          (prop) => !(prop in schemaObj),
        );
        if (missingProps.length > 0) {
          deduct(s, "INCOMPLETE_SCHEMA", {
            schemaType,
            missingProps,
          });
          break; // Only deduct once
        }
      }
    }
  }

  // INVALID_SCHEMA: -8 if any (normalized) node is missing its @type
  if (schemaNodes.length > 0) {
    const hasInvalidSchema = schemaNodes.some((node) => !node["@type"]);
    if (hasInvalidSchema) {
      deduct(s, "INVALID_SCHEMA");
    }
  }

  // MISSING_ENTITY_MARKUP: -5 if key entities not in schema. Recognizes
  // common entity subtypes (LocalBusiness, etc.), not just the bare bases.
  const hasEntityMarkup = schemaTypes.some(isEntityType);
  if (schemaNodes.length > 0 && !hasEntityMarkup) {
    deduct(s, "MISSING_ENTITY_MARKUP");
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
