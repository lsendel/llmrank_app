export type {
  IntegrationFetcherContext,
  EnrichmentResult,
  IntegrationFetcher,
} from "./types";

export { fetchGSCData } from "./fetchers/gsc";
export { fetchPSIData } from "./fetchers/psi";
export { fetchGA4Data } from "./fetchers/ga4";
export { fetchClarityData } from "./fetchers/clarity";

import type {
  IntegrationFetcher,
  IntegrationFetcherContext,
  EnrichmentResult,
} from "./types";
import { fetchGSCData } from "./fetchers/gsc";
import { fetchPSIData } from "./fetchers/psi";
import { fetchGA4Data } from "./fetchers/ga4";
import { fetchClarityData } from "./fetchers/clarity";

export const INTEGRATION_FETCHERS: Record<string, IntegrationFetcher> = {
  gsc: fetchGSCData,
  psi: fetchPSIData,
  ga4: fetchGA4Data,
  clarity: fetchClarityData,
};

export interface ProviderResult {
  provider: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface EnrichmentRunResult {
  results: EnrichmentResult[];
  providerResults: ProviderResult[];
}

/**
 * Run enrichments for all enabled integrations.
 * Returns flat array of per-page enrichment results plus per-provider diagnostics.
 */
export async function runEnrichments(
  integrations: {
    provider: string;
    credentials: Record<string, string>;
    config: Record<string, unknown>;
  }[],
  domain: string,
  pageUrls: string[],
): Promise<EnrichmentRunResult> {
  const results: EnrichmentResult[] = [];
  const providerResults: ProviderResult[] = [];

  await Promise.all(
    integrations.map(async (integration) => {
      const fetcher = INTEGRATION_FETCHERS[integration.provider];
      if (!fetcher) {
        providerResults.push({
          provider: integration.provider,
          ok: false,
          count: 0,
          error: "No fetcher registered",
        });
        return;
      }

      const ctx: IntegrationFetcherContext = {
        domain,
        pageUrls,
        credentials: integration.credentials,
        config: integration.config,
      };

      try {
        const items = await fetcher(ctx);
        results.push(...items);
        providerResults.push({
          provider: integration.provider,
          ok: true,
          count: items.length,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `Integration fetcher failed [${integration.provider}]:`,
          errorMsg,
        );
        providerResults.push({
          provider: integration.provider,
          ok: false,
          count: 0,
          error: errorMsg,
        });
      }
    }),
  );

  return { results, providerResults };
}
