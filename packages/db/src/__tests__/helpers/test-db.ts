import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

let _db: PostgresJsDatabase | null = null;

export function getTestDb(): PostgresJsDatabase {
  if (_db) return _db;
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set");
  const client = postgres(url);
  _db = drizzle(client);
  return _db;
}

/**
 * Get a raw postgres client for direct SQL execution.
 */
function getRawSql() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set");
  return postgres(url);
}

/**
 * Truncate all tables in dependency order (CASCADE handles FKs).
 * Run in beforeAll/beforeEach to reset state between test files.
 */
export async function truncateAll(): Promise<void> {
  const sql = getRawSql();
  await sql`TRUNCATE
    admin_audit_logs,
    outbox_events,
    page_enrichments,
    project_integrations,
    competitors,
    log_uploads,
    custom_extractors,
    plan_price_history,
    payments,
    subscriptions,
    visibility_checks,
    issues,
    page_scores,
    pages,
    crawl_jobs,
    projects,
    users
  CASCADE`;
}

/**
 * Seed a minimal user + project for tests that need FK references.
 * Returns typed objects with id fields.
 */
export async function seedBaseEntities() {
  const sql = getRawSql();
  const [user] = await sql`
    INSERT INTO users (email, name, plan, crawl_credits_remaining)
    VALUES ('test@example.com', 'Test User', 'pro', 30)
    RETURNING id, email, name, plan, crawl_credits_remaining
  `;
  const [project] = await sql`
    INSERT INTO projects (user_id, name, domain)
    VALUES (${user.id}, 'Test Site', 'https://example.com')
    RETURNING id, user_id, name, domain
  `;
  return { user, project };
}
