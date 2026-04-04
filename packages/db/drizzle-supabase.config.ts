import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/supabase-agency.ts",
  out: "./migrations/supabase",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DATABASE_URL!,
  },
});
