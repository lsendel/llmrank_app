# Unified Reports Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the three separate reports tab sections (toolbar, report list, auto-report settings) into a single unified view with one "New Report" tabbed modal.

**Architecture:** Modify 4 existing components. The toolbar is simplified (Export Data + New Report). The `GenerateReportModal` gains a second "Schedule" tab. The `ReportList` table gains schedule rows at the top. The `AutoReportSettingsSection` is removed from the page.

**Tech Stack:** React, TypeScript, Radix Tabs (`@/components/ui/tabs`), existing hooks (`useAutoReportSettings`, `useReportsTabData`, `useReportsTabActions`)

**Spec:** `docs/superpowers/specs/2026-03-23-unified-reports-tab-design.md`

---

### Task 1: Simplify the toolbar

**Files:**

- Modify: `apps/web/src/components/reports/reports-tab-sections.tsx`

- [ ] **Step 1: Update ReportsTabToolbar**

Replace the current toolbar. Change the "Generate Report" button text to "New Report" and add a `Plus` icon instead of `FileText`. The toolbar props stay the same.

```tsx
// In reports-tab-sections.tsx, replace ReportsTabToolbar with:
export function ReportsTabToolbar({
  crawlJobId,
  onExport,
  onOpenGenerate,
}: {
  crawlJobId?: string;
  onExport: (format: "csv" | "json") => void | Promise<void>;
  onOpenGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!crawlJobId}>
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => void onExport("csv")}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onExport("json")}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={onOpenGenerate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>
      {!crawlJobId && (
        <p className="text-xs text-muted-foreground">
          Run a crawl first to generate reports
        </p>
      )}
    </div>
  );
}
```

Add `Plus` to the lucide-react imports. Remove the `disabled={!crawlJobId}` from the New Report button (modal handles this per-tab).

- [ ] **Step 2: Remove AutoReportSettingsSection export**

Delete the entire `AutoReportSettingsSection` function and its related imports (`Input`, `Label`, `Select*`, `Mail`, `ReportSchedule`, `inferAudienceFromSchedule`, `REPORT_AUDIENCE_ORDER`, `REPORT_AUDIENCE_PRESETS`, `ReportAudience`) that are no longer used by the toolbar. Keep imports still used by the toolbar (`Download`, `Button`, `DropdownMenu*`, `Loader2`).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck --filter=@llm-boost/web 2>&1 | tail -10`
Expected: Success (there will be temporary errors from `reports-tab.tsx` still referencing `AutoReportSettingsSection` — that's fine, we fix it in Task 4)

Note: This step may fail until Task 4 is complete. That's expected — proceed to Task 2.

---

### Task 2: Add schedule rows to ReportList

**Files:**

- Modify: `apps/web/src/components/reports/report-list.tsx`

- [ ] **Step 1: Add schedule row props and rendering**

Update `ReportList` to accept schedule-related props and render schedule rows above report rows in the same table.

```tsx
// Updated Props interface
interface Props {
  reports: Report[];
  schedules?: ReportSchedule[];
  crawlJobId?: string;
  sendingNowScheduleId?: string | null;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onScheduleSendNow?: (schedule: ReportSchedule) => void | Promise<void>;
  onScheduleToggle?: (schedule: ReportSchedule) => void | Promise<void>;
  onScheduleDelete?: (id: string) => void | Promise<void>;
}
```

Add `ReportSchedule` to the imports from `@/lib/api`. Add `Badge`, `Calendar` to imports.

In the table body, before the report rows `.map()`, add schedule rows:

```tsx
{
  (schedules ?? []).map((schedule) => (
    <TableRow key={`schedule-${schedule.id}`} className="bg-muted/30">
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              {schedule.type === "summary" ? "Summary" : "Detailed"}
              <Badge variant="outline" className="text-xs">
                Scheduled
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {schedule.recipientEmail}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs uppercase">{schedule.format}</TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={schedule.enabled ? "default" : "outline"}
          aria-pressed={schedule.enabled}
          onClick={() => void onScheduleToggle?.(schedule)}
        >
          {schedule.enabled ? "Active" : "Paused"}
        </Button>
      </TableCell>
      <TableCell>—</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(schedule.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!crawlJobId || sendingNowScheduleId === schedule.id}
            onClick={() => void onScheduleSendNow?.(schedule)}
          >
            {sendingNowScheduleId === schedule.id ? "Sending..." : "Send now"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete schedule"
            onClick={() => void onScheduleDelete?.(schedule.id)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  ));
}
```

- [ ] **Step 2: Update empty state**

Change the empty state condition to check both reports and schedules:

```tsx
if (reports.length === 0 && (!schedules || schedules.length === 0)) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        No reports yet. Click &quot;New Report&quot; to generate one or set up a
        schedule.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck --filter=@llm-boost/web 2>&1 | tail -10`
Expected: May still have errors from reports-tab.tsx — proceed to Task 3.

---

### Task 3: Add Schedule tab to the modal

**Files:**

- Modify: `apps/web/src/components/reports/generate-report-modal.tsx`

- [ ] **Step 1: Expand the modal with tabs**

The modal currently only handles on-demand generation. Add a "Schedule" tab using the existing `Tabs` UI component. The modal needs new props for schedule creation.

Updated props:

```tsx
interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  crawlJobId?: string;
  onGenerated: () => void;
  // Schedule tab props
  locked?: boolean;
  onCreateSchedule?: (args: {
    audience: ReportAudience;
    recipientInput: string;
    format: "pdf" | "docx";
    type: "summary" | "detailed";
  }) => void | Promise<void>;
  scheduleSaving?: boolean;
}
```

Add imports:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  REPORT_AUDIENCE_PRESETS,
  REPORT_AUDIENCE_ORDER,
  type ReportAudience,
} from "./reports-tab-helpers";
```

Wrap the existing form content in `TabsContent value="generate"` and add a new `TabsContent value="schedule"` with:

- Audience preset cards (3 buttons in a grid, same styling as the old `AutoReportSettingsSection`)
- Recipient Email input
- Format and Type selects
- Create Schedule button (disabled when locked or no recipient)
- Plan-locked message when `locked` is true

The Schedule tab manages its own local state (audience, recipientInput, format, type) via `useState`. State resets when `open` changes to `false` (use `useEffect`).

- [ ] **Step 2: Keep Generate Now tab working**

The Generate Now tab should disable the "Generate Report" button when `crawlJobId` is undefined, with hint text "Run a crawl first."

Change `crawlJobId` from required to optional in props. Guard `handleGenerate` to return early if no `crawlJobId`.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck --filter=@llm-boost/web 2>&1 | tail -10`

---

### Task 4: Wire everything together in reports-tab.tsx

**Files:**

- Modify: `apps/web/src/components/reports/reports-tab.tsx`

- [ ] **Step 1: Update the main tab component**

Remove the `AutoReportSettingsSection` import and rendering. Pass schedule data to `ReportList` and schedule-creation callbacks to `GenerateReportModal`. Coordinate loading states.

```tsx
"use client";

import { GenerateReportModal } from "./generate-report-modal";
import { ReportList } from "./report-list";
import {
  ReportsTabLoadingState,
  ReportsTabToolbar,
} from "./reports-tab-sections";
import { useAutoReportSettings } from "./use-auto-report-settings";
import { useReportsTabActions } from "./use-reports-tab-actions";
import { useReportsTabData } from "./use-reports-tab-data";

interface Props {
  projectId: string;
  crawlJobId: string | undefined;
}

export default function ReportsTab({ projectId, crawlJobId }: Props) {
  const { reports, setReports, loading, fetchReports } = useReportsTabData({
    projectId,
  });
  const { showModal, setShowModal, handleExport, handleDelete } =
    useReportsTabActions({
      crawlJobId,
      setReports,
    });
  const autoReportSettings = useAutoReportSettings({
    projectId,
    crawlJobId,
    onReportGenerated: fetchReports,
  });

  if (loading || autoReportSettings.loading) {
    return <ReportsTabLoadingState />;
  }

  return (
    <div className="space-y-4">
      <ReportsTabToolbar
        crawlJobId={crawlJobId}
        onExport={handleExport}
        onOpenGenerate={() => setShowModal(true)}
      />

      <ReportList
        reports={reports}
        schedules={autoReportSettings.schedules}
        crawlJobId={crawlJobId}
        sendingNowScheduleId={autoReportSettings.sendingNowScheduleId}
        onDelete={handleDelete}
        onRefresh={fetchReports}
        onScheduleSendNow={autoReportSettings.handleSendNow}
        onScheduleToggle={autoReportSettings.handleToggle}
        onScheduleDelete={autoReportSettings.handleDelete}
      />

      <GenerateReportModal
        open={showModal}
        onClose={() => setShowModal(false)}
        projectId={projectId}
        crawlJobId={crawlJobId}
        onGenerated={fetchReports}
        locked={autoReportSettings.locked}
        onCreateSchedule={async ({ recipientInput, format, type }) => {
          autoReportSettings.setRecipientInput(recipientInput);
          autoReportSettings.setFormat(format);
          autoReportSettings.setType(type);
          // Small delay to let state propagate, then call create
          await autoReportSettings.handleCreate();
          setShowModal(false);
        }}
        scheduleSaving={autoReportSettings.saving}
      />
    </div>
  );
}
```

Note: The `GenerateReportModal` is now always rendered (not gated by `crawlJobId`) because the Schedule tab doesn't need a crawlJobId. The Generate Now tab handles the disabled state internally.

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck --filter=@llm-boost/web 2>&1 | tail -10`
Expected: Success, no errors

- [ ] **Step 3: Run existing tests**

Run: `pnpm test --filter=@llm-boost/web -- --run reports 2>&1 | tail -30`

The existing test `reports-tab.test.tsx` will likely need updates since it references "Auto-Report Settings", "3. Add Schedule", and the old UI structure. Update the test to match the new UI:

- The schedule creation test should now open the modal, switch to the Schedule tab, fill in the form, and click "Create Schedule"
- The send-now test should find the "Send now" button in the unified table (it's still rendered, just in a different location)

- [ ] **Step 4: Update tests**

Update `reports-tab.test.tsx` to work with the new unified layout. The mock for `GenerateReportModal` needs to be removed or updated since it now contains the schedule form. Alternatively, test the schedule creation flow through the actual modal.

- [ ] **Step 5: Final verification**

Run: `pnpm typecheck --filter=@llm-boost/web 2>&1 | tail -10`
Run: `pnpm test --filter=@llm-boost/web -- --run reports 2>&1 | tail -30`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/reports/
git commit -m "feat: unify reports tab — single table with tabbed New Report modal

Merge toolbar, report list, and auto-report settings into one view.
New Report modal has Generate Now and Schedule tabs.
Schedule rows appear at top of unified report table.
AutoReportSettingsSection removed from page layout."
```

---

### Task 5: Deploy and verify

- [ ] **Step 1: Build and deploy**

```bash
cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc
```

- [ ] **Step 2: Verify in browser**

Navigate to `https://llmrank.app/dashboard/projects/fe681853-0cd0-4f8e-8b39-5a987caf84c0?tab=reports` and verify:

- Toolbar shows "Export Data" + "New Report"
- Existing schedules appear as rows at top of table with Active/Paused toggle and Send Now
- Existing reports appear below schedules
- "New Report" modal has two tabs: Generate Now and Schedule
- Generate Now tab works as before
- Schedule tab shows audience presets, recipient input, format/type, create button
