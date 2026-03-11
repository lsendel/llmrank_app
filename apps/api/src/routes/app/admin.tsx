/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { adminMiddleware } from "../../middleware/admin";
import { Layout, PageHeader } from "../../views/layout";
import { adminQueries } from "@llm-boost/db";
import { SkeletonCard, SkeletonTable } from "../../views/htmx-helpers";

export const adminAppRoutes = new Hono<AppEnv>();

adminAppRoutes.use("*", adminMiddleware);

adminAppRoutes.get("/admin", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/sign-in");

  const content = (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="System overview and user management"
      />
      {/* Stats — loaded lazily */}
      <div
        id="admin-stats"
        hx-get="/app/admin/stats"
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      {/* User search + list */}
      <div class="mt-8">
        <h2 class="mb-4 text-lg font-semibold">Users</h2>
        <input
          type="search"
          name="q"
          hx-get="/app/admin/users"
          hx-trigger="keyup changed delay:300ms"
          hx-target="#admin-user-list"
          placeholder="Search by email or name..."
          class="mb-4 w-full rounded border px-4 py-2 text-sm"
        />
        <div
          id="admin-user-list"
          hx-get="/app/admin/users"
          hx-trigger="load"
          hx-swap="innerHTML"
        >
          <SkeletonTable rows={6} />
        </div>
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout title="Admin" user={{ email: String(user.email ?? ""), plan: String(user.plan ?? "free") }}>
      {content}
    </Layout>,
  );
});

// ─── Admin stats partial ──────────────────────────────
adminAppRoutes.get("/admin/stats", async (c) => {
  const db = c.get("db");
  const stats = await adminQueries(db).getStats();

  return c.html(
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">MRR</p>
        <p class="text-2xl font-bold">${stats.mrr.toLocaleString()}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">Active Subscribers</p>
        <p class="text-2xl font-bold">{stats.activeSubscribers}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">Total Customers</p>
        <p class="text-2xl font-bold">{stats.totalCustomers}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">Churn Rate</p>
        <p class="text-2xl font-bold">{stats.churnRate}%</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">Pending Jobs</p>
        <p class="text-2xl font-bold">{stats.ingestHealth.pendingJobs}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">Running Jobs</p>
        <p class="text-2xl font-bold">{stats.ingestHealth.runningJobs}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">Failed (24h)</p>
        <p class="text-2xl font-bold text-red-600">
          {stats.ingestHealth.failedLast24h}
        </p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
        <p class="text-sm text-gray-500">Avg Crawl Time</p>
        <p class="text-2xl font-bold">
          {stats.ingestHealth.avgCompletionMinutes}m
        </p>
      </div>
    </div>,
  );
});

// ─── Admin user list partial ──────────────────────────
adminAppRoutes.get("/admin/users", async (c) => {
  const db = c.get("db");
  const search = c.req.query("q") ?? "";
  const page = parseInt(c.req.query("page") ?? "1", 10);

  const result = await adminQueries(db).getCustomers({
    page,
    limit: 25,
    search: search || undefined,
  });

  const PLAN_COLORS: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    starter: "bg-blue-100 text-blue-700",
    pro: "bg-purple-100 text-purple-700",
    agency: "bg-green-100 text-green-700",
  };

  return c.html(
    <div>
      <div class="overflow-x-auto rounded-lg border bg-white dark:bg-gray-900">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-gray-500">
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Plan</th>
              <th class="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((u) => (
              <tr class="border-b last:border-0 hover:bg-gray-50">
                <td class="px-4 py-3 font-mono text-xs">{u.email}</td>
                <td class="px-4 py-3">{u.name ?? "—"}</td>
                <td class="px-4 py-3">
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[u.plan] ?? PLAN_COLORS.free}`}
                  >
                    {u.plan}
                  </span>
                </td>
                <td class="px-4 py-3 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.data.length === 0 && (
          <p class="py-8 text-center text-sm text-gray-500">
            {search ? "No users match your search." : "No users found."}
          </p>
        )}
      </div>

      {/* Pagination */}
      {result.pagination.totalPages > 1 && (
        <div class="mt-4 flex items-center justify-between text-sm">
          <span class="text-gray-500">
            Page {result.pagination.page} of {result.pagination.totalPages} (
            {result.pagination.total} total)
          </span>
          <div class="flex gap-2">
            {page > 1 && (
              <button
                hx-get={
                  search
                    ? "/app/admin/users?q=" + encodeURIComponent(search) + "&page=" + String(page - 1)
                    : "/app/admin/users?page=" + String(page - 1)
                }
                hx-target="#admin-user-list"
                hx-swap="innerHTML"
                class="rounded border px-3 py-1 text-gray-700 hover:bg-gray-50"
              >
                Previous
              </button>
            )}
            {page < result.pagination.totalPages && (
              <button
                hx-get={
                  search
                    ? "/app/admin/users?q=" + encodeURIComponent(search) + "&page=" + String(page + 1)
                    : "/app/admin/users?page=" + String(page + 1)
                }
                hx-target="#admin-user-list"
                hx-swap="innerHTML"
                class="rounded border px-3 py-1 text-gray-700 hover:bg-gray-50"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>,
  );
});
