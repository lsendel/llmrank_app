import { drizzle } from "drizzle-orm/d1";
import * as appSchema from "./schema/d1-app";
import * as adminSchema from "./schema/d1-admin";

// D1Database type from Cloudflare Workers runtime — declared here to avoid
// requiring @cloudflare/workers-types as a devDependency in the db package.
type D1Database = Parameters<typeof drizzle>[0];

export function createAppDb(d1: D1Database) {
  return drizzle(d1, { schema: appSchema });
}

export function createAdminDb(d1: D1Database) {
  return drizzle(d1, { schema: adminSchema });
}

export type AppDatabase = ReturnType<typeof createAppDb>;
export type AdminDatabase = ReturnType<typeof createAdminDb>;
