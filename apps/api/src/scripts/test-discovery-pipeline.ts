/**
 * Test script for smart competitor discovery pipeline.
 * Tests each LLM provider, then runs the full pipeline on a real project.
 *
 * Usage: npx tsx infra/scripts/test-discovery-pipeline.ts
 */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function testAnthropic(): Promise<boolean> {
  if (!ANTHROPIC_API_KEY) {
    console.log("  SKIP: ANTHROPIC_API_KEY not set");
    return false;
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 64,
    messages: [{ role: "user", content: "Reply with just the word OK" }],
  });
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  console.log(`  Anthropic Haiku: "${text.trim()}"`);
  return true;
}

async function testPerplexity(): Promise<boolean> {
  if (!PERPLEXITY_API_KEY) {
    console.log("  SKIP: PERPLEXITY_API_KEY not set");
    return false;
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: PERPLEXITY_API_KEY,
    baseURL: "https://api.perplexity.ai",
  });
  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [
      {
        role: "user",
        content:
          "What are the top 3 competitors to semrush.com? Return only domain names, one per line.",
      },
    ],
    max_tokens: 256,
  });
  const text = response.choices[0]?.message?.content ?? "";
  console.log(`  Perplexity Sonar:\n${text.trim().split("\n").map((l: string) => `    ${l}`).join("\n")}`);
  return true;
}

async function testGrok(): Promise<boolean> {
  if (!XAI_API_KEY) {
    console.log("  SKIP: XAI_API_KEY not set");
    return false;
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
  const response = await client.chat.completions.create({
    model: "grok-3-fast",
    messages: [
      {
        role: "user",
        content:
          "What are the top 3 competitors to semrush.com? Return only domain names, one per line.",
      },
    ],
    max_tokens: 256,
  });
  const text = response.choices[0]?.message?.content ?? "";
  console.log(`  Grok 3 Fast:\n${text.trim().split("\n").map((l: string) => `    ${l}`).join("\n")}`);
  return true;
}

async function testSiteDescription(): Promise<void> {
  if (!DATABASE_URL || !ANTHROPIC_API_KEY) {
    console.log("  SKIP: DATABASE_URL or ANTHROPIC_API_KEY not set");
    return;
  }

  // Pick a project with a completed crawl
  const { createDb, projectQueries, crawlQueries, pageQueries } = await import(
    "@llm-boost/db"
  );
  const db = createDb(DATABASE_URL);

  // Find the first project with a completed crawl and no site description
  const result = await db.execute(
    `SELECT p.id, p.domain, p.name, cj.id as crawl_id
     FROM projects p
     JOIN crawl_jobs cj ON cj.project_id = p.id AND cj.status = 'complete'
     WHERE p.site_description IS NULL
     ORDER BY cj.created_at DESC
     LIMIT 1`,
  );

  const row = (result as any).rows?.[0] ?? (result as any)[0];
  if (!row) {
    console.log("  SKIP: No projects with completed crawls and no site description");
    return;
  }

  console.log(`  Testing on: ${row.domain} (project: ${row.id})`);

  const { runAutoSiteDescription } = await import(
    "@llm-boost/pipeline"
  );

  await runAutoSiteDescription({
    databaseUrl: DATABASE_URL,
    projectId: row.id,
    crawlJobId: row.crawl_id,
    anthropicApiKey: ANTHROPIC_API_KEY,
  });

  // Check the result
  const project = await projectQueries(db).getById(row.id);
  console.log(`  Result: description="${project?.siteDescription}", industry="${project?.industry}"`);
}

async function testCompetitorDiscovery(): Promise<void> {
  if (!DATABASE_URL || !ANTHROPIC_API_KEY) {
    console.log("  SKIP: DATABASE_URL or ANTHROPIC_API_KEY not set");
    return;
  }

  const { createDb, competitorQueries } = await import(
    "@llm-boost/db"
  );
  const db = createDb(DATABASE_URL);

  // Find a project with a completed crawl and 0 competitors
  const result = await db.execute(
    `SELECT p.id, p.domain, p.name, p.site_description, p.industry
     FROM projects p
     JOIN crawl_jobs cj ON cj.project_id = p.id AND cj.status = 'complete'
     WHERE (SELECT count(*) FROM competitors WHERE project_id = p.id) = 0
     ORDER BY cj.created_at DESC
     LIMIT 1`,
  );

  const row = (result as any).rows?.[0] ?? (result as any)[0];
  if (!row) {
    console.log("  SKIP: No projects with completed crawls and 0 competitors");
    return;
  }

  console.log(`  Testing on: ${row.domain} (description: "${row.site_description}", industry: "${row.industry}")`);

  const { runAutoCompetitorDiscovery } = await import(
    "@llm-boost/pipeline"
  );

  await runAutoCompetitorDiscovery({
    databaseUrl: DATABASE_URL,
    projectId: row.id,
    anthropicApiKey: ANTHROPIC_API_KEY,
    perplexityApiKey: PERPLEXITY_API_KEY,
    grokApiKey: XAI_API_KEY,
  });

  // Check results
  const competitors = await competitorQueries(db).listByProject(row.id);
  console.log(`  Discovered ${competitors.length} competitors:`);
  for (const c of competitors) {
    console.log(`    - ${c.domain} (source: ${c.source})`);
  }
}

async function main() {
  console.log("\n=== Step 1: Test API Keys ===\n");

  let anthropicOk = false;
  let perplexityOk = false;
  let grokOk = false;

  try {
    anthropicOk = await testAnthropic();
  } catch (e: any) {
    console.log(`  FAIL Anthropic: ${e.message}`);
  }

  try {
    perplexityOk = await testPerplexity();
  } catch (e: any) {
    console.log(`  FAIL Perplexity: ${e.message}`);
  }

  try {
    grokOk = await testGrok();
  } catch (e: any) {
    console.log(`  FAIL Grok: ${e.message}`);
  }

  console.log(`\n  Summary: Anthropic=${anthropicOk ? "OK" : "FAIL"} Perplexity=${perplexityOk ? "OK" : "FAIL"} Grok=${grokOk ? "OK" : "FAIL"}`);

  if (!anthropicOk) {
    console.log("\n  Anthropic is required for the pipeline. Fix the key and retry.");
    process.exit(1);
  }

  console.log("\n=== Step 2: Test Auto Site Description ===\n");

  try {
    await testSiteDescription();
  } catch (e: any) {
    console.log(`  FAIL: ${e.message}`);
  }

  console.log("\n=== Step 3: Test Auto Competitor Discovery ===\n");

  try {
    await testCompetitorDiscovery();
  } catch (e: any) {
    console.log(`  FAIL: ${e.message}`);
  }

  console.log("\n=== Done ===\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
