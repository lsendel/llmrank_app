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
  organizationQueries,
  orgMemberQueries,
  orgInviteQueries,
  scoreQueries,
  crawlQueries,
  projectQueries,
  competitorBenchmarkQueries,
  visibilityQueries,
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

// =====================================================================
// Team Management Page
// =====================================================================

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-blue-100 text-blue-700",
  admin: "bg-red-100 text-red-700",
  member: "bg-gray-100 text-gray-700",
  viewer: "bg-gray-50 text-gray-500",
};

appRoutes.get("/team", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  // Find user's organization
  const orgs = await organizationQueries(db).listByUser(userId);
  const orgRow = orgs[0];

  const content = orgRow ? (
    <div>
      <PageHeader
        title="Team Management"
        description={`Organization: ${orgRow.org.name}`}
      />
      {/* Members list — loaded via HTMX */}
      <div
        id="team-content"
        hx-get={`/app/team/${orgRow.org.id}/members`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <p class="py-8 text-center text-sm text-gray-400">Loading team...</p>
      </div>
    </div>
  ) : (
    <div>
      <PageHeader
        title="Create Organization"
        description="Create an organization to invite team members and collaborate."
      />
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <form hx-post="/api/orgs" hx-target="body" class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium" for="orgName">
              Organization Name
            </label>
            <input
              type="text"
              name="name"
              id="orgName"
              placeholder="e.g. Acme Inc."
              required
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium" for="orgSlug">
              Slug
            </label>
            <input
              type="text"
              name="slug"
              id="orgSlug"
              placeholder="e.g. acme-inc"
              required
              pattern="[a-z0-9-]+"
              class="w-full rounded border px-3 py-2 text-sm"
            />
            <p class="mt-1 text-xs text-gray-500">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Organization
          </button>
        </form>
      </section>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout title="Team" user={{ email: user.email ?? "", plan: user.plan }}>
      {content}
    </Layout>,
  );
});

// ─── Team members partial ──────────────────────────────
appRoutes.get("/team/:orgId/members", async (c) => {
  const db = c.get("db");
  const orgId = c.req.param("orgId");

  const members = await orgMemberQueries(db).listByOrg(orgId);
  const invites = await orgInviteQueries(db).listByOrg(orgId);
  const pendingInvites = invites.filter((inv) => !inv.acceptedAt);

  return c.html(
    <div class="space-y-6">
      {/* Members table */}
      <section class="rounded-lg border bg-white dark:bg-gray-900">
        <div class="border-b px-6 py-4">
          <h2 class="text-lg font-semibold">Team Members ({members.length})</h2>
        </div>
        {members.length === 0 ? (
          <p class="px-6 py-8 text-center text-sm text-gray-500">
            No team members yet. Invite someone below.
          </p>
        ) : (
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-gray-500">
                <th class="px-6 py-3 font-medium">Member</th>
                <th class="px-6 py-3 font-medium">Role</th>
                <th class="px-6 py-3 font-medium">Joined</th>
                <th class="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr class="border-b last:border-0">
                  <td class="px-6 py-3">
                    <p class="font-medium">{m.name ?? "Unnamed"}</p>
                    <p class="text-xs text-gray-500">{m.email}</p>
                  </td>
                  <td class="px-6 py-3">
                    <span
                      class={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer}`}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td class="px-6 py-3 text-gray-500">
                    {m.joinedAt
                      ? new Date(m.joinedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td class="px-6 py-3 text-right">
                    {m.role !== "owner" && (
                      <div class="flex items-center justify-end gap-2">
                        <select
                          hx-patch={`/api/orgs/${orgId}/members/${m.id}`}
                          hx-target="closest tr"
                          hx-swap="outerHTML"
                          name="role"
                          class="rounded border px-2 py-1 text-xs"
                        >
                          {["admin", "member", "viewer"].map((r) => (
                            <option value={r} selected={m.role === r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                        <button
                          hx-delete={`/api/orgs/${orgId}/members/${m.userId}`}
                          hx-target="closest tr"
                          hx-swap="outerHTML"
                          hx-confirm="Remove this member from the team?"
                          class="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {m.role === "owner" && (
                      <span class="text-xs text-gray-400">Owner</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Invite form */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">Invite Team Member</h2>
        <form
          hx-post={`/api/orgs/${orgId}/invites`}
          hx-target="#invite-status"
          hx-swap="innerHTML"
          class="flex items-end gap-3"
        >
          <div class="flex-1">
            <label class="mb-1 block text-sm font-medium" for="inviteEmail">
              Email
            </label>
            <input
              type="email"
              name="email"
              id="inviteEmail"
              placeholder="colleague@example.com"
              required
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium" for="inviteRole">
              Role
            </label>
            <select
              name="role"
              id="inviteRole"
              class="rounded border px-3 py-2 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="member" selected>
                Member
              </option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send Invite
          </button>
        </form>
        <div id="invite-status" class="mt-2"></div>
      </section>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <section class="rounded-lg border bg-white dark:bg-gray-900">
          <div class="border-b px-6 py-4">
            <h2 class="text-lg font-semibold">
              Pending Invites ({pendingInvites.length})
            </h2>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-gray-500">
                <th class="px-6 py-3 font-medium">Email</th>
                <th class="px-6 py-3 font-medium">Role</th>
                <th class="px-6 py-3 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((inv) => (
                <tr class="border-b last:border-0">
                  <td class="px-6 py-3">{inv.email}</td>
                  <td class="px-6 py-3">
                    <span
                      class={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[inv.role] ?? ROLE_COLORS.viewer}`}
                    >
                      {inv.role}
                    </span>
                  </td>
                  <td class="px-6 py-3 text-gray-500">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>,
  );
});

// =====================================================================
// New Project Page
// =====================================================================

appRoutes.get("/projects/new", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const content = (
    <div class="mx-auto max-w-lg">
      <PageHeader
        title="New Project"
        description="Add a website to audit for AI-readiness."
      />
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <form
          hx-post="/api/projects"
          hx-target="#form-error"
          hx-swap="innerHTML"
          class="space-y-5"
        >
          <div id="form-error"></div>

          <div>
            <label class="mb-1 block text-sm font-medium" for="name">
              Project Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              placeholder="My Website"
              required
              maxlength={100}
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium" for="domain">
              Domain
            </label>
            <input
              type="text"
              name="domain"
              id="domain"
              placeholder="example.com"
              required
              class="w-full rounded border px-3 py-2 text-sm"
            />
            <p class="mt-1 text-xs text-gray-500">
              Enter the root domain to audit. https:// will be added
              automatically if omitted.
            </p>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="submit"
              class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Project
            </button>
            <a
              href="/app/projects"
              class="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </form>
      </section>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout
      title="New Project"
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

// =====================================================================
// Projects List (Dashboard Home)
// =====================================================================

function gradeColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function gradeLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs Work";
  return "Poor";
}

function gradeBadgeColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

appRoutes.get("/", (c) => c.redirect("/app/projects"));

appRoutes.get("/projects", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const content = (
    <div>
      <PageHeader
        title="Projects"
        description="Manage your website projects and view their AI-readiness scores."
        actions={
          <a
            href="/app/projects/new"
            class="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Project
          </a>
        }
      />
      <div
        id="project-list"
        hx-get="/app/projects/cards"
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <p class="py-16 text-center text-sm text-gray-400">
          Loading projects...
        </p>
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout
      title="Projects"
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

appRoutes.get("/projects/cards", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const allProjects = await projectQueries(db).listByUser(userId);

  // Batch-fetch latest crawl + score data per project
  const recentCrawls = await crawlQueries(db).getRecentForUser(userId);

  // Map: projectId → latest completed crawl with score
  const latestByProject = new Map<
    string,
    {
      overallScore: number | null;
      letterGrade: string | null;
      pagesCrawled: number | null;
      pagesScored: number | null;
      completedAt: Date | null;
    }
  >();
  for (const crawl of recentCrawls) {
    if (crawl.status !== "complete") continue;
    if (latestByProject.has(crawl.projectId)) continue; // already have latest
    latestByProject.set(crawl.projectId, {
      overallScore: crawl.overallScore,
      letterGrade: crawl.letterGrade,
      pagesCrawled: crawl.pagesCrawled,
      pagesScored: crawl.pagesScored,
      completedAt: crawl.completedAt,
    });
  }

  if (allProjects.length === 0) {
    return c.html(
      <div class="rounded-lg border-2 border-dashed bg-white p-16 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">No projects yet.</p>
        <a
          href="/app/projects/new"
          class="mt-4 inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create your first project
        </a>
      </div>,
    );
  }

  return c.html(
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {allProjects.map((project) => {
        const crawl = latestByProject.get(project.id);
        const score = crawl?.overallScore ?? null;

        return (
          <a
            href={`/app/projects/${project.id}`}
            class="group block rounded-lg border bg-white p-5 transition-shadow hover:shadow-md dark:bg-gray-900"
          >
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-semibold group-hover:text-blue-600">
                  {project.name}
                </h3>
                <p class="mt-0.5 text-sm text-gray-500">{project.domain}</p>
              </div>
              {score !== null ? (
                <div class="flex flex-col items-end gap-1">
                  <span class={`text-2xl font-bold ${gradeColor(score)}`}>
                    {score}
                  </span>
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${gradeBadgeColor(score)}`}
                  >
                    {gradeLabel(score)}
                  </span>
                </div>
              ) : (
                <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  No crawls yet
                </span>
              )}
            </div>

            <div class="mt-4 flex gap-4 text-xs text-gray-500">
              {crawl ? (
                <>
                  <span>
                    {crawl.pagesCrawled ?? crawl.pagesScored ?? 0} pages scanned
                  </span>
                  {crawl.completedAt && (
                    <span>
                      Last crawl:{" "}
                      {new Date(crawl.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </>
              ) : (
                <span>
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Quick actions */}
            <div class="mt-4 flex items-center justify-between border-t pt-3">
              <div class="flex items-center gap-1">
                <span
                  class="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  title="Strategy"
                >
                  Strategy
                </span>
                <span
                  class="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  title="Competitors"
                >
                  Competitors
                </span>
                <span
                  class="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  title="Issues"
                >
                  Issues
                </span>
              </div>
              <button
                hx-delete={`/api/projects/${project.id}`}
                hx-target="closest a"
                hx-swap="outerHTML"
                hx-confirm={`Delete "${project.name}"? This will permanently remove all crawl data, scores, and reports. This action cannot be undone.`}
                class="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                onclick="event.preventDefault(); event.stopPropagation();"
              >
                Delete
              </button>
            </div>
          </a>
        );
      })}
    </div>,
  );
});

// =====================================================================
// Project Issues Page
// =====================================================================

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
  performance: "Performance",
  schema: "Schema",
  llm_visibility: "LLM Visibility",
};

appRoutes.get("/projects/:id/issues", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const projectId = c.req.param("id");
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.text("Not found", 404);
  }

  // Get latest crawl for this project
  const crawls = await crawlQueries(db).listByProject(projectId, 1);
  const latestCrawl = crawls[0];

  const content = (
    <div>
      <PageHeader
        title={`Issues — ${project.domain}`}
        description="Issues found during the latest crawl"
        actions={
          <a
            href={`/app/projects/${projectId}`}
            class="text-sm text-blue-600 hover:underline"
          >
            Back to project
          </a>
        }
      />
      {latestCrawl ? (
        <div
          id="issue-list"
          hx-get={`/app/projects/${projectId}/issues/list?jobId=${latestCrawl.id}`}
          hx-trigger="load"
          hx-swap="innerHTML"
        >
          <p class="py-8 text-center text-sm text-gray-400">
            Loading issues...
          </p>
        </div>
      ) : (
        <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
          <p class="text-sm text-gray-500">
            No crawls found. Run a crawl to discover issues.
          </p>
        </div>
      )}
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout title="Issues" user={{ email: user.email ?? "", plan: user.plan }}>
      {content}
    </Layout>,
  );
});

// ─── Issues list partial (with server-side filtering) ──
appRoutes.get("/projects/:id/issues/list", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const jobId = c.req.query("jobId");
  const severity = c.req.query("severity") ?? "all";
  const category = c.req.query("category") ?? "all";

  if (!jobId) return c.text("Missing jobId", 400);

  const allIssues = await scoreQueries(db).getIssuesByJob(jobId);

  const filtered = allIssues.filter((issue) => {
    if (severity !== "all" && issue.severity !== severity) return false;
    if (category !== "all" && issue.category !== category) return false;
    return true;
  });

  const severities = ["all", "critical", "warning", "info"];
  const categories = [
    "all",
    "technical",
    "content",
    "ai_readiness",
    "performance",
  ];

  return c.html(
    <div class="space-y-4">
      {/* Filters */}
      <div class="flex flex-wrap gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-500">Severity:</span>
          {severities.map((sev) => (
            <button
              hx-get={`/app/projects/${projectId}/issues/list?jobId=${jobId}&severity=${sev}&category=${category}`}
              hx-target="#issue-list"
              hx-swap="innerHTML"
              class={`rounded px-3 py-1 text-sm font-medium ${
                severity === sev
                  ? "bg-blue-600 text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {sev === "all"
                ? `All (${allIssues.length})`
                : `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${allIssues.filter((i) => i.severity === sev).length})`}
            </button>
          ))}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-500">Category:</span>
          {categories.map((cat) => (
            <button
              hx-get={`/app/projects/${projectId}/issues/list?jobId=${jobId}&severity=${severity}&category=${cat}`}
              hx-target="#issue-list"
              hx-swap="innerHTML"
              class={`rounded px-3 py-1 text-sm font-medium ${
                category === cat
                  ? "bg-blue-600 text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {cat === "all" ? "All" : (CATEGORY_LABELS[cat] ?? cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Issue cards */}
      {filtered.length === 0 ? (
        <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
          <p class="text-sm text-gray-500">
            {allIssues.length === 0
              ? "No issues found."
              : "No issues match the selected filters."}
          </p>
        </div>
      ) : (
        <div class="space-y-3">
          {filtered.map((issue) => (
            <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span
                      class={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[issue.severity] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {issue.severity}
                    </span>
                    <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {CATEGORY_LABELS[issue.category] ?? issue.category}
                    </span>
                    <code class="text-xs text-gray-400">{issue.code}</code>
                  </div>
                  <p class="mt-2 text-sm font-medium">{issue.message}</p>
                  {issue.pageUrl && (
                    <p class="mt-1 text-xs text-gray-500">{issue.pageUrl}</p>
                  )}
                  {issue.recommendation && (
                    <p class="mt-1 text-xs text-gray-500">
                      {issue.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,
  );
});

// =====================================================================
// Project Detail Page (Tab Container)
// =====================================================================

const PROJECT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "pages", label: "Pages" },
  { key: "issues", label: "Issues" },
  { key: "competitors", label: "Competitors" },
  { key: "visibility", label: "Visibility" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
] as const;

type ProjectTab = (typeof PROJECT_TABS)[number]["key"];

function ProjectTabNav({
  projectId,
  active,
}: {
  projectId: string;
  active: ProjectTab;
}) {
  return (
    <div class="mb-6 flex gap-1 overflow-x-auto border-b" role="tablist">
      {PROJECT_TABS.map((t) => (
        <button
          hx-get={`/app/projects/${projectId}/tab/${t.key}`}
          hx-target="#tab-content"
          hx-push-url={`/app/projects/${projectId}?tab=${t.key}`}
          class={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
            t.key === active
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          role="tab"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ScoreBar({
  label,
  score,
  weight,
}: {
  label: string;
  score: number | null;
  weight: string;
}) {
  const s = score ?? 0;
  return (
    <div>
      <div class="flex justify-between text-sm">
        <span class="font-medium">
          {label}{" "}
          <span class="text-xs font-normal text-gray-400">({weight})</span>
        </span>
        <span class={`font-bold ${gradeColor(s)}`}>{score ?? "—"}</span>
      </div>
      <div class="mt-1 h-2 w-full rounded-full bg-gray-200">
        <div
          class={`h-2 rounded-full ${s >= 80 ? "bg-green-500" : s >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
          style={`width: ${Math.min(s, 100)}%`}
        ></div>
      </div>
    </div>
  );
}

appRoutes.get("/projects/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const projectId = c.req.param("id");
  if (projectId === "new") return c.redirect("/app/projects/new");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.text("Not found", 404);
  }

  const rawTab = c.req.query("tab") ?? "overview";
  const tab = PROJECT_TABS.find((t) => t.key === rawTab)
    ? (rawTab as ProjectTab)
    : "overview";

  const content = (
    <div>
      <PageHeader
        title={project.name}
        description={project.domain}
        actions={
          <div class="flex items-center gap-3">
            <button
              hx-post={`/api/projects/${projectId}/crawls`}
              class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Run Crawl
            </button>
            <a
              href="/app/projects"
              class="text-sm text-gray-500 hover:underline"
            >
              Back to projects
            </a>
          </div>
        }
      />
      <ProjectTabNav projectId={projectId} active={tab} />
      <div
        id="tab-content"
        hx-get={`/app/projects/${projectId}/tab/${tab}`}
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
      title={project.name}
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

// ─── Overview tab ─────────────────────────────────────
appRoutes.get("/projects/:id/tab/overview", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const project = await projectQueries(db).getById(projectId);
  if (!project) return c.text("Not found", 404);

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);

  if (!latestCrawl || latestCrawl.status !== "complete") {
    return c.html(
      <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
        <p class="text-gray-500">
          {latestCrawl
            ? `Crawl in progress (${latestCrawl.status})...`
            : "No crawls yet. Run a crawl to see your scores."}
        </p>
        {latestCrawl && (
          <a
            href={`/app/crawl/${latestCrawl.id}`}
            class="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            View crawl progress
          </a>
        )}
      </div>,
    );
  }

  const scores = await scoreQueries(db).listByJob(latestCrawl.id);
  const issuesByJob = await scoreQueries(db).getIssuesByJob(latestCrawl.id);

  const avgOf = (arr: (number | null)[]) => {
    const valid = arr.filter((n): n is number => n !== null);
    return valid.length > 0
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
      : null;
  };

  const overall = avgOf(scores.map((s) => s.overallScore));
  const technical = avgOf(scores.map((s) => s.technicalScore));
  const contentScore = avgOf(scores.map((s) => s.contentScore));
  const aiReadiness = avgOf(scores.map((s) => s.aiReadinessScore));
  const perfScore = avgOf(scores.map((s) => s.lighthousePerf));

  const issueBySeverity = { critical: 0, warning: 0, info: 0 };
  for (const issue of issuesByJob) {
    if (issue.severity in issueBySeverity) {
      issueBySeverity[issue.severity as keyof typeof issueBySeverity]++;
    }
  }

  const topIssues = issuesByJob
    .filter((i) => i.severity === "critical" || i.severity === "warning")
    .slice(0, 5);

  // Fetch score trend data from completed crawls
  const completedCrawls = await crawlQueries(db).listCompletedByProject(
    projectId,
    10,
  );
  const trendData: { labels: string[]; scores: number[] } = {
    labels: [],
    scores: [],
  };
  for (const cr of completedCrawls.reverse()) {
    const crScores = await scoreQueries(db).listByJob(cr.id);
    if (crScores.length > 0) {
      const avg = Math.round(
        crScores.reduce((sum, s) => sum + s.overallScore, 0) / crScores.length,
      );
      trendData.labels.push(
        new Date(cr.completedAt ?? cr.createdAt).toLocaleDateString(),
      );
      trendData.scores.push(avg);
    }
  }

  return c.html(
    <div class="space-y-6">
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="flex flex-col items-center justify-center rounded-lg border bg-white p-6 dark:bg-gray-900">
          <span class={`text-5xl font-bold ${gradeColor(overall ?? 0)}`}>
            {overall ?? "—"}
          </span>
          <span
            class={`mt-2 rounded px-3 py-1 text-sm font-medium ${gradeBadgeColor(overall ?? 0)}`}
          >
            {overall !== null ? gradeLabel(overall) : "N/A"}
          </span>
          <p class="mt-2 text-xs text-gray-500">Overall Score</p>
          <p class="text-xs text-gray-400">
            {scores.length} pages &middot;{" "}
            {latestCrawl.completedAt
              ? new Date(latestCrawl.completedAt).toLocaleDateString()
              : ""}
          </p>
        </div>

        <div class="col-span-2 space-y-4 rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="text-sm font-semibold text-gray-500">
            Category Breakdown
          </h3>
          <ScoreBar label="Technical" score={technical} weight="25%" />
          <ScoreBar label="Content" score={contentScore} weight="30%" />
          <ScoreBar label="AI Readiness" score={aiReadiness} weight="30%" />
          <ScoreBar label="Performance" score={perfScore} weight="15%" />
        </div>
      </div>

      {latestCrawl.summary && (
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-2 text-sm font-semibold text-gray-500">
            Executive Summary
          </h3>
          <p class="text-sm leading-relaxed text-gray-700">
            {latestCrawl.summary}
          </p>
        </div>
      )}

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Issue Distribution
          </h3>
          <div class="flex gap-4">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full bg-red-500"></span>
              <span class="text-sm">Critical: {issueBySeverity.critical}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full bg-yellow-500"></span>
              <span class="text-sm">Warning: {issueBySeverity.warning}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full bg-blue-500"></span>
              <span class="text-sm">Info: {issueBySeverity.info}</span>
            </div>
          </div>
          <div
            id="issue-dist-chart"
            class="mt-4 h-48"
            data-chart-type="issue-distribution"
            data-chart-data={JSON.stringify(issueBySeverity)}
          ></div>
        </div>

        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">Score Trend</h3>
          {trendData.scores.length >= 2 ? (
            <div
              id="score-trend-chart"
              class="h-48"
              data-chart-data={JSON.stringify(trendData)}
            >
              <canvas id="score-trend-canvas"></canvas>
            </div>
          ) : (
            <p class="flex h-48 items-center justify-center text-xs text-gray-400">
              Score trend requires at least 2 completed crawls
            </p>
          )}
        </div>
      </div>

      {topIssues.length > 0 && (
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Top Issues ({issuesByJob.length} total)
          </h3>
          <div class="space-y-3">
            {topIssues.map((issue) => (
              <div class="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                <span
                  class={`mt-0.5 rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[issue.severity] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {issue.severity}
                </span>
                <div class="flex-1">
                  <p class="text-sm">{issue.message}</p>
                  {issue.pageUrl && (
                    <p class="mt-0.5 text-xs text-gray-400">{issue.pageUrl}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <a
            href={`/app/projects/${projectId}/issues`}
            class="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            View all issues
          </a>
        </div>
      )}
      {/* Chart init — loaded after DOM renders */}
      <script src="/app/static/charts.js"></script>
    </div>,
  );
});

// ─── Chart islands JS (served as static asset) ───────
appRoutes.get("/static/charts.js", (c) => {
  // Safe: chart data comes from server-rendered data-* attributes, not user input
  const js = [
    "(function(){",
    "if(typeof Chart==='undefined')return;",
    "var distEl=document.getElementById('issue-dist-chart');",
    "if(distEl){",
    "  var d=JSON.parse(distEl.getAttribute('data-chart-data')||'{}');",
    "  var cv=document.createElement('canvas');",
    "  while(distEl.firstChild)distEl.removeChild(distEl.firstChild);",
    "  distEl.appendChild(cv);",
    "  new Chart(cv,{type:'doughnut',data:{",
    "    labels:['Critical','Warning','Info'],",
    "    datasets:[{data:[d.critical||0,d.warning||0,d.info||0],",
    "      backgroundColor:['#ef4444','#eab308','#3b82f6']}]},",
    "    options:{responsive:true,maintainAspectRatio:false,",
    "      plugins:{legend:{position:'bottom',labels:{padding:16}}}}});",
    "}",
    "var trendEl=document.getElementById('score-trend-chart');",
    "if(trendEl){",
    "  var td=JSON.parse(trendEl.getAttribute('data-chart-data')||'null');",
    "  if(td){",
    "    var cv2=document.getElementById('score-trend-canvas');",
    "    if(cv2){new Chart(cv2,{type:'line',data:{labels:td.labels,",
    "      datasets:[{label:'Overall Score',data:td.scores,",
    "        borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.1)',",
    "        fill:true,tension:0.3,pointRadius:4}]},",
    "      options:{responsive:true,maintainAspectRatio:false,",
    "        scales:{y:{min:0,max:100}},plugins:{legend:{display:false}}}});}",
    "  }",
    "}",
    "})();",
  ].join("\n");
  return c.body(js, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=3600",
  });
});

// ─── Pages tab ────────────────────────────────────────
appRoutes.get("/projects/:id/tab/pages", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const sort = c.req.query("sort") ?? "score";
  const dir = c.req.query("dir") ?? "asc";

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (!latestCrawl || latestCrawl.status !== "complete") {
    return c.html(
      <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">No completed crawl data yet.</p>
      </div>,
    );
  }

  const pagesWithScores = await scoreQueries(db).listByJobWithPages(
    latestCrawl.id,
  );

  const sorted = [...pagesWithScores].sort((a, b) => {
    let cmp = 0;
    if (sort === "score") cmp = a.overallScore - b.overallScore;
    else if (sort === "issues") cmp = a.issueCount - b.issueCount;
    else if (sort === "url")
      cmp = (a.page?.url ?? "").localeCompare(b.page?.url ?? "");
    else if (sort === "status")
      cmp = (a.page?.statusCode ?? 0) - (b.page?.statusCode ?? 0);
    return dir === "desc" ? -cmp : cmp;
  });

  const nextDir = dir === "asc" ? "desc" : "asc";
  const sortLink = (col: string) =>
    `/app/projects/${projectId}/tab/pages?sort=${col}&dir=${sort === col ? nextDir : "asc"}`;
  const sortIcon = (col: string) =>
    sort === col ? (dir === "asc" ? " ^" : " v") : "";

  return c.html(
    <div class="overflow-x-auto rounded-lg border bg-white dark:bg-gray-900">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-gray-500">
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("url")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                URL{sortIcon("url")}
              </button>
            </th>
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("status")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                Status{sortIcon("status")}
              </button>
            </th>
            <th class="px-4 py-3 font-medium">Title</th>
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("score")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                Score{sortIcon("score")}
              </button>
            </th>
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("issues")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                Issues{sortIcon("issues")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr class="border-b last:border-0 hover:bg-gray-50">
              <td class="max-w-xs truncate px-4 py-3 font-mono text-xs">
                {row.page?.url ?? "—"}
              </td>
              <td class="px-4 py-3">
                <span
                  class={`rounded px-2 py-0.5 text-xs font-medium ${
                    (row.page?.statusCode ?? 0) < 300
                      ? "bg-green-100 text-green-700"
                      : (row.page?.statusCode ?? 0) < 400
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {row.page?.statusCode ?? "—"}
                </span>
              </td>
              <td class="max-w-xs truncate px-4 py-3 text-gray-700">
                {row.page?.title ?? "—"}
              </td>
              <td class="px-4 py-3">
                <span class={`font-bold ${gradeColor(row.overallScore)}`}>
                  {row.overallScore}
                </span>
              </td>
              <td class="px-4 py-3">
                {row.issueCount > 0 ? (
                  <span class="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                    {row.issueCount}
                  </span>
                ) : (
                  <span class="text-xs text-gray-400">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p class="py-8 text-center text-sm text-gray-500">No pages found.</p>
      )}
    </div>,
  );
});

// ─── Issues tab (delegates to existing issues partial) ──
appRoutes.get("/projects/:id/tab/issues", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (!latestCrawl) {
    return c.html(
      <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">
          No crawls found. Run a crawl to discover issues.
        </p>
      </div>,
    );
  }

  return c.html(
    <div
      id="issue-list"
      hx-get={`/app/projects/${projectId}/issues/list?jobId=${latestCrawl.id}`}
      hx-trigger="load"
      hx-swap="innerHTML"
    >
      <p class="py-8 text-center text-sm text-gray-400">Loading issues...</p>
    </div>,
  );
});

// ─── Competitors tab ──────────────────────────────────
appRoutes.get("/projects/:id/tab/competitors", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project) return c.text("Not found", 404);

  const benchmarks =
    await competitorBenchmarkQueries(db).listByProject(projectId);

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  let projScores = {
    overall: 0,
    technical: 0,
    content: 0,
    aiReadiness: 0,
    performance: 0,
  };
  if (latestCrawl?.status === "complete") {
    const scores = await scoreQueries(db).listByJob(latestCrawl.id);
    const avg = (arr: (number | null)[]) => {
      const v = arr.filter((n): n is number => n !== null);
      return v.length > 0
        ? Math.round(v.reduce((a, b) => a + b, 0) / v.length)
        : 0;
    };
    projScores = {
      overall: avg(scores.map((s) => s.overallScore)),
      technical: avg(scores.map((s) => s.technicalScore)),
      content: avg(scores.map((s) => s.contentScore)),
      aiReadiness: avg(scores.map((s) => s.aiReadinessScore)),
      performance: avg(scores.map((s) => s.lighthousePerf)),
    };
  }

  const byDomain = new Map<string, (typeof benchmarks)[number]>();
  for (const b of benchmarks) {
    if (!byDomain.has(b.competitorDomain)) {
      byDomain.set(b.competitorDomain, b);
    }
  }

  return c.html(
    <div class="space-y-6">
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">
          Benchmark Competitor
        </h3>
        <form
          hx-post={`/api/projects/${projectId}/competitors/benchmark`}
          hx-target="#competitor-list"
          hx-swap="beforeend"
          class="flex gap-2"
        >
          <input
            type="text"
            name="domain"
            placeholder="competitor.com"
            required
            class="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Benchmark
          </button>
        </form>
      </section>

      <div id="competitor-list" class="space-y-4">
        {byDomain.size === 0 ? (
          <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
            <p class="text-sm text-gray-500">
              No competitor benchmarks yet. Add a competitor domain above.
            </p>
          </div>
        ) : (
          Array.from(byDomain.entries()).map(([domain, b]) => {
            const delta = (b.overallScore ?? 0) - projScores.overall;
            const deltaLabel =
              delta > 0 ? "They lead" : delta < 0 ? "You lead" : "Tied";
            const deltaColor =
              delta > 0
                ? "bg-red-100 text-red-700"
                : delta < 0
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700";

            return (
              <div class="rounded-lg border bg-white p-5 dark:bg-gray-900">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-semibold">{domain}</h4>
                    <p class="text-xs text-gray-500">
                      Benchmarked{" "}
                      {b.crawledAt
                        ? new Date(b.crawledAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${deltaColor}`}
                  >
                    {deltaLabel}
                  </span>
                </div>
                <div class="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
                  {(
                    [
                      ["Overall", projScores.overall, b.overallScore],
                      ["Technical", projScores.technical, b.technicalScore],
                      ["Content", projScores.content, b.contentScore],
                      ["AI Ready", projScores.aiReadiness, b.aiReadinessScore],
                      ["Perf", projScores.performance, b.performanceScore],
                    ] as [string, number, number | null][]
                  ).map(([label, yours, theirs]) => {
                    const d = (theirs ?? 0) - yours;
                    return (
                      <div>
                        <p class="text-gray-500">{label}</p>
                        <p class="font-bold">
                          {yours} vs {theirs ?? "—"}
                        </p>
                        {d !== 0 && (
                          <p
                            class={`text-xs ${d > 0 ? "text-red-500" : "text-green-500"}`}
                          >
                            {d > 0 ? "+" : ""}
                            {d}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>,
  );
});

// ─── Visibility tab ───────────────────────────────────
appRoutes.get("/projects/:id/tab/visibility", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const checks = await visibilityQueries(db).listByProject(projectId);
  const recent = checks.slice(0, 20);

  return c.html(
    <div class="space-y-6">
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">
          Manual Visibility Check
        </h3>
        <form
          hx-post={`/api/projects/${projectId}/visibility/check`}
          hx-target="#visibility-results"
          hx-swap="afterbegin"
          class="flex flex-wrap gap-2"
        >
          <input
            type="text"
            name="query"
            placeholder="Enter a search query..."
            required
            class="flex-1 rounded border px-3 py-2 text-sm"
          />
          <select name="provider" class="rounded border px-3 py-2 text-sm">
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
            <option value="perplexity">Perplexity</option>
            <option value="gemini">Gemini</option>
            <option value="copilot">Copilot</option>
          </select>
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Check
          </button>
        </form>
      </section>

      <section class="rounded-lg border bg-white dark:bg-gray-900">
        <div class="border-b px-6 py-4">
          <h3 class="text-sm font-semibold text-gray-500">
            Recent Checks ({checks.length})
          </h3>
        </div>
        <div id="visibility-results">
          {recent.length === 0 ? (
            <p class="px-6 py-8 text-center text-sm text-gray-500">
              No visibility checks yet. Run one above.
            </p>
          ) : (
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-gray-500">
                  <th class="px-4 py-3 font-medium">Date</th>
                  <th class="px-4 py-3 font-medium">Query</th>
                  <th class="px-4 py-3 font-medium">Provider</th>
                  <th class="px-4 py-3 font-medium">Mentioned</th>
                  <th class="px-4 py-3 font-medium">Cited</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((check) => (
                  <tr class="border-b last:border-0">
                    <td class="px-4 py-3 text-gray-500">
                      {new Date(check.checkedAt).toLocaleDateString()}
                    </td>
                    <td class="max-w-xs truncate px-4 py-3">{check.query}</td>
                    <td class="px-4 py-3">
                      <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {check.llmProvider}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class={`rounded px-2 py-0.5 text-xs font-medium ${
                          check.brandMentioned
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {check.brandMentioned ? "Yes" : "No"}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class={`rounded px-2 py-0.5 text-xs font-medium ${
                          check.urlCited
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {check.urlCited ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>,
  );
});

// ─── History tab ──────────────────────────────────────
appRoutes.get("/projects/:id/tab/history", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const crawls = await crawlQueries(db).listByProject(projectId);

  const completedIds = crawls
    .filter((cr) => cr.status === "complete")
    .map((cr) => cr.id);

  const scoreMap = new Map<string, number>();
  for (const id of completedIds) {
    const scores = await scoreQueries(db).listByJob(id);
    if (scores.length > 0) {
      const avg = Math.round(
        scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
      );
      scoreMap.set(id, avg);
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    complete: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    crawling: "bg-blue-100 text-blue-700",
    scoring: "bg-purple-100 text-purple-700",
    pending: "bg-gray-100 text-gray-600",
    queued: "bg-yellow-100 text-yellow-700",
  };

  return c.html(
    <div class="overflow-x-auto rounded-lg border bg-white dark:bg-gray-900">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-gray-500">
            <th class="px-4 py-3 font-medium">Date</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Pages</th>
            <th class="px-4 py-3 font-medium">Score</th>
            <th class="px-4 py-3 font-medium">Grade</th>
            <th class="px-4 py-3 text-right font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {crawls.map((crawl) => {
            const score = scoreMap.get(crawl.id) ?? null;
            let grade: string | null = null;
            if (score !== null) {
              if (score >= 90) grade = "A";
              else if (score >= 80) grade = "B";
              else if (score >= 70) grade = "C";
              else if (score >= 60) grade = "D";
              else grade = "F";
            }

            return (
              <tr class="border-b last:border-0 hover:bg-gray-50">
                <td class="px-4 py-3 text-gray-500">
                  {crawl.startedAt
                    ? new Date(crawl.startedAt).toLocaleDateString()
                    : new Date(crawl.createdAt).toLocaleDateString()}
                </td>
                <td class="px-4 py-3">
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[crawl.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {crawl.status}
                  </span>
                </td>
                <td class="px-4 py-3">
                  {crawl.pagesCrawled ?? crawl.pagesScored ?? "—"}
                </td>
                <td class="px-4 py-3">
                  {score !== null ? (
                    <span class={`font-bold ${gradeColor(score)}`}>
                      {score}
                    </span>
                  ) : (
                    <span class="text-gray-400">—</span>
                  )}
                </td>
                <td class="px-4 py-3">
                  {grade ? (
                    <span
                      class={`rounded px-2 py-0.5 text-xs font-medium ${gradeBadgeColor(score ?? 0)}`}
                    >
                      {grade}
                    </span>
                  ) : (
                    <span class="text-gray-400">—</span>
                  )}
                </td>
                <td class="px-4 py-3 text-right">
                  <a
                    href={`/app/crawl/${crawl.id}`}
                    class="text-sm text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {crawls.length === 0 && (
        <p class="py-8 text-center text-sm text-gray-500">
          No crawl history yet.
        </p>
      )}
    </div>,
  );
});

// ─── Project settings tab ─────────────────────────────
appRoutes.get("/projects/:id/tab/settings", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) return c.text("Not found", 404);

  return c.html(
    <div class="max-w-lg space-y-6">
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-lg font-semibold">Project Settings</h3>
        <form
          hx-patch={`/api/projects/${projectId}`}
          hx-target="#project-settings-status"
          hx-swap="innerHTML"
          class="space-y-4"
        >
          <div>
            <label class="mb-1 block text-sm font-medium" for="projectName">
              Project Name
            </label>
            <input
              type="text"
              name="name"
              id="projectName"
              value={project.name}
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Domain</label>
            <p class="text-sm text-gray-500">{project.domain}</p>
            <p class="text-xs text-gray-400">
              Domain cannot be changed after creation.
            </p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium" for="siteDescription">
              Site Description
            </label>
            <textarea
              name="siteDescription"
              id="siteDescription"
              rows={3}
              class="w-full rounded border px-3 py-2 text-sm"
              placeholder="Brief description of what this site does..."
            >
              {project.siteDescription ?? ""}
            </textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium" for="industry">
              Industry
            </label>
            <input
              type="text"
              name="industry"
              id="industry"
              value={project.industry ?? ""}
              placeholder="e.g. SaaS, E-commerce, Healthcare"
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div class="flex items-center gap-3">
            <button
              type="submit"
              class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save
            </button>
            <span id="project-settings-status"></span>
          </div>
        </form>
      </section>

      <section class="rounded-lg border border-red-200 bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-2 text-lg font-semibold text-red-600">Danger Zone</h3>
        <p class="mb-4 text-sm text-gray-500">
          Permanently delete this project and all its data.
        </p>
        <button
          hx-delete={`/api/projects/${projectId}`}
          hx-confirm={`Delete "${project.name}"? This will permanently remove all crawl data, scores, and reports.`}
          class="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete Project
        </button>
      </section>
    </div>,
  );
});

// =====================================================================
// Crawl Detail Page (Live Progress)
// =====================================================================

appRoutes.get("/crawl/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const crawlId = c.req.param("id");
  const job = await crawlQueries(db).getById(crawlId);
  if (!job) return c.text("Crawl not found", 404);

  const project = await projectQueries(db).getById(job.projectId);
  if (!project || project.userId !== userId) return c.text("Not found", 404);

  const content = (
    <div>
      <PageHeader
        title={`Crawl — ${project.domain}`}
        description={`Started ${job.startedAt ? new Date(job.startedAt).toLocaleString() : new Date(job.createdAt).toLocaleString()}`}
        actions={
          <a
            href={`/app/projects/${project.id}?tab=history`}
            class="text-sm text-gray-500 hover:underline"
          >
            Back to project
          </a>
        }
      />
      <div
        id="crawl-progress"
        hx-get={`/app/crawl/${crawlId}/progress`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <p class="py-8 text-center text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout title="Crawl" user={{ email: user.email ?? "", plan: user.plan }}>
      {content}
    </Layout>,
  );
});

// ─── Crawl progress partial (polls during active crawl) ──
appRoutes.get("/crawl/:id/progress", async (c) => {
  const db = c.get("db");
  const crawlId = c.req.param("id");
  const job = await crawlQueries(db).getById(crawlId);
  if (!job) return c.text("Not found", 404);

  const isActive = ["pending", "queued", "crawling", "scoring"].includes(
    job.status,
  );
  const pct =
    job.pagesFound && job.pagesFound > 0
      ? Math.round(((job.pagesCrawled ?? 0) / job.pagesFound) * 100)
      : 0;

  const STATUS_BADGE: Record<string, string> = {
    complete: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    crawling: "bg-blue-100 text-blue-700",
    scoring: "bg-purple-100 text-purple-700",
    pending: "bg-gray-100 text-gray-600",
    queued: "bg-yellow-100 text-yellow-700",
  };

  if (isActive) {
    // Still running — return with hx-trigger to continue polling
    return c.html(
      <div
        hx-get={`/app/crawl/${crawlId}/progress`}
        hx-trigger="every 3s"
        hx-swap="outerHTML"
      >
        <div class="space-y-4 rounded-lg border bg-white p-6 dark:bg-gray-900">
          <div class="flex items-center gap-3">
            <span
              class={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {job.status}
            </span>
            <span class="text-sm text-gray-500">
              {job.pagesCrawled ?? 0} / {job.pagesFound ?? "?"} pages
            </span>
          </div>
          <div class="h-3 w-full rounded-full bg-gray-200">
            <div
              class="h-3 rounded-full bg-blue-500 transition-all"
              style={`width: ${pct}%`}
            ></div>
          </div>
          <div class="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p class="text-2xl font-bold">{job.pagesFound ?? 0}</p>
              <p class="text-xs text-gray-500">Found</p>
            </div>
            <div>
              <p class="text-2xl font-bold">{job.pagesCrawled ?? 0}</p>
              <p class="text-xs text-gray-500">Crawled</p>
            </div>
            <div>
              <p class="text-2xl font-bold">{job.pagesScored ?? 0}</p>
              <p class="text-xs text-gray-500">Scored</p>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  // Completed or failed — no more polling
  if (job.status === "failed") {
    return c.html(
      <div class="space-y-4 rounded-lg border border-red-200 bg-white p-6 dark:bg-gray-900">
        <div class="flex items-center gap-3">
          <span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Failed
          </span>
        </div>
        {job.errorMessage && (
          <p class="text-sm text-red-600">{job.errorMessage}</p>
        )}
        <a
          href={`/app/projects/${job.projectId}`}
          class="inline-block text-sm text-blue-600 hover:underline"
        >
          Back to project
        </a>
      </div>,
    );
  }

  // Complete — show score summary
  const scores = await scoreQueries(db).listByJob(crawlId);
  const avgScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
        )
      : null;

  const avgOf = (arr: (number | null)[]) => {
    const valid = arr.filter((n): n is number => n !== null);
    return valid.length > 0
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
      : null;
  };

  const technical = avgOf(scores.map((s) => s.technicalScore));
  const contentScore = avgOf(scores.map((s) => s.contentScore));
  const aiReadiness = avgOf(scores.map((s) => s.aiReadinessScore));
  const perfScore = avgOf(scores.map((s) => s.lighthousePerf));

  return c.html(
    <div class="space-y-6">
      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <div class="flex items-center gap-3">
          <span class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Complete
          </span>
          <span class="text-sm text-gray-500">
            {scores.length} pages scored
          </span>
        </div>
      </div>

      {avgScore !== null && (
        <div class="grid gap-6 sm:grid-cols-5">
          <div class="flex flex-col items-center rounded-lg border bg-white p-4 dark:bg-gray-900">
            <span class={`text-3xl font-bold ${gradeColor(avgScore)}`}>
              {avgScore}
            </span>
            <span class="mt-1 text-xs text-gray-500">Overall</span>
          </div>
          {(
            [
              ["Technical", technical],
              ["Content", contentScore],
              ["AI Ready", aiReadiness],
              ["Performance", perfScore],
            ] as [string, number | null][]
          ).map(([label, score]) => (
            <div class="flex flex-col items-center rounded-lg border bg-white p-4 dark:bg-gray-900">
              <span class={`text-3xl font-bold ${gradeColor(score ?? 0)}`}>
                {score ?? "—"}
              </span>
              <span class="mt-1 text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {job.summary && (
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-2 text-sm font-semibold text-gray-500">
            Executive Summary
          </h3>
          <p class="text-sm leading-relaxed text-gray-700">{job.summary}</p>
        </div>
      )}

      <div class="flex gap-3">
        <a
          href={`/app/projects/${job.projectId}`}
          class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          View Full Project
        </a>
        <a
          href={`/app/projects/${job.projectId}?tab=issues`}
          class="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Review Issues
        </a>
      </div>
    </div>,
  );
});
