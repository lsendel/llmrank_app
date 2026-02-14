import { eq, and } from "drizzle-orm";
import type { Database } from "../client";
import { projectIntegrations } from "../schema";

export function integrationQueries(db: Database) {
  return {
    async listByProject(projectId: string) {
      return db.query.projectIntegrations.findMany({
        where: eq(projectIntegrations.projectId, projectId),
      });
    },

    async getByProjectAndProvider(
      projectId: string,
      provider: "gsc" | "psi" | "ga4" | "clarity",
    ) {
      return db.query.projectIntegrations.findFirst({
        where: and(
          eq(projectIntegrations.projectId, projectId),
          eq(projectIntegrations.provider, provider),
        ),
      });
    },

    async upsert(data: {
      projectId: string;
      provider: "gsc" | "psi" | "ga4" | "clarity";
      encryptedCredentials?: string | null;
      config?: unknown;
      tokenExpiresAt?: Date | null;
    }) {
      const [row] = await db
        .insert(projectIntegrations)
        .values({
          projectId: data.projectId,
          provider: data.provider,
          encryptedCredentials: data.encryptedCredentials ?? null,
          config: data.config ?? {},
          tokenExpiresAt: data.tokenExpiresAt ?? null,
          enabled: true,
        })
        .onConflictDoUpdate({
          target: [projectIntegrations.projectId, projectIntegrations.provider],
          set: {
            encryptedCredentials: data.encryptedCredentials ?? null,
            config: data.config ?? {},
            tokenExpiresAt: data.tokenExpiresAt ?? null,
            enabled: true,
            lastError: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    },

    async updateEnabled(id: string, enabled: boolean) {
      const [updated] = await db
        .update(projectIntegrations)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(projectIntegrations.id, id))
        .returning();
      return updated;
    },

    async updateCredentials(
      id: string,
      encryptedCredentials: string,
      tokenExpiresAt?: Date | null,
    ) {
      const [updated] = await db
        .update(projectIntegrations)
        .set({
          encryptedCredentials,
          tokenExpiresAt: tokenExpiresAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(projectIntegrations.id, id))
        .returning();
      return updated;
    },

    async updateLastSync(id: string, error?: string | null) {
      const [updated] = await db
        .update(projectIntegrations)
        .set({
          lastSyncAt: new Date(),
          lastError: error ?? null,
          updatedAt: new Date(),
        })
        .where(eq(projectIntegrations.id, id))
        .returning();
      return updated;
    },

    async remove(id: string, projectId: string) {
      await db
        .delete(projectIntegrations)
        .where(
          and(
            eq(projectIntegrations.id, id),
            eq(projectIntegrations.projectId, projectId),
          ),
        );
    },
  };
}
