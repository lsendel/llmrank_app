import {
  AlertTriangle,
  Bell,
  Crown,
  Loader2,
  Mail,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import type { DigestPreferences, NotificationPreferences } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import {
  DIGEST_DAY_OPTIONS,
  DIGEST_FREQUENCY_OPTIONS,
  getClearHistoryLabel,
  NOTIFICATION_OPTIONS,
  PERSONA_OPTIONS,
  showDigestDaySelect,
  type NotificationKey,
  type ProjectOption,
} from "./general-section-helpers";

export function CurrentPlanCard({ planName }: { planName: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Current Plan</CardTitle>
          </div>
        </div>
        <CardDescription>
          You are currently on the{" "}
          <strong className="text-foreground">{planName}</strong> plan.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function RoleCard({
  persona,
  savingPersona,
  onPersonaChange,
}: {
  persona: string | null;
  savingPersona: boolean;
  onPersonaChange: (value: string) => void | Promise<void>;
}) {
  return (
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
            onValueChange={onPersonaChange}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              {PERSONA_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {savingPersona && (
          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function NotificationPreferencesCard({
  notifications,
  savingNotification,
  onToggleNotification,
}: {
  notifications?: NotificationPreferences;
  savingNotification: string | null;
  onToggleNotification: (key: NotificationKey) => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Notification Preferences</CardTitle>
        </div>
        <CardDescription>
          Choose which email notifications you want to receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {NOTIFICATION_OPTIONS.map((notification, index) => {
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
                  onClick={() => onToggleNotification(notification.key)}
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
  );
}

export function EmailDigestCard({
  digestPrefs,
  savingDigest,
  onDigestFrequencyChange,
  onDigestDayChange,
}: {
  digestPrefs?: DigestPreferences;
  savingDigest: boolean;
  onDigestFrequencyChange: (value: string) => void | Promise<void>;
  onDigestDayChange: (value: string) => void | Promise<void>;
}) {
  return (
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
            onValueChange={onDigestFrequencyChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIGEST_FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showDigestDaySelect(digestPrefs) && (
          <div className="space-y-2">
            <Label>Send on</Label>
            <Select
              value={String(digestPrefs?.digestDay ?? 1)}
              disabled={savingDigest}
              onValueChange={onDigestDayChange}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIGEST_DAY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {savingDigest && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function WebhookUrlCard({
  webhookInput,
  savingWebhook,
  webhookError,
  webhookSuccess,
  hasWebhook,
  onWebhookInputChange,
  onSaveWebhook,
  onRemoveWebhook,
}: {
  webhookInput: string;
  savingWebhook: boolean;
  webhookError: string | null;
  webhookSuccess: boolean;
  hasWebhook: boolean;
  onWebhookInputChange: (value: string) => void;
  onSaveWebhook: () => void | Promise<void>;
  onRemoveWebhook: () => void | Promise<void>;
}) {
  return (
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
            onChange={(event) => onWebhookInputChange(event.target.value)}
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
          <Button size="sm" disabled={savingWebhook} onClick={onSaveWebhook}>
            {savingWebhook ? "Saving..." : "Save"}
          </Button>
          {hasWebhook && (
            <Button
              size="sm"
              variant="outline"
              disabled={savingWebhook}
              onClick={onRemoveWebhook}
            >
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClearHistoryCard({
  clearTarget,
  onClearTargetChange,
  clearDialogOpen,
  onClearDialogOpenChange,
  clearing,
  clearResult,
  projectsList,
  onClearHistory,
}: {
  clearTarget: string;
  onClearTargetChange: (value: string) => void;
  clearDialogOpen: boolean;
  onClearDialogOpenChange: (open: boolean) => void;
  clearing: boolean;
  clearResult: string | null;
  projectsList: ProjectOption[];
  onClearHistory: () => void | Promise<void>;
}) {
  const clearLabel = getClearHistoryLabel(clearTarget, projectsList);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Clear Crawl History</CardTitle>
        </div>
        <CardDescription>
          Permanently delete crawl data for all projects or a specific project.
          This removes crawl jobs, page data, scores, and issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={clearTarget} onValueChange={onClearTargetChange}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projectsList.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={clearDialogOpen} onOpenChange={onClearDialogOpenChange}>
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
                    {clearLabel}
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
                  onClick={() => onClearDialogOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onClearHistory}
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
  );
}

export function DangerZoneCard({
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  deleting,
  onDeleteAccount,
}: {
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDeleteAccount: () => void | Promise<void>;
}) {
  return (
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
          <Dialog
            open={deleteDialogOpen}
            onOpenChange={onDeleteDialogOpenChange}
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
                  onClick={() => onDeleteDialogOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDeleteAccount}
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
  );
}
