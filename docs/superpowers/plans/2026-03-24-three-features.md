# Three Features: Issues Pagination, Report Preview, Meta Integration Polish

**Goal:** Ship three improvements: paginated issues list, in-browser report preview, and Meta integration polish.

---

## Feature 8: Issues Tab Pagination

### Task 8.1: Add pagination to IssuesList

- Modify: `apps/web/src/components/tabs/issues-tab-sections.tsx`
- Modify: `apps/web/src/components/tabs/issues-tab.tsx`
- Modify: `apps/web/src/components/tabs/use-issues-tab-data.ts`

Client-side pagination (issues are already loaded for filtering). Add `page` and `PAGE_SIZE=25` state. Slice `filteredIssues` by page. Add Previous/Next buttons below the list with page count display. Reset page to 1 when filters change.

---

## Feature 7: Report Preview

### Task 7.1: Add /api/reports/:id/content endpoint

- Modify: `apps/api/src/routes/reports.ts`
- Use: `@llm-boost/reports` aggregateReportData + fetchReportData

New GET endpoint returns JSON shaped for UnifiedReportView: domain, overallScore, grade, sections array with actions and code snippets.

### Task 7.2: Add Preview button + modal to ReportList

- Modify: `apps/web/src/components/reports/report-list.tsx`
- Modify: `apps/web/src/lib/api/domains/reports.ts` (add getContent method)

Add Eye icon button next to Download for complete reports. Opens a modal/drawer rendering UnifiedReportView with fetched content data.

---

## Feature 9: Meta Integration Polish

### Task 9.1: Add Meta signal tasks to integrations tab

- Modify: `apps/web/src/components/tabs/integrations-tab-helpers.ts` (buildSignalTaskPlan)

Add Meta-specific signals: pages with missing OG tags flagged as warnings, high-engagement pages without proper structured data flagged as opportunities.

### Task 9.2: Add ad account discovery

- Modify: `apps/api/src/routes/integrations/oauth.ts` or new route
- Modify: frontend Meta connect modal

Add endpoint to list user's ad accounts via /me/adaccounts. Show dropdown in connect modal instead of manual text input.

---

## Execution Order

8.1 → 7.1 → 7.2 → 9.1 → 9.2 → deploy all
