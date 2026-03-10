import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ApiTokensCreateDialog,
  ApiTokensEmptyStateCard,
  ApiTokensHeader,
  ApiTokensListCard,
  ApiTokensLockedCard,
} from "./api-tokens-section-sections";

describe("api tokens section sections", () => {
  it("renders locked-state and empty-state cards", () => {
    const onUpgrade = vi.fn();

    render(
      <>
        <ApiTokensLockedCard onUpgrade={onUpgrade} />
        <ApiTokensEmptyStateCard />
      </>,
    );

    expect(
      screen.getByText(/API Access requires Pro or Agency/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/No API tokens created yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Upgrade to Pro/i }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("renders header, create dialog, and revoke list states", () => {
    const onCreateToken = vi.fn();
    const onResetDialog = vi.fn();
    const onCopyToken = vi.fn();
    const onToggleScope = vi.fn();
    const onRevokeToken = vi.fn();
    const onRevokeDialogOpenChange = vi.fn();

    render(
      <>
        <ApiTokensHeader tokenCount={1} maxTokens={5}>
          <ApiTokensCreateDialog
            open
            onOpenChange={vi.fn()}
            createdToken={null}
            tokenType="api"
            tokenName="CI token"
            tokenProjectId="proj-1"
            tokenScopes={["metrics:read"]}
            tokenError={null}
            savingToken={false}
            tokenCopied={false}
            createDisabled={false}
            projects={[
              {
                id: "proj-1",
                name: "Main Site",
                domain: "https://example.com",
              },
            ]}
            onTokenTypeChange={vi.fn()}
            onTokenNameChange={vi.fn()}
            onTokenProjectChange={vi.fn()}
            onToggleScope={onToggleScope}
            onCreateToken={onCreateToken}
            onResetDialog={onResetDialog}
            onCopyToken={onCopyToken}
          />
        </ApiTokensHeader>
        <ApiTokensListCard
          tokens={[
            {
              id: "tok-1",
              name: "Primary token",
              prefix: "llmb",
              type: "api",
              scopes: ["metrics:read"],
              projectId: null,
              lastUsedAt: null,
              createdAt: "2026-03-07T12:00:00.000Z",
              expiresAt: null,
            },
          ]}
          revokeTokenId="tok-1"
          revokingToken={false}
          onRevokeDialogOpenChange={onRevokeDialogOpenChange}
          onRevokeToken={onRevokeToken}
        />
      </>,
    );

    expect(screen.getByText("1 / 5 tokens")).toBeInTheDocument();
    expect(screen.getByText("Create API Token")).toBeInTheDocument();
    expect(screen.getByText("Primary token")).toBeInTheDocument();
    expect(screen.getByText("metrics:read")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Metrics (read)"));
    expect(onToggleScope).toHaveBeenCalledWith("metrics:read");

    const createButtons = screen.getAllByRole("button", {
      name: "Create Token",
      hidden: true,
    });
    const cancelButtons = screen.getAllByRole("button", {
      name: "Cancel",
      hidden: true,
    });

    fireEvent.click(createButtons[createButtons.length - 1]!);
    fireEvent.click(cancelButtons[0]!);
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, revoke token", hidden: true }),
    );

    expect(onCreateToken).toHaveBeenCalledTimes(1);
    expect(onResetDialog).toHaveBeenCalledTimes(1);
    expect(onRevokeToken).toHaveBeenCalledWith("tok-1");
  });

  it("renders created-token setup instructions", () => {
    const onCopyToken = vi.fn();

    render(
      <ApiTokensCreateDialog
        open
        onOpenChange={vi.fn()}
        createdToken={{
          id: "tok-created",
          name: "Claude Code",
          prefix: "llmb",
          type: "mcp",
          scopes: [],
          projectId: null,
          lastUsedAt: null,
          createdAt: "2026-03-07T12:00:00.000Z",
          expiresAt: null,
          plaintext: "tok_live_created",
        }}
        tokenType="mcp"
        tokenName="Claude Code"
        tokenProjectId=""
        tokenScopes={["metrics:read"]}
        tokenError={null}
        savingToken={false}
        tokenCopied={false}
        createDisabled={false}
        projects={[]}
        onTokenTypeChange={vi.fn()}
        onTokenNameChange={vi.fn()}
        onTokenProjectChange={vi.fn()}
        onToggleScope={vi.fn()}
        onCreateToken={vi.fn()}
        onResetDialog={vi.fn()}
        onCopyToken={onCopyToken}
      />,
    );

    expect(screen.getByText("Token Created")).toBeInTheDocument();
    expect(
      screen.getByText(/This token will not be shown again/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Setup Instructions")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Copy/i })[0]);
    expect(onCopyToken).toHaveBeenCalled();
  });
});
