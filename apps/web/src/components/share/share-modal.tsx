"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Globe } from "lucide-react";
import { ShareModalBody } from "./share-modal-sections";
import { useShareModalState } from "./use-share-modal-state";

// ── Types ──────────────────────────────────────────────────────────────

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crawlId: string;
}

// ── Component ──────────────────────────────────────────────────────────

export function ShareModal({ open, onOpenChange, crawlId }: ShareModalProps) {
  const {
    checking,
    confirmRevoke,
    copiedField,
    error,
    expiry,
    handleCopyToClipboard,
    handleEnable,
    handleRevoke,
    handleUpdate,
    htmlBadgeEmbed,
    level,
    loading,
    markdownBadgeEmbed,
    revoking,
    setConfirmRevoke,
    setExpiry,
    setLevel,
    setUpdateExpiry,
    setUpdateLevel,
    shareInfo,
    shareUrl,
    updateExpiry,
    updateLevel,
    updating,
  } = useShareModalState({ open, crawlId });

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

        <ShareModalBody
          checking={checking}
          shareInfo={shareInfo}
          error={error}
          level={level}
          expiry={expiry}
          updateLevel={updateLevel}
          updateExpiry={updateExpiry}
          loading={loading}
          updating={updating}
          revoking={revoking}
          confirmRevoke={confirmRevoke}
          copiedField={copiedField}
          shareUrl={shareUrl}
          htmlBadgeEmbed={htmlBadgeEmbed}
          markdownBadgeEmbed={markdownBadgeEmbed}
          onLevelChange={setLevel}
          onExpiryChange={setExpiry}
          onUpdateLevelChange={setUpdateLevel}
          onUpdateExpiryChange={setUpdateExpiry}
          onEnable={handleEnable}
          onUpdate={handleUpdate}
          onConfirmRevokeChange={setConfirmRevoke}
          onRevoke={handleRevoke}
          onCancel={() => onOpenChange(false)}
          onCopy={handleCopyToClipboard}
        />
      </DialogContent>
    </Dialog>
  );
}
