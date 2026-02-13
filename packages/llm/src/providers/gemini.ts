import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";

export async function checkGemini(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(query);
  const responseText = result.response.text();
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "gemini",
    query,
    responseText,
    ...analysis,
  };
}
