# Report Generation System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive report generation system that produces expert-level AI-readiness PDF and DOCX reports, stored on Cloudflare R2, generated via a dedicated Queue Worker.

**Architecture:** Dedicated Cloudflare Worker consumes from a Queue, aggregates analytics data from all existing services, renders PDF via `@react-pdf/renderer` and DOCX via `docx` npm package, uploads to R2, and exposes download via signed URLs. New `packages/reports` package owns all report logic.

**Tech Stack:** @react-pdf/renderer (PDF), docx (Word), Cloudflare Queues + Workers, R2, Drizzle ORM, Vitest

---

## Phase 1: Database & Shared Types

### Task 1: Add report enums and table to schema

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/shared/src/constants/plans.ts`

**Step 1: Add report enums to schema.ts**

Add after the existing enum definitions (around line 30):

```typescript
export const reportTypeEnum = pgEnum("report_type", ["summary", "detailed"]);
export const reportFormatEnum = pgEnum("report_format", ["pdf", "docx"]);
export const reportStatusEnum = pgEnum("report_status", [
  "queued",
  "generating",
  "complete",
  "failed",
]);
```

**Step 2: Add reports table to schema.ts**

Add after the `visibilityChecks` table:

```typescript
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    crawlJobId: uuid("crawl_job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: reportTypeEnum("type").notNull(),
    format: reportFormatEnum("format").notNull(),
    status: reportStatusEnum("status").notNull().default("queued"),
    r2Key: text("r2_key"),
    fileSize: integer("file_size"),
    config: jsonb("config").default({}),
    error: text("error"),
    generatedAt: timestamp("generated_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_reports_project").on(t.projectId),
    index("idx_reports_user").on(t.userId),
  ],
);
```

**Step 3: Export reports table from db/src/index.ts**

Ensure `reports` is exported alongside other tables.

**Step 4: Add report plan limits to shared/src/constants/plans.ts**

Add to the `PlanLimits` interface:

```typescript
reportsPerMonth: number;
reportTypes: ("summary" | "detailed")[];
reportBranding: "none" | "logo" | "full";
reportHistoryDepth: number;
reportCompetitorSection: boolean;
reportIntegrationData: boolean;
```

Add values to each tier in `PLAN_LIMITS`:

```typescript
// free
reportsPerMonth: 1,
reportTypes: ["summary"],
reportBranding: "none",
reportHistoryDepth: 1,
reportCompetitorSection: false,
reportIntegrationData: false,

// starter
reportsPerMonth: 5,
reportTypes: ["summary", "detailed"],
reportBranding: "none",
reportHistoryDepth: 3,
reportCompetitorSection: true,
reportIntegrationData: false,

// pro
reportsPerMonth: 20,
reportTypes: ["summary", "detailed"],
reportBranding: "logo",
reportHistoryDepth: 10,
reportCompetitorSection: true,
reportIntegrationData: true,

// agency
reportsPerMonth: Infinity,
reportTypes: ["summary", "detailed"],
reportBranding: "full",
reportHistoryDepth: Infinity,
reportCompetitorSection: true,
reportIntegrationData: true,
```

**Step 5: Add plan enforcement function**

In `packages/shared/src/domain/plan-enforcer.ts`, add:

```typescript
export function canGenerateReport(
  plan: PlanTier,
  usedThisMonth: number,
  reportType: "summary" | "detailed",
): boolean {
  const limits = PLAN_LIMITS[plan];
  if (usedThisMonth >= limits.reportsPerMonth) return false;
  return limits.reportTypes.includes(reportType);
}
```

**Step 6: Push schema to database**

Run: `cd packages/db && npx drizzle-kit push`
Expected: New enums and `reports` table created in Neon

**Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/shared/src/constants/plans.ts packages/shared/src/domain/plan-enforcer.ts
git commit -m "feat: add reports table schema and plan limits"
```

---

### Task 2: Add report Zod schemas and shared types

**Files:**

- Create: `packages/shared/src/schemas/report.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/report-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GenerateReportSchema, ReportConfigSchema } from "../schemas/report";

describe("GenerateReportSchema", () => {
  it("accepts valid summary report request", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "summary",
      format: "pdf",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid detailed report with config", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "detailed",
      format: "docx",
      config: {
        compareCrawlIds: ["550e8400-e29b-41d4-a716-446655440002"],
        preparedFor: "Acme Corp",
        brandingColor: "#4F46E5",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid report type", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "invalid",
      format: "pdf",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test -- report-schema`
Expected: FAIL (module not found)

**Step 3: Write the schema**

Create `packages/shared/src/schemas/report.ts`:

```typescript
import { z } from "zod";

export const ReportConfigSchema = z.object({
  compareCrawlIds: z.array(z.string().uuid()).max(10).optional(),
  brandingLogoUrl: z.string().url().optional(),
  brandingColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  preparedFor: z.string().max(200).optional(),
  includeSections: z.array(z.string()).optional(),
});

export const GenerateReportSchema = z.object({
  projectId: z.string().uuid(),
  crawlJobId: z.string().uuid(),
  type: z.enum(["summary", "detailed"]),
  format: z.enum(["pdf", "docx"]),
  config: ReportConfigSchema.optional(),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;
export type ReportConfig = z.infer<typeof ReportConfigSchema>;

export type ReportType = "summary" | "detailed";
export type ReportFormat = "pdf" | "docx";
export type ReportStatus = "queued" | "generating" | "complete" | "failed";

export interface ReportMeta {
  id: string;
  projectId: string;
  crawlJobId: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  r2Key: string | null;
  fileSize: number | null;
  config: ReportConfig;
  error: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
```

**Step 4: Export from index.ts**

Add to `packages/shared/src/index.ts`:

```typescript
export * from "./schemas/report";
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test -- report-schema`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/report.ts packages/shared/src/__tests__/report-schema.test.ts packages/shared/src/index.ts
git commit -m "feat: add report Zod schemas and shared types"
```

---

## Phase 2: Report Data Aggregator

### Task 3: Create packages/reports package scaffold

**Files:**

- Create: `packages/reports/package.json`
- Create: `packages/reports/tsconfig.json`
- Create: `packages/reports/src/index.ts`
- Create: `packages/reports/src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "@llm-boost/reports",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@llm-boost/db": "workspace:*",
    "@llm-boost/shared": "workspace:*",
    "@react-pdf/renderer": "^4.3.2",
    "docx": "^9.2.0"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create types.ts**

```typescript
import type { ReportConfig, ReportType, ReportFormat } from "@llm-boost/shared";

export interface ReportData {
  project: {
    name: string;
    domain: string;
    branding?: {
      logoUrl?: string;
      companyName?: string;
      primaryColor?: string;
    };
  };
  crawl: {
    id: string;
    completedAt: string;
    pagesFound: number;
    pagesCrawled: number;
    pagesScored: number;
    summary: string | null;
    summaryData: Record<string, unknown> | null;
  };
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  issues: {
    bySeverity: { severity: string; count: number }[];
    byCategory: { category: string; count: number }[];
    total: number;
    items: ReportIssue[];
  };
  gradeDistribution: { grade: string; count: number; percentage: number }[];
  quickWins: ReportQuickWin[];
  pages: ReportPageScore[];
  history: ReportHistoryPoint[];
  visibility: ReportVisibility | null;
  competitors: ReportCompetitor[] | null;
  contentHealth: ReportContentHealth | null;
  platformOpportunities: ReportPlatformOpportunity[] | null;
  integrations: ReportIntegrationData | null;
  config: ReportConfig;
}

export interface ReportIssue {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string;
  affectedPages: number;
  scoreImpact: number;
  roiEstimate: ReportROI | null;
}

export interface ReportROI {
  scoreImpact: number;
  pageReach: number;
  visibilityImpact: string;
  trafficEstimate: string | null;
}

export interface ReportQuickWin {
  code: string;
  message: string;
  recommendation: string;
  effort: "low" | "medium" | "high";
  affectedPages: number;
  scoreImpact: number;
  roi: ReportROI;
}

export interface ReportPageScore {
  url: string;
  title: string | null;
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  grade: string;
  issueCount: number;
}

export interface ReportHistoryPoint {
  crawlId: string;
  completedAt: string;
  overall: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  pagesScored: number;
}

export interface ReportVisibility {
  platforms: {
    provider: string;
    brandMentionRate: number;
    urlCitationRate: number;
    avgPosition: number | null;
    checksCount: number;
  }[];
}

export interface ReportCompetitor {
  domain: string;
  mentionCount: number;
  platforms: string[];
  queries: string[];
}

export interface ReportPlatformOpportunity {
  platform: string;
  currentScore: number;
  opportunityScore: number;
  topTips: string[];
}

export interface ReportContentHealth {
  avgWordCount: number;
  avgClarity: number | null;
  avgAuthority: number | null;
  avgComprehensiveness: number | null;
  avgStructure: number | null;
  avgCitationWorthiness: number | null;
  pagesAboveThreshold: number;
  totalPages: number;
}

export interface ReportIntegrationData {
  gsc: {
    topQueries: {
      query: string;
      impressions: number;
      clicks: number;
      position: number;
    }[];
  } | null;
  ga4: {
    bounceRate: number;
    avgEngagement: number;
    topPages: { url: string; sessions: number }[];
  } | null;
  clarity: { avgUxScore: number; rageClickPages: string[] } | null;
}

export interface GenerateReportJob {
  reportId: string;
  projectId: string;
  crawlJobId: string;
  userId: string;
  type: ReportType;
  format: ReportFormat;
  config: ReportConfig;
  databaseUrl: string;
}
```

**Step 4: Create index.ts**

```typescript
export type * from "./types";
```

**Step 5: Install dependencies**

Run: `pnpm install`

**Step 6: Commit**

```bash
git add packages/reports/
git commit -m "feat: scaffold packages/reports with types"
```

---

### Task 4: Build report data aggregator

**Files:**

- Create: `packages/reports/src/data-aggregator.ts`
- Create: `packages/reports/src/__tests__/data-aggregator.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { aggregateReportData } from "../data-aggregator";

describe("aggregateReportData", () => {
  it("aggregates scores into correct structure", () => {
    // Test with mock DB results
    const mockDbResults = {
      project: {
        name: "Test",
        domain: "example.com",
        settings: {},
        branding: {},
      },
      crawl: {
        id: "crawl-1",
        completedAt: new Date().toISOString(),
        pagesFound: 10,
        pagesCrawled: 10,
        pagesScored: 10,
        summary: "Test summary",
        summaryData: null,
      },
      pageScores: [
        {
          overallScore: 85,
          technicalScore: 90,
          contentScore: 80,
          aiReadinessScore: 85,
          lighthousePerf: 0.9,
          lighthouseSeo: 0.95,
        },
        {
          overallScore: 70,
          technicalScore: 75,
          contentScore: 65,
          aiReadinessScore: 72,
          lighthousePerf: 0.7,
          lighthouseSeo: 0.8,
        },
      ],
      issues: [],
      pages: [],
      historyCrawls: [],
      visibilityChecks: [],
    };

    const result = aggregateReportData(mockDbResults, { type: "summary" });
    expect(result.scores.overall).toBeCloseTo(77.5);
    expect(result.scores.letterGrade).toBe("C");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/reports && pnpm test -- data-aggregator`
Expected: FAIL

**Step 3: Implement data-aggregator.ts**

This module takes raw DB query results and transforms them into the `ReportData` shape. It computes averages, groups issues, builds history arrays, and calculates ROI estimates. The full implementation pulls from the existing patterns in `insights-service.ts` and `intelligence-service.ts`.

Key functions:

- `aggregateReportData(dbResults, options)` → `ReportData`
- `computeAverageScores(pageScores)` → scores object
- `groupIssues(issues)` → grouped by severity/category with counts
- `buildHistory(crawls)` → `ReportHistoryPoint[]`
- `aggregateCompetitors(visibilityChecks)` → `ReportCompetitor[]`
- `estimateROI(issue, avgScore, pageCount)` → `ReportROI`

**Step 4: Run tests**

Run: `cd packages/reports && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/reports/src/data-aggregator.ts packages/reports/src/__tests__/
git commit -m "feat: add report data aggregator with ROI estimation"
```

---

### Task 5: Build ROI estimation engine

**Files:**

- Create: `packages/reports/src/roi.ts`
- Create: `packages/reports/src/__tests__/roi.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { estimateIssueROI } from "../roi";

describe("estimateIssueROI", () => {
  it("estimates high ROI for critical issue affecting many pages", () => {
    const roi = estimateIssueROI({
      code: "MISSING_LLMS_TXT",
      severity: "critical",
      scoreDeduction: 8,
      affectedPages: 50,
      totalPages: 50,
      gscImpressions: 10000,
    });
    expect(roi.scoreImpact).toBe(8);
    expect(roi.pageReach).toBe(50);
    expect(roi.visibilityImpact).toBe("high");
    expect(roi.trafficEstimate).toBeTruthy();
  });

  it("estimates low ROI for info issue on few pages", () => {
    const roi = estimateIssueROI({
      code: "MISSING_OG_IMAGE",
      severity: "info",
      scoreDeduction: 2,
      affectedPages: 3,
      totalPages: 100,
      gscImpressions: null,
    });
    expect(roi.visibilityImpact).toBe("low");
    expect(roi.trafficEstimate).toBeNull();
  });
});
```

**Step 2: Implement roi.ts**

ROI model:

- `scoreImpact`: Direct from scoring engine deduction weights
- `pageReach`: Count of affected pages
- `visibilityImpact`: "high" (critical, >50% pages), "medium" (warning or >20%), "low" (info or <20%)
- `trafficEstimate`: When GSC data available, `impressions * (scoreImpact/100) * avgCTR`

**Step 3: Run tests, commit**

---

## Phase 3: PDF Chart Components

### Task 6: Build PDF SVG chart primitives

**Files:**

- Create: `packages/reports/src/pdf/charts/score-circle.tsx`
- Create: `packages/reports/src/pdf/charts/bar-chart.tsx`
- Create: `packages/reports/src/pdf/charts/line-chart.tsx`
- Create: `packages/reports/src/pdf/charts/radar-chart.tsx`
- Create: `packages/reports/src/pdf/charts/pie-chart.tsx`

Each chart uses `@react-pdf/renderer`'s `Svg`, `Path`, `Rect`, `Circle`, `Line`, `Text` components. No DOM required.

**Step 1: Score Circle**

```tsx
import React from "react";
import { Svg, Circle, Text } from "@react-pdf/renderer";

interface Props {
  score: number;
  size?: number;
  color?: string;
}

export function PdfScoreCircle({ score, size = 100, color }: Props) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const fillColor =
    color ??
    (score >= 90
      ? "#22c55e"
      : score >= 80
        ? "#3b82f6"
        : score >= 70
          ? "#eab308"
          : score >= 60
            ? "#f97316"
            : "#ef4444");

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#e5e7eb"
        strokeWidth={8}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={fillColor}
        strokeWidth={8}
        fill="none"
        strokeDasharray={`${progress} ${circumference - progress}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <Text
        x={size / 2}
        y={size / 2 + 6}
        textAnchor="middle"
        style={{ fontSize: size * 0.3, fontWeight: 700, color: fillColor }}
      >
        {score}
      </Text>
    </Svg>
  );
}
```

**Step 2: Implement remaining charts** (bar, line, radar, pie) following same SVG-primitive pattern.

**Step 3: Commit**

```bash
git add packages/reports/src/pdf/charts/
git commit -m "feat: add PDF SVG chart components (score, bar, line, radar, pie)"
```

---

### Task 7: Build PDF report templates

**Files:**

- Create: `packages/reports/src/pdf/components/header.tsx`
- Create: `packages/reports/src/pdf/components/footer.tsx`
- Create: `packages/reports/src/pdf/components/section.tsx`
- Create: `packages/reports/src/pdf/components/table.tsx`
- Create: `packages/reports/src/pdf/templates/summary.tsx`
- Create: `packages/reports/src/pdf/templates/detailed.tsx`
- Create: `packages/reports/src/pdf/render.ts`

**Step 1: Build shared components** (header with branding, footer with page numbers, section wrappers, data tables)

**Step 2: Build summary template**

```tsx
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "../../types";
import { PdfScoreCircle } from "../charts/score-circle";
import { PdfRadarChart } from "../charts/radar-chart";
import { PdfLineChart } from "../charts/line-chart";
import { ReportHeader } from "../components/header";
import { ReportFooter } from "../components/footer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 12, color: "#6b7280", marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    color: "#1f2937",
  },
  row: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
});

export function SummaryReportPdf({ data }: { data: ReportData }) {
  const brandColor = data.config.brandingColor ?? "#4F46E5";

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} />
        <View style={{ alignItems: "center", marginTop: 80 }}>
          <PdfScoreCircle score={data.scores.overall} size={180} />
          <Text style={[styles.title, { marginTop: 16 }]}>
            {data.scores.letterGrade} Grade
          </Text>
          <Text style={styles.subtitle}>
            {data.project.domain} - AI Readiness Report
          </Text>
        </View>
        {data.config.preparedFor && (
          <Text
            style={{ textAlign: "center", marginTop: 20, color: "#6b7280" }}
          >
            Prepared for {data.config.preparedFor}
          </Text>
        )}
        <ReportFooter pageNumber={1} />
      </Page>

      {/* Scores + Quick Wins Page */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} compact />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Scorecard</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <PdfRadarChart scores={data.scores} size={200} />
            </View>
            <View style={styles.col}>{/* Category scores list */}</View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text>{data.crawl.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top 5 Quick Wins</Text>
          {data.quickWins.slice(0, 5).map((win, i) => (
            <View
              key={i}
              style={{
                marginBottom: 8,
                padding: 8,
                backgroundColor: "#f9fafb",
              }}
            >
              <Text style={{ fontWeight: 700 }}>
                {i + 1}. {win.message}
              </Text>
              <Text style={{ color: "#6b7280", marginTop: 2 }}>
                {win.recommendation}
              </Text>
              <Text style={{ color: brandColor, marginTop: 2 }}>
                Est. impact: +{win.scoreImpact} pts | {win.affectedPages} pages
                | Effort: {win.effort}
              </Text>
            </View>
          ))}
        </View>
        <ReportFooter pageNumber={2} />
      </Page>

      {/* Trends + Visibility Page */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} compact />
        {data.history.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Score Trend</Text>
            <PdfLineChart data={data.history} width={500} height={200} />
          </View>
        )}
        {data.visibility && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Visibility Snapshot</Text>
            {/* Platform visibility bars */}
          </View>
        )}
        <ReportFooter pageNumber={3} />
      </Page>
    </Document>
  );
}
```

**Step 3: Build detailed template** — extends summary with all additional sections (issue catalog, page analysis, heatmap, content health, competitors, integrations, action plan, appendix).

**Step 4: Build render.ts**

```typescript
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReportData } from "../types";
import { SummaryReportPdf } from "./templates/summary";
import { DetailedReportPdf } from "./templates/detailed";

export async function renderPdf(data: ReportData, type: "summary" | "detailed"): Promise<Buffer> {
  const Component = type === "summary" ? SummaryReportPdf : DetailedReportPdf;
  return renderToBuffer(<Component data={data} />);
}
```

**Step 5: Commit**

```bash
git add packages/reports/src/pdf/
git commit -m "feat: add PDF report templates (summary + detailed)"
```

---

### Task 8: Build DOCX report templates

**Files:**

- Create: `packages/reports/src/docx/templates/summary.ts`
- Create: `packages/reports/src/docx/templates/detailed.ts`
- Create: `packages/reports/src/docx/render.ts`
- Create: `packages/reports/src/docx/styles.ts`

**Step 1: Install docx**

Run: `cd packages/reports && pnpm add docx`

**Step 2: Build DOCX renderer**

Uses `docx` npm package to build Word documents programmatically:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  ImageRun,
} from "docx";
import type { ReportData } from "../types";

export async function renderDocx(
  data: ReportData,
  type: "summary" | "detailed",
): Promise<Buffer> {
  const sections =
    type === "summary"
      ? buildSummarySections(data)
      : buildDetailedSections(data);

  const doc = new Document({ sections });
  return Buffer.from(await Packer.toBuffer(doc));
}
```

For charts in DOCX: render SVG to PNG using `resvg-js` (lightweight, no DOM dependency), embed as `ImageRun`.

**Step 3: Commit**

```bash
git add packages/reports/src/docx/
git commit -m "feat: add DOCX report templates (summary + detailed)"
```

---

## Phase 4: Report Worker & API

### Task 9: Create report-worker app

**Files:**

- Create: `apps/report-worker/package.json`
- Create: `apps/report-worker/wrangler.toml`
- Create: `apps/report-worker/src/index.ts`
- Create: `apps/report-worker/tsconfig.json`

**Step 1: Create wrangler.toml**

```toml
name = "llm-boost-report-worker"
main = "src/index.ts"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "R2"
bucket_name = "ai-seo-storage"

[[queues.consumers]]
queue = "llm-boost-reports"
max_batch_size = 1
max_retries = 3

[vars]
# DATABASE_URL set via secrets
```

**Step 2: Create worker handler**

```typescript
import { createDb } from "@llm-boost/db";
import { aggregateReportData } from "@llm-boost/reports/data-aggregator";
import { renderPdf } from "@llm-boost/reports/pdf/render";
import { renderDocx } from "@llm-boost/reports/docx/render";
import type { GenerateReportJob } from "@llm-boost/reports";

interface Env {
  R2: R2Bucket;
  DATABASE_URL: string;
}

export default {
  async queue(batch: MessageBatch<GenerateReportJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body;
      const db = createDb(env.DATABASE_URL);

      try {
        // Update status to generating
        await updateReportStatus(db, job.reportId, "generating");

        // Aggregate all data
        const dbResults = await fetchAllReportData(db, job);
        const reportData = aggregateReportData(dbResults, {
          type: job.type,
          config: job.config,
        });

        // Render document
        const buffer =
          job.format === "pdf"
            ? await renderPdf(reportData, job.type)
            : await renderDocx(reportData, job.type);

        // Upload to R2
        const r2Key = `reports/${job.projectId}/${job.reportId}.${job.format}`;
        await env.R2.put(r2Key, buffer, {
          httpMetadata: {
            contentType:
              job.format === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        });

        // Update report record
        await updateReportComplete(db, job.reportId, r2Key, buffer.byteLength);
        message.ack();
      } catch (error) {
        await updateReportStatus(db, job.reportId, "failed", String(error));
        message.retry();
      }
    }
  },
};
```

**Step 3: Add queue producer binding to API wrangler.toml**

Add to `apps/api/wrangler.toml`:

```toml
[[queues.producers]]
binding = "REPORT_QUEUE"
queue = "llm-boost-reports"
```

**Step 4: Commit**

```bash
git add apps/report-worker/
git commit -m "feat: add report generation queue worker"
```

---

### Task 10: Add report API routes

**Files:**

- Create: `apps/api/src/routes/reports.ts`
- Create: `apps/api/src/repositories/report-repository.ts`
- Create: `apps/api/src/services/report-service.ts`
- Modify: `apps/api/src/index.ts` (mount routes)

**Step 1: Create report repository**

Following existing pattern from `apps/api/src/repositories/`:

```typescript
import { eq, and, desc } from "drizzle-orm";
import { reports } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";

export function createReportRepository(db: Database) {
  return {
    async create(data: typeof reports.$inferInsert) {
      const [row] = await db.insert(reports).values(data).returning();
      return row;
    },
    async findById(id: string) {
      return db.query.reports.findFirst({ where: eq(reports.id, id) });
    },
    async listByProject(projectId: string, limit = 20) {
      return db.query.reports.findMany({
        where: eq(reports.projectId, projectId),
        orderBy: [desc(reports.createdAt)],
        limit,
      });
    },
    async countThisMonth(userId: string) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      // Count reports created this month
      const rows = await db
        .select()
        .from(reports)
        .where(
          and(eq(reports.userId, userId), gte(reports.createdAt, startOfMonth)),
        );
      return rows.length;
    },
    async updateStatus(
      id: string,
      status: string,
      extra?: Record<string, unknown>,
    ) {
      await db
        .update(reports)
        .set({ status, ...extra })
        .where(eq(reports.id, id));
    },
    async delete(id: string) {
      await db.delete(reports).where(eq(reports.id, id));
    },
  };
}
```

**Step 2: Create report service**

```typescript
import { ServiceError } from "./errors";
import { canGenerateReport } from "@llm-boost/shared";
import type { GenerateReportInput } from "@llm-boost/shared";

export function createReportService(deps) {
  return {
    async generate(userId: string, input: GenerateReportInput, queue: Queue) {
      // 1. Verify project ownership
      // 2. Check plan limits (canGenerateReport)
      // 3. Create report record with status "queued"
      // 4. Enqueue job to REPORT_QUEUE
      // 5. Return report metadata
    },
    async list(userId: string, projectId: string) {
      /* ... */
    },
    async getDownloadUrl(userId: string, reportId: string, r2: R2Bucket) {
      // Verify ownership, get r2Key, create signed URL
    },
    async deleteReport(userId: string, reportId: string, r2: R2Bucket) {
      /* ... */
    },
  };
}
```

**Step 3: Create report routes**

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { GenerateReportSchema } from "@llm-boost/shared";
import { createReportRepository } from "../repositories/report-repository";
import { createReportService } from "../services/report-service";
import { handleServiceError } from "../services/errors";

export const reportRoutes = new Hono<AppEnv>();
reportRoutes.use("*", authMiddleware);

// POST /reports/generate
reportRoutes.post("/generate", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = GenerateReportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid report request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }
  const service = createReportService({
    reports: createReportRepository(db) /* ... */,
  });
  try {
    const report = await service.generate(
      userId,
      parsed.data,
      c.env.REPORT_QUEUE,
    );
    return c.json({ data: report }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /reports?projectId=xxx
reportRoutes.get("/", async (c) => {
  /* list reports */
});

// GET /reports/:id
reportRoutes.get("/:id", async (c) => {
  /* get report status */
});

// GET /reports/:id/download
reportRoutes.get("/:id/download", async (c) => {
  /* return signed R2 URL */
});

// DELETE /reports/:id
reportRoutes.delete("/:id", async (c) => {
  /* delete report + R2 object */
});
```

**Step 4: Mount routes in index.ts**

Add to `apps/api/src/index.ts`:

```typescript
import { reportRoutes } from "./routes/reports";
app.route("/reports", reportRoutes);
```

**Step 5: Commit**

```bash
git add apps/api/src/routes/reports.ts apps/api/src/repositories/report-repository.ts apps/api/src/services/report-service.ts apps/api/src/index.ts
git commit -m "feat: add report API routes (generate, list, download, delete)"
```

---

## Phase 5: Frontend UI

### Task 11: Add report API client methods

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add report types and API methods**

```typescript
export interface Report {
  id: string;
  projectId: string;
  crawlJobId: string;
  type: "summary" | "detailed";
  format: "pdf" | "docx";
  status: "queued" | "generating" | "complete" | "failed";
  fileSize: number | null;
  error: string | null;
  generatedAt: string | null;
  createdAt: string;
}

// Add to api object:
reports: {
  generate: (input: { projectId: string; crawlJobId: string; type: string; format: string; config?: Record<string, unknown> }) =>
    fetchApi<Report>("/reports/generate", { method: "POST", body: JSON.stringify(input) }),
  list: (projectId: string) =>
    fetchApi<Report[]>(`/reports?projectId=${projectId}`),
  getStatus: (id: string) =>
    fetchApi<Report>(`/reports/${id}`),
  getDownloadUrl: (id: string) =>
    fetchApi<{ url: string }>(`/reports/${id}/download`),
  delete: (id: string) =>
    fetchApi<void>(`/reports/${id}`, { method: "DELETE" }),
},
```

**Step 2: Commit**

---

### Task 12: Build report generation UI

**Files:**

- Create: `apps/web/src/components/reports/generate-report-modal.tsx`
- Create: `apps/web/src/components/reports/report-list.tsx`
- Create: `apps/web/src/app/dashboard/projects/[id]/reports/page.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/layout.tsx` (add Reports tab)

**Step 1: Generate Report Modal**

A dialog that lets users choose:

- Report type (Summary / Detailed)
- Format (PDF / DOCX)
- Optional: "Prepared for" client name
- Optional: Compare with previous crawls (multi-select)
- Button: "Generate Report"

**Step 2: Report List**

Table showing generated reports with:

- Type, format, status badge (queued/generating/complete/failed)
- File size, generated date
- Download button (when complete)
- Delete button
- Auto-poll for status updates when reports are queued/generating

**Step 3: Reports page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ReportList } from "@/components/reports/report-list";
import { GenerateReportModal } from "@/components/reports/generate-report-modal";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [reports, setReports] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Fetch reports, handle generation, polling...

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reports</h2>
        <Button onClick={() => setShowModal(true)}>
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>
      <ReportList reports={reports} onDelete={handleDelete} />
      <GenerateReportModal
        open={showModal}
        onClose={() => setShowModal(false)}
        projectId={projectId}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
```

**Step 4: Add Reports tab to project layout**

**Step 5: Commit**

```bash
git add apps/web/src/components/reports/ apps/web/src/app/dashboard/projects/\\[id\\]/reports/
git commit -m "feat: add report generation UI (modal, list, reports tab)"
```

---

## Phase 6: Integration Testing & Polish

### Task 13: Add competitor analysis aggregation

**Files:**

- Create: `packages/reports/src/competitors.ts`
- Create: `packages/reports/src/__tests__/competitors.test.ts`

Aggregates from `visibility_checks` table:

- Groups by competitor domain
- Counts mentions per platform
- Identifies queries where competitors are cited but user isn't
- Returns sorted by mention frequency

---

### Task 14: Add integration data collection

**Files:**

- Create: `packages/reports/src/integrations.ts`

Pulls from `enrichments` table when connected:

- GSC: Top 20 queries by impressions
- GA4: Bounce rate, engagement, top pages by sessions
- Clarity: UX quality scores, rage click pages

Respects plan limits (`reportIntegrationData` flag).

---

### Task 15: End-to-end integration test

**Files:**

- Create: `apps/api/src/__tests__/reports.test.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("Report generation flow", () => {
  it("creates report record and enqueues job", async () => {
    // POST /reports/generate with valid input
    // Assert: 201 response with report metadata
    // Assert: report status is "queued"
    // Assert: queue received message
  });

  it("rejects report generation when plan limit reached", async () => {
    // Set user to free plan with 1 report used this month
    // POST /reports/generate
    // Assert: 403 PLAN_LIMIT_REACHED
  });

  it("returns download URL for completed report", async () => {
    // Create report with status "complete" and r2Key
    // GET /reports/:id/download
    // Assert: 200 with signed URL
  });

  it("lists reports for project", async () => {
    // Create 3 reports for a project
    // GET /reports?projectId=xxx
    // Assert: returns 3 reports ordered by createdAt desc
  });
});
```

---

### Task 16: Typecheck and final verification

**Step 1:** Run: `pnpm typecheck`
**Step 2:** Run: `pnpm test`
**Step 3:** Run: `cd packages/reports && pnpm test`
**Step 4:** Run: `cd apps/api && pnpm test`
**Step 5:** Fix any issues
**Step 6:** Final commit

```bash
git add -A
git commit -m "feat: complete report generation system"
```

---

## Summary

| Phase | Tasks | What it builds                                             |
| ----- | ----- | ---------------------------------------------------------- |
| 1     | 1-2   | Database schema, enums, Zod schemas, plan limits           |
| 2     | 3-5   | packages/reports scaffold, data aggregator, ROI engine     |
| 3     | 6-8   | PDF chart components, PDF templates, DOCX templates        |
| 4     | 9-10  | Queue worker, API routes (generate/list/download/delete)   |
| 5     | 11-12 | Frontend API client, report generation UI                  |
| 6     | 13-16 | Competitor analysis, integrations, e2e tests, verification |
