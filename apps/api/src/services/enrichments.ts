import {
  createDb,
  projectQueries,
  integrationQueries,
  enrichmentQueries,
} from "@llm-boost/db";
import { runEnrichments, type ProviderResult } from "@llm-boost/integrations";
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

export interface EnrichmentOutput {
  enrichmentRowsInserted: number;
  providerResults: ProviderResult[];
}

/**
 * Runs integration enrichments (GSC, PSI, GA4, Clarity) for a completed crawl.
 * Returns diagnostic info about which providers succeeded/failed.
 */
export async function runIntegrationEnrichments(
  input: EnrichmentInput,
): Promise<EnrichmentOutput> {
  console.log(
    `[enrichments] Starting enrichments for project=${input.projectId} job=${input.jobId} pages=${input.insertedPages.length}`,
  );
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) {
    console.log(`[enrichments] Project ${input.projectId} not found, skipping`);
    return { enrichmentRowsInserted: 0, providerResults: [] };
  }

  const integrations = await integrationQueries(db).listByProject(
    input.projectId,
  );
  const enabled = integrations.filter(
    (i) => i.enabled && i.encryptedCredentials,
  );
  console.log(
    `[enrichments] Found ${integrations.length} integrations, ${enabled.length} enabled`,
  );
  if (enabled.length === 0) {
    return { enrichmentRowsInserted: 0, providerResults: [] };
  }

  const allPageUrls = input.insertedPages.map((p) => p.url);

  // Decrypt credentials and refresh OAuth tokens if needed
  const prepared = (
    await Promise.all(
      enabled.map(async (integration) => {
        let creds: Record<string, string>;
        try {
          creds = JSON.parse(
            await decrypt(
              integration.encryptedCredentials!,
              input.encryptionKey,
            ),
          );
        } catch {
          console.error(
            `[enrichments] Failed to parse credentials for integration ${integration.id} (${integration.provider})`,
          );
          return null;
        }

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
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  console.log(
    `[enrichments] Prepared ${prepared.length} integrations: ${prepared.map((p) => p.provider).join(", ")}`,
  );

  // Run all fetchers
  const { results, providerResults } = await runEnrichments(
    prepared,
    project.domain,
    allPageUrls,
  );
  console.log(
    `[enrichments] Fetchers returned ${results.length} results`,
    providerResults,
  );

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
    console.log(
      `[enrichments] Inserted ${enrichmentRows.length} enrichment rows`,
    );
  }

  // Update lastSyncAt for each integration
  for (const p of prepared) {
    await integrationQueries(db).updateLastSync(p.integrationId, null);
  }

  console.log(
    `[enrichments] Completed enrichments for project=${input.projectId} job=${input.jobId}`,
  );

  return { enrichmentRowsInserted: enrichmentRows.length, providerResults };
}
