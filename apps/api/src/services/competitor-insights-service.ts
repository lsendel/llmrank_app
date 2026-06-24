import { parseHtml } from "@llm-boost/parsers";
import type { VisibilityRepository } from "@llm-boost/repositories";

type VisibilityCheckLike = Awaited<
  ReturnType<VisibilityRepository["listByProject"]>
>[number];

type HomepageFetch = typeof fetch;

export interface CompetitorWinningQuery {
  query: string;
  providers: string[];
  wins: number;
  bestPosition: number | null;
  avgPosition: number | null;
  lastSeenAt: string;
  yourMentioned: boolean;
  yourCited: boolean;
}

export interface CompetitorTheme {
  label: string;
  source: "homepage" | "queries" | "mixed";
  evidence: string[];
}

export interface CompetitorHomepageSignals {
  title: string | null;
  metaDescription: string | null;
  headings: string[];
}

export interface CompetitorInsight {
  competitorDomain: string;
  winningQueries: CompetitorWinningQuery[];
  inferredThemes: CompetitorTheme[];
  homepageSignals: CompetitorHomepageSignals | null;
}

interface CompetitorInsightsDeps {
  visibility: VisibilityRepository;
  fetchImpl?: HomepageFetch;
}

interface ThemeInferenceArgs {
  domain: string;
  homepageSignals: CompetitorHomepageSignals | null;
  winningQueries: CompetitorWinningQuery[];
}

type PhraseCandidate = {
  score: number;
  sourceKinds: Set<"title" | "meta" | "heading" | "query">;
  evidence: Set<string>;
};

const FETCH_TIMEOUT_MS = 8000;
const MAX_THEMES = 3;
const MAX_THEME_EVIDENCE = 2;
const MAX_WINNING_QUERIES = 10;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "best",
  "by",
  "for",
  "from",
  "get",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "the",
  "their",
  "this",
  "to",
  "top",
  "vs",
  "what",
  "when",
  "with",
  "your",
]);

const ACRONYM_TOKENS = new Set(["ai", "seo", "llm", "api", "ux", "ui", "saas"]);

const SOURCE_WEIGHTS: Record<"title" | "meta" | "heading" | "query", number> = {
  title: 4,
  meta: 2,
  heading: 3,
  query: 5,
};

function normalizeDomain(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function tokenize(text: string, blockedTokens: Set<string>) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !blockedTokens.has(token))
    .filter((token) => !/^\d+$/.test(token));
}

function buildNgrams(tokens: string[]) {
  const phrases = new Set<string>();

  for (let i = 0; i < tokens.length; i += 1) {
    const unigram = tokens[i];
    if (unigram && unigram.length >= 6) {
      phrases.add(unigram);
    }

    const bigram = tokens.slice(i, i + 2);
    if (bigram.length === 2) {
      phrases.add(bigram.join(" "));
    }

    const trigram = tokens.slice(i, i + 3);
    if (trigram.length === 3) {
      phrases.add(trigram.join(" "));
    }
  }

  return phrases;
}

function toThemeLabel(phrase: string) {
  return phrase
    .split(" ")
    .map((token) => {
      if (ACRONYM_TOKENS.has(token)) return token.toUpperCase();
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ");
}

function overlapsSelected(selected: string[], candidate: string) {
  return selected.some(
    (existing) => existing.includes(candidate) || candidate.includes(existing),
  );
}

export function buildCompetitorWinningQueryMap(
  checks: VisibilityCheckLike[],
  competitorDomains?: string[],
) {
  const normalizedFilter = competitorDomains?.length
    ? new Set(competitorDomains.map(normalizeDomain))
    : null;

  const byCompetitor = new Map<
    string,
    Map<
      string,
      {
        query: string;
        providers: Set<string>;
        wins: number;
        positions: number[];
        lastSeenAt: string;
        yourMentioned: boolean;
        yourCited: boolean;
      }
    >
  >();

  for (const check of checks) {
    const mentions = Array.isArray(check.competitorMentions)
      ? check.competitorMentions
      : [];

    for (const mention of mentions) {
      if (!mention.mentioned) continue;

      const domain = normalizeDomain(mention.domain);
      if (normalizedFilter && !normalizedFilter.has(domain)) continue;

      const byQuery = byCompetitor.get(domain) ?? new Map();
      const existing = byQuery.get(check.query) ?? {
        query: check.query,
        providers: new Set<string>(),
        wins: 0,
        positions: [],
        lastSeenAt: new Date(0).toISOString(),
        yourMentioned: false,
        yourCited: false,
      };

      existing.providers.add(check.llmProvider);
      existing.wins += 1;
      if (typeof mention.position === "number") {
        existing.positions.push(mention.position);
      }
      if (new Date(check.checkedAt) > new Date(existing.lastSeenAt)) {
        existing.lastSeenAt = new Date(check.checkedAt).toISOString();
      }
      existing.yourMentioned ||= check.brandMentioned;
      existing.yourCited ||= check.urlCited;

      byQuery.set(check.query, existing);
      byCompetitor.set(domain, byQuery);
    }
  }

  return new Map(
    Array.from(byCompetitor.entries()).map(([domain, byQuery]) => [
      domain,
      Array.from(byQuery.values())
        .map((entry) => ({
          query: entry.query,
          providers: Array.from(entry.providers).sort(),
          wins: entry.wins,
          bestPosition:
            entry.positions.length > 0 ? Math.min(...entry.positions) : null,
          avgPosition:
            entry.positions.length > 0
              ? Math.round(
                  (entry.positions.reduce((sum, value) => sum + value, 0) /
                    entry.positions.length) *
                    10,
                ) / 10
              : null,
          lastSeenAt: entry.lastSeenAt,
          yourMentioned: entry.yourMentioned,
          yourCited: entry.yourCited,
        }))
        .sort((a, b) => {
          if (a.yourMentioned !== b.yourMentioned) {
            return Number(a.yourMentioned) - Number(b.yourMentioned);
          }
          if (b.wins !== a.wins) return b.wins - a.wins;
          if ((a.bestPosition ?? Infinity) !== (b.bestPosition ?? Infinity)) {
            return (a.bestPosition ?? Infinity) - (b.bestPosition ?? Infinity);
          }
          return (
            new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
          );
        })
        .slice(0, MAX_WINNING_QUERIES),
    ]),
  );
}

export function inferThemes({
  domain,
  homepageSignals,
  winningQueries,
}: ThemeInferenceArgs): CompetitorTheme[] {
  const blockedTokens = new Set(
    normalizeDomain(domain)
      .split(/[.-]/)
      .filter((token) => token.length >= 3),
  );

  const candidates = new Map<string, PhraseCandidate>();
  const sources: Array<{
    kind: "title" | "meta" | "heading" | "query";
    text: string;
  }> = [];

  if (homepageSignals?.title) {
    sources.push({ kind: "title", text: homepageSignals.title });
  }
  if (homepageSignals?.metaDescription) {
    sources.push({ kind: "meta", text: homepageSignals.metaDescription });
  }
  for (const heading of homepageSignals?.headings ?? []) {
    sources.push({ kind: "heading", text: heading });
  }
  for (const query of winningQueries.slice(0, 6)) {
    sources.push({ kind: "query", text: query.query });
  }

  for (const source of sources) {
    const tokens = tokenize(source.text, blockedTokens);
    if (tokens.length === 0) continue;

    for (const phrase of buildNgrams(tokens)) {
      const candidate = candidates.get(phrase) ?? {
        score: 0,
        sourceKinds: new Set(),
        evidence: new Set(),
      };
      candidate.score += SOURCE_WEIGHTS[source.kind];
      candidate.sourceKinds.add(source.kind);
      if (candidate.evidence.size < 4) {
        candidate.evidence.add(source.text);
      }
      candidates.set(phrase, candidate);
    }
  }

  const ranked = Array.from(candidates.entries())
    .filter(([, candidate]) => candidate.score >= 5)
    .sort((a, b) => {
      const aMixed =
        a[1].sourceKinds.has("query") && a[1].sourceKinds.size > 1 ? 1 : 0;
      const bMixed =
        b[1].sourceKinds.has("query") && b[1].sourceKinds.size > 1 ? 1 : 0;
      if (aMixed !== bMixed) return bMixed - aMixed;
      if (a[1].sourceKinds.size !== b[1].sourceKinds.size) {
        return b[1].sourceKinds.size - a[1].sourceKinds.size;
      }
      if (a[1].score !== b[1].score) return b[1].score - a[1].score;
      return b[0].length - a[0].length;
    });

  const selected: string[] = [];
  const themes: CompetitorTheme[] = [];

  for (const [phrase, candidate] of ranked) {
    if (themes.length >= MAX_THEMES) break;
    if (overlapsSelected(selected, phrase)) continue;

    selected.push(phrase);
    themes.push({
      label: toThemeLabel(phrase),
      source:
        candidate.sourceKinds.has("query") && candidate.sourceKinds.size > 1
          ? "mixed"
          : candidate.sourceKinds.has("query")
            ? "queries"
            : "homepage",
      evidence: Array.from(candidate.evidence).slice(0, MAX_THEME_EVIDENCE),
    });
  }

  return themes;
}

export async function fetchHomepageSignals(
  domain: string,
  fetchImpl: HomepageFetch = fetch,
): Promise<CompetitorHomepageSignals | null> {
  const normalized = normalizeDomain(domain);

  for (const url of [`https://${normalized}`, `http://${normalized}`]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "LLMRankBot/1.0 (+https://llmrank.app)" },
        signal: controller.signal,
      });

      if (!response.ok) continue;

      const html = await response.text();
      const parsed = parseHtml(html, url);
      const headings = Array.from(
        new Set([...(parsed.h1 ?? []), ...(parsed.h2 ?? [])]),
      )
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 6);

      return {
        title: parsed.title ?? null,
        metaDescription: parsed.metaDescription ?? null,
        headings,
      };
    } catch {
      // Try the next URL variant.
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

export function createCompetitorInsightsService({
  visibility,
  fetchImpl = fetch,
}: CompetitorInsightsDeps) {
  return {
    async getProjectInsights(args: {
      projectId: string;
      competitorDomains: string[];
      filters?: { region?: string; language?: string };
    }): Promise<CompetitorInsight[]> {
      const domains = Array.from(
        new Set(args.competitorDomains.map(normalizeDomain).filter(Boolean)),
      );
      if (domains.length === 0) return [];

      const checks = await visibility.listByProject(
        args.projectId,
        args.filters,
      );
      const winningQueriesByCompetitor = buildCompetitorWinningQueryMap(
        checks,
        domains,
      );

      const homepageSignals = await Promise.all(
        domains.map((domain) => fetchHomepageSignals(domain, fetchImpl)),
      );

      return domains
        .map((domain, index) => {
          const winningQueries = winningQueriesByCompetitor.get(domain) ?? [];
          const signals = homepageSignals[index] ?? null;

          return {
            competitorDomain: domain,
            winningQueries,
            inferredThemes: inferThemes({
              domain,
              homepageSignals: signals,
              winningQueries,
            }),
            homepageSignals: signals,
          };
        })
        .sort((a, b) => b.winningQueries.length - a.winningQueries.length);
    },
  };
}
