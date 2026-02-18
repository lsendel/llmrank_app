import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";
import { LLM_MODELS } from "../llm-config";

const REQUEST_TIMEOUT_MS = 30_000;

const AI_MODE_SYSTEM_INSTRUCTION = `You are a search engine providing comprehensive, well-sourced answers to user queries.
Rules:
- Always cite your sources with URLs in Markdown link format: [Source Name](https://url)
- Cite at least 3-5 different sources when possible
- Prioritize authoritative, well-known sources in the domain
- Include a "Sources:" section at the end listing all cited URLs
- Give a comprehensive, factual answer — not opinions`;

export async function checkGeminiAIMode(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: LLM_MODELS.visibility.gemini_ai_mode,
    systemInstruction: AI_MODE_SYSTEM_INSTRUCTION,
  });

  const result = await withRetry(() =>
    withTimeout(
      model.generateContent(
        `Search query: "${query}"\n\nProvide a comprehensive, well-sourced answer.`,
      ),
      REQUEST_TIMEOUT_MS,
    ),
  );

  const responseText = result.response.text();
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "gemini_ai_mode",
    query,
    responseText,
    ...analysis,
  };
}
