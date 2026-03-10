import { useCallback, useState } from "react";
import {
  api,
  type ApiTokenWithPlaintext,
  type BillingInfo,
  type ApiTokenInfo,
  type PaginatedResponse,
  type Project,
} from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  API_TOKEN_SCOPES,
  canManageApiTokens,
  getMaxApiTokens,
} from "./api-tokens-section-helpers";

export function useApiTokensSectionState() {
  const { withAuth } = useApi();

  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: tokens, mutate: mutateTokens } = useApiSWR<ApiTokenInfo[]>(
    "api-tokens",
    useCallback(() => api.tokens.list(), []),
  );
  const { data: projectsData } = useApiSWR<PaginatedResponse<Project>>(
    "projects-for-tokens",
    useCallback(() => api.projects.list({ limit: 100 }), []),
  );

  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenProjectId, setTokenProjectId] = useState<string>("");
  const [tokenScopes, setTokenScopes] = useState<string[]>([
    API_TOKEN_SCOPES[0].value,
  ]);
  const [savingToken, setSavingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] =
    useState<ApiTokenWithPlaintext | null>(null);
  const [revokeTokenId, setRevokeTokenId] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenType, setTokenType] = useState<"api" | "mcp">("mcp");

  const maxTokens = getMaxApiTokens(billing?.plan);
  const canUseTokens = canManageApiTokens(billing?.plan);

  const resetTokenDialog = useCallback(() => {
    setCreateTokenOpen(false);
    setCreatedToken(null);
    setTokenName("");
    setTokenProjectId("");
    setTokenScopes([API_TOKEN_SCOPES[0].value]);
    setTokenType("mcp");
    setTokenError(null);
    setTokenCopied(false);
  }, []);

  const handleCreateTokenDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetTokenDialog();
        return;
      }

      setCreateTokenOpen(true);
    },
    [resetTokenDialog],
  );

  const handleTokenNameChange = useCallback((value: string) => {
    setTokenName(value);
    setTokenError(null);
  }, []);

  const handleTokenTypeChange = useCallback((value: "api" | "mcp") => {
    setTokenType(value);
  }, []);

  const handleToggleScope = useCallback((scope: string) => {
    setTokenScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((item) => item !== scope)
        : [...prev, scope],
    );
  }, []);

  const handleCreateToken = useCallback(async () => {
    setTokenError(null);

    if (!tokenName.trim()) {
      setTokenError("Token name is required.");
      return;
    }

    if (tokenType === "api" && tokenScopes.length === 0) {
      setTokenError("Select at least one scope.");
      return;
    }

    setSavingToken(true);
    try {
      const result = await api.tokens.create({
        name: tokenName.trim(),
        type: tokenType,
        projectId:
          tokenType === "api" && tokenProjectId && tokenProjectId !== "all"
            ? tokenProjectId
            : undefined,
        scopes: tokenType === "api" ? tokenScopes : undefined,
      });
      setCreatedToken(result);
      await mutateTokens();
    } catch (err) {
      setTokenError(
        err instanceof Error ? err.message : "Failed to create token",
      );
    } finally {
      setSavingToken(false);
    }
  }, [mutateTokens, tokenName, tokenProjectId, tokenScopes, tokenType]);

  const handleRevokeDialogOpenChange = useCallback(
    (open: boolean, id: string) => {
      setRevokeTokenId(open ? id : null);
    },
    [],
  );

  const handleRevokeToken = useCallback(
    async (id: string) => {
      setRevokingToken(true);
      try {
        await api.tokens.revoke(id);
        await mutateTokens();
        setRevokeTokenId(null);
      } catch (err) {
        console.error("Failed to revoke token:", err);
      } finally {
        setRevokingToken(false);
      }
    },
    [mutateTokens],
  );

  const handleCopyToken = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      // noop fallback; visible input/snippet can be selected manually
    }
  }, []);

  const handleUpgradeToPro = useCallback(async () => {
    try {
      await withAuth(async () => {
        const result = await api.billing.createCheckoutSession(
          "pro",
          window.location.origin + "/dashboard/settings?upgraded=true",
          window.location.origin + "/dashboard/settings",
        );
        window.location.href = result.url;
      });
    } catch (err) {
      console.error(err);
    }
  }, [withAuth]);

  return {
    canUseTokens,
    maxTokens,
    tokens: tokens ?? [],
    projects: projectsData?.data ?? [],
    createTokenOpen,
    tokenName,
    tokenProjectId,
    tokenScopes,
    savingToken,
    tokenError,
    createdToken,
    revokeTokenId,
    revokingToken,
    tokenCopied,
    tokenType,
    resetTokenDialog,
    setTokenProjectId,
    handleCreateTokenDialogOpenChange,
    handleTokenNameChange,
    handleTokenTypeChange,
    handleToggleScope,
    handleCreateToken,
    handleRevokeDialogOpenChange,
    handleRevokeToken,
    handleCopyToken,
    handleUpgradeToPro,
  };
}
