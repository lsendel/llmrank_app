/**
 * One-time migration script to normalize all existing project domains.
 *
 * Run locally:   npx tsx scripts/migrate-normalize-domains.ts
 * Run against prod: DATABASE_URL=<prod-url> npx tsx scripts/migrate-normalize-domains.ts
 */
/* eslint-disable no-restricted-imports */
import { createDb } from "@llm-boost/db";
import { projects } from "@llm-boost/db";
import { normalizeDomain } from "@llm-boost/shared";
import { sql } from "drizzle-orm";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  const allProjects = await db
    .select({ id: projects.id, domain: projects.domain })
    .from(projects);

  console.log(`Found ${allProjects.length} projects.`);

  let updated = 0;
  for (const p of allProjects) {
    const normalized = normalizeDomain(p.domain);
    if (normalized !== p.domain) {
      await db
        .update(projects)
        .set({ domain: normalized, updatedAt: new Date() })
        .where(sql`${projects.id} = ${p.id}`);
      console.log(`  ${p.domain} -> ${normalized}`);
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} of ${allProjects.length} projects.`);
}

main().catch(console.error);
