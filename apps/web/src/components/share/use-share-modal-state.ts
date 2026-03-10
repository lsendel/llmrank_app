"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type ShareInfo } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  buildShareAssets,
  expiryOptionToDate,
  type ExpiryOption,
  type ShareLevel,
} from "./share-modal-helpers";

export function useShareModalState({
  open,
  crawlId,
}: {
  open: boolean;
  crawlId: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<ShareLevel>("summary");
  const [expiry, setExpiry] = useState<ExpiryOption>("permanent");
  const [updateLevel, setUpdateLevel] = useState<ShareLevel>("summary");
  const [updateExpiry, setUpdateExpiry] = useState<ExpiryOption>("permanent");
  const [updating, setUpdating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const checkShareStatus = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const info = await api.share.update(crawlId, {});
      setShareInfo(info);
      setUpdateLevel(info.level);
    } catch (err) {
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
      void checkShareStatus();
    } else {
      setShareInfo(null);
      setError(null);
      setLevel("summary");
      setExpiry("permanent");
      setConfirmRevoke(false);
      setCopiedField(null);
    }
  }, [open, checkShareStatus]);

  const { shareUrl, badgeUrl, htmlBadgeEmbed, markdownBadgeEmbed } = useMemo(
    () =>
      buildShareAssets(shareInfo, {
        origin: typeof window !== "undefined" ? window.location.origin : "",
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
      }),
    [shareInfo],
  );

  const handleEnable = useCallback(async () => {
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
  }, [crawlId, expiry, level, toast]);

  const handleUpdate = useCallback(async () => {
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
  }, [crawlId, toast, updateExpiry, updateLevel]);

  const handleRevoke = useCallback(async () => {
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
  }, [crawlId, toast]);

  const handleCopyToClipboard = useCallback(
    async (text: string, field: string) => {
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
    },
    [toast],
  );

  return {
    badgeUrl,
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
  };
}
