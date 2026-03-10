import type { ReactNode } from "react";
import { normalizeDomain } from "@llm-boost/shared";
import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiTokenInfo, ApiTokenWithPlaintext, Project } from "@/lib/api";
import {
  API_TOKEN_SCOPES,
  getTokenCreatedLabel,
  getTokenLastUsedLabel,
  resolveMcpSetupSnippets,
} from "./api-tokens-section-helpers";

export function ApiTokensLockedCard({
  onUpgrade,
}: {
  onUpgrade: () => void | Promise<void>;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Key className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h3 className="mt-4 text-lg font-semibold">
          API Access requires Pro or Agency
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Upgrade to Pro or Agency to create API tokens and integrate LLM Boost
          data into your own tools and dashboards.
        </p>
        <Button className="mt-6" onClick={onUpgrade}>
          <Zap className="h-4 w-4" />
          Upgrade to Pro
        </Button>
      </CardContent>
    </Card>
  );
}

export function ApiTokensHeader({
  tokenCount,
  maxTokens,
  children,
}: {
  tokenCount: number;
  maxTokens: number;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">API Tokens</h2>
        <p className="text-sm text-muted-foreground">
          Create tokens to access the LLM Rank API programmatically.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">
          {tokenCount} / {maxTokens} tokens
        </Badge>
        {children}
      </div>
    </div>
  );
}

export function ApiTokensCreateDialog({
  open,
  onOpenChange,
  createdToken,
  tokenType,
  tokenName,
  tokenProjectId,
  tokenScopes,
  tokenError,
  savingToken,
  tokenCopied,
  createDisabled,
  projects,
  onTokenTypeChange,
  onTokenNameChange,
  onTokenProjectChange,
  onToggleScope,
  onCreateToken,
  onResetDialog,
  onCopyToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createdToken: ApiTokenWithPlaintext | null;
  tokenType: "api" | "mcp";
  tokenName: string;
  tokenProjectId: string;
  tokenScopes: string[];
  tokenError: string | null;
  savingToken: boolean;
  tokenCopied: boolean;
  createDisabled: boolean;
  projects: Project[];
  onTokenTypeChange: (value: "api" | "mcp") => void;
  onTokenNameChange: (value: string) => void;
  onTokenProjectChange: (value: string) => void;
  onToggleScope: (scope: string) => void;
  onCreateToken: () => void | Promise<void>;
  onResetDialog: () => void;
  onCopyToken: (value: string) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={createDisabled}>
          <Plus className="h-4 w-4" />
          Create Token
        </Button>
      </DialogTrigger>
      <DialogContent
        className={
          createdToken ? "max-h-[85vh] overflow-y-auto sm:max-w-2xl" : ""
        }
      >
        {createdToken ? (
          <CreatedTokenDialogView
            createdToken={createdToken}
            tokenType={tokenType}
            tokenCopied={tokenCopied}
            onCopyToken={onCopyToken}
            onResetDialog={onResetDialog}
          />
        ) : (
          <CreateTokenDialogView
            tokenType={tokenType}
            tokenName={tokenName}
            tokenProjectId={tokenProjectId}
            tokenScopes={tokenScopes}
            tokenError={tokenError}
            savingToken={savingToken}
            projects={projects}
            onTokenTypeChange={onTokenTypeChange}
            onTokenNameChange={onTokenNameChange}
            onTokenProjectChange={onTokenProjectChange}
            onToggleScope={onToggleScope}
            onCreateToken={onCreateToken}
            onResetDialog={onResetDialog}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreatedTokenDialogView({
  createdToken,
  tokenType,
  tokenCopied,
  onCopyToken,
  onResetDialog,
}: {
  createdToken: ApiTokenWithPlaintext;
  tokenType: "api" | "mcp";
  tokenCopied: boolean;
  onCopyToken: (value: string) => void | Promise<void>;
  onResetDialog: () => void;
}) {
  const setupSnippets = resolveMcpSetupSnippets(createdToken.plaintext);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Token Created</DialogTitle>
        <DialogDescription>
          Copy this token now. It will not be shown again.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/50">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
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
              onClick={() => onCopyToken(createdToken.plaintext)}
            >
              {tokenCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {tokenType === "mcp" ? (
          <div className="space-y-3">
            <Label>Setup Instructions</Label>
            {setupSnippets.map(({ name, snippet }) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {name}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => onCopyToken(snippet)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono">
                  {snippet}
                </pre>
                {name === "Claude Code (team)" ? (
                  <p className="text-xs text-muted-foreground">
                    Creates a shared .mcp.json in your repo. Each team member
                    sets{" "}
                    <code className="text-xs">
                      export LLM_BOOST_API_TOKEN={createdToken.plaintext}
                    </code>{" "}
                    in their shell.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <Button onClick={onResetDialog}>Done</Button>
      </DialogFooter>
    </>
  );
}

function CreateTokenDialogView({
  tokenType,
  tokenName,
  tokenProjectId,
  tokenScopes,
  tokenError,
  savingToken,
  projects,
  onTokenTypeChange,
  onTokenNameChange,
  onTokenProjectChange,
  onToggleScope,
  onCreateToken,
  onResetDialog,
}: {
  tokenType: "api" | "mcp";
  tokenName: string;
  tokenProjectId: string;
  tokenScopes: string[];
  tokenError: string | null;
  savingToken: boolean;
  projects: Project[];
  onTokenTypeChange: (value: "api" | "mcp") => void;
  onTokenNameChange: (value: string) => void;
  onTokenProjectChange: (value: string) => void;
  onToggleScope: (scope: string) => void;
  onCreateToken: () => void | Promise<void>;
  onResetDialog: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Create API Token</DialogTitle>
        <DialogDescription>
          Generate a token to access the API. Choose scopes carefully.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Token Type</Label>
          <Select
            value={tokenType}
            onValueChange={(value) => onTokenTypeChange(value as "api" | "mcp")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcp">MCP Server (recommended)</SelectItem>
              <SelectItem value="api">API Token</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tokenType === "mcp"
              ? "Full access for Claude Code, Cursor, and other AI coding tools."
              : "Limited scopes for custom API integrations."}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            placeholder={
              tokenType === "mcp"
                ? "e.g. Claude Code, Cursor"
                : "e.g. CI pipeline, Dashboard integration"
            }
            value={tokenName}
            onChange={(event) => onTokenNameChange(event.target.value)}
          />
        </div>

        {tokenType === "api" ? (
          <div className="space-y-2">
            <Label>Project (optional)</Label>
            <Select value={tokenProjectId} onValueChange={onTokenProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} ({normalizeDomain(project.domain)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {tokenType === "api" ? (
          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="space-y-2">
              {API_TOKEN_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={tokenScopes.includes(scope.value)}
                    onChange={() => onToggleScope(scope.value)}
                    className="rounded border-input"
                  />
                  {scope.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {tokenError ? (
          <p className="text-sm text-destructive">{tokenError}</p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onResetDialog}>
          Cancel
        </Button>
        <Button onClick={onCreateToken} disabled={savingToken}>
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
  );
}

export function ApiTokensEmptyStateCard() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Key className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">
          No API tokens created yet. Create one to get started.
        </p>
      </CardContent>
    </Card>
  );
}

export function ApiTokensListCard({
  tokens,
  revokeTokenId,
  revokingToken,
  onRevokeDialogOpenChange,
  onRevokeToken,
}: {
  tokens: ApiTokenInfo[];
  revokeTokenId: string | null;
  revokingToken: boolean;
  onRevokeDialogOpenChange: (open: boolean, id: string) => void;
  onRevokeToken: (id: string) => void | Promise<void>;
}) {
  return (
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
                    <Badge variant="secondary" className="text-xs font-normal">
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
                    {getTokenCreatedLabel(token.createdAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getTokenLastUsedLabel(token.lastUsedAt)}
                  </span>
                </div>
              </div>

              <Dialog
                open={revokeTokenId === token.id}
                onOpenChange={(open) =>
                  onRevokeDialogOpenChange(open, token.id)
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
                      invalidate it. Any integrations using this token will stop
                      working.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => onRevokeDialogOpenChange(false, token.id)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => onRevokeToken(token.id)}
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
  );
}
