import { eq, and } from "drizzle-orm";

export interface PromptTemplate {
  system: string;
  user: string;
  model: string;
  config?: { maxTokens?: number; temperature?: number };
}

export interface ResolvedPrompt extends PromptTemplate {
  promptId: string | null;
}

/**
 * Schema shape for the prompt_templates table.
 * Accepts any Drizzle table reference that has the required columns,
 * so the llm package does not need a direct dependency on @llm-boost/db.
 */
export interface PromptTemplatesTable {
  slug: any;
  status: any;
  systemPrompt: any;
  userPromptTemplate: any;
  model: any;
  modelConfig: any;
  id: any;
}

/**
 * Resolves prompts at runtime by checking the DB for an active versioned
 * template, falling back to hardcoded defaults when the DB is unavailable
 * or no active row exists for the given slug.
 */
export class PromptResolver {
  constructor(
    private db: any,
    private schema: PromptTemplatesTable,
    private fallbacks: Map<string, PromptTemplate>,
  ) {}

  async resolve(
    slug: string,
    variables: Record<string, string>,
  ): Promise<ResolvedPrompt> {
    try {
      const [row] = await this.db
        .select()
        .from(this.schema)
        .where(
          and(eq(this.schema.slug, slug), eq(this.schema.status, "active")),
        )
        .limit(1);

      if (row) {
        return {
          system: this.interpolate(row.systemPrompt, variables),
          user: this.interpolate(row.userPromptTemplate, variables),
          model: row.model,
          config: row.modelConfig ?? {},
          promptId: row.id,
        };
      }
    } catch (err) {
      console.warn(
        `PromptResolver: DB lookup failed for "${slug}", using fallback`,
        err,
      );
    }

    const fallback = this.fallbacks.get(slug);
    if (!fallback) {
      throw new Error(
        `No prompt found for slug "${slug}" (no DB row, no fallback)`,
      );
    }

    return {
      system: this.interpolate(fallback.system, variables),
      user: this.interpolate(fallback.user, variables),
      model: fallback.model,
      config: fallback.config ?? {},
      promptId: null,
    };
  }

  private interpolate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => variables[key] ?? `{{${key}}}`,
    );
  }
}
