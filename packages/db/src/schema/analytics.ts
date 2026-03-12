import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sourceTypeEnum } from "./enums";
import { projects } from "./projects";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    event: text("event").notNull(),
    domain: text("domain").notNull(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    sourceType: sourceTypeEnum("source_type").notNull().default("other"),
    aiProvider: text("ai_provider"),
    country: text("country"),
    botScore: integer("bot_score"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_analytics_events_project_created").on(t.projectId, t.createdAt),
    index("idx_analytics_events_source_created").on(t.sourceType, t.createdAt),
    index("idx_analytics_events_ai_provider_created").on(t.aiProvider, t.createdAt),
  ],
);

export const analyticsDailyRollups = pgTable(
  "analytics_daily_rollups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    date: date("date").notNull(),
    event: text("event").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    aiProvider: text("ai_provider").notNull().default("none"),
    country: text("country").notNull().default("unknown"),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("idx_analytics_rollups_unique").on(
      t.projectId,
      t.date,
      t.event,
      t.sourceType,
      t.aiProvider,
      t.country,
    ),
    index("idx_analytics_rollups_project_date").on(t.projectId, t.date),
  ],
);
