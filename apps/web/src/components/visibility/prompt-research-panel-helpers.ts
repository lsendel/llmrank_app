import type { AIPrompt } from "@/lib/api";

export type PromptCategoryFilter =
  | "all"
  | "comparison"
  | "how-to"
  | "recommendation"
  | "review"
  | "general";

export type PromptMentionedFilter = "all" | "mentioned" | "not_mentioned";

export type PromptDifficultyFilter = "all" | "easy" | "medium" | "hard";

export const CATEGORY_COLORS: Record<string, string> = {
  comparison: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "how-to": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  recommendation:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  general: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export const PROMPT_CATEGORY_OPTIONS: Array<{
  value: PromptCategoryFilter;
  label: string;
}> = [
  { value: "all", label: "All categories" },
  { value: "comparison", label: "Comparison" },
  { value: "how-to", label: "How-to" },
  { value: "recommendation", label: "Recommendation" },
  { value: "review", label: "Review" },
  { value: "general", label: "General" },
];

export const PROMPT_MENTION_OPTIONS: Array<{
  value: PromptMentionedFilter;
  label: string;
}> = [
  { value: "all", label: "All prompts" },
  { value: "mentioned", label: "Mentioned" },
  { value: "not_mentioned", label: "Not mentioned" },
];

export const PROMPT_DIFFICULTY_OPTIONS: Array<{
  value: PromptDifficultyFilter;
  label: string;
}> = [
  { value: "all", label: "All difficulty" },
  { value: "easy", label: "Easy (0-33)" },
  { value: "medium", label: "Medium (34-66)" },
  { value: "hard", label: "Hard (67-100)" },
];

export function getDifficultyBarClassName(value: number) {
  if (value >= 70) return "bg-red-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-green-500";
}

export function getMentionedBadgeProps(mentioned: boolean | null) {
  if (mentioned === true) {
    return { label: "Yes", variant: "success" as const };
  }

  if (mentioned === false) {
    return { label: "No", variant: "outline" as const };
  }

  return { label: "Unknown", variant: "secondary" as const };
}

export function filterPromptResearchPrompts(
  prompts: AIPrompt[],
  filters: {
    categoryFilter: PromptCategoryFilter;
    mentionedFilter: PromptMentionedFilter;
    difficultyFilter: PromptDifficultyFilter;
  },
) {
  return prompts.filter((prompt) => {
    if (
      filters.categoryFilter !== "all" &&
      prompt.category !== filters.categoryFilter
    ) {
      return false;
    }

    if (filters.mentionedFilter === "all") {
      return true;
    }

    if (filters.mentionedFilter === "mentioned") {
      return Boolean(prompt.yourMentioned);
    }

    if (
      filters.mentionedFilter === "not_mentioned" &&
      prompt.yourMentioned !== false
    ) {
      return false;
    }

    if (filters.difficultyFilter === "all" || prompt.difficulty == null) {
      return true;
    }

    if (filters.difficultyFilter === "easy") {
      return prompt.difficulty <= 33;
    }

    if (filters.difficultyFilter === "medium") {
      return prompt.difficulty > 33 && prompt.difficulty <= 66;
    }

    if (filters.difficultyFilter === "hard") {
      return prompt.difficulty > 66;
    }

    return true;
  });
}

export function buildPromptResearchCsv(prompts: AIPrompt[]) {
  const escape = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const headers = [
    "Prompt",
    "Category",
    "EstimatedVolume",
    "Difficulty",
    "Intent",
    "DiscoveredAt",
  ];
  const rows = prompts.map((prompt) => [
    prompt.prompt,
    prompt.category,
    prompt.estimatedVolume,
    prompt.difficulty,
    prompt.intent,
    prompt.discoveredAt,
  ]);

  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function buildPromptResearchCsvFilename(
  projectId: string,
  date = new Date(),
) {
  return `prompt-research-${projectId}-${date.toISOString().slice(0, 10)}.csv`;
}
