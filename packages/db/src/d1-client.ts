import { drizzle } from "drizzle-orm/d1";
import * as appSchema from "./schema/d1-app";
import * as adminSchema from "./schema/d1-admin";

export function createAppDb(d1: D1Database) {
  return drizzle(d1, { schema: appSchema });
}

export function createAdminDb(d1: D1Database) {
  return drizzle(d1, { schema: adminSchema });
}

export type AppDatabase = ReturnType<typeof createAppDb>;
export type AdminDatabase = ReturnType<typeof createAdminDb>;
