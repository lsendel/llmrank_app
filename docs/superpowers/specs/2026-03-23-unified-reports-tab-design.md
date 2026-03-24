# Unified Reports Tab Design

**Date:** 2026-03-23
**Status:** Approved

## Summary

Merge the reports tab's three separate sections (toolbar, report list, auto-report settings card) into a single unified view. One "New Report" button opens a tabbed modal for both on-demand generation and schedule creation. Reports and schedules appear in a single table.

## Current State

The reports tab has three disconnected sections stacked vertically:

1. **ReportsTabToolbar** — Export Data dropdown + Generate Report button
2. **ReportList** — table of generated reports (type, format, status, size, date, download/delete)
3. **AutoReportSettingsSection** — a card with audience presets, recipient email, format/type selects, schedule list with send now/toggle/delete actions

Key files:

- `apps/web/src/components/reports/reports-tab.tsx` — main tab component
- `apps/web/src/components/reports/reports-tab-sections.tsx` — toolbar + auto-report card
- `apps/web/src/components/reports/report-list.tsx` — report table
- `apps/web/src/components/reports/generate-report-modal.tsx` — on-demand generation modal
- `apps/web/src/components/reports/use-auto-report-settings.ts` — schedule management hook
- `apps/web/src/components/reports/use-reports-tab-actions.ts` — export/delete actions
- `apps/web/src/components/reports/use-reports-tab-data.ts` — report list data fetching
- `apps/web/src/components/reports/reports-tab-helpers.ts` — audience presets (executive, seo_lead, content_lead)

## Design

### Layout (top to bottom)

1. **Toolbar** — single row, right-aligned:
   - "Export Data" dropdown (CSV/JSON) — unchanged
   - "New Report" button — replaces the old "Generate Report" button

2. **Unified Table** — single table combining both report rows and schedule rows:
   - Columns: Type | Format | Status | Size | Created | Actions
   - **Schedule rows** float to the top with a distinct "Scheduled" badge in the Type column (e.g. "Summary · Scheduled")
   - **Report rows** below, sorted by creation date descending
   - No separate "Source" column — the DB `reports` table lacks a `source` or `scheduleId` field, and adding one is out of scope. Instead, schedule rows are visually distinct by their badge and row styling.

3. **Empty state** — when no reports and no schedules exist, show a prompt: `No reports yet. Click "New Report" to generate one or set up a schedule.`

4. **Loading** — show the loading spinner until both reports and schedules have loaded before rendering the table.

### "New Report" Modal

Replaces both `GenerateReportModal` and the schedule creation form from `AutoReportSettingsSection`. Uses the existing `Tabs` UI component (`@/components/ui/tabs`). Two tabs:

**Tab 1: Generate Now**

- Report Type select (Summary / Detailed) — unchanged
- Format select (PDF / DOCX) — unchanged
- Prepared For input (optional) — unchanged
- "Generate Report" button — disabled with hint text when `crawlJobId` is undefined (same as current behavior)

**Tab 2: Schedule**

- Audience preset cards (Executive Summary, SEO Lead, Content Lead) — moved from auto-report card, using existing `REPORT_AUDIENCE_PRESETS`
- Recipient Email input — moved from auto-report card
- Format select (PDF / DOCX)
- Type select (Summary / Detailed)
- "Create Schedule" button
- Plan-locked users see a disabled state with upgrade prompt

The modal manages its own local state for the Schedule tab form fields (audience, recipient, format, type). State resets when the modal closes.

### Table Row Types

**Report row (unchanged columns):**

- Type: "Executive Summary" or "Detailed Report" with icon
- Format: PDF / DOCX
- Status: queued / generating / complete / failed (existing badges)
- Size: file size
- Created: date
- Actions: Download (if complete) + Delete

**Schedule row:**

- Type: "Summary" or "Detailed" + "Scheduled" badge + recipient email below in muted text
- Format: PDF / DOCX
- Status: "Active" or "Paused" toggle button
- Size: "—"
- Created: schedule creation date
- Actions: Send Now (disabled if no crawlJobId) + Delete

### What Gets Removed

- `AutoReportSettingsSection` export from `reports-tab-sections.tsx` — schedule creation moves to modal Schedule tab, schedule list moves to unified table rows
- Separate "Generate Report" button — replaced by "New Report"
- The `ReportsTabToolbar` is simplified (just Export Data + New Report)

### What Stays Unchanged

- `use-auto-report-settings.ts` hook — still manages schedule CRUD, just consumed differently
- `use-reports-tab-data.ts` hook — still fetches report list
- `use-reports-tab-actions.ts` hook — still handles export/delete
- `reports-tab-helpers.ts` — audience presets, constants stay the same
- API layer and DB schema — no backend changes needed

### Files to Modify

1. `reports-tab.tsx` — remove AutoReportSettingsSection rendering, pass schedules to ReportList, coordinate both loading states
2. `reports-tab-sections.tsx` — simplify toolbar to just Export Data + New Report, remove AutoReportSettingsSection export
3. `report-list.tsx` — accept schedule rows via new prop, render schedule rows at top with distinct styling and inline actions (send now, toggle, delete)
4. `generate-report-modal.tsx` — add Tabs with "Generate Now" (existing form) and "Schedule" (audience presets + recipient + format + type + create button, with plan-lock check)

### Files to Delete

None — we modify existing files. The `AutoReportSettingsSection` export is removed from `reports-tab-sections.tsx` but the file itself remains (it still contains the toolbar).
