/**
 * Strips markdown code fences from LLM responses that wrap JSON output.
 */
export function stripFences(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}
