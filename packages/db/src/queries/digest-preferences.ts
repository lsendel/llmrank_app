import { eq, and, or, isNull, lt } from "drizzle-orm";
import type { Database } from "../client";
import { users } from "../schema";

export function digestPreferenceQueries(db: Database) {
  return {
    async getPreferences(userId: string) {
      const row = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          digestFrequency: true,
          digestDay: true,
          lastDigestSentAt: true,
        },
      });
      return row ?? null;
    },

    async updatePreferences(
      userId: string,
      prefs: { digestFrequency?: string; digestDay?: number },
    ) {
      const [updated] = await db
        .update(users)
        .set({ ...prefs, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({
          digestFrequency: users.digestFrequency,
          digestDay: users.digestDay,
          lastDigestSentAt: users.lastDigestSentAt,
        });
      return updated;
    },

    async getUsersDueForDigest(
      frequency: "weekly" | "monthly",
      cutoffDate: Date,
    ) {
      return db
        .select({
          id: users.id,
          email: users.email,
          digestFrequency: users.digestFrequency,
          digestDay: users.digestDay,
          lastDigestSentAt: users.lastDigestSentAt,
        })
        .from(users)
        .where(
          and(
            eq(users.digestFrequency, frequency),
            or(
              isNull(users.lastDigestSentAt),
              lt(users.lastDigestSentAt, cutoffDate),
            ),
          ),
        );
    },

    async markDigestSent(userId: string) {
      await db
        .update(users)
        .set({ lastDigestSentAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));
    },
  };
}
