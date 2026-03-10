import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { ShareInfo } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  expiryToLabel,
  EXPIRY_OPTIONS,
  LEVEL_DESCRIPTIONS,
  SHARE_LEVELS,
  type ExpiryOption,
  type ShareLevel,
} from "./share-modal-helpers";

export function ShareModalBody({
  checking,
  shareInfo,
  error,
  level,
  expiry,
  updateLevel,
  updateExpiry,
  loading,
  updating,
  revoking,
  confirmRevoke,
  copiedField,
  shareUrl,
  htmlBadgeEmbed,
  markdownBadgeEmbed,
  onLevelChange,
  onExpiryChange,
  onUpdateLevelChange,
  onUpdateExpiryChange,
  onEnable,
  onUpdate,
  onConfirmRevokeChange,
  onRevoke,
  onCancel,
  onCopy,
}: {
  checking: boolean;
  shareInfo: ShareInfo | null;
  error: string | null;
  level: ShareLevel;
  expiry: ExpiryOption;
  updateLevel: ShareLevel;
  updateExpiry: ExpiryOption;
  loading: boolean;
  updating: boolean;
  revoking: boolean;
  confirmRevoke: boolean;
  copiedField: string | null;
  shareUrl: string;
  htmlBadgeEmbed: string;
  markdownBadgeEmbed: string;
  onLevelChange: (value: ShareLevel) => void;
  onExpiryChange: (value: ExpiryOption) => void;
  onUpdateLevelChange: (value: ShareLevel) => void;
  onUpdateExpiryChange: (value: ExpiryOption) => void;
  onEnable: () => Promise<void>;
  onUpdate: () => Promise<void>;
  onConfirmRevokeChange: (value: boolean) => void;
  onRevoke: () => Promise<void>;
  onCancel: () => void;
  onCopy: (text: string, field: string) => Promise<void>;
}) {
  if (checking) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (shareInfo) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Share URL</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
              {shareUrl}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onCopy(shareUrl, "url")}
              title="Copy share URL"
            >
              {copiedField === "url" ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="icon" asChild>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open share link"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Badge variant="info">
            {LEVEL_DESCRIPTIONS[shareInfo.level].label}
          </Badge>
          <Badge variant={shareInfo.expiresAt ? "warning" : "secondary"}>
            {expiryToLabel(shareInfo.expiresAt)}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label>Badge Embed Code</Label>
          <Tabs defaultValue="html" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="html" className="flex-1">
                HTML
              </TabsTrigger>
              <TabsTrigger value="markdown" className="flex-1">
                Markdown
              </TabsTrigger>
            </TabsList>
            <TabsContent value="html">
              <div className="relative">
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono">
                  {htmlBadgeEmbed}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1"
                  onClick={() => onCopy(htmlBadgeEmbed, "html")}
                >
                  {copiedField === "html" ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="markdown">
              <div className="relative">
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono">
                  {markdownBadgeEmbed}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1"
                  onClick={() => onCopy(markdownBadgeEmbed, "markdown")}
                >
                  {copiedField === "markdown" ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <h4 className="text-sm font-medium">Update Settings</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Level</Label>
              <Select
                value={updateLevel}
                onValueChange={(value) =>
                  onUpdateLevelChange(value as ShareLevel)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_LEVELS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEVEL_DESCRIPTIONS[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expiry</Label>
              <Select
                value={updateExpiry}
                onValueChange={(value) =>
                  onUpdateExpiryChange(value as ExpiryOption)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label.replace(" (never expires)", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onUpdate}
            disabled={updating}
            className="w-full"
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Settings"
            )}
          </Button>
        </div>

        <div className="border-t pt-4">
          {confirmRevoke ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This will permanently revoke the share link. Anyone with the
                  link will no longer be able to access the report. This action
                  cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConfirmRevokeChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onRevoke}
                  disabled={revoking}
                  className="flex-1"
                >
                  {revoking ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    "Confirm Revoke"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => onConfirmRevokeChange(true)}
            >
              Revoke Access
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Share Level</Label>
        <div className="space-y-2">
          {SHARE_LEVELS.map((value) => {
            const { label, description } = LEVEL_DESCRIPTIONS[value];
            const isSelected = level === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => onLevelChange(value)}
                className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    }`}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <p className="mt-1 ml-5 text-xs text-muted-foreground">
                  {description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Link Expiry</Label>
        <Select
          value={expiry}
          onValueChange={(value) => onExpiryChange(value as ExpiryOption)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPIRY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onEnable} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Generate Link
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}
