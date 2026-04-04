import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, uuidText } from "./d1-helpers";
import { users } from "./d1-app";

// ─── Admin Tables ─────────────────────────────────────────────────────────────

export const blockedDomains = sqliteTable("blocked_domains", {
  id: uuidText("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  blockedBy: text("blocked_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const adminSettings = sqliteTable("admin_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default("{}"), // jsonb → text
  updatedBy: text("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const promptTemplates = sqliteTable("prompt_templates", {
  id: uuidText("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  userPromptTemplate: text("user_prompt_template").notNull(),
  variables: text("variables"), // jsonb → text
  model: text("model").notNull(),
  modelConfig: text("model_config"), // jsonb → text
  version: integer("version").notNull().default(1),
  contentHash: text("content_hash").notNull(),
  status: text("status").notNull().default("draft"), // enum → text
  parentId: uuidText("parent_id"),
  createdBy: text("created_by"),
  activatedAt: text("activated_at"),
  createdAt: createdAt(),
});

export const promptMetrics = sqliteTable("prompt_metrics", {
  id: uuidText("id").primaryKey(),
  promptId: uuidText("prompt_id")
    .notNull()
    .references(() => promptTemplates.id),
  invocations: integer("invocations").default(0),
  avgLatencyMs: integer("avg_latency_ms"),
  avgTokensIn: integer("avg_tokens_in"),
  avgTokensOut: integer("avg_tokens_out"),
  avgCostCents: integer("avg_cost_cents"),
  errorRate: integer("error_rate_bps"),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  createdAt: createdAt(),
});

// ─── Audit Logs (from identity.ts) ────────────────────────────────────────────

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: uuidText("id").primaryKey(),
    orgId: uuidText("org_id"), // references organizations in D1, kept as plain text
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: text("metadata").default("{}"), // jsonb → text
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_audit_logs_org_created").on(t.orgId, t.createdAt),
    index("idx_audit_logs_actor").on(t.actorId),
    index("idx_audit_logs_resource").on(t.resourceType, t.resourceId),
  ],
);

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: uuidText("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_admin_audit_target").on(t.targetType, t.targetId)],
);

// ─── Leads (from features.ts) ─────────────────────────────────────────────────

export const leads = sqliteTable("leads", {
  id: uuidText("id").primaryKey(),
  email: text("email").notNull(),
  reportToken: text("report_token"),
  source: text("source").notNull().default("shared_report"),
  scanResultId: uuidText("scan_result_id"),
  convertedAt: text("converted_at"),
  projectId: uuidText("project_id"),
  createdAt: createdAt(),
});
