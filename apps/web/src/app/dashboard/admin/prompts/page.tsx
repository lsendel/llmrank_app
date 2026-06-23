"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PromptEditor } from "@/components/admin/prompt-editor";
import { PromptVersionHistory } from "@/components/admin/prompt-version-history";
import type { PromptTemplate } from "@/components/admin/prompt-editor";
import { apiClient } from "@/lib/api/core/client";

interface ApiEnvelope<T> {
  data: T;
}

const CATEGORY_ORDER = [
  "scoring",
  "fix",
  "narrative",
  "discovery",
  "optimization",
];

export default function AdminPromptsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(
    null,
  );
  const [versions, setVersions] = useState<PromptTemplate[]>([]);
  const categoryFilter = searchParams.get("category") ?? "all";

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const res =
        await apiClient.get<
          ApiEnvelope<PromptTemplate[] | Record<string, PromptTemplate[]>>
        >("/api/admin/prompts");

      const data = Array.isArray(res.data)
        ? res.data
        : Object.values(res.data ?? {}).flat();

      setPrompts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  async function selectPrompt(prompt: PromptTemplate) {
    setSelectedPrompt(prompt);
    try {
      const res = await apiClient.get<ApiEnvelope<PromptTemplate[]>>(
        `/api/admin/prompts/history/${prompt.slug}`,
      );
      setVersions(res.data);
    } catch {
      setVersions([prompt]);
    }
  }

  async function handleSave(data: {
    systemPrompt: string;
    userPromptTemplate: string;
    model: string;
    description: string;
  }) {
    if (!selectedPrompt) return;
    const variables = [
      ...(data.userPromptTemplate.match(/\{\{(\w+)\}\}/g) ?? []),
    ].map((value) => value.replace(/[{}]/g, ""));
    const res = await apiClient.post<ApiEnvelope<PromptTemplate>>(
      `/api/admin/prompts/${selectedPrompt.slug}/versions`,
      {
        ...data,
        name: selectedPrompt.name,
        category: selectedPrompt.category,
        variables: Array.from(new Set(variables)),
      },
    );
    setSelectedPrompt(res.data);
    await loadPrompts();
    await selectPrompt(res.data);
  }

  async function handleActivate() {
    if (!selectedPrompt) return;
    await apiClient.post(`/api/admin/prompts/${selectedPrompt.id}/activate`);
    await loadPrompts();
    if (selectedPrompt) await selectPrompt(selectedPrompt);
  }

  async function handleArchive() {
    if (!selectedPrompt) return;
    await apiClient.post(`/api/admin/prompts/${selectedPrompt.id}/archive`);
    await loadPrompts();
    if (selectedPrompt) await selectPrompt(selectedPrompt);
  }

  const visiblePrompts = useMemo(
    () =>
      categoryFilter === "all"
        ? prompts
        : prompts.filter((prompt) => prompt.category === categoryFilter),
    [categoryFilter, prompts],
  );

  const availableCategories = useMemo(
    () =>
      Array.from(new Set(prompts.map((prompt) => prompt.category))).sort(
        (left, right) => {
          const leftIndex = CATEGORY_ORDER.indexOf(left);
          const rightIndex = CATEGORY_ORDER.indexOf(right);
          if (leftIndex === -1 && rightIndex === -1) {
            return left.localeCompare(right);
          }
          if (leftIndex === -1) return 1;
          if (rightIndex === -1) return -1;
          return leftIndex - rightIndex;
        },
      ),
    [prompts],
  );

  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const items = visiblePrompts.filter((p) => p.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {} as Record<string, PromptTemplate[]>,
  );

  for (const prompt of visiblePrompts) {
    if (!CATEGORY_ORDER.includes(prompt.category)) {
      if (!grouped[prompt.category]) grouped[prompt.category] = [];
      if (!grouped[prompt.category].find((p) => p.id === prompt.id)) {
        grouped[prompt.category].push(prompt);
      }
    }
  }

  if (selectedPrompt) {
    return (
      <div className="space-y-6 p-6">
        <button
          onClick={() => {
            setSelectedPrompt(null);
            setVersions([]);
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to prompts
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
          <PromptEditor
            prompt={selectedPrompt}
            onSave={handleSave}
            onActivate={handleActivate}
            onArchive={handleArchive}
          />
          <PromptVersionHistory
            versions={versions}
            currentId={selectedPrompt.id}
            onSelect={(id) => {
              const v = versions.find((p) => p.id === id);
              if (v) setSelectedPrompt(v);
            }}
            onActivate={async (id) => {
              await apiClient.post(`/api/admin/prompts/${id}/activate`);
              await loadPrompts();
              if (selectedPrompt) await selectPrompt(selectedPrompt);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Prompt Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage LLM prompt templates with version control and testing.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={categoryFilter === "all" ? "default" : "outline"}
            onClick={() => router.replace("/dashboard/admin/prompts")}
          >
            All
          </Button>
          {availableCategories.map((category) => (
            <Button
              key={category}
              size="sm"
              variant={categoryFilter === category ? "default" : "outline"}
              onClick={() =>
                router.replace(
                  `/dashboard/admin/prompts?category=${encodeURIComponent(category)}`,
                )
              }
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          No prompts found for this category.
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {category} ({items.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((prompt) => (
                <div
                  key={prompt.id}
                  className="rounded-lg border p-4 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => selectPrompt(prompt)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{prompt.name}</span>
                    <Badge
                      variant={
                        prompt.status === "active" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {prompt.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {prompt.slug}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{prompt.model}</span>
                    <span>·</span>
                    <span>v{prompt.version}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
