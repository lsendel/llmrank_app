import {
  createAppDb,
  projectQueries,
  integrationQueries,
  enrichmentQueries,
  pageQueries,
} from "@llm-boost/db";
import { runEnrichments, type ProviderResult } from "@llm-boost/integrations";
import { decrypt, encrypt } from "../lib/crypto";
import { refreshAccessToken } from "../lib/google-oauth";
import { refreshLongLivedToken } from "../lib/meta-oauth";

const ENRICHMENT_PAGE_LIMIT = 50;

export interface EnrichmentInput {
  d1: D1Database;
  encryptionKey: string;
  googleClientId: string;
  googleClientSecret: string;
  metaAppId: string;
  metaAppSecret: string;
  projectId: string;
  jobId: string;
  insertedPages: { id: string; url: string }[];
}

export interface EnrichmentOutput {
  enrichmentRowsInserted: number;
  providerResults: ProviderResult[];
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function parseIntegrationConfig(config: unknown): Record<string, unknown> {
  if (!config) return {};

  if (typeof config === "string") {
    try {
      const parsed: unknown = JSON.parse(config);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

/**
 * Runs integration enrichments (GSC, PSI, GA4, Clarity) for a completed crawl.
 * Returns diagnostic info about which providers succeeded/failed.
 */
export async function runIntegrationEnrichments(
  input: EnrichmentInput,
  logger?: {
    info: (msg: string, data?: any) => void;
    error: (msg: string, data?: any) => void;
  },
): Promise<EnrichmentOutput> {
  logger?.info("[enrichments] Starting enrichments", {
    projectId: input.projectId,
    jobId: input.jobId,
    pageCount: input.insertedPages.length,
  });
  const db = createAppDb(input.d1);
  const integrationsQ = integrationQueries(db);
  const enrichmentsQ = enrichmentQueries(db);
  const pagesQ = pageQueries(db);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) {
    logger?.info("[enrichments] Project not found, skipping", {
      projectId: input.projectId,
    });
    return { enrichmentRowsInserted: 0, providerResults: [] };
  }

  const integrations = await integrationsQ.listByProject(input.projectId);
  const enabled = integrations.filter(
    (i) => i.enabled && i.encryptedCredentials,
  );
  logger?.info("[enrichments] Found integrations", {
    total: integrations.length,
    enabled: enabled.length,
  });
  if (enabled.length === 0) {
    return { enrichmentRowsInserted: 0, providerResults: [] };
  }

  // Fetch a bounded page sample from the DB. Provider APIs can be expensive
  // here, especially PSI, so keep this intentional and stable.
  const dbJobPages = await pagesQ.listByJob(input.jobId, {
    limit: ENRICHMENT_PAGE_LIMIT,
  });
  const allJobPages =
    dbJobPages.length > 0
      ? dbJobPages.slice(0, ENRICHMENT_PAGE_LIMIT)
      : input.insertedPages;
  const allPageUrls = allJobPages.map((p) => p.url);
  if (allPageUrls.length === 0) {
    logger?.info("[enrichments] No pages found, skipping", {
      projectId: input.projectId,
      jobId: input.jobId,
    });
    return { enrichmentRowsInserted: 0, providerResults: [] };
  }

  // Decrypt credentials and refresh OAuth tokens if needed
  const preparationFailures: ProviderResult[] = [];
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
        } catch (err) {
          const error = `Credential decrypt failed: ${errorMessage(err)}`;
          logger?.error(
            "[enrichments] Failed to parse credentials for integration",
            {
              integrationId: integration.id,
              provider: integration.provider,
              error,
            },
          );
          preparationFailures.push({
            provider: integration.provider,
            ok: false,
            count: 0,
            error,
          });
          await integrationsQ.updateLastSync(integration.id, error);
          return null;
        }

        // Refresh Google OAuth tokens if expired
        if (
          (integration.provider === "gsc" || integration.provider === "ga4") &&
          creds.refreshToken &&
          integration.tokenExpiresAt &&
          new Date(integration.tokenExpiresAt) < new Date()
        ) {
          try {
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
            await integrationsQ.updateCredentials(
              integration.id,
              newEncrypted,
              new Date(Date.now() + refreshed.expiresIn * 1000),
            );
          } catch (err) {
            const error = `OAuth token refresh failed: ${errorMessage(err)}`;
            logger?.error(
              "[enrichments] Google token refresh failed for integration",
              {
                integrationId: integration.id,
                provider: integration.provider,
                error,
              },
            );
            preparationFailures.push({
              provider: integration.provider,
              ok: false,
              count: 0,
              error,
            });
            await integrationsQ.updateLastSync(integration.id, error);
            return null;
          }
        }

        // Refresh Meta long-lived token if expiring within 7 days
        if (
          integration.provider === "meta" &&
          creds.accessToken &&
          integration.tokenExpiresAt
        ) {
          const sevenDaysFromNow = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          );
          const tokenExpiresAt = new Date(integration.tokenExpiresAt);
          if (tokenExpiresAt < sevenDaysFromNow) {
            try {
              const refreshed = await refreshLongLivedToken({
                token: creds.accessToken,
                clientId: input.metaAppId,
                clientSecret: input.metaAppSecret,
              });
              creds.accessToken = refreshed.accessToken;

              const newEncrypted = await encrypt(
                JSON.stringify(creds),
                input.encryptionKey,
              );
              await integrationsQ.updateCredentials(
                integration.id,
                newEncrypted,
                new Date(Date.now() + refreshed.expiresIn * 1000),
              );
            } catch (err) {
              const error = `Meta token refresh failed: ${errorMessage(err)}`;
              logger?.error(
                "[enrichments] Meta token refresh failed for integration",
                {
                  integrationId: integration.id,
                  error,
                },
              );
              if (tokenExpiresAt < new Date()) {
                preparationFailures.push({
                  provider: integration.provider,
                  ok: false,
                  count: 0,
                  error,
                });
                await integrationsQ.updateLastSync(integration.id, error);
                return null;
              }
            }
          }
        }

        return {
          provider: integration.provider,
          integrationId: integration.id,
          credentials: creds as Record<string, string>,
          config: parseIntegrationConfig(integration.config),
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  logger?.info("[enrichments] Prepared integrations", {
    count: prepared.length,
    providers: prepared.map((p) => p.provider).join(", "),
  });
  if (prepared.length === 0) {
    return { enrichmentRowsInserted: 0, providerResults: preparationFailures };
  }

  // Run all fetchers
  const { results, providerResults } = await runEnrichments(
    prepared,
    project.domain,
    allPageUrls,
  );
  logger?.info("[enrichments] Fetchers completed", {
    resultCount: results.length,
    providerResults,
  });

  // Map page URLs to page IDs from the same bounded sample sent to fetchers.
  const urlToPageId = new Map(allJobPages.map((p) => [p.url, p.id]));

  // Batch insert enrichment results
  const enrichmentRows = results
    .filter((r) => urlToPageId.has(r.pageUrl))
    .map((r) => ({
      pageId: urlToPageId.get(r.pageUrl)!,
      jobId: input.jobId,
      provider: r.provider as "gsc" | "psi" | "ga4" | "clarity" | "meta",
      data: r.data,
    }));

  if (enrichmentRows.length > 0) {
    await enrichmentsQ.createBatch(enrichmentRows);
    logger?.info("[enrichments] Inserted enrichment rows", {
      rowCount: enrichmentRows.length,
    });
  }

  // Update lastSyncAt for each integration, recording per-provider errors
  for (const p of prepared) {
    const result = providerResults.find((r) => r.provider === p.provider);
    await integrationsQ.updateLastSync(
      p.integrationId,
      result && !result.ok ? (result.error ?? "Unknown error") : null,
    );
  }

  logger?.info("[enrichments] Completed enrichments", {
    projectId: input.projectId,
    jobId: input.jobId,
  });

  return {
    enrichmentRowsInserted: enrichmentRows.length,
    providerResults: [...preparationFailures, ...providerResults],
  };
}
