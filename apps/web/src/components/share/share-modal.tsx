"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { api, type ShareInfo, ApiError } from "@/lib/api";
import {
  Loader2,
  Copy,
  Check,
  Link2,
  ShieldAlert,
  Globe,
  ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crawlId: string;
}

type ShareLevel = "summary" | "issues" | "full";
type ExpiryOption = "permanent" | "7" | "30" | "90";

const LEVEL_DESCRIPTIONS: Record<
  ShareLevel,
  { label: string; description: string }
> = {
  summary: {
    label: "Summary Only",
    description:
      "Overall score, letter grade, and category breakdown. No page-level details.",
  },
  issues: {
    label: "Summary + Issues",
    description:
      "Everything in Summary, plus the list of issues found and quick wins.",
  },
  full: {
    label: "Full Report",
    description:
      "Complete report including all pages, detailed scores, and recommendations.",
  },
};

function expiryOptionToDate(option: ExpiryOption): string | null {
  if (option === "permanent") return null;
  const days = parseInt(option, 10);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function expiryToLabel(expiresAt: string | null): string {
  if (!expiresAt) return "Permanent";
  const date = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysLeft <= 0) return "Expired";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
}

// ── Component ──────────────────────────────────────────────────────────

export function ShareModal({ open, onOpenChange, crawlId }: ShareModalProps) {
  const { toast } = useToast();

  // Shared state
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configure state
  const [level, setLevel] = useState<ShareLevel>("summary");
  const [expiry, setExpiry] = useState<ExpiryOption>("permanent");

  // Manage state
  const [updateLevel, setUpdateLevel] = useState<ShareLevel>("summary");
  const [updateExpiry, setUpdateExpiry] = useState<ExpiryOption>("permanent");
  const [updating, setUpdating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Check current share status when modal opens
  const checkShareStatus = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      // Try updating with empty settings to check if sharing is active.
      // If it succeeds, sharing is enabled and we get current info.
      const info = await api.share.update(crawlId, {});
      setShareInfo(info);
      setUpdateLevel(info.level);
    } catch (err) {
      // 400 means sharing is not enabled -- that's the expected "no share" state
      if (err instanceof ApiError && err.status === 400) {
        setShareInfo(null);
      } else {
        setError("Failed to check sharing status.");
      }
    } finally {
      setChecking(false);
    }
  }, [crawlId]);

  useEffect(() => {
    if (open) {
      checkShareStatus();
    } else {
      // Reset state when modal closes
      setShareInfo(null);
      setError(null);
      setLevel("summary");
      setExpiry("permanent");
      setConfirmRevoke(false);
      setCopiedField(null);
    }
  }, [open, checkShareStatus]);

  // ── Handlers ───────────────────────────────────────────────────────

  async function handleEnable() {
    setLoading(true);
    setError(null);
    try {
      const info = await api.share.enable(crawlId, {
        level,
        expiresAt: expiryOptionToDate(expiry),
      });
      setShareInfo(info);
      setUpdateLevel(info.level);
      toast({
        title: "Sharing enabled",
        description: "Your share link is ready.",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to enable sharing. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    setUpdating(true);
    setError(null);
    try {
      const info = await api.share.update(crawlId, {
        level: updateLevel,
        expiresAt: expiryOptionToDate(updateExpiry),
      });
      setShareInfo(info);
      setUpdateLevel(info.level);
      toast({
        title: "Settings updated",
        description: "Share settings have been updated.",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update settings. Please try again.");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    setError(null);
    try {
      await api.share.disable(crawlId);
      setShareInfo(null);
      setConfirmRevoke(false);
      toast({
        title: "Sharing disabled",
        description: "The share link has been revoked.",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to revoke sharing. Please try again.");
      }
    } finally {
      setRevoking(false);
    }
  }

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({ title: "Copied", description: "Copied to clipboard." });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  }

  // ── Derived values ─────────────────────────────────────────────────

  const shareUrl = shareInfo
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareInfo.shareToken}`
    : "";

  const badgeUrl = shareInfo
    ? `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/public/badge/${shareInfo.shareToken}.svg`
    : "";

  const htmlBadgeEmbed = shareInfo
    ? `<a href="${shareUrl}" target="_blank" rel="noopener noreferrer"><img src="${badgeUrl}" alt="AI Readiness Score" /></a>`
    : "";

  const markdownBadgeEmbed = shareInfo
    ? `[![AI Readiness Score](${badgeUrl})](${shareUrl})`
    : "";

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Share Report
          </DialogTitle>
          <DialogDescription>
            {shareInfo
              ? "Manage your public share link and badge embed code."
              : "Create a public link to share this crawl report."}
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : shareInfo ? (
          /* ── State 2: Manage (share active) ─────────────────────── */
          <div className="space-y-5">
            {/* Share URL */}
            <div className="space-y-2">
              <Label>Share URL</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono truncate">
                  {shareUrl}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(shareUrl, "url")}
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

            {/* Current settings */}
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="info">
                {LEVEL_DESCRIPTIONS[shareInfo.level].label}
              </Badge>
              <Badge variant={shareInfo.expiresAt ? "warning" : "secondary"}>
                {expiryToLabel(shareInfo.expiresAt)}
              </Badge>
            </div>

            {/* Badge embed */}
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
                    <pre className="rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {htmlBadgeEmbed}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => copyToClipboard(htmlBadgeEmbed, "html")}
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
                    <pre className="rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {markdownBadgeEmbed}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() =>
                        copyToClipboard(markdownBadgeEmbed, "markdown")
                      }
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

            {/* Update settings */}
            <div className="space-y-3 rounded-md border p-4">
              <h4 className="text-sm font-medium">Update Settings</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Level</Label>
                  <Select
                    value={updateLevel}
                    onValueChange={(v) => setUpdateLevel(v as ShareLevel)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Summary Only</SelectItem>
                      <SelectItem value="issues">Summary + Issues</SelectItem>
                      <SelectItem value="full">Full Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expiry</Label>
                  <Select
                    value={updateExpiry}
                    onValueChange={(v) => setUpdateExpiry(v as ExpiryOption)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleUpdate}
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

            {/* Revoke access */}
            <div className="border-t pt-4">
              {confirmRevoke ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      This will permanently revoke the share link. Anyone with
                      the link will no longer be able to access the report. This
                      action cannot be undone.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmRevoke(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRevoke}
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
                  onClick={() => setConfirmRevoke(true)}
                >
                  Revoke Access
                </Button>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          /* ── State 1: Configure (no active share) ───────────────── */
          <div className="space-y-5">
            {/* Level selection (button group since RadioGroup doesn't exist) */}
            <div className="space-y-2">
              <Label>Share Level</Label>
              <div className="space-y-2">
                {(Object.keys(LEVEL_DESCRIPTIONS) as ShareLevel[]).map(
                  (key) => {
                    const { label, description } = LEVEL_DESCRIPTIONS[key];
                    const isSelected = level === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLevel(key)}
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
                  },
                )}
              </div>
            </div>

            {/* Expiry selection */}
            <div className="space-y-2">
              <Label>Link Expiry</Label>
              <Select
                value={expiry}
                onValueChange={(v) => setExpiry(v as ExpiryOption)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">
                    Permanent (never expires)
                  </SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleEnable} disabled={loading}>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
