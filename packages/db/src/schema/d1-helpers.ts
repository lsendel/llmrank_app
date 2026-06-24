import { sql } from "drizzle-orm";
import { customType, text } from "drizzle-orm/sqlite-core";

// D1 rejects Date objects — serialize to ISO string (pattern from families.care)
export const dateText = customType<{ data: string | Date; driverData: string }>(
  {
    dataType() {
      return "text";
    },
    toDriver(value): string {
      if (value instanceof Date) return value.toISOString();
      return String(value ?? "");
    },
  },
);

export function textId(name = "id") {
  return text(name).primaryKey();
}

export function uuidText(name: string) {
  return text(name);
}

export function createdAt(name = "created_at") {
  return text(name)
    .notNull()
    .default(sql`(datetime('now'))`);
}

export function updatedAt(name = "updated_at") {
  return text(name)
    .notNull()
    .default(sql`(datetime('now'))`);
}
