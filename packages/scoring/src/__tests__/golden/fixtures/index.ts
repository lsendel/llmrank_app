import type { GoldenFixture } from "./_builder";
import { cleanFixtures } from "./clean";
import { contentQualityFixtures } from "./content-quality";
import { readabilityFixtures } from "./readability";
import { llmGatingFixtures } from "./llm-gating";
import { technicalSeoFixtures } from "./technical-seo";
import { performanceAndErrorFixtures } from "./performance-and-errors";

export type { GoldenFixture, FixtureTag } from "./_builder";

/**
 * The full golden set: representative healthy pages + edge cases spanning every
 * scoring category. Ordered deterministically (by source group, then declared
 * order) so the committed snapshot diff stays stable.
 */
export const GOLDEN_FIXTURES: GoldenFixture[] = [
  ...cleanFixtures,
  ...contentQualityFixtures,
  ...readabilityFixtures,
  ...llmGatingFixtures,
  ...technicalSeoFixtures,
  ...performanceAndErrorFixtures,
];

// Fail loudly at import time if two fixtures share an id — snapshot keys must be
// unique or one would silently overwrite the other.
const seen = new Set<string>();
for (const f of GOLDEN_FIXTURES) {
  if (seen.has(f.id)) {
    throw new Error(`Duplicate golden fixture id: ${f.id}`);
  }
  seen.add(f.id);
}
