import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

export const blockedDomains = pgTable("blocked_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  blockedBy: text("blocked_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedBy: text("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const promptStatusEnum = pgEnum("prompt_status", [
  "draft",
  "active",
  "archived",
]);

export const promptTemplates = pgTable("prompt_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  userPromptTemplate: text("user_prompt_template").notNull(),
  variables: jsonb("variables").$type<string[]>(),
  model: text("model").notNull(),
  modelConfig: jsonb("model_config").$type<{
    maxTokens?: number;
    temperature?: number;
  }>(),
  version: integer("version").notNull().default(1),
  contentHash: text("content_hash").notNull(),
  status: promptStatusEnum("status").notNull().default("draft"),
  parentId: uuid("parent_id"),
  createdBy: text("created_by"),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promptMetrics = pgTable("prompt_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  promptId: uuid("prompt_id")
    .references(() => promptTemplates.id)
    .notNull(),
  invocations: integer("invocations").default(0),
  avgLatencyMs: integer("avg_latency_ms"),
  avgTokensIn: integer("avg_tokens_in"),
  avgTokensOut: integer("avg_tokens_out"),
  avgCostCents: integer("avg_cost_cents"),
  errorRate: integer("error_rate_bps"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
