/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { htmxMiddleware } from "../middleware/htmx";
import { Layout, PageHeader } from "../views/layout";
import {
  userQueries,
  apiTokenQueries,
  notificationChannelQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const appRoutes = new Hono<AppEnv>();

appRoutes.use("*", authMiddleware);
appRoutes.use("*", htmxMiddleware);

// ─── Shared tab renderer ───────────────────────────────
const SETTINGS_TABS = [
  "general",
  "billing",
  "tokens",
  "notifications",
  "digest",
  "team",
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number];

function TabNav({ active }: { active: SettingsTab }) {
  return (
    <div class="mb-6 flex gap-1 border-b" role="tablist">
      {SETTINGS_TABS.map((t) => (
        <button
          hx-get={`/app/settings/${t}`}
          hx-target="#settings-content"
          hx-push-url={`/app/settings?tab=${t}`}
          class={`border-b-2 px-4 py-2 text-sm font-medium ${
            t === active
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          role="tab"
        >
          {t === "tokens"
            ? "API Tokens"
            : t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ─── Settings page (full page) ─────────────────────────
appRoutes.get("/settings", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const tab = (c.req.query("tab") as SettingsTab) ?? "general";
  const validTab = SETTINGS_TABS.includes(tab) ? tab : "general";

  const content = (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account, plan, and notification preferences."
      />
      <TabNav active={validTab} />
      <div
        id="settings-content"
        hx-get={`/app/settings/${validTab}`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <p class="py-8 text-center text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout
      title="Settings"
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

// ─── General tab ───────────────────────────────────────
appRoutes.get("/settings/general", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.text("Unauthorized", 401);

  return c.html(
    <div class="space-y-6">
      {/* Persona selection */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">Your Role</h2>
        <form
          hx-put="/api/account"
          hx-target="#general-status"
          hx-swap="innerHTML"
          class="flex items-end gap-4"
        >
          <div>
            <label class="mb-1 block text-sm font-medium" for="persona">
              I work as
            </label>
            <select
              name="persona"
              id="persona"
              class="rounded border px-3 py-2 text-sm"
            >
              {["agency", "freelancer", "in_house", "developer"].map((p) => (
                <option value={p} selected={user.persona === p}>
                  {p
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
          <span id="general-status"></span>
        </form>
      </section>

      {/* Notification preferences */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">Notifications</h2>
        <form
          hx-put="/api/account/notifications"
          hx-target="#notif-status"
          hx-swap="innerHTML"
          class="space-y-4"
        >
          <label class="flex items-center gap-3">
            <input
              type="checkbox"
              name="notifyOnCrawlComplete"
              value="true"
              checked={user.notifyOnCrawlComplete}
              class="rounded"
            />
            <span class="text-sm">Email me when a crawl finishes</span>
          </label>
          <label class="flex items-center gap-3">
            <input
              type="checkbox"
              name="notifyOnScoreDrop"
              value="true"
              checked={user.notifyOnScoreDrop}
              class="rounded"
            />
            <span class="text-sm">Email me when a score drops 10+ points</span>
          </label>
          <div class="flex items-end gap-4">
            <button
              type="submit"
              class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save
            </button>
            <span id="notif-status"></span>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section class="rounded-lg border border-red-200 bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-2 text-lg font-semibold text-red-600">Danger Zone</h2>
        <p class="mb-4 text-sm text-gray-500">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <button
          hx-delete="/api/account"
          hx-confirm="Are you absolutely sure? This will delete all your projects, crawl data, and account information permanently."
          class="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete Account
        </button>
      </section>
    </div>,
  );
});

// ─── Billing tab ───────────────────────────────────────
appRoutes.get("/settings/billing", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.text("Unauthorized", 401);

  const limits =
    PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  const creditsUsed =
    (limits.crawlsPerMonth ?? 0) - (user.crawlCreditsRemaining ?? 0);
  const creditsPct =
    limits.crawlsPerMonth > 0
      ? Math.round((creditsUsed / limits.crawlsPerMonth) * 100)
      : 0;

  return c.html(
    <div class="space-y-6">
      {/* Current plan */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">Current Plan</h2>
        <div class="flex items-center gap-3">
          <span class="rounded bg-blue-100 px-3 py-1 text-sm font-semibold capitalize text-blue-700">
            {user.plan}
          </span>
          {user.plan !== "agency" && (
            <a href="/pricing" class="text-sm text-blue-600 hover:underline">
              Upgrade
            </a>
          )}
        </div>

        <div class="mt-4 space-y-3">
          <div>
            <div class="flex justify-between text-sm">
              <span>
                Crawl Credits: {creditsUsed} / {limits.crawlsPerMonth}
              </span>
              <span class="text-gray-500">{creditsPct}% used</span>
            </div>
            <div class="mt-1 h-2 w-full rounded-full bg-gray-200">
              <div
                class={`h-2 rounded-full ${creditsPct > 80 ? "bg-red-500" : "bg-blue-500"}`}
                style={`width: ${Math.min(creditsPct, 100)}%`}
              ></div>
            </div>
          </div>
          <p class="text-sm text-gray-500">
            Max {limits.pagesPerCrawl} pages/crawl &middot; {limits.projects}{" "}
            projects
          </p>
        </div>
      </section>

      {/* Manage subscription */}
      {user.plan !== "free" && (
        <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h2 class="mb-4 text-lg font-semibold">Subscription</h2>
          <div class="flex gap-3">
            <button
              hx-post="/api/billing/portal-session"
              hx-vals={JSON.stringify({
                returnUrl: "/app/settings?tab=billing",
              })}
              class="rounded bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200"
            >
              Manage in Stripe
            </button>
          </div>
        </section>
      )}
    </div>,
  );
});

// ─── API Tokens tab ────────────────────────────────────
appRoutes.get("/settings/tokens", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.text("Unauthorized", 401);

  const tokens = await apiTokenQueries(db).listByUser(userId);
  const maxTokens = user.plan === "pro" ? 5 : user.plan === "agency" ? 20 : 0;

  if (maxTokens === 0) {
    return c.html(
      <div class="rounded-lg border bg-white p-6 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">
          API tokens require a Pro or Agency plan.
        </p>
        <a
          href="/pricing"
          class="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          Upgrade to unlock
        </a>
      </div>,
    );
  }

  return c.html(
    <div class="space-y-6">
      {/* Create token form */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">
          API Tokens ({tokens.length}/{maxTokens})
        </h2>
        <form
          hx-post="/api/tokens"
          hx-target="#token-list"
          hx-swap="beforeend"
          class="flex gap-2"
        >
          <input
            type="text"
            name="name"
            placeholder="Token name"
            required
            class="flex-1 rounded border px-3 py-2 text-sm"
          />
          <select name="type" class="rounded border px-3 py-2 text-sm">
            <option value="mcp">MCP</option>
            <option value="api">API</option>
          </select>
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            disabled={tokens.length >= maxTokens}
          >
            Create
          </button>
        </form>
      </section>

      {/* Token list */}
      <div id="token-list" class="space-y-3">
        {tokens.map((token) => (
          <div class="flex items-center justify-between rounded-lg border bg-white px-4 py-3 dark:bg-gray-900">
            <div>
              <p class="text-sm font-medium">{token.name}</p>
              <p class="text-xs text-gray-500">
                {token.tokenPrefix}... &middot; {token.type} &middot; Created{" "}
                {new Date(token.createdAt).toLocaleDateString()}
                {token.lastUsedAt &&
                  ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`}
              </p>
            </div>
            <button
              hx-delete={`/api/tokens/${token.id}`}
              hx-target="closest div"
              hx-swap="outerHTML"
              hx-confirm="Revoke this token? This cannot be undone."
              class="text-sm text-red-600 hover:underline"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>,
  );
});

// ─── Notifications tab ─────────────────────────────────
appRoutes.get("/settings/notifications", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const channels = await notificationChannelQueries(db).listByUser(userId);

  return c.html(
    <div class="space-y-6">
      {/* Add channel */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">Notification Channels</h2>
        <form
          hx-post="/api/notification-channels"
          hx-target="#channel-list"
          hx-swap="beforeend"
          class="flex gap-2"
        >
          <select name="type" class="rounded border px-3 py-2 text-sm">
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
            <option value="slack_incoming">Slack</option>
          </select>
          <input
            type="text"
            name="endpoint"
            placeholder="Email or URL"
            required
            class="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      </section>

      {/* Channel list */}
      <div id="channel-list" class="space-y-3">
        {channels.map((ch) => (
          <div class="flex items-center justify-between rounded-lg border bg-white px-4 py-3 dark:bg-gray-900">
            <div>
              <p class="text-sm font-medium">
                {ch.channelType === "email"
                  ? "Email"
                  : ch.channelType === "slack_incoming"
                    ? "Slack"
                    : "Webhook"}
              </p>
              <p class="text-xs text-gray-500">
                {ch.config &&
                  (typeof ch.config === "object"
                    ? ((ch.config as Record<string, string>).email ??
                      (ch.config as Record<string, string>).url ??
                      "")
                    : String(ch.config))}
                {ch.enabled ? "" : " (disabled)"}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <button
                hx-patch={`/api/notification-channels/${ch.id}`}
                hx-vals={JSON.stringify({ enabled: !ch.enabled })}
                hx-target="closest div"
                hx-swap="outerHTML"
                class="text-sm text-blue-600 hover:underline"
              >
                {ch.enabled ? "Disable" : "Enable"}
              </button>
              <button
                hx-delete={`/api/notification-channels/${ch.id}`}
                hx-target="closest div"
                hx-swap="outerHTML"
                hx-confirm="Remove this notification channel?"
                class="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>,
  );
});

// ─── Digest tab ────────────────────────────────────────
appRoutes.get("/settings/digest", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.text("Unauthorized", 401);

  return c.html(
    <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
      <h2 class="mb-4 text-lg font-semibold">Email Digest</h2>
      <p class="mb-4 text-sm text-gray-500">
        Receive periodic email summaries of your project scores and issues.
      </p>
      <form
        hx-patch="/api/account/digest"
        hx-target="#digest-status"
        hx-swap="innerHTML"
        class="flex items-end gap-4"
      >
        <div>
          <label class="mb-1 block text-sm font-medium" for="digestFrequency">
            Frequency
          </label>
          <select
            name="digestFrequency"
            id="digestFrequency"
            class="rounded border px-3 py-2 text-sm"
          >
            <option value="off" selected={user.digestFrequency === "off"}>
              Off
            </option>
            <option value="weekly" selected={user.digestFrequency === "weekly"}>
              Weekly
            </option>
            <option
              value="monthly"
              selected={user.digestFrequency === "monthly"}
            >
              Monthly
            </option>
          </select>
        </div>
        <button
          type="submit"
          class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save
        </button>
        <span id="digest-status"></span>
      </form>
    </section>,
  );
});

// ─── Team tab ──────────────────────────────────────────
appRoutes.get("/settings/team", async (c) => {
  // Team management is a separate page (Task 6), link to it
  return c.html(
    <div class="rounded-lg border bg-white p-6 text-center dark:bg-gray-900">
      <p class="text-sm text-gray-500">
        Team management has been moved to its own page.
      </p>
      <a
        href="/app/team"
        hx-boost="true"
        class="mt-2 inline-block text-sm text-blue-600 hover:underline"
      >
        Go to Team Management
      </a>
    </div>,
  );
});
