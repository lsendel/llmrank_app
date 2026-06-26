/**
 * JSON-LD structured-data helpers shared by the v1 (factors) and v2
 * (dimensions) scoring engines.
 *
 * Real-world JSON-LD frequently nests typed entities inside a top-level
 * `@graph` array (e.g. `{ "@context": ..., "@graph": [LocalBusiness, ...] }`)
 * or ships a bare array of nodes. The wrapper object itself has no `@type`,
 * so naive `obj["@type"]` checks treated valid schema as invalid and never
 * saw the entity types inside. `normalizeSchemaNodes` flattens those shapes
 * into the actual typed nodes so every downstream check sees real entities.
 */

export type SchemaNode = Record<string, unknown>;

/**
 * Flatten an array of parsed JSON-LD blocks into their individual typed nodes,
 * descending into `@graph` containers and nested arrays. A wrapper that has its
 * own `@type` is kept in addition to its graph children.
 */
export function normalizeSchemaNodes(
  structuredData: readonly unknown[] | undefined,
): SchemaNode[] {
  const nodes: SchemaNode[] = [];

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object") {
      const obj = value as SchemaNode;
      const graph = obj["@graph"];
      if (Array.isArray(graph)) {
        // `@graph` wrapper: descend into its nodes. Keep the wrapper too only
        // if it carries its own @type (rare but valid).
        if (obj["@type"]) nodes.push(obj);
        for (const child of graph) visit(child);
        return;
      }
      nodes.push(obj);
    }
  };

  for (const block of structuredData ?? []) visit(block);
  return nodes;
}

/** Collect all `@type` values (string or array) from normalized nodes. */
export function schemaTypesFromNodes(nodes: readonly SchemaNode[]): string[] {
  const types: string[] = [];
  for (const node of nodes) {
    const t = node["@type"];
    if (typeof t === "string") {
      types.push(t);
    } else if (Array.isArray(t)) {
      for (const x of t) if (typeof x === "string") types.push(x);
    }
  }
  return types;
}

/**
 * Named-entity schema types. Includes the broad schema.org bases plus the
 * common concrete subtypes (LocalBusiness, etc.) that a strict equality check
 * would otherwise miss, and a suffix heuristic for the long tail of
 * Organization/Business/Store/Service subtypes.
 */
const ENTITY_TYPES = new Set<string>([
  "Person",
  "Organization",
  "Product",
  "Place",
  "Event",
  "LocalBusiness",
  "Corporation",
  "NGO",
  "EducationalOrganization",
  "GovernmentOrganization",
  "MedicalOrganization",
  "Restaurant",
  "Store",
  "Service",
  "Brand",
  "Physician",
  "Hospital",
  "NursingHome",
]);

/** True if a schema `@type` represents a named entity worth marking up. */
export function isEntityType(type: string): boolean {
  return (
    ENTITY_TYPES.has(type) ||
    type.endsWith("Business") ||
    type.endsWith("Organization") ||
    type.endsWith("Store") ||
    type.endsWith("Service")
  );
}
