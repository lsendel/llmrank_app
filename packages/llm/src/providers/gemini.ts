import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";
import { LLM_MODELS } from "../llm-config";

const REQUEST_TIMEOUT_MS = 30_000;

export async function checkGemini(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
  locale?: { region: string; language: string },
): Promise<VisibilityCheckResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const localeInstruction =
    locale && (locale.region !== "us" || locale.language !== "en")
      ? `Answer as if you are responding to a user in ${locale.region.toUpperCase()} who speaks ${locale.language}.`
      : undefined;
  const model = genAI.getGenerativeModel({
    model: LLM_MODELS.visibility.gemini,
    ...(localeInstruction && { systemInstruction: localeInstruction }),
  });

  const result = await withRetry(() =>
    withTimeout(model.generateContent(query), REQUEST_TIMEOUT_MS),
  );

  const responseText = result.response.text();
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "gemini",
    query,
    responseText,
    ...analysis,
  };
}
