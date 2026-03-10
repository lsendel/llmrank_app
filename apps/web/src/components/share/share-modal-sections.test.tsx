import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShareModalBody } from "./share-modal-sections";

const shareInfo = {
  shareToken: "token-123",
  shareUrl: "https://llmrank.app/share/token-123",
  badgeUrl: "https://api.llmrank.app/api/public/badge/token-123.svg",
  level: "issues" as const,
  expiresAt: "2026-03-16T08:00:00.000Z",
};

describe("share modal sections", () => {
  it("renders configure state and forwards selection callbacks", () => {
    const onLevelChange = vi.fn();
    const onEnable = vi.fn(async () => undefined);
    const onCancel = vi.fn();

    render(
      <ShareModalBody
        checking={false}
        shareInfo={null}
        error={null}
        level="summary"
        expiry="permanent"
        updateLevel="summary"
        updateExpiry="permanent"
        loading={false}
        updating={false}
        revoking={false}
        confirmRevoke={false}
        copiedField={null}
        shareUrl=""
        htmlBadgeEmbed=""
        markdownBadgeEmbed=""
        onLevelChange={onLevelChange}
        onExpiryChange={vi.fn()}
        onUpdateLevelChange={vi.fn()}
        onUpdateExpiryChange={vi.fn()}
        onEnable={onEnable}
        onUpdate={vi.fn(async () => undefined)}
        onConfirmRevokeChange={vi.fn()}
        onRevoke={vi.fn(async () => undefined)}
        onCancel={onCancel}
        onCopy={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /summary \+ issues/i }));
    fireEvent.click(screen.getByRole("button", { name: /generate link/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onLevelChange).toHaveBeenCalledWith("issues");
    expect(onEnable).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders manage state and forwards copy / revoke actions", () => {
    const onCopy = vi.fn(async () => undefined);
    const onConfirmRevokeChange = vi.fn();
    const onRevoke = vi.fn(async () => undefined);

    const { rerender } = render(
      <ShareModalBody
        checking={false}
        shareInfo={shareInfo}
        error={null}
        level="summary"
        expiry="permanent"
        updateLevel="issues"
        updateExpiry="permanent"
        loading={false}
        updating={false}
        revoking={false}
        confirmRevoke={false}
        copiedField={null}
        shareUrl="https://llmrank.app/share/token-123"
        htmlBadgeEmbed="<a href='https://llmrank.app/share/token-123'>badge</a>"
        markdownBadgeEmbed="[badge](https://llmrank.app/share/token-123)"
        onLevelChange={vi.fn()}
        onExpiryChange={vi.fn()}
        onUpdateLevelChange={vi.fn()}
        onUpdateExpiryChange={vi.fn()}
        onEnable={vi.fn(async () => undefined)}
        onUpdate={vi.fn(async () => undefined)}
        onConfirmRevokeChange={onConfirmRevokeChange}
        onRevoke={onRevoke}
        onCancel={vi.fn()}
        onCopy={onCopy}
      />,
    );

    expect(screen.getByText("Share URL")).toBeInTheDocument();
    expect(screen.getAllByText("Summary + Issues").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTitle("Copy share URL"));
    fireEvent.click(screen.getByRole("button", { name: /revoke access/i }));

    expect(onCopy).toHaveBeenCalledWith(
      "https://llmrank.app/share/token-123",
      "url",
    );
    expect(onConfirmRevokeChange).toHaveBeenCalledWith(true);

    rerender(
      <ShareModalBody
        checking={false}
        shareInfo={shareInfo}
        error={null}
        level="summary"
        expiry="permanent"
        updateLevel="issues"
        updateExpiry="permanent"
        loading={false}
        updating={false}
        revoking={false}
        confirmRevoke={true}
        copiedField={null}
        shareUrl="https://llmrank.app/share/token-123"
        htmlBadgeEmbed="<a href='https://llmrank.app/share/token-123'>badge</a>"
        markdownBadgeEmbed="[badge](https://llmrank.app/share/token-123)"
        onLevelChange={vi.fn()}
        onExpiryChange={vi.fn()}
        onUpdateLevelChange={vi.fn()}
        onUpdateExpiryChange={vi.fn()}
        onEnable={vi.fn(async () => undefined)}
        onUpdate={vi.fn(async () => undefined)}
        onConfirmRevokeChange={onConfirmRevokeChange}
        onRevoke={onRevoke}
        onCancel={vi.fn()}
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm revoke/i }));
    expect(onRevoke).toHaveBeenCalled();
  });
});
