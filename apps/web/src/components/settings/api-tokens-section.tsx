"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  Copy,
  Key,
  Loader2,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type BillingInfo,
  type ApiTokenInfo,
  type ApiTokenWithPlaintext,
  type Project,
  type PaginatedResponse,
} from "@/lib/api";

const tokenLimits: Record<string, number> = {
  free: 0,
  starter: 0,
  pro: 5,
  agency: 20,
};

const allScopes = [
  { value: "metrics:read", label: "Metrics (read)" },
  { value: "scores:read", label: "Scores (read)" },
  { value: "visibility:read", label: "Visibility (read)" },
];

const mcpSetupSnippets = {
  "Claude Code": `claude mcp add llm-boost \\
  --env LLM_BOOST_API_TOKEN=__VALUE__ \\
  -- npx -y @llmrank.app/mcp`,
  "Cursor / Claude Desktop / Windsurf": `{
  "mcpServers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "__VALUE__"
      }
    }
  }
}`,
};

export function ApiTokensSection() {
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
  const [tokenScopes, setTokenScopes] = useState<string[]>(["metrics:read"]);
  const [savingToken, setSavingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] =
    useState<ApiTokenWithPlaintext | null>(null);
  const [revokeTokenId, setRevokeTokenId] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenType, setTokenType] = useState<"api" | "mcp">("mcp");

  const maxTokens = tokenLimits[billing?.plan ?? "free"] ?? 0;
  const canUseTokens = billing?.plan === "pro" || billing?.plan === "agency";

  function toggleScope(scope: string) {
    setTokenScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreateToken() {
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
  }

  async function handleRevokeToken(id: string) {
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
  }

  function resetTokenDialog() {
    setCreateTokenOpen(false);
    setCreatedToken(null);
    setTokenName("");
    setTokenProjectId("");
    setTokenScopes(["metrics:read"]);
    setTokenType("mcp");
    setTokenError(null);
    setTokenCopied(false);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }

  async function handleUpgradeToPro() {
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
  }

  if (!canUseTokens) {
    return (
      <div className="space-y-6 pt-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">
              API Access requires Pro or Agency
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Upgrade to Pro or Agency to create API tokens and integrate LLM
              Boost data into your own tools and dashboards.
            </p>
            <Button className="mt-6" onClick={handleUpgradeToPro}>
              <Zap className="h-4 w-4" />
              Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Token header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Tokens</h2>
          <p className="text-sm text-muted-foreground">
            Create tokens to access the LLM Boost API programmatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {tokens?.length ?? 0} / {maxTokens} tokens
          </Badge>
          <Dialog
            open={createTokenOpen}
            onOpenChange={(open) => {
              if (!open) resetTokenDialog();
              else setCreateTokenOpen(true);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" disabled={(tokens?.length ?? 0) >= maxTokens}>
                <Plus className="h-4 w-4" />
                Create Token
              </Button>
            </DialogTrigger>
            <DialogContent
              className={
                createdToken ? "sm:max-w-2xl max-h-[85vh] overflow-y-auto" : ""
              }
            >
              {createdToken ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Token Created</DialogTitle>
                    <DialogDescription>
                      Copy this token now. It will not be shown again.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/50">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        This token will not be shown again. Store it securely.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>API Token</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={createdToken.plaintext}
                          className="min-w-0 font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() =>
                            copyToClipboard(createdToken.plaintext)
                          }
                        >
                          {tokenCopied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {tokenType === "mcp" && (
                      <div className="space-y-3">
                        <Label>Setup Instructions</Label>
                        {Object.entries(mcpSetupSnippets).map(
                          ([name, snippet]) => {
                            const resolved = snippet.replace(
                              /__VALUE__/g,
                              createdToken.plaintext,
                            );
                            return (
                              <div key={name} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    {name}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-muted-foreground"
                                    onClick={() => copyToClipboard(resolved)}
                                  >
                                    <Copy className="mr-1 h-3 w-3" />
                                    Copy
                                  </Button>
                                </div>
                                <pre className="rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto">
                                  {resolved}
                                </pre>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={resetTokenDialog}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create API Token</DialogTitle>
                    <DialogDescription>
                      Generate a token to access the API. Choose scopes
                      carefully.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Token type */}
                    <div className="space-y-2">
                      <Label>Token Type</Label>
                      <Select
                        value={tokenType}
                        onValueChange={(v) => setTokenType(v as "api" | "mcp")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcp">
                            MCP Server (recommended)
                          </SelectItem>
                          <SelectItem value="api">API Token</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {tokenType === "mcp"
                          ? "Full access for Claude Code, Cursor, and other AI coding tools."
                          : "Limited scopes for custom API integrations."}
                      </p>
                    </div>

                    {/* Token name */}
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        placeholder={
                          tokenType === "mcp"
                            ? "e.g. Claude Code, Cursor"
                            : "e.g. CI pipeline, Dashboard integration"
                        }
                        value={tokenName}
                        onChange={(e) => {
                          setTokenName(e.target.value);
                          setTokenError(null);
                        }}
                      />
                    </div>

                    {/* Project selector — API tokens only */}
                    {tokenType === "api" && (
                      <div className="space-y-2">
                        <Label>Project (optional)</Label>
                        <Select
                          value={tokenProjectId}
                          onValueChange={setTokenProjectId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All projects" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All projects</SelectItem>
                            {projectsData?.data.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name} ({project.domain})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Scopes — API tokens only */}
                    {tokenType === "api" && (
                      <div className="space-y-2">
                        <Label>Scopes</Label>
                        <div className="space-y-2">
                          {allScopes.map((scope) => (
                            <label
                              key={scope.value}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={tokenScopes.includes(scope.value)}
                                onChange={() => toggleScope(scope.value)}
                                className="rounded border-input"
                              />
                              {scope.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {tokenError && (
                      <p className="text-sm text-destructive">{tokenError}</p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetTokenDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateToken} disabled={savingToken}>
                      {savingToken ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Token"
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Token list */}
      {!tokens || tokens.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No API tokens created yet. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{token.name}</p>
                      <Badge
                        variant={token.type === "mcp" ? "default" : "outline"}
                        className="text-xs"
                      >
                        {token.type === "mcp" ? "MCP" : "API"}
                      </Badge>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        {token.prefix}...
                      </code>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {token.type === "mcp" ? (
                        <Badge
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          Full access
                        </Badge>
                      ) : (
                        token.scopes.map((scope) => (
                          <Badge
                            key={scope}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {scope}
                          </Badge>
                        ))
                      )}
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(token.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {token.lastUsedAt
                          ? `Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                          : "Never used"}
                      </span>
                    </div>
                  </div>
                  <Dialog
                    open={revokeTokenId === token.id}
                    onOpenChange={(open) =>
                      setRevokeTokenId(open ? token.id : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Revoke token?</DialogTitle>
                        <DialogDescription>
                          Revoking &ldquo;{token.name}&rdquo; will immediately
                          invalidate it. Any integrations using this token will
                          stop working.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setRevokeTokenId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleRevokeToken(token.id)}
                          disabled={revokingToken}
                        >
                          {revokingToken ? "Revoking..." : "Yes, revoke token"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
