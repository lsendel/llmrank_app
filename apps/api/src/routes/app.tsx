/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { htmxMiddleware } from "../middleware/htmx";
import { Layout, PageHeader } from "../views/layout";
import { userQueries } from "@llm-boost/db";

export const appRoutes = new Hono<AppEnv>();

appRoutes.use("*", authMiddleware);
appRoutes.use("*", htmxMiddleware);

// ─── Settings page ─────────────────────────────────────
appRoutes.get("/settings", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const content = (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account preferences"
      />

      {/* Digest preferences — HTMX form */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">Email Digest</h2>
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
              <option
                value="weekly"
                selected={user.digestFrequency === "weekly"}
              >
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
          <span id="digest-status" class="text-sm text-green-600"></span>
        </form>
      </section>
    </div>
  );

  // If HTMX partial request, return just the content
  if (c.get("isHtmx")) {
    return c.html(content);
  }

  // Full page render
  return c.html(
    <Layout
      title="Settings"
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});
