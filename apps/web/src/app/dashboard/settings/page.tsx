"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  CreditCard,
  Bell,
  Shield,
  Zap,
  AlertTriangle,
  Check,
  CheckCircle2,
  Star,
  ArrowDown,
  X,
  Plus,
  Trash2,
  Copy,
  Key,
  Mail,
  Globe,
  Hash,
  Loader2,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  type BillingInfo,
  type SubscriptionInfo,
  type PaymentRecord,
  type NotificationPreferences,
  type DigestPreferences,
  type NotificationChannel,
  type NotificationChannelType,
  type NotificationEventType,
  type ApiTokenInfo,
  type ApiTokenWithPlaintext,
  type Project,
  type PaginatedResponse,
} from "@/lib/api";

const plans = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    priceNote: "",
    popular: false,
    features: [
      "1 project",
      "10 pages per crawl",
      "2 crawls per month",
      "30-day history",
    ],
  },
  {
    tier: "starter",
    name: "Starter",
    price: "$79",
    priceNote: "/mo",
    popular: false,
    features: [
      "5 projects",
      "100 pages per crawl",
      "10 crawls per month",
      "90-day history",
      "Lighthouse analysis",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$149",
    priceNote: "/mo",
    popular: true,
    features: [
      "20 projects",
      "500 pages per crawl",
      "30 crawls per month",
      "1-year history",
      "API access",
      "GSC + PageSpeed Insights",
    ],
  },
  {
    tier: "agency",
    name: "Agency",
    price: "$299",
    priceNote: "/mo",
    popular: false,
    features: [
      "50 projects",
      "2000 pages per crawl",
      "Unlimited crawls",
      "2-year history",
      "API access",
      "Custom LLM prompts",
      "All 4 integrations",
    ],
  },
];

const planNameMap: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

export default function SettingsPage() {
  const { withAuth } = useApi();
  const { signOut } = useAuth();
  const searchParams = useSearchParams();

  const { data: billing, isLoading: loading } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: subscription, mutate: mutateSubscription } =
    useApiSWR<SubscriptionInfo | null>(
      "billing-subscription",
      useCallback(() => api.billing.getSubscription(), []),
    );
  const { data: payments } = useApiSWR<PaymentRecord[]>(
    "billing-payments",
    useCallback(() => api.billing.getPayments(), []),
  );
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
  const { data: channels, mutate: mutateChannels } = useApiSWR<
    NotificationChannel[]
  >(
    "notification-channels",
    useCallback(() => api.channels.list(), []),
  );
  const { data: tokens, mutate: mutateTokens } = useApiSWR<ApiTokenInfo[]>(
    "api-tokens",
    useCallback(() => api.tokens.list(), []),
  );
  const { data: projectsData } = useApiSWR<PaginatedResponse<Project>>(
    "projects-for-tokens",
    useCallback(() => api.projects.list({ limit: 100 }), []),
  );

  const [savingNotification, setSavingNotification] = useState<string | null>(
    null,
  );
  const [savingDigest, setSavingDigest] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookSuccess, setWebhookSuccess] = useState(false);

  // Notification channels state
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [channelType, setChannelType] =
    useState<NotificationChannelType>("email");
  const [channelConfigValue, setChannelConfigValue] = useState("");
  const [channelEventTypes, setChannelEventTypes] = useState<
    NotificationEventType[]
  >(["crawl_completed"]);
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [togglingChannelId, setTogglingChannelId] = useState<string | null>(
    null,
  );

  // API tokens state
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

  // Persona state
  const [persona, setPersona] = useState<string | null>(null);
  const [savingPersona, setSavingPersona] = useState(false);

  useEffect(() => {
    api.account
      .getMe()
      .then((me) => setPersona(me.persona))
      .catch(() => {});
  }, []);

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

  // Sync webhook input from loaded notifications
  useEffect(() => {
    if (notifications?.webhookUrl) {
      setWebhookInput(notifications.webhookUrl);
    }
  }, [notifications?.webhookUrl]);

  // Show success banner after Stripe checkout redirect
  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      setSuccessBanner(
        "Your plan has been upgraded successfully! Your new features are now active.",
      );
      // Clean URL without triggering navigation
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [searchParams]);

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      await withAuth(async () => {
        await api.billing.cancelSubscription();
      });
      setCancelDialogOpen(false);
      setDowngradeDialogOpen(false);
      await mutateSubscription();
    } catch (err) {
      console.error(err);
    } finally {
      setCanceling(false);
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

  async function handlePlanAction(planTier: string) {
    const isDowngradeToFree = planTier === "free";

    // Downgrading to Free = cancel subscription
    if (isDowngradeToFree && subscription) {
      setDowngradeDialogOpen(true);
      return;
    }

    // All other cases: Stripe checkout
    setUpgrading(planTier);
    try {
      await withAuth(async () => {
        const result = await api.billing.createCheckoutSession(
          planTier,
          window.location.origin + "/dashboard/settings?upgraded=true",
          window.location.origin + "/dashboard/settings",
        );
        window.location.href = result.url;
      });
    } catch (err) {
      console.error(err);
      setUpgrading(null);
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

  // ── Channel helpers ───────────────────────────────────────────────
  const channelLimits: Record<string, number> = {
    free: 1,
    starter: 3,
    pro: 10,
    agency: 25,
  };
  const maxChannels = channelLimits[billing?.plan ?? "free"] ?? 1;

  const allEventTypes: { value: NotificationEventType; label: string }[] = [
    { value: "crawl_completed", label: "Crawl Completed" },
    { value: "score_drop", label: "Score Drop" },
    { value: "mention_gained", label: "Mention Gained" },
    { value: "mention_lost", label: "Mention Lost" },
    { value: "position_changed", label: "Position Changed" },
  ];

  function toggleEventType(et: NotificationEventType) {
    setChannelEventTypes((prev) =>
      prev.includes(et) ? prev.filter((e) => e !== et) : [...prev, et],
    );
  }

  async function handleCreateChannel() {
    setChannelError(null);
    const val = channelConfigValue.trim();
    if (!val) {
      setChannelError("Please provide a value.");
      return;
    }
    if (channelType === "email" && !val.includes("@")) {
      setChannelError("Please enter a valid email address.");
      return;
    }
    if (
      (channelType === "webhook" || channelType === "slack_incoming") &&
      !val.startsWith("https://")
    ) {
      setChannelError("URL must start with https://");
      return;
    }
    if (channelEventTypes.length === 0) {
      setChannelError("Select at least one event type.");
      return;
    }
    setSavingChannel(true);
    try {
      const configKey = channelType === "email" ? "email" : "url";
      await api.channels.create({
        type: channelType,
        config: { [configKey]: val },
        eventTypes: channelEventTypes,
      });
      await mutateChannels();
      setAddChannelOpen(false);
      setChannelConfigValue("");
      setChannelType("email");
      setChannelEventTypes(["crawl_completed"]);
    } catch (err) {
      setChannelError(
        err instanceof Error ? err.message : "Failed to create channel",
      );
    } finally {
      setSavingChannel(false);
    }
  }

  async function handleToggleChannel(channel: NotificationChannel) {
    setTogglingChannelId(channel.id);
    try {
      await api.channels.update(channel.id, { enabled: !channel.enabled });
      await mutateChannels();
    } catch (err) {
      console.error("Failed to toggle channel:", err);
    } finally {
      setTogglingChannelId(null);
    }
  }

  async function handleDeleteChannel(id: string) {
    setDeletingChannelId(id);
    try {
      await api.channels.delete(id);
      await mutateChannels();
    } catch (err) {
      console.error("Failed to delete channel:", err);
    } finally {
      setDeletingChannelId(null);
    }
  }

  // ── Token helpers ──────────────────────────────────────────────────
  const tokenLimits: Record<string, number> = {
    free: 0,
    starter: 0,
    pro: 5,
    agency: 20,
  };
  const maxTokens = tokenLimits[billing?.plan ?? "free"] ?? 0;
  const canUseTokens = billing?.plan === "pro" || billing?.plan === "agency";

  const allScopes = [
    { value: "metrics:read", label: "Metrics (read)" },
    { value: "scores:read", label: "Scores (read)" },
    { value: "visibility:read", label: "Visibility (read)" },
  ];

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
    if (tokenScopes.length === 0) {
      setTokenError("Select at least one scope.");
      return;
    }
    setSavingToken(true);
    try {
      const result = await api.tokens.create({
        name: tokenName.trim(),
        projectId:
          tokenProjectId && tokenProjectId !== "all"
            ? tokenProjectId
            : undefined,
        scopes: tokenScopes,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  const currentTier = billing?.plan ?? "free";
  const currentPlanName = planNameMap[currentTier] ?? "Free";
  const crawlsTotal = billing?.crawlCreditsTotal ?? 0;
  const creditsRemaining = Math.min(
    billing?.crawlCreditsRemaining ?? 0,
    crawlsTotal,
  );
  const crawlsUsed = Math.max(0, crawlsTotal - creditsRemaining);
  const creditsPercentUsed =
    crawlsTotal > 0
      ? Math.min(100, Math.max(0, (crawlsUsed / crawlsTotal) * 100))
      : 0;
  const currentTierIndex = plans.findIndex((p) => p.tier === currentTier);

  return (
    <div className="space-y-8">
      {/* Success banner after upgrade */}
      {successBanner && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{successBanner}</p>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-green-600 hover:text-green-800 dark:text-green-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, plan, and notification preferences.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api-tokens">API Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8 pt-4">
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
                        <p className="text-sm font-medium">
                          {notification.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {notification.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        disabled={savingNotification === notification.key}
                        onClick={() =>
                          handleToggleNotification(notification.key)
                        }
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
                Receive JSON alerts at this URL. Works with Slack incoming
                webhooks.
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
                  onClick={async () => {
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
                        err instanceof Error
                          ? err.message
                          : "Failed to save webhook URL",
                      );
                    } finally {
                      setSavingWebhook(false);
                    }
                  }}
                >
                  {savingWebhook ? "Saving..." : "Save"}
                </Button>
                {notifications?.webhookUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingWebhook}
                    onClick={async () => {
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
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
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
                    Permanently delete your account, all projects, and crawl
                    data.
                  </p>
                </div>
                <Dialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Are you absolutely sure?</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. This will permanently
                        delete your account, all projects, crawl history, and
                        associated data.
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
        </TabsContent>

        <TabsContent value="billing" className="space-y-8 pt-4">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Current Plan</CardTitle>
              </div>
              <CardDescription>
                You are on the{" "}
                <span className="font-semibold text-foreground">
                  {currentPlanName}
                </span>{" "}
                plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Credits */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Crawl Credits</span>
                  <span className="font-medium">
                    {creditsRemaining} of {crawlsTotal} remaining
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${creditsPercentUsed}%` }}
                  />
                </div>
              </div>

              {/* Usage stats */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Max Projects</p>
                  <p className="text-lg font-semibold">
                    {billing?.maxProjects ?? "--"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Pages per Crawl
                  </p>
                  <p className="text-lg font-semibold">
                    {billing?.maxPagesPerCrawl ?? "--"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Monthly Crawls Used
                  </p>
                  <p className="text-lg font-semibold">
                    {crawlsUsed} / {crawlsTotal}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              {currentTier !== "agency" && (
                <Button
                  onClick={() =>
                    handlePlanAction(
                      plans[currentTierIndex + 1]?.tier ?? "starter",
                    )
                  }
                >
                  <Zap className="h-4 w-4" />
                  Upgrade Plan
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Subscription Management */}
          {subscription && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Subscription</CardTitle>
                </div>
                <CardDescription>
                  Manage your active subscription.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      subscription.cancelAtPeriodEnd
                        ? "secondary"
                        : subscription.status === "active"
                          ? "default"
                          : "destructive"
                    }
                  >
                    {subscription.cancelAtPeriodEnd
                      ? "Canceling"
                      : subscription.status === "past_due"
                        ? "Past Due"
                        : "Active"}
                  </Badge>
                  <span className="text-sm font-medium capitalize">
                    {subscription.planCode} plan
                  </span>
                </div>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.cancelAtPeriodEnd
                      ? "Access until "
                      : "Next billing date: "}
                    {new Date(
                      subscription.currentPeriodEnd,
                    ).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
              <CardFooter className="gap-2">
                {!subscription.cancelAtPeriodEnd &&
                  subscription.status === "active" && (
                    <Dialog
                      open={cancelDialogOpen}
                      onOpenChange={setCancelDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Cancel Subscription
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Cancel subscription?</DialogTitle>
                          <DialogDescription>
                            Your subscription will remain active until the end
                            of the current billing period. You won&apos;t be
                            charged again.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setCancelDialogOpen(false)}
                          >
                            Keep Subscription
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleCancelSubscription}
                            disabled={canceling}
                          >
                            {canceling ? "Canceling..." : "Yes, cancel"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await withAuth(async () => {
                        const result = await api.billing.createPortalSession(
                          window.location.href,
                        );
                        window.location.href = result.url;
                      });
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  Manage Billing
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Plan comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Plans</CardTitle>
              <CardDescription>
                Compare plans and choose the best fit for your needs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {plans.map((plan, index) => {
                  const isCurrent = plan.tier === currentTier;
                  const isUpgrade = index > currentTierIndex;
                  return (
                    <div
                      key={plan.tier}
                      className={`relative rounded-lg border p-4 ${
                        isCurrent
                          ? "border-primary bg-primary/5"
                          : plan.popular
                            ? "border-primary/60 shadow-sm"
                            : "border-border"
                      }`}
                    >
                      {plan.popular && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground shadow-sm">
                            <Star className="mr-1 h-3 w-3" />
                            Most Popular
                          </Badge>
                        </div>
                      )}
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold">{plan.name}</h3>
                        {isCurrent && <Badge variant="default">Current</Badge>}
                      </div>
                      <p className="mb-3">
                        <span className="text-2xl font-bold">{plan.price}</span>
                        {plan.priceNote && (
                          <span className="text-sm text-muted-foreground">
                            {plan.priceNote}
                          </span>
                        )}
                      </p>
                      <ul className="space-y-1.5">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {!isCurrent && (
                        <Button
                          variant={
                            isUpgrade && plan.popular ? "default" : "outline"
                          }
                          size="sm"
                          className="mt-4 w-full"
                          disabled={upgrading === plan.tier}
                          onClick={() => handlePlanAction(plan.tier)}
                        >
                          {upgrading === plan.tier ? (
                            "Redirecting..."
                          ) : isUpgrade ? (
                            <>
                              <Zap className="h-3.5 w-3.5" />
                              Upgrade
                            </>
                          ) : (
                            <>
                              <ArrowDown className="h-3.5 w-3.5" />
                              Downgrade
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Downgrade to Free confirmation dialog */}
          <Dialog
            open={downgradeDialogOpen}
            onOpenChange={setDowngradeDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Downgrade to Free?</DialogTitle>
                <DialogDescription>
                  Your current subscription will be canceled at the end of the
                  billing period. You&apos;ll keep access to your paid features
                  until then, after which your account will revert to the Free
                  plan limits.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/50">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Projects and data exceeding Free plan limits may become
                  read-only.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDowngradeDialogOpen(false)}
                >
                  Keep Current Plan
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                >
                  {canceling ? "Processing..." : "Yes, downgrade to Free"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Payment History</CardTitle>
              </div>
              <CardDescription>
                Your recent payments and invoices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="divide-y">
                  {payments.map((payment: PaymentRecord) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          ${(payment.amountCents / 100).toFixed(2)}{" "}
                          {payment.currency.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant={
                          payment.status === "succeeded"
                            ? "default"
                            : payment.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No payments yet. Your payment history will appear here when
                  you subscribe to a paid plan.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report Branding</CardTitle>
              <CardDescription>
                Branding is configured per-project to support multiple clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                To customize your report branding (logo, company name, colors),
                go to any project and open its <strong>Settings</strong> tab.
              </p>
              {projectsData?.data && projectsData.data.length > 0 && (
                <div className="mt-4 space-y-2">
                  {projectsData.data.slice(0, 5).map((p) => (
                    <a
                      key={p.id}
                      href={`/dashboard/projects/${p.id}?tab=settings`}
                      className="block rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      {p.name}{" "}
                      <span className="text-muted-foreground">
                        &rarr; Settings
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications Tab ──────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6 pt-4">
          {/* Channel usage */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Notification Channels</h2>
              <p className="text-sm text-muted-foreground">
                Configure where you receive alerts about crawls, score changes,
                and visibility events.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                {channels?.length ?? 0} / {maxChannels} channels
              </Badge>
              <Dialog open={addChannelOpen} onOpenChange={setAddChannelOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={(channels?.length ?? 0) >= maxChannels}
                  >
                    <Plus className="h-4 w-4" />
                    Add Channel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Notification Channel</DialogTitle>
                    <DialogDescription>
                      Choose a channel type and configure where to send alerts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Channel type */}
                    <div className="space-y-2">
                      <Label>Channel Type</Label>
                      <Select
                        value={channelType}
                        onValueChange={(v) =>
                          setChannelType(v as NotificationChannelType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="slack_incoming">
                            Slack Incoming Webhook
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Config input */}
                    <div className="space-y-2">
                      <Label>
                        {channelType === "email"
                          ? "Email Address"
                          : channelType === "slack_incoming"
                            ? "Slack Webhook URL"
                            : "Webhook URL"}
                      </Label>
                      <Input
                        placeholder={
                          channelType === "email"
                            ? "alerts@example.com"
                            : channelType === "slack_incoming"
                              ? "https://hooks.slack.com/services/..."
                              : "https://api.example.com/webhook"
                        }
                        value={channelConfigValue}
                        onChange={(e) => {
                          setChannelConfigValue(e.target.value);
                          setChannelError(null);
                        }}
                      />
                    </div>

                    {/* Event types */}
                    <div className="space-y-2">
                      <Label>Event Types</Label>
                      <div className="space-y-2">
                        {allEventTypes.map((et) => (
                          <label
                            key={et.value}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={channelEventTypes.includes(et.value)}
                              onChange={() => toggleEventType(et.value)}
                              className="rounded border-input"
                            />
                            {et.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {channelError && (
                      <p className="text-sm text-destructive">{channelError}</p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setAddChannelOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateChannel}
                      disabled={savingChannel}
                    >
                      {savingChannel ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Channel"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Channel list */}
          {!channels || channels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No notification channels configured yet. Add one to start
                  receiving alerts.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => {
                const configDisplay =
                  channel.type === "email"
                    ? channel.config.email
                    : channel.config.url;
                const typeLabel =
                  channel.type === "email"
                    ? "Email"
                    : channel.type === "slack_incoming"
                      ? "Slack"
                      : "Webhook";
                const TypeIcon =
                  channel.type === "email"
                    ? Mail
                    : channel.type === "slack_incoming"
                      ? Hash
                      : Globe;

                return (
                  <Card key={channel.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {typeLabel}
                            </Badge>
                            {!channel.enabled && (
                              <Badge variant="secondary" className="text-xs">
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {configDisplay}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {channel.eventTypes.map((et) => (
                              <Badge
                                key={et}
                                variant="secondary"
                                className="text-xs font-normal"
                              >
                                {et.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {/* Toggle */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={channel.enabled}
                          disabled={togglingChannelId === channel.id}
                          onClick={() => handleToggleChannel(channel)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            channel.enabled ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              channel.enabled
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingChannelId === channel.id}
                          onClick={() => handleDeleteChannel(channel.id)}
                        >
                          {deletingChannelId === channel.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── API Tokens Tab ─────────────────────────────────────────── */}
        <TabsContent value="api-tokens" className="space-y-6 pt-4">
          {!canUseTokens ? (
            /* Plan gate for Free / Starter */
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <h3 className="mt-4 text-lg font-semibold">
                  API Access requires Pro or Agency
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Upgrade to Pro or Agency to create API tokens and integrate
                  LLM Boost data into your own tools and dashboards.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => handlePlanAction("pro")}
                >
                  <Zap className="h-4 w-4" />
                  Upgrade to Pro
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
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
                      <Button
                        size="sm"
                        disabled={(tokens?.length ?? 0) >= maxTokens}
                      >
                        <Plus className="h-4 w-4" />
                        Create Token
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      {createdToken ? (
                        /* Token created — show plaintext */
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
                                This token will not be shown again. Store it
                                securely.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>API Token</Label>
                              <div className="flex gap-2">
                                <Input
                                  readOnly
                                  value={createdToken.plaintext}
                                  className="font-mono text-sm"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
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
                          </div>
                          <DialogFooter>
                            <Button onClick={resetTokenDialog}>Done</Button>
                          </DialogFooter>
                        </>
                      ) : (
                        /* Token creation form */
                        <>
                          <DialogHeader>
                            <DialogTitle>Create API Token</DialogTitle>
                            <DialogDescription>
                              Generate a token to access the API. Choose scopes
                              carefully.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {/* Token name */}
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input
                                placeholder="e.g. CI pipeline, Dashboard integration"
                                value={tokenName}
                                onChange={(e) => {
                                  setTokenName(e.target.value);
                                  setTokenError(null);
                                }}
                              />
                            </div>

                            {/* Project selector */}
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
                                  <SelectItem value="all">
                                    All projects
                                  </SelectItem>
                                  {projectsData?.data.map((project) => (
                                    <SelectItem
                                      key={project.id}
                                      value={project.id}
                                    >
                                      {project.name} ({project.domain})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Scopes */}
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
                                      checked={tokenScopes.includes(
                                        scope.value,
                                      )}
                                      onChange={() => toggleScope(scope.value)}
                                      className="rounded border-input"
                                    />
                                    {scope.label}
                                  </label>
                                ))}
                              </div>
                            </div>

                            {tokenError && (
                              <p className="text-sm text-destructive">
                                {tokenError}
                              </p>
                            )}
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={resetTokenDialog}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleCreateToken}
                              disabled={savingToken}
                            >
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
                              <p className="text-sm font-medium">
                                {token.name}
                              </p>
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                                {token.prefix}...
                              </code>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {token.scopes.map((scope) => (
                                <Badge
                                  key={scope}
                                  variant="secondary"
                                  className="text-xs font-normal"
                                >
                                  {scope}
                                </Badge>
                              ))}
                              <span className="text-xs text-muted-foreground">
                                Created{" "}
                                {new Date(token.createdAt).toLocaleDateString()}
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
                                  Revoking &ldquo;{token.name}&rdquo; will
                                  immediately invalidate it. Any integrations
                                  using this token will stop working.
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
                                  {revokingToken
                                    ? "Revoking..."
                                    : "Yes, revoke token"}
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
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
