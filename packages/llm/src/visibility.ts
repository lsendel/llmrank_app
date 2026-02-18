import { checkChatGPT } from "./providers/chatgpt";
import { checkClaude } from "./providers/claude";
import { checkPerplexity } from "./providers/perplexity";
import { checkGemini } from "./providers/gemini";
import { checkCopilot } from "./providers/copilot";
import { checkGeminiAIMode } from "./providers/gemini-ai-mode";

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
  copilot: checkCopilot,
  gemini_ai_mode: checkGeminiAIMode,
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
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/$/, "");

  // Create brand variations (e.g. "llmrank.com" -> "llmrank", "llm rank")
  const brandName = domain.split(".")[0];
  const brandVariations = [brandName, brandName.replace(/-/g, " "), domain];

  const brandMentioned = brandVariations.some((v) => text.includes(v));

  // Detect Markdown links [Anchor](URL) or plain URLs
  // We want to see if the target domain appears in a URL context
  const urlRegex = new RegExp(
    `\\(https?:\\/\\/[^)]*${escapeRegExp(domain)}[^)]*\\)|https?:\\/\\/[^\\s]*${escapeRegExp(domain)}`,
    "i",
  );
  const urlCited = urlRegex.test(responseText);

  let citationPosition: number | null = null;
  const lines = responseText.split("\n").filter((l) => l.trim());

  // Find first occurrence line number
  if (brandMentioned || urlCited) {
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (
        brandVariations.some((v) => lineLower.includes(v)) ||
        urlRegex.test(lines[i])
      ) {
        citationPosition = i + 1;
        break;
      }
    }
  }

  const competitorMentions = competitors.map((comp) => {
    const compDomain = comp
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\/$/, "");
    const compBrand = compDomain.split(".")[0];
    const compVariations = [
      compBrand,
      compBrand.replace(/-/g, " "),
      compDomain,
    ];

    const mentioned = compVariations.some((v) => text.includes(v));
    const compUrlRegex = new RegExp(
      `\\(https?:\\/\\/[^)]*${escapeRegExp(compDomain)}[^)]*\\)|https?:\\/\\/[^\\s]*${escapeRegExp(compDomain)}`,
      "i",
    );
    const cited = compUrlRegex.test(responseText);

    let position: number | null = null;
    if (mentioned || cited) {
      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        if (
          compVariations.some((v) => lineLower.includes(v)) ||
          compUrlRegex.test(lines[i])
        ) {
          position = i + 1;
          break;
        }
      }
    }
    return { domain: comp, mentioned, position };
  });

  return { brandMentioned, urlCited, citationPosition, competitorMentions };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
