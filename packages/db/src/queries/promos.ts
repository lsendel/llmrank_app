import { eq, and, desc, sql } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { promos } from "../schema";

export function promoQueries(db: Database) {
  return {
    async getByCode(code: string) {
      return db.query.promos.findFirst({
        where: and(
          eq(promos.code, code.toUpperCase()),
          eq(promos.active, true),
        ),
      });
    },

    async getById(id: string) {
      return db.query.promos.findFirst({
        where: eq(promos.id, id),
      });
    },

    async list() {
      return db.query.promos.findMany({
        orderBy: desc(promos.createdAt),
      });
    },

    async create(data: {
      code: string;
      stripeCouponId: string;
      stripePromotionCodeId?: string;
      discountType: "percent_off" | "amount_off" | "free_months";
      discountValue: number;
      duration: "once" | "repeating" | "forever";
      durationMonths?: number;
      maxRedemptions?: number;
      expiresAt?: Date;
      createdBy?: string;
    }) {
      const [promo] = await db
        .insert(promos)
        .values({
          ...data,
          id: crypto.randomUUID(),
          code: data.code.toUpperCase(),
          expiresAt: data.expiresAt?.toISOString(),
        })
        .returning();
      return promo;
    },

    async incrementRedeemed(id: string) {
      const [updated] = await db
        .update(promos)
        .set({ timesRedeemed: sql`${promos.timesRedeemed} + 1` })
        .where(eq(promos.id, id))
        .returning();
      return updated;
    },

    async deactivate(id: string) {
      const [updated] = await db
        .update(promos)
        .set({ active: false })
        .where(eq(promos.id, id))
        .returning();
      return updated;
    },
  };
}
