import { checkChatGPT } from "./providers/chatgpt";
import { checkClaude } from "./providers/claude";
import { checkPerplexity } from "./providers/perplexity";
import { checkGemini } from "./providers/gemini";

export interface VisibilityCheckResult {
  provider: string;
  query: string;
  responseText: string;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition: number | null;
  competitorMentions: {
    domain: string;
    mentioned: boolean;
    position: number | null;
  }[];
}

export interface VisibilityCheckOptions {
  query: string;
  targetDomain: string;
  competitors?: string[];
  providers: string[];
  apiKeys: Record<string, string>;
}

type ProviderCheckFn = (
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
) => Promise<VisibilityCheckResult>;

const PROVIDER_MAP: Record<string, ProviderCheckFn> = {
  chatgpt: checkChatGPT,
  claude: checkClaude,
  perplexity: checkPerplexity,
  gemini: checkGemini,
};

export class VisibilityChecker {
  async checkAllProviders(
    options: VisibilityCheckOptions,
  ): Promise<VisibilityCheckResult[]> {
    const {
      query,
      targetDomain,
      competitors = [],
      providers,
      apiKeys,
    } = options;

    const checks = providers
      .filter((p) => PROVIDER_MAP[p] && apiKeys[p])
      .map((provider) =>
        PROVIDER_MAP[provider](
          query,
          targetDomain,
          competitors,
          apiKeys[provider],
        ).catch(
          (err): VisibilityCheckResult => ({
            provider,
            query,
            responseText: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            brandMentioned: false,
            urlCited: false,
            citationPosition: null,
            competitorMentions: competitors.map((domain) => ({
              domain,
              mentioned: false,
              position: null,
            })),
          }),
        ),
      );

    return Promise.all(checks);
  }
}

/** Parse a response text to detect brand mentions and URL citations. */
export function analyzeResponse(
  responseText: string,
  targetDomain: string,
  competitors: string[],
): Pick<
  VisibilityCheckResult,
  "brandMentioned" | "urlCited" | "citationPosition" | "competitorMentions"
> {
  const text = responseText.toLowerCase();
  const domain = targetDomain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "");
  const brandName = domain.split(".")[0];

  const brandMentioned = text.includes(brandName) || text.includes(domain);
  const urlCited = text.includes(domain);

  let citationPosition: number | null = null;
  if (urlCited) {
    const lines = text.split("\n").filter((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(domain)) {
        citationPosition = i + 1;
        break;
      }
    }
  }

  const competitorMentions = competitors.map((comp) => {
    const compDomain = comp
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "");
    const compBrand = compDomain.split(".")[0];
    const mentioned = text.includes(compBrand) || text.includes(compDomain);
    let position: number | null = null;
    if (mentioned) {
      const lines = text.split("\n").filter((l) => l.trim());
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(compBrand) || lines[i].includes(compDomain)) {
          position = i + 1;
          break;
        }
      }
    }
    return { domain: comp, mentioned, position };
  });

  return { brandMentioned, urlCited, citationPosition, competitorMentions };
}
