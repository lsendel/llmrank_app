import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptEditor, type PromptTemplate } from "./prompt-editor";

vi.mock("./prompt-test-panel", () => ({
  PromptTestPanel: () => <div>Prompt Test Panel</div>,
}));

const basePrompt: PromptTemplate = {
  id: "prompt-1",
  name: "Narrative Prompt",
  slug: "narrative_technical_analysis",
  category: "narrative",
  description: "Initial description",
  systemPrompt: "System A",
  userPromptTemplate: "User A {{reportData}}",
  variables: ["reportData"],
  model: "claude-haiku-4-5-20251001",
  modelConfig: { maxTokens: 1024 },
  version: 1,
  status: "active",
  parentId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  activatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PromptEditor", () => {
  it("resets local editor state when a different prompt version is selected", () => {
    const onSave = vi.fn();
    const onActivate = vi.fn();
    const onArchive = vi.fn();

    const { rerender } = render(
      <PromptEditor
        prompt={basePrompt}
        onSave={onSave}
        onActivate={onActivate}
        onArchive={onArchive}
      />,
    );

    expect(screen.getByDisplayValue("System A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Initial description")).toBeInTheDocument();

    rerender(
      <PromptEditor
        prompt={{
          ...basePrompt,
          id: "prompt-2",
          version: 2,
          description: "Updated description",
          systemPrompt: "System B",
          userPromptTemplate: "User B {{reportData}}",
        }}
        onSave={onSave}
        onActivate={onActivate}
        onArchive={onArchive}
      />,
    );

    expect(screen.getByDisplayValue("System B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Updated description")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("System A")).not.toBeInTheDocument();
  });
});
