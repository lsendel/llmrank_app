export interface RobotsGroup {
  userAgents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export interface RobotsResult {
  groups: RobotsGroup[];
  sitemaps: string[];
  host?: string;
}

export class RobotsParser {
  private content: string;
  private result: RobotsResult | null = null;

  constructor(content: string) {
    this.content = content;
  }

  public parse(): RobotsResult {
    if (this.result) return this.result;
    return this.parseCheck();
  }

  private parseCheck(): RobotsResult {
    const lines = this.content.split(/\r?\n/);
    const groups: RobotsGroup[] = [];
    const sitemaps: string[] = [];
    let host: string | undefined;

    let currentAgents: string[] = [];
    let currentAllows: string[] = [];
    let currentDisallows: string[] = [];
    let currentCrawlDelay: number | undefined;

    const flushGroup = () => {
      if (currentAgents.length > 0) {
        groups.push({
          userAgents: [...currentAgents],
          allow: [...currentAllows],
          disallow: [...currentDisallows],
          crawlDelay: currentCrawlDelay,
        });
      }
      currentAgents = [];
      currentAllows = [];
      currentDisallows = [];
      currentCrawlDelay = undefined;
    };

    let seenDirectiveSinceAgent = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const commentIndex = trimmed.indexOf("#");
      const cleanLine =
        commentIndex > -1 ? trimmed.substring(0, commentIndex).trim() : trimmed;
      if (!cleanLine) continue;

      const colonIdx = cleanLine.indexOf(":");
      if (colonIdx === -1) continue;

      const key = cleanLine.substring(0, colonIdx).trim().toLowerCase();
      const value = cleanLine.substring(colonIdx + 1).trim();

      if (key === "user-agent") {
        if (seenDirectiveSinceAgent) {
          flushGroup();
          seenDirectiveSinceAgent = false;
        }
        currentAgents.push(value);
      } else if (key === "allow") {
        if (currentAgents.length === 0) continue; // Orphan directive
        currentAllows.push(value);
        seenDirectiveSinceAgent = true;
      } else if (key === "disallow") {
        if (currentAgents.length === 0) continue;
        currentDisallows.push(value);
        seenDirectiveSinceAgent = true;
      } else if (key === "crawl-delay") {
        if (currentAgents.length === 0) continue;
        currentCrawlDelay = parseFloat(value);
        seenDirectiveSinceAgent = true;
      } else if (key === "sitemap") {
        sitemaps.push(value);
      } else if (key === "host") {
        host = value;
      }
    }
    flushGroup();

    this.result = { groups, sitemaps, host };
    return this.result;
  }

  public isAllowed(url: string, userAgent: string): boolean {
    if (!this.result) this.parse();
    if (!this.result) return true;

    // parsing URL path
    let path: string;
    try {
      const u = new URL(url.startsWith("http") ? url : `http://${url}`);
      path = u.pathname + u.search;
      // Decode path to match robots.txt decoding rules usually
      // But robots.txt rules are often percentage encoded.
      // Google says: "The path is case-sensitive."
    } catch {
      // if just a path passed
      path = url;
    }

    // Find best matching group
    // 1. Exact match user-agent
    // 2. Wildcard match

    // We filter groups that match the userAgent
    const matchingGroups = this.result.groups.filter((g) =>
      g.userAgents.some((ua) => {
        const pattern = ua.toLowerCase();
        const target = userAgent.toLowerCase();
        return target.includes(pattern) || pattern === "*";
      }),
    );

    // Prefer specific UA over wildcard
    const specificGroup = matchingGroups.find((g) =>
      g.userAgents.some(
        (ua) =>
          userAgent.toLowerCase().includes(ua.toLowerCase()) && ua !== "*",
      ),
    );

    const groupToUse =
      specificGroup || matchingGroups.find((g) => g.userAgents.includes("*"));

    if (!groupToUse) return true; // No rules -> allowed

    return this.checkPath(path, groupToUse);
  }

  private checkPath(path: string, group: RobotsGroup): boolean {
    // Longest match wins

    // Combine allow and disallow into a single list of rules
    // Rule: { path, type: 'allow' | 'disallow', length }

    let bestMatch: { type: "allow" | "disallow"; length: number } | null = null;

    for (const allow of group.allow) {
      if (this.matches(path, allow)) {
        if (!bestMatch || allow.length >= bestMatch.length) {
          bestMatch = { type: "allow", length: allow.length };
        }
      }
    }

    for (const disallow of group.disallow) {
      if (!disallow) continue; // Empty disallow means allow? No "Disallow: " means allow everything?
      // "Disallow: " (empty) means nothing is disallowed.
      if (this.matches(path, disallow)) {
        if (!bestMatch || disallow.length > bestMatch.length) {
          // Google says if lengths equal, Allow wins? actually Allow wins if lengths equal.
          // If lengths equal, Allow wins. So only update if strictly greater?
          // Or if strictly greater, Disallow wins.

          // Spec: "The most specific rule based on the length of the [path] entry wins"
          // "Directives with equal length ... Allow wins"

          if (!bestMatch || disallow.length > bestMatch.length) {
            bestMatch = { type: "disallow", length: disallow.length };
          }
        }
      }
    }

    if (bestMatch && bestMatch.type === "disallow") return false;
    return true;
  }

  private matches(path: string, rule: string): boolean {
    // Basic implementation without full wildcard support for now, or just simple startsWith
    // Robust implementation would handle * and $

    // Simple prefix match (standard robots.txt)
    // Handles "*" as wildcard

    // If rule ends with $, anchor it. Else it's a prefix match.
    // But we just escaped $ above.
    // Actually standard: $ at end means end of string.

    // Let's implement Google's spec logic simplified:
    // 1. If rule is empty, it matches nothing? No, "Disallow: " means ignore.
    if (!rule) return false;

    // If no wildcards, just startsWith
    if (!rule.includes("*") && !rule.includes("$")) {
      return path.startsWith(rule);
    }

    let pattern = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    // Restore * and $ functionality
    pattern = pattern.replace(/\\\*/g, ".*");
    pattern = pattern.replace(/\\\$$/, "$");

    try {
      return new RegExp(pattern).test(path);
    } catch {
      return false;
    }
  }
}

export interface LlmsTxtResult {
  title?: string;
  description?: string;
  links: { title: string; url: string }[];
}

export class LlmsTxtParser {
  private content: string;

  constructor(content: string) {
    this.content = content;
  }

  public parse(): LlmsTxtResult {
    const lines = this.content.split(/\r?\n/);
    let title: string | undefined;
    let description: string | undefined;
    const links: { title: string; url: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        title = trimmed.substring(2).trim();
      } else if (trimmed.startsWith("> ")) {
        description = trimmed.substring(2).trim();
      } else if (trimmed.startsWith("- ")) {
        // Link format: - [Title](URL)
        const match = trimmed.match(/- \[(.*?)\]\((.*?)\)/);
        if (match) {
          links.push({ title: match[1], url: match[2] });
        }
      }
    }
    return { title, description, links };
  }
}
