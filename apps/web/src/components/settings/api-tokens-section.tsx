"use client";

import {
  ApiTokensCreateDialog,
  ApiTokensEmptyStateCard,
  ApiTokensHeader,
  ApiTokensListCard,
  ApiTokensLockedCard,
} from "./api-tokens-section-sections";
import { useApiTokensSectionState } from "./use-api-tokens-section-state";

export function ApiTokensSection() {
  const state = useApiTokensSectionState();

  if (!state.canUseTokens) {
    return (
      <div className="space-y-6 pt-4">
        <ApiTokensLockedCard onUpgrade={state.handleUpgradeToPro} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <ApiTokensHeader
        tokenCount={state.tokens.length}
        maxTokens={state.maxTokens}
      >
        <ApiTokensCreateDialog
          open={state.createTokenOpen}
          onOpenChange={state.handleCreateTokenDialogOpenChange}
          createdToken={state.createdToken}
          tokenType={state.tokenType}
          tokenName={state.tokenName}
          tokenProjectId={state.tokenProjectId}
          tokenScopes={state.tokenScopes}
          tokenError={state.tokenError}
          savingToken={state.savingToken}
          tokenCopied={state.tokenCopied}
          createDisabled={state.tokens.length >= state.maxTokens}
          projects={state.projects}
          onTokenTypeChange={state.handleTokenTypeChange}
          onTokenNameChange={state.handleTokenNameChange}
          onTokenProjectChange={state.setTokenProjectId}
          onToggleScope={state.handleToggleScope}
          onCreateToken={state.handleCreateToken}
          onResetDialog={state.resetTokenDialog}
          onCopyToken={state.handleCopyToken}
        />
      </ApiTokensHeader>

      {state.tokens.length === 0 ? (
        <ApiTokensEmptyStateCard />
      ) : (
        <ApiTokensListCard
          tokens={state.tokens}
          revokeTokenId={state.revokeTokenId}
          revokingToken={state.revokingToken}
          onRevokeDialogOpenChange={state.handleRevokeDialogOpenChange}
          onRevokeToken={state.handleRevokeToken}
        />
      )}
    </div>
  );
}
