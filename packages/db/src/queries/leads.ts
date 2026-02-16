import { eq, and, isNull, lte } from "drizzle-orm";
import type { Database } from "../client";
import { leads } from "../schema";

export function leadQueries(db: Database) {
  return {
    async create(data: {
      email: string;
      reportToken?: string;
      source?: string;
      scanResultId?: string;
    }) {
      const [lead] = await db
        .insert(leads)
        .values({
          email: data.email,
          reportToken: data.reportToken ?? null,
          source: data.source ?? "shared_report",
          scanResultId: data.scanResultId ?? null,
        })
        .returning();
      return lead;
    },

    async getById(id: string) {
      const [lead] = await db.select().from(leads).where(eq(leads.id, id));
      return lead ?? null;
    },

    async findByEmail(email: string) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.email, email))
        .orderBy(leads.createdAt);
      return lead ?? null;
    },

    async markConverted(id: string, projectId: string) {
      const [updated] = await db
        .update(leads)
        .set({ convertedAt: new Date(), projectId })
        .where(eq(leads.id, id))
        .returning();
      return updated ?? null;
    },

    async deleteOldUnconverted(daysOld: number) {
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      const deleted = await db
        .delete(leads)
        .where(and(isNull(leads.convertedAt), lte(leads.createdAt, cutoff)))
        .returning({ id: leads.id });
      return deleted.length;
    },
  };
}
