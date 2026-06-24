import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as agencySchema from "./schema/supabase-agency";

export function createAgencyDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema: agencySchema });
}

export type AgencyDatabase = ReturnType<typeof createAgencyDb>;
