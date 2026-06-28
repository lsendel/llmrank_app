import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeSection, NarrativeSectionType } from "@llm-boost/shared";
import type { NarrativeInput, NarrativeReport, TokenUsage } from "./types";
import { getApplicableSections, generateSection } from "./sections";
import type { NarrativeResolvedPrompt } from "./prompts/runtime-prompts";
import { mergeTokenUsage } from "./utils/token-tracker";
import { SECTION_PROMPTS } from "./prompts/section-prompts";
import { BASE_SYSTEM_PROMPT } from "./prompts/base-prompt";
import { getToneAdapter } from "./prompts/tone-adapters";
import { selectDataForSection } from "./utils/data-selector";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface NarrativeEngineOptions {
  anthropicApiKey: string;
  model?: string;
  sectionPrompts?: Partial<
    Record<NarrativeSectionType, NarrativeResolvedPrompt>
  >;
}

export class NarrativeEngine {
  private client: Anthropic;
  private model: string;
  private sectionPrompts: Partial<
    Record<NarrativeSectionType, NarrativeResolvedPrompt>
  >;

  constructor(options: NarrativeEngineOptions) {
    this.client = new Anthropic({ apiKey: options.anthropicApiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.sectionPrompts = options.sectionPrompts ?? {};
  }

  async generate(input: NarrativeInput): Promise<NarrativeReport> {
    const applicableSections = getApplicableSections(input);

    const results = await Promise.allSettled(
      applicableSections.map((config) =>
        generateSection(
          this.client,
          config,
          input,
          this.model,
          this.sectionPrompts[config.type],
        ),
      ),
    );

    const sections: NarrativeSection[] = [];
    const tokenUsages: TokenUsage[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        sections.push(result.value.section);
        tokenUsages.push(result.value.tokenUsage);
      }
      // Failed sections are silently skipped — partial generation is valid
    }

    sections.sort((a, b) => a.order - b.order);

    if (sections.length === 0) {
      throw new Error("No narrative sections could be generated");
    }

    return {
      sections,
      tokenUsage: mergeTokenUsage(tokenUsages),
      generatedBy: this.model,
    };
  }

  async regenerateSection(
    sectionType: NarrativeSectionType,
    input: NarrativeInput,
    instructions?: string,
  ): Promise<NarrativeSection> {
    const config = getApplicableSections(input).find(
      (c) => c.type === sectionType,
    );
    if (!config) {
      throw new Error(
        `Section type "${sectionType}" is not applicable for this input`,
      );
    }

    const dataContext = selectDataForSection(config.type, input);
    const toneAdapter = getToneAdapter(input.tone);

    let userPrompt = `${SECTION_PROMPTS[config.type]}

Here is the data for your analysis:

${JSON.stringify(dataContext, null, 2)}`;

    const resolvedPrompt = this.sectionPrompts[config.type];
    if (resolvedPrompt?.user) {
      userPrompt = resolvedPrompt.user;
    }

    if (instructions) {
      userPrompt += `\n\nAdditional instructions from the user: ${instructions}`;
    }

    const response = await this.client.messages.create({
      model: resolvedPrompt?.model ?? this.model,
      max_tokens: resolvedPrompt?.maxTokens ?? 1024,
      system:
        resolvedPrompt?.system ?? `${BASE_SYSTEM_PROMPT}\n\n${toneAdapter}`,
      messages: [{ role: "user", content: userPrompt }],
      ...(resolvedPrompt?.temperature != null
        ? { temperature: resolvedPrompt.temperature }
        : {}),
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Fail rather than return empty content: callers replace the stored section
    // with this, so an empty/non-text response would wipe a good section.
    if (!content.trim()) {
      throw new Error("Section regeneration returned empty content");
    }

    return {
      id: crypto.randomUUID(),
      type: config.type,
      title: config.title,
      content,
      editedContent: null,
      order: config.order,
      dataContext,
    };
  }
}
