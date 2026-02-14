import {
  createDb,
  projectQueries,
  integrationQueries,
  enrichmentQueries,
} from "@llm-boost/db";
import { runEnrichments } from "@llm-boost/integrations";
import { decrypt, encrypt } from "../lib/crypto";
import { refreshAccessToken } from "../lib/google-oauth";

export interface EnrichmentInput {
  databaseUrl: string;
  encryptionKey: string;
  googleClientId: string;
  googleClientSecret: string;
  projectId: string;
  jobId: string;
  insertedPages: { id: string; url: string }[];
}

/**
 * Runs integration enrichments (GSC, PSI, GA4, Clarity) for a completed crawl.
 * Designed to run inside waitUntil() after the HTTP response is sent.
 */
export async function runIntegrationEnrichments(
  input: EnrichmentInput,
): Promise<void> {
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const integrations = await integrationQueries(db).listByProject(
    input.projectId,
  );
  const enabled = integrations.filter(
    (i) => i.enabled && i.encryptedCredentials,
  );
  if (enabled.length === 0) return;

  const allPageUrls = input.insertedPages.map((p) => p.url);

  // Decrypt credentials and refresh OAuth tokens if needed
  const prepared = await Promise.all(
    enabled.map(async (integration) => {
      const creds = JSON.parse(
        await decrypt(integration.encryptedCredentials!, input.encryptionKey),
      );

      // Refresh OAuth tokens if expired
      if (
        (integration.provider === "gsc" || integration.provider === "ga4") &&
        creds.refreshToken &&
        integration.tokenExpiresAt &&
        integration.tokenExpiresAt < new Date()
      ) {
        const refreshed = await refreshAccessToken({
          refreshToken: creds.refreshToken,
          clientId: input.googleClientId,
          clientSecret: input.googleClientSecret,
        });
        creds.accessToken = refreshed.accessToken;

        const newEncrypted = await encrypt(
          JSON.stringify(creds),
          input.encryptionKey,
        );
        await integrationQueries(db).updateCredentials(
          integration.id,
          newEncrypted,
          new Date(Date.now() + refreshed.expiresIn * 1000),
        );
      }

      return {
        provider: integration.provider,
        integrationId: integration.id,
        credentials: creds as Record<string, string>,
        config: (integration.config ?? {}) as Record<string, unknown>,
      };
    }),
  );

  // Run all fetchers
  const results = await runEnrichments(prepared, project.domain, allPageUrls);

  // Map page URLs to page IDs
  const urlToPageId = new Map(input.insertedPages.map((p) => [p.url, p.id]));

  // Batch insert enrichment results
  const enrichmentRows = results
    .filter((r) => urlToPageId.has(r.pageUrl))
    .map((r) => ({
      pageId: urlToPageId.get(r.pageUrl)!,
      jobId: input.jobId,
      provider: r.provider as "gsc" | "psi" | "ga4" | "clarity",
      data: r.data,
    }));

  if (enrichmentRows.length > 0) {
    await enrichmentQueries(db).createBatch(enrichmentRows);
  }

  // Update lastSyncAt for each integration
  for (const p of prepared) {
    await integrationQueries(db).updateLastSync(p.integrationId, null);
  }
}
