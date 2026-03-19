# UX Improvements Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve snippet installation (verification + platform guides + CF auto-inject), auto-sync on connect, fix PSI CWV display, reduce page length via collapsible sections and removing static card, and add integration health banner.

**Architecture:** Frontend-heavy (Next.js components), one API endpoint addition (snippet verification), one Cloudflare Worker script for auto-injection. Each task is independently deployable.

**Tech Stack:** Next.js, TypeScript, Hono API, Cloudflare Workers, Vitest

---

### Task 1: Snippet installation verification endpoint

**Problem:** Users install the snippet manually but have no way to confirm it's working beyond waiting for traffic.

**Files:**

- Modify: `apps/api/src/routes/analytics.ts` — add `GET /analytics/:projectId/verify-snippet`
- Modify: `apps/web/src/lib/api/domains/integrations.ts` or create `apps/web/src/lib/api/domains/analytics.ts` — add client method

- [ ] **Step 1: Add verification endpoint**

In `apps/api/src/routes/analytics.ts`, add a new route after the existing analytics routes. The endpoint fetches the user's site HTML and checks for the snippet:

```typescript
analyticsRoutes.get(
  "/analytics/:projectId/verify-snippet",
  authMiddleware,
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    const project = await projectQueries(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const domain = project.domain;
    const siteUrl = domain.startsWith("http") ? domain : `https://${domain}`;

    try {
      const res = await fetch(siteUrl, {
        headers: { "User-Agent": "LLMRank-Snippet-Verifier/1.0" },
        redirect: "follow",
      });

      if (!res.ok) {
        return c.json({
          data: {
            installed: false,
            reason: `Site returned HTTP ${res.status}`,
          },
        });
      }

      const html = await res.text();
      const hasSnippet = html.includes("api.llmrank.app/s/analytics.js");
      const hasProjectId = html.includes(projectId);

      return c.json({
        data: {
          installed: hasSnippet && hasProjectId,
          hasSnippet,
          hasProjectId,
          reason: !hasSnippet
            ? "Snippet script tag not found in page HTML"
            : !hasProjectId
              ? "Snippet found but project ID doesn't match"
              : "Snippet correctly installed",
        },
      });
    } catch (err) {
      return c.json({
        data: {
          installed: false,
          reason: `Could not fetch site: ${err instanceof Error ? err.message : "unknown error"}`,
        },
      });
    }
  },
);
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/analytics.ts
git commit -m "feat: add snippet verification API endpoint"
```

---

### Task 2: Platform-specific installation guides

**Problem:** Users don't know how to add a script tag to their specific platform.

**Files:**

- Create: `apps/web/src/components/snippet-install-guides.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx`

- [ ] **Step 1: Create platform guides component**

Create `apps/web/src/components/snippet-install-guides.tsx` with a tabbed interface showing platform-specific instructions:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const PLATFORMS = [
  {
    id: "html",
    label: "HTML",
    instructions:
      "Paste the snippet inside the <head> tag of your index.html file, before the closing </head>.",
  },
  {
    id: "wordpress",
    label: "WordPress",
    instructions:
      "Go to Appearance → Theme File Editor → header.php. Paste the snippet before </head>. Alternatively, use a plugin like 'Insert Headers and Footers' to add it without editing theme files.",
  },
  {
    id: "shopify",
    label: "Shopify",
    instructions:
      "Go to Online Store → Themes → Edit Code → theme.liquid. Paste the snippet inside the <head> section before </head>.",
  },
  {
    id: "nextjs",
    label: "Next.js",
    instructions:
      "Add the snippet to your app/layout.tsx inside the <head> tag using next/script with strategy='afterInteractive', or add it directly to your custom _document.tsx.",
  },
  {
    id: "cloudflare",
    label: "Cloudflare Pages",
    instructions:
      "Add the snippet to your index.html <head> section. If using a framework, add it to the HTML template. For automatic injection, use the Cloudflare auto-inject option below.",
  },
  {
    id: "vercel",
    label: "Vercel",
    instructions:
      "If using Next.js, add via app/layout.tsx. For static sites, add to the index.html <head>. Vercel also supports injecting scripts via the Analytics tab in dashboard settings.",
  },
] as const;

export function SnippetInstallGuides() {
  const [selected, setSelected] = useState("html");
  const platform = PLATFORMS.find((p) => p.id === selected)!;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Platform guide
      </p>
      <div className="flex flex-wrap gap-1">
        {PLATFORMS.map((p) => (
          <Button
            key={p.id}
            variant={selected === p.id ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setSelected(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{platform.instructions}</p>
    </div>
  );
}
```

- [ ] **Step 2: Add guides to snippet settings section**

In `apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx`, import and render `SnippetInstallGuides` below the snippet code block when `snippetEnabled` is true:

```tsx
import { SnippetInstallGuides } from "@/components/snippet-install-guides";
// ... inside the snippetEnabled block, after the code pre block:
<SnippetInstallGuides />;
```

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/snippet-install-guides.tsx apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx
git commit -m "feat: platform-specific snippet installation guides"
```

---

### Task 3: Cloudflare auto-inject option

**Problem:** For sites on Cloudflare, users could skip manual installation entirely.

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx`

- [ ] **Step 1: Add Cloudflare auto-inject instructions**

Below the platform guides, add a callout card explaining Cloudflare Zaraz or Workers-based injection. Since we can't programmatically configure the user's Cloudflare account, provide a step-by-step guide:

```tsx
{
  snippetEnabled && (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
      <p className="text-xs font-medium">
        Cloudflare Auto-Inject (no code changes needed)
      </p>
      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
        <li>Go to your Cloudflare dashboard → your site → Zaraz</li>
        <li>Click "Add new tool" → "Custom HTML"</li>
        <li>Paste the snippet code above</li>
        <li>Set firing trigger to "Page Load" on all pages</li>
        <li>Save — the snippet will be injected automatically on every page</li>
      </ol>
      <p className="text-[10px] text-muted-foreground">
        This works for any site proxied through Cloudflare, regardless of your
        tech stack.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/projects/[id]/_components/snippet-settings-section.tsx
git commit -m "feat: Cloudflare Zaraz auto-inject instructions for snippet"
```

---

### Task 4: Update snippet verification button to use the API

**Problem:** The current "Verify Snippet" button sends a test beacon — it verifies the collect endpoint works but not that the snippet is actually on the user's site.

**Files:**

- Modify: `apps/web/src/components/tabs/ai-traffic-tab.tsx`

- [ ] **Step 1: Replace the test beacon with the verification API call**

Update `handleTestSnippet` to call the new verification endpoint instead:

```typescript
async function handleTestSnippet() {
  setTesting(true);
  try {
    const res = await fetch(`/api/analytics/${projectId}/verify-snippet`);
    const data = await res.json();
    if (data.data?.installed) {
      setTestResult("success");
    } else {
      setTestResult("error");
      setTestMessage(data.data?.reason ?? "Snippet not found");
    }
  } catch {
    setTestResult("error");
    setTestMessage("Could not verify snippet installation");
  } finally {
    setTesting(false);
    setTimeout(() => {
      setTestResult(null);
      setTestMessage(null);
    }, 8000);
  }
}
```

Add state: `const [testMessage, setTestMessage] = useState<string | null>(null);`

Update the button to show the message on error:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleTestSnippet}
  disabled={testing}
>
  {testing
    ? "Checking..."
    : testResult === "success"
      ? "✓ Snippet verified"
      : testResult === "error"
        ? "✗ Not found"
        : "Verify Installation"}
</Button>;
{
  testResult === "error" && testMessage && (
    <p className="text-xs text-destructive mt-1">{testMessage}</p>
  );
}
```

Note: The API call should go through the Next.js proxy to handle auth. Use `api.` client or `fetch` with credentials. Read the existing code to see how other authenticated API calls are made from this component.

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tabs/ai-traffic-tab.tsx
git commit -m "feat: verify snippet installation via API instead of test beacon"
```

---

### Task 5: Auto-sync on integration connect

**Problem:** After connecting GSC/GA4/Clarity via OAuth, users have to manually click "Sync Now". Should trigger automatically.

**Files:**

- Modify: `apps/web/src/components/tabs/use-integrations-tab-actions.ts`

- [ ] **Step 1: Trigger sync after successful connect**

Find the `handleOAuthConnect` and `handleConnect` functions. After they successfully connect, call `handleSync()` automatically:

In the OAuth connect success handler (after the connect succeeds and `refreshIntegrations()` is called), add:

```typescript
// Auto-sync after connecting
setTimeout(() => void handleSync(), 1000);
```

Do the same in `handleConnect` (for API key integrations like PSI, Clarity).

The small delay ensures the integration record is fully committed before sync tries to read credentials.

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tabs/use-integrations-tab-actions.ts
git commit -m "feat: auto-sync integration data after connecting"
```

---

### Task 6: Fix PSI CWV Pass Rate — show "No field data" when CrUX is empty

**Problem:** CWV Pass Rate shows "0%" when there's no CrUX field data (site too new/low-traffic). Misleading — looks like failure when lab score is 79/100.

**Files:**

- Modify: `packages/reports/src/integrations.ts` — track whether any CrUX data exists
- Modify: `packages/reports/src/types.ts` — add `hasCruxData` field
- Modify: `apps/web/src/lib/api/types/integrations.ts` — add `hasCruxData` field
- Modify: `apps/web/src/components/integration-insights-view-sections.tsx` — conditional display

- [ ] **Step 1: Add `hasCruxData` to PSI type**

In `packages/reports/src/types.ts` and `apps/web/src/lib/api/types/integrations.ts`, add `hasCruxData: boolean` to the `psi` type.

- [ ] **Step 2: Track CrUX presence in aggregation**

In `packages/reports/src/integrations.ts`, in the PSI aggregation block, add a counter:

```typescript
let cruxDataCount = 0;
// ... inside the loop:
const crux = String(d.cruxOverall ?? "");
if (crux && crux !== "null" && crux !== "") cruxDataCount++;
```

Then in the psi object:

```typescript
hasCruxData: cruxDataCount > 0,
```

- [ ] **Step 3: Update PsiSection to show "No field data" conditionally**

In `apps/web/src/components/integration-insights-view-sections.tsx`, in the `PsiSection` component, update the CWV Pass Rate display:

```tsx
<div className="rounded-lg border p-4">
  <p className="text-sm font-medium">CWV Pass Rate</p>
  {psi.hasCruxData ? (
    <p className="mt-1 text-3xl font-bold">
      {psi.cwvPassRate}
      <span className="ml-1 text-sm font-normal text-muted-foreground">%</span>
    </p>
  ) : (
    <p className="mt-1 text-sm text-muted-foreground">
      No field data — site needs more traffic for Chrome UX Report
    </p>
  )}
</div>
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/reports/src/integrations.ts packages/reports/src/types.ts apps/web/src/lib/api/types/integrations.ts apps/web/src/components/integration-insights-view-sections.tsx
git commit -m "fix: show 'No field data' for CWV when CrUX data unavailable"
```

---

### Task 7: Collapsible provider sections in analytics

**Problem:** The integration analytics page is very long (~8 cards stacked). Users have to scroll past sections they've already reviewed.

**Files:**

- Modify: `apps/web/src/components/integration-insights-view.tsx`

- [ ] **Step 1: Add collapsible wrappers around provider sections**

Use the existing shadcn/ui `Collapsible` component (or import from `@/components/ui/collapsible`). If it doesn't exist, use a simple `details/summary` HTML pattern or a `useState` toggle.

Wrap each provider section (GSC, GA4, Meta, Clarity, PSI) in a collapsible with a header showing the provider name and a chevron toggle. Default state: first section open, rest collapsed.

```tsx
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium hover:bg-muted/50"
      >
        <Icon className="h-4 w-4 text-primary" />
        {title}
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4" />
        )}
      </button>
      {open && <div className="border-t px-3 pb-3">{children}</div>}
    </div>
  );
}
```

Wrap each section: GSC (default open), GA4, Clarity, PSI, Meta in `CollapsibleSection`.

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/integration-insights-view.tsx
git commit -m "feat: collapsible provider sections in integration analytics"
```

---

### Task 8: Remove static "How integrations enhance your reports" card

**Problem:** The card is static marketing content that never changes regardless of what's connected. Takes up significant scroll space.

**Files:**

- Modify: `apps/web/src/components/tabs/integrations-tab-analytics.tsx`

- [ ] **Step 1: Remove the enhancement card**

Find the section that renders the "How integrations enhance your reports" card (the last `Card` in `IntegrationAnalyticsSection`, conditional on `hasConnectedIntegrations`). Remove the entire block:

```tsx
{
  hasConnectedIntegrations && (
    <Card>
      <CardHeader>
        <CardTitle>How integrations enhance your reports</CardTitle>
        ...
      </CardHeader>
      <CardContent>...</CardContent>
    </Card>
  );
}
```

Delete this entire conditional block.

- [ ] **Step 2: Run typecheck**

Check for any unused imports after removal.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tabs/integrations-tab-analytics.tsx
git commit -m "fix: remove static integrations enhancement card to reduce page length"
```

---

### Task 9: Integration health summary banner

**Problem:** No at-a-glance health status for integrations. Users have to scroll through each card to see status.

**Files:**

- Modify: `apps/web/src/components/tabs/integrations-tab-sections.tsx` or `integrations-tab.tsx`

- [ ] **Step 1: Add a health summary banner above the integration cards**

Create a small banner component that summarizes integration health:

```tsx
function IntegrationHealthBanner({
  integrations,
}: {
  integrations: ProjectIntegration[] | undefined;
}) {
  if (!integrations || integrations.length === 0) return null;

  const connected = integrations.filter((i) => i.hasCredentials && i.enabled);
  const withErrors = connected.filter((i) => i.lastError);
  const lastSync = connected
    .map((i) => i.lastSyncAt)
    .filter(Boolean)
    .sort()
    .pop();

  const timeAgo = lastSync ? formatDistanceToNow(new Date(lastSync)) : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-2 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${withErrors.length > 0 ? "bg-yellow-500" : connected.length > 0 ? "bg-green-500" : "bg-gray-400"}`}
      />
      <span className="text-muted-foreground">
        {connected.length}/{integrations.length} connected
        {withErrors.length > 0 && ` · ${withErrors.length} with errors`}
        {timeAgo && ` · last sync ${timeAgo} ago`}
      </span>
    </div>
  );
}
```

Note: Use a simple relative time formatter. Check if `date-fns` `formatDistanceToNow` is already available, or compute manually:

```typescript
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
```

- [ ] **Step 2: Render the banner**

Add it at the top of the integration cards grid in `IntegrationCardsSection` (or wherever the integration cards are rendered), before the individual cards.

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/integrations-tab-sections.tsx
git commit -m "feat: integration health summary banner"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`

- [ ] **Step 2: Run tests**

Run: `pnpm test`

- [ ] **Step 3: Push and deploy**

```bash
git push
```

Verify at https://llmrank.app/dashboard/projects/fe681853-0cd0-4f8e-8b39-5a987caf84c0?tab=integrations and ?tab=ai-traffic
