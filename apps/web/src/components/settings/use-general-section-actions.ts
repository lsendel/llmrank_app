import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-hooks";
import {
  api,
  type DigestPreferences,
  type NotificationPreferences,
} from "@/lib/api";
import { useApi } from "@/lib/use-api";
import {
  getClearHistoryLabel,
  type NotificationKey,
  type ProjectOption,
  validateWebhookUrl,
} from "./general-section-helpers";

type NotificationMutator = (
  data?: NotificationPreferences,
  shouldRevalidate?: boolean,
) => Promise<unknown>;

type DigestMutator = (
  data?: DigestPreferences,
  shouldRevalidate?: boolean,
) => Promise<unknown>;

interface Props {
  mePersona?: string | null;
  notifications?: NotificationPreferences;
  mutateNotifications: NotificationMutator;
  mutateDigest: DigestMutator;
  projectsList: ProjectOption[];
}

export function useGeneralSectionActions({
  mePersona,
  notifications,
  mutateNotifications,
  mutateDigest,
  projectsList,
}: Props) {
  const { withAuth } = useApi();
  const { signOut } = useAuth();

  const [savingNotification, setSavingNotification] = useState<string | null>(
    null,
  );
  const [savingDigest, setSavingDigest] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [webhookInput, setWebhookInput] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookSuccess, setWebhookSuccess] = useState(false);
  const [persona, setPersona] = useState<string | null>(null);
  const [savingPersona, setSavingPersona] = useState(false);
  const [clearTarget, setClearTarget] = useState("all");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  useEffect(() => {
    setPersona(mePersona ?? null);
  }, [mePersona]);

  useEffect(() => {
    if (notifications?.webhookUrl) {
      setWebhookInput(notifications.webhookUrl);
    }
  }, [notifications?.webhookUrl]);

  async function handlePersonaChange(value: string) {
    setSavingPersona(true);
    const previous = persona;
    setPersona(value);
    try {
      await api.account.updateProfile({ persona: value });
    } catch {
      setPersona(previous);
    } finally {
      setSavingPersona(false);
    }
  }

  async function handleToggleNotification(key: NotificationKey) {
    if (!notifications) return;

    const newValue = !notifications[key];
    setSavingNotification(key);
    await mutateNotifications({ ...notifications, [key]: newValue }, false);

    try {
      await api.account.updateNotifications({ [key]: newValue });
      await mutateNotifications();
    } catch (error) {
      await mutateNotifications({ ...notifications, [key]: !newValue }, false);
      console.error("Failed to save notification preference:", error);
    } finally {
      setSavingNotification(null);
    }
  }

  async function handleDigestFrequencyChange(value: string) {
    setSavingDigest(true);
    try {
      await api.account.updateDigestPreferences({ digestFrequency: value });
      await mutateDigest();
    } catch (error) {
      console.error("Failed to update digest frequency:", error);
    } finally {
      setSavingDigest(false);
    }
  }

  async function handleDigestDayChange(value: string) {
    setSavingDigest(true);
    try {
      await api.account.updateDigestPreferences({ digestDay: Number(value) });
      await mutateDigest();
    } catch (error) {
      console.error("Failed to update digest day:", error);
    } finally {
      setSavingDigest(false);
    }
  }

  function handleWebhookInputChange(value: string) {
    setWebhookInput(value);
    setWebhookError(null);
    setWebhookSuccess(false);
  }

  async function handleSaveWebhook() {
    setWebhookError(null);
    setWebhookSuccess(false);

    const url = webhookInput.trim();
    const validationError = validateWebhookUrl(url);
    if (validationError) {
      setWebhookError(validationError);
      return;
    }

    setSavingWebhook(true);
    try {
      await api.account.updateNotifications({ webhookUrl: url || null });
      await mutateNotifications();
      setWebhookSuccess(true);
    } catch (error) {
      setWebhookError(
        error instanceof Error ? error.message : "Failed to save webhook URL",
      );
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleRemoveWebhook() {
    setSavingWebhook(true);
    setWebhookError(null);
    try {
      await api.account.updateNotifications({ webhookUrl: null });
      setWebhookInput("");
      await mutateNotifications();
      setWebhookSuccess(true);
    } catch {
      setWebhookError("Failed to remove webhook URL");
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleClearHistory() {
    setClearing(true);
    setClearResult(null);
    try {
      const projectId = clearTarget === "all" ? undefined : clearTarget;
      const result = await api.crawls.deleteHistory(projectId);
      const label = getClearHistoryLabel(clearTarget, projectsList);
      setClearResult(
        `Deleted ${result.deleted} crawl${result.deleted === 1 ? "" : "s"} from ${label}.`,
      );
      setClearDialogOpen(false);
    } catch (error) {
      setClearResult(
        error instanceof Error ? error.message : "Failed to clear history",
      );
    } finally {
      setClearing(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await withAuth(async () => {
        await api.account.deleteAccount();
      });
      await signOut();
    } catch (error) {
      console.error(error);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  return {
    savingNotification,
    savingDigest,
    deleteDialogOpen,
    deleting,
    webhookInput,
    savingWebhook,
    webhookError,
    webhookSuccess,
    persona,
    savingPersona,
    clearTarget,
    clearDialogOpen,
    clearing,
    clearResult,
    setDeleteDialogOpen,
    setClearTarget,
    setClearDialogOpen,
    handlePersonaChange,
    handleToggleNotification,
    handleDigestFrequencyChange,
    handleDigestDayChange,
    handleWebhookInputChange,
    handleSaveWebhook,
    handleRemoveWebhook,
    handleClearHistory,
    handleDeleteAccount,
  };
}
