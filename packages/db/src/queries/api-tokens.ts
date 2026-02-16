import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { apiTokens } from "../schema";

export function apiTokenQueries(db: Database) {
  return {
    async create(data: {
      userId: string;
      projectId: string;
      name: string;
      tokenHash: string;
      tokenPrefix: string;
      scopes: string[];
      expiresAt?: Date;
    }) {
      const [token] = await db.insert(apiTokens).values(data).returning();
      return token;
    },

    async findByHash(tokenHash: string) {
      const [token] = await db
        .select()
        .from(apiTokens)
        .where(
          and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)),
        );
      if (!token) return null;
      if (token.expiresAt && token.expiresAt < new Date()) return null;
      return token;
    },

    async listByUser(userId: string) {
      return db
        .select({
          id: apiTokens.id,
          name: apiTokens.name,
          tokenPrefix: apiTokens.tokenPrefix,
          scopes: apiTokens.scopes,
          projectId: apiTokens.projectId,
          lastUsedAt: apiTokens.lastUsedAt,
          expiresAt: apiTokens.expiresAt,
          revokedAt: apiTokens.revokedAt,
          createdAt: apiTokens.createdAt,
        })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(apiTokens.createdAt);
    },

    async revoke(id: string) {
      const [token] = await db
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(eq(apiTokens.id, id))
        .returning();
      return token ?? null;
    },

    async updateLastUsed(id: string) {
      await db
        .update(apiTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiTokens.id, id));
    },

    async countByUser(userId: string) {
      const rows = await db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
      return rows.length;
    },
  };
}
