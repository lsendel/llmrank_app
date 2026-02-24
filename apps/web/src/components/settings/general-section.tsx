"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Bell,
  Shield,
  AlertTriangle,
  Mail,
  Loader2,
  Users,
  Trash2,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type NotificationPreferences,
  type DigestPreferences,
} from "@/lib/api";

export function GeneralSection() {
  const { withAuth } = useApi();
  const { signOut } = useAuth();

  const { data: notifications, mutate: mutateNotifications } =
    useApiSWR<NotificationPreferences>(
      "account-notifications",
      useCallback(() => api.account.getNotifications(), []),
    );
  const { data: digestPrefs, mutate: mutateDigest } =
    useApiSWR<DigestPreferences>(
      "account-digest",
      useCallback(() => api.account.getDigestPreferences(), []),
    );

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

  // Persona state
  const [persona, setPersona] = useState<string | null>(null);
  const [savingPersona, setSavingPersona] = useState(false);

  // Clear history state
  const [clearTarget, setClearTarget] = useState<string>("all");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const { data: projectsData } = useApiSWR(
    "settings-projects",
    useCallback(() => api.projects.list({ limit: 100 }), []),
  );
  const projectsList = projectsData?.data ?? [];

  useEffect(() => {
    api.account
      .getMe()
      .then((me) => setPersona(me.persona))
      .catch(() => {});
  }, []);

  // Sync webhook input from loaded notifications
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

  async function handleToggleNotification(
    key: "notifyOnCrawlComplete" | "notifyOnScoreDrop",
  ) {
    if (!notifications) return;
    const newValue = !notifications[key];
    setSavingNotification(key);
    // Optimistic update
    await mutateNotifications({ ...notifications, [key]: newValue }, false);
    try {
      await api.account.updateNotifications({ [key]: newValue });
      await mutateNotifications();
    } catch (err) {
      // Revert on failure
      await mutateNotifications({ ...notifications, [key]: !newValue }, false);
      console.error("Failed to save notification preference:", err);
    } finally {
      setSavingNotification(null);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await withAuth(async () => {
        await api.account.deleteAccount();
      });
      await signOut();
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  async function handleSaveWebhook() {
    setWebhookError(null);
    setWebhookSuccess(false);
    const url = webhookInput.trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
          setWebhookError("URL must use HTTPS");
          return;
        }
      } catch {
        setWebhookError("Invalid URL format");
        return;
      }
    }
    setSavingWebhook(true);
    try {
      await api.account.updateNotifications({
        webhookUrl: url || null,
      });
      await mutateNotifications();
      setWebhookSuccess(true);
    } catch (err) {
      setWebhookError(
        err instanceof Error ? err.message : "Failed to save webhook URL",
      );
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleRemoveWebhook() {
    setSavingWebhook(true);
    setWebhookError(null);
    try {
      await api.account.updateNotifications({
        webhookUrl: null,
      });
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
      const label =
        clearTarget === "all"
          ? "all projects"
          : (projectsList.find((p) => p.id === clearTarget)?.name ?? "project");
      setClearResult(
        `Deleted ${result.deleted} crawl${result.deleted === 1 ? "" : "s"} from ${label}.`,
      );
      setClearDialogOpen(false);
    } catch (err) {
      setClearResult(
        err instanceof Error ? err.message : "Failed to clear history",
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-8 pt-4">
      {/* Your Role */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Your Role</CardTitle>
          </div>
          <CardDescription>
            This determines how your dashboard is organized. Change anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={persona ?? ""}
              disabled={savingPersona}
              onValueChange={handlePersonaChange}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agency">Agency</SelectItem>
                <SelectItem value="freelancer">Freelancer</SelectItem>
                <SelectItem value="in_house">In-House</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {savingPersona && (
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Notification Preferences
            </CardTitle>
          </div>
          <CardDescription>
            Choose which email notifications you want to receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {(
            [
              {
                key: "notifyOnCrawlComplete",
                label: "Crawl Complete",
                description: "Get notified when a crawl finishes.",
              },
              {
                key: "notifyOnScoreDrop",
                label: "Score Drops",
                description:
                  "Get alerted when a project score drops by 10+ points.",
              },
            ] as const
          ).map((notification, index) => {
            const isOn = !!(notifications?.[notification.key] ?? true);
            return (
              <div key={notification.key}>
                {index > 0 && <Separator className="my-0" />}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium">{notification.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    disabled={savingNotification === notification.key}
                    onClick={() => handleToggleNotification(notification.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isOn ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isOn ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Email Digest Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Email Digest</CardTitle>
          </div>
          <CardDescription>
            Receive periodic summaries of your project scores and issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={digestPrefs?.digestFrequency ?? "off"}
              disabled={savingDigest}
              onValueChange={async (value) => {
                setSavingDigest(true);
                try {
                  await api.account.updateDigestPreferences({
                    digestFrequency: value,
                  });
                  await mutateDigest();
                } catch (err) {
                  console.error("Failed to update digest frequency:", err);
                } finally {
                  setSavingDigest(false);
                }
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {digestPrefs?.digestFrequency === "weekly" && (
            <div className="space-y-2">
              <Label>Send on</Label>
              <Select
                value={String(digestPrefs?.digestDay ?? 1)}
                disabled={savingDigest}
                onValueChange={async (value) => {
                  setSavingDigest(true);
                  try {
                    await api.account.updateDigestPreferences({
                      digestDay: Number(value),
                    });
                    await mutateDigest();
                  } catch (err) {
                    console.error("Failed to update digest day:", err);
                  } finally {
                    setSavingDigest(false);
                  }
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {savingDigest && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook URL</CardTitle>
          <CardDescription>
            Receive JSON alerts at this URL. Works with Slack incoming webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">HTTPS URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://hooks.slack.com/services/..."
              value={webhookInput}
              onChange={(e) => {
                setWebhookInput(e.target.value);
                setWebhookError(null);
                setWebhookSuccess(false);
              }}
            />
          </div>
          {webhookError && (
            <p className="text-sm text-destructive">{webhookError}</p>
          )}
          {webhookSuccess && (
            <p className="text-sm text-green-600">
              Webhook URL saved successfully.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={savingWebhook}
              onClick={handleSaveWebhook}
            >
              {savingWebhook ? "Saving..." : "Save"}
            </Button>
            {notifications?.webhookUrl && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingWebhook}
                onClick={handleRemoveWebhook}
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clear Crawl History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Clear Crawl History</CardTitle>
          </div>
          <CardDescription>
            Permanently delete crawl data for all projects or a specific
            project. This removes crawl jobs, page data, scores, and issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={clearTarget} onValueChange={setClearTarget}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Clear History
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear crawl history?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete all crawl jobs, pages, scores,
                    and issues for{" "}
                    <span className="font-medium text-foreground">
                      {clearTarget === "all"
                        ? "all projects"
                        : (projectsList.find((p) => p.id === clearTarget)
                            ?.name ?? "this project")}
                    </span>
                    . This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">
                    All crawl data will be permanently lost.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setClearDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleClearHistory}
                    disabled={clearing}
                  >
                    {clearing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {clearing ? "Deleting..." : "Yes, clear history"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {clearResult && (
            <p className="text-sm text-muted-foreground">{clearResult}</p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base text-destructive">
              Danger Zone
            </CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that will permanently affect your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account, all projects, and crawl data.
              </p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete
                    your account, all projects, crawl history, and associated
                    data.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">
                    All data will be permanently lost.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Yes, delete my account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
