import Anthropic from "@anthropic-ai/sdk";
import { ServiceError } from "./errors";

interface FixContext {
  url: string;
  title: string;
  excerpt: string;
  domain: string;
  contentType?: string;
  pages?: { url: string; title: string }[];
}

interface FixGeneratorDeps {
  contentFixes: {
    create: (data: any) => Promise<any>;
    countByUserThisMonth: (userId: string) => Promise<number>;
  };
}

const FIX_PROMPTS: Record<string, (ctx: FixContext) => string> = {
  MISSING_META_DESC: (ctx) =>
    `Write a meta description (120-160 chars) for this page.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent excerpt: ${ctx.excerpt?.slice(0, 1000)}\nReturn ONLY the meta description text, no HTML tags.`,
  MISSING_TITLE: (ctx) =>
    `Write a title tag (30-60 chars) for this page.\nURL: ${ctx.url}\nContent excerpt: ${ctx.excerpt?.slice(0, 1000)}\nReturn ONLY the title text.`,
  NO_STRUCTURED_DATA: (ctx) =>
    `Generate JSON-LD structured data for this page.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nType: ${ctx.contentType ?? "WebPage"}\nContent excerpt: ${ctx.excerpt?.slice(0, 1500)}\nReturn valid JSON-LD only, no explanation.`,
  MISSING_LLMS_TXT: (ctx) =>
    `Generate an llms.txt file for the website ${ctx.domain}.\nPages:\n${ctx.pages?.map((p) => "- " + p.url + ": " + p.title).join("\n") ?? "N/A"}\nFollow the llms.txt specification. Return the file content only.`,
  NO_FAQ_SECTION: (ctx) =>
    `Generate 3-5 FAQ questions and answers based on this page content.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent: ${ctx.excerpt?.slice(0, 1500)}\nReturn as HTML <details>/<summary> elements.`,
  MISSING_SUMMARY: (ctx) =>
    `Write a 2-3 sentence executive summary for this page that an AI assistant could quote.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent: ${ctx.excerpt?.slice(0, 1500)}\nReturn plain text only.`,
  MISSING_ALT_TEXT: (ctx) =>
    `Based on the page context, suggest descriptive alt text for images on this page.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nReturn one alt text suggestion per line.`,
  MISSING_OG_TAGS: (ctx) =>
    `Generate Open Graph meta tags for this page.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent excerpt: ${ctx.excerpt?.slice(0, 1000)}\nReturn HTML <meta> tags only.`,
  MISSING_CANONICAL: (ctx) =>
    `Suggest the canonical URL for this page.\nCurrent URL: ${ctx.url}\nDomain: ${ctx.domain}\nReturn only the canonical URL.`,
  BAD_HEADING_HIERARCHY: (ctx) =>
    `Suggest an improved heading structure for this page.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent excerpt: ${ctx.excerpt?.slice(0, 1500)}\nReturn a clean H1 > H2 > H3 outline.`,
};

const ISSUE_TO_FIX_TYPE: Record<string, string> = {
  MISSING_META_DESC: "meta_description",
  MISSING_TITLE: "title_tag",
  NO_STRUCTURED_DATA: "json_ld",
  MISSING_LLMS_TXT: "llms_txt",
  NO_FAQ_SECTION: "faq_section",
  MISSING_SUMMARY: "summary_section",
  MISSING_ALT_TEXT: "alt_text",
  MISSING_OG_TAGS: "og_tags",
  MISSING_CANONICAL: "canonical",
  BAD_HEADING_HIERARCHY: "heading_structure",
};

export function createFixGeneratorService(deps: FixGeneratorDeps) {
  return {
    getSupportedIssueCodes(): string[] {
      return Object.keys(FIX_PROMPTS);
    },

    async generateFix(args: {
      userId: string;
      projectId: string;
      pageId?: string;
      issueCode: string;
      context: FixContext;
      apiKey: string;
      planLimit: number;
    }) {
      // Check plan limit
      const usedThisMonth = await deps.contentFixes.countByUserThisMonth(
        args.userId,
      );
      if (usedThisMonth >= args.planLimit) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Monthly AI fix limit reached. Upgrade your plan for more.",
        );
      }

      const promptFn = FIX_PROMPTS[args.issueCode];
      if (!promptFn) {
        throw new ServiceError(
          "UNSUPPORTED_FIX",
          422,
          `No AI fix available for issue code: ${args.issueCode}`,
        );
      }

      const client = new Anthropic({ apiKey: args.apiKey });
      const message = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: promptFn(args.context) }],
      });

      const generatedText = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      const fixType = ISSUE_TO_FIX_TYPE[args.issueCode] ?? "meta_description";

      const fix = await deps.contentFixes.create({
        userId: args.userId,
        projectId: args.projectId,
        pageId: args.pageId,
        issueCode: args.issueCode,
        fixType,
        originalContent: args.context.excerpt?.slice(0, 500),
        generatedFix: generatedText,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        model: "claude-sonnet-4-5-20250929",
      });

      return fix;
    },
  };
}
