import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EngineModeBadge } from "./engine-mode-badge";

describe("EngineModeBadge", () => {
  it("labels recall-mode answers (citations may be unverified)", () => {
    render(<EngineModeBadge mode="recall" />);
    expect(screen.getByText("Recall")).toBeInTheDocument();
  });

  it("labels live-retrieval answers", () => {
    render(<EngineModeBadge mode="live_retrieval" />);
    expect(screen.getByText("Live web")).toBeInTheDocument();
  });

  it("renders nothing for untagged (older) rows", () => {
    const { container } = render(<EngineModeBadge mode={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when mode is undefined", () => {
    const { container } = render(<EngineModeBadge mode={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
