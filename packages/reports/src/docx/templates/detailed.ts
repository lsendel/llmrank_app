import {
  Document,
  FileChild,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
} from "docx";
import type { ReportData, ReportIssue } from "../../types";
import {
  heading,
  bodyText,
  spacer,
  scoreText,
  simpleTable,
  bulletList,
} from "../builders";
import { gradeColor, BRAND_COLOR, GRAY_400, GRAY_600 } from "../styles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateUrl(url: string, max = 50): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + "...";
}

interface ActionTier {
  title: string;
  description: string;
  items: ReportIssue[];
}

function buildActionPlan(issues: ReportIssue[]): ActionTier[] {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const quickWins = warnings.filter((i) => i.scoreImpact >= 3);
  const strategic = warnings.filter((i) => i.scoreImpact < 3);
  const info = issues.filter((i) => i.severity === "info");

  return [
    {
      title: "Priority 1: Critical Fixes",
      description:
        "Address immediately - these issues significantly harm your AI visibility.",
      items: critical,
    },
    {
      title: "Priority 2: Quick Wins",
      description: "High-impact changes that are relatively easy to implement.",
      items: quickWins,
    },
    {
      title: "Priority 3: Strategic Improvements",
      description: "Medium-term improvements for sustained visibility gains.",
      items: strategic,
    },
    {
      title: "Priority 4: Long-term Optimization",
      description: "Ongoing optimizations for marginal gains.",
      items: info,
    },
  ].filter((tier) => tier.items.length > 0);
}

// ---------------------------------------------------------------------------
// Document builder
// ---------------------------------------------------------------------------

export function buildDetailedDocx(data: ReportData): Document {
  const brandName = data.project.branding?.companyName ?? "LLM Boost";
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Cover ──────────────────────────────────────────────────────────────
  const coverParagraphs = [
    spacer(),
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "AI-Readiness Report",
          size: 56,
          bold: true,
          color: "1F2937",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Detailed Analysis",
          size: 28,
          color: GRAY_600,
        }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: data.project.domain,
          size: 28,
          color: BRAND_COLOR,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Overall Score: ${Math.round(data.scores.overall)} (${data.scores.letterGrade})`,
          size: 36,
          bold: true,
          color: gradeColor(data.scores.overall),
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${data.crawl.pagesScored} pages analyzed | ${date}`,
          size: 20,
          color: GRAY_600,
        }),
      ],
    }),
  ];

  if (data.config.preparedFor) {
    coverParagraphs.push(
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Prepared for ${data.config.preparedFor}`,
            size: 22,
            color: GRAY_600,
          }),
        ],
      }),
    );
  }

  // ── Category Scorecard ────────────────────────────────────────────────
  const bodyParagraphs: FileChild[] = [
    heading("Category Scorecard", HeadingLevel.HEADING_1),
    scoreText(
      "Technical SEO",
      data.scores.technical,
      gradeColor(data.scores.technical),
    ),
    scoreText(
      "Content Quality",
      data.scores.content,
      gradeColor(data.scores.content),
    ),
    scoreText(
      "AI Readiness",
      data.scores.aiReadiness,
      gradeColor(data.scores.aiReadiness),
    ),
    scoreText(
      "Performance",
      data.scores.performance,
      gradeColor(data.scores.performance),
    ),
    spacer(),
  ];

  // ── Executive Summary ─────────────────────────────────────────────────
  if (data.crawl.summary) {
    bodyParagraphs.push(
      heading("Executive Summary", HeadingLevel.HEADING_1),
      bodyText(data.crawl.summary),
      spacer(),
    );
  }

  // ── Quick Wins ────────────────────────────────────────────────────────
  bodyParagraphs.push(
    heading("Top Quick Wins", HeadingLevel.HEADING_1),
    bodyText("Top recommendations sorted by impact-to-effort ratio", {
      color: GRAY_600,
      size: 18,
    }),
  );
  const wins = data.quickWins.slice(0, 10);
  bodyParagraphs.push(
    ...bulletList(
      wins.map((w, i) => ({
        text: `${i + 1}. ${w.message}`,
        detail: `${w.recommendation} | +${w.scoreImpact} pts | ${w.affectedPages} pages | Effort: ${w.effort} | Visibility: ${w.roi.visibilityImpact}${w.roi.trafficEstimate ? ` | ${w.roi.trafficEstimate}` : ""}`,
      })),
    ),
    spacer(),
  );

  // ── AI Visibility Snapshot ────────────────────────────────────────────
  if (data.visibility) {
    bodyParagraphs.push(
      heading("AI Visibility Snapshot", HeadingLevel.HEADING_1),
      bodyText("How your brand appears across AI platforms", {
        color: GRAY_600,
        size: 18,
      }),
      simpleTable(
        [
          "Platform",
          "Brand Mentions",
          "URL Citations",
          "Avg Position",
          "Checks",
        ],
        data.visibility.platforms.map((p) => [
          p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
          `${p.brandMentionRate}%`,
          `${p.urlCitationRate}%`,
          p.avgPosition !== null ? p.avgPosition.toFixed(1) : "N/A",
          String(p.checksCount),
        ]),
      ),
      spacer(),
    );
  }

  // ── Issue Catalog ─────────────────────────────────────────────────────
  bodyParagraphs.push(
    heading("Issue Catalog", HeadingLevel.HEADING_1),
    bodyText(
      `${data.issues.total} issues found across ${data.crawl.pagesScored} pages`,
      { color: GRAY_600, size: 18 },
    ),
    simpleTable(
      ["Code", "Severity", "Category", "Message", "Pages", "Impact"],
      data.issues.items.map((issue) => [
        issue.code,
        issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1),
        issue.category.charAt(0).toUpperCase() + issue.category.slice(1),
        issue.message,
        String(issue.affectedPages),
        `-${issue.scoreImpact}`,
      ]),
    ),
    spacer(),
  );

  // ── Lowest Scoring Pages ──────────────────────────────────────────────
  const worstPages = [...data.pages]
    .sort((a, b) => a.overall - b.overall)
    .slice(0, 20);

  if (worstPages.length > 0) {
    bodyParagraphs.push(
      heading("Lowest Scoring Pages", HeadingLevel.HEADING_1),
      bodyText("Top 20 pages that need the most attention", {
        color: GRAY_600,
        size: 18,
      }),
      simpleTable(
        ["URL", "Score", "Grade", "Issues"],
        worstPages.map((page) => [
          truncateUrl(page.url),
          String(Math.round(page.overall)),
          page.grade,
          String(page.issueCount),
        ]),
      ),
      spacer(),
    );
  }

  // ── Grade Distribution ────────────────────────────────────────────────
  if (data.gradeDistribution.length > 0) {
    bodyParagraphs.push(
      heading("Grade Distribution", HeadingLevel.HEADING_1),
      bodyText("Distribution of page grades across your site", {
        color: GRAY_600,
        size: 18,
      }),
      simpleTable(
        ["Grade", "Count", "Percentage"],
        data.gradeDistribution.map((g) => [
          g.grade,
          String(g.count),
          `${g.percentage.toFixed(1)}%`,
        ]),
      ),
      spacer(),
    );
  }

  // ── Content Health ────────────────────────────────────────────────────
  if (data.contentHealth) {
    const metrics: string[][] = [
      [
        "Average Word Count",
        String(Math.round(data.contentHealth.avgWordCount)),
      ],
    ];
    if (data.contentHealth.avgClarity !== null) {
      metrics.push(["Clarity Score", data.contentHealth.avgClarity.toFixed(1)]);
    }
    if (data.contentHealth.avgAuthority !== null) {
      metrics.push([
        "Authority Score",
        data.contentHealth.avgAuthority.toFixed(1),
      ]);
    }
    if (data.contentHealth.avgComprehensiveness !== null) {
      metrics.push([
        "Comprehensiveness",
        data.contentHealth.avgComprehensiveness.toFixed(1),
      ]);
    }
    if (data.contentHealth.avgStructure !== null) {
      metrics.push([
        "Structure Score",
        data.contentHealth.avgStructure.toFixed(1),
      ]);
    }
    if (data.contentHealth.avgCitationWorthiness !== null) {
      metrics.push([
        "Citation Worthiness",
        data.contentHealth.avgCitationWorthiness.toFixed(1),
      ]);
    }
    metrics.push([
      "Pages Above Threshold",
      `${data.contentHealth.pagesAboveThreshold} / ${data.contentHealth.totalPages}`,
    ]);

    bodyParagraphs.push(
      heading("Content Health Metrics", HeadingLevel.HEADING_1),
      bodyText("Aggregate content quality signals", {
        color: GRAY_600,
        size: 18,
      }),
      simpleTable(["Metric", "Value"], metrics),
      spacer(),
    );
  }

  // ── Competitor Analysis ───────────────────────────────────────────────
  if (data.competitors && data.competitors.length > 0) {
    bodyParagraphs.push(
      heading("Competitor Analysis", HeadingLevel.HEADING_1),
      bodyText("Domains that appear alongside your brand in AI responses", {
        color: GRAY_600,
        size: 18,
      }),
      simpleTable(
        ["Domain", "Mentions", "Platforms", "Top Queries"],
        data.competitors.map((comp) => [
          comp.domain,
          String(comp.mentionCount),
          comp.platforms.join(", "),
          comp.queries.slice(0, 3).join(", "),
        ]),
      ),
      spacer(),
    );
  }

  // ── Action Plan (4 tiers) ─────────────────────────────────────────────
  const actionPlan = buildActionPlan(data.issues.items);
  bodyParagraphs.push(
    heading("Action Plan", HeadingLevel.HEADING_1),
    bodyText(
      `Based on the ${data.issues.total} issues identified, here is a 4-tier action plan organized by priority and impact.`,
    ),
    spacer(),
  );

  for (const tier of actionPlan) {
    bodyParagraphs.push(
      heading(tier.title, HeadingLevel.HEADING_2),
      bodyText(tier.description, { color: GRAY_600, size: 18 }),
    );

    const tierItems = tier.items.slice(0, 10);
    bodyParagraphs.push(
      ...bulletList(
        tierItems.map((item) => ({
          text: item.recommendation,
          detail: `${item.affectedPages} pages | -${item.scoreImpact} pts impact${item.roi ? ` | Visibility: ${item.roi.visibilityImpact}` : ""}${item.roi?.trafficEstimate ? ` | ${item.roi.trafficEstimate}` : ""}`,
        })),
      ),
    );

    if (tier.items.length > 10) {
      bodyParagraphs.push(
        bodyText(`...and ${tier.items.length - 10} more items`, {
          color: GRAY_600,
          size: 18,
        }),
      );
    }

    bodyParagraphs.push(spacer());
  }

  // ── Platform Opportunities ────────────────────────────────────────────
  if (data.platformOpportunities && data.platformOpportunities.length > 0) {
    bodyParagraphs.push(
      heading("Platform Opportunities", HeadingLevel.HEADING_1),
      bodyText("Platform-specific optimization recommendations", {
        color: GRAY_600,
        size: 18,
      }),
    );

    for (const plat of data.platformOpportunities) {
      bodyParagraphs.push(
        heading(plat.platform, HeadingLevel.HEADING_3),
        bodyText(
          `Current: ${Math.round(plat.currentScore)} | Opportunity: ${Math.round(plat.opportunityScore)}`,
          { color: GRAY_600 },
        ),
        ...bulletList(plat.topTips.map((tip) => ({ text: tip }))),
      );
    }

    bodyParagraphs.push(spacer());
  }

  // ── Integration Data ──────────────────────────────────────────────────
  if (data.integrations) {
    bodyParagraphs.push(heading("Integration Data", HeadingLevel.HEADING_1));

    // Google Search Console
    if (data.integrations.gsc) {
      bodyParagraphs.push(
        heading("Google Search Console", HeadingLevel.HEADING_2),
        bodyText("Top search queries driving traffic to your site", {
          color: GRAY_600,
          size: 18,
        }),
        simpleTable(
          ["Query", "Impressions", "Clicks", "Position"],
          data.integrations.gsc.topQueries
            .slice(0, 15)
            .map((q) => [
              truncateUrl(q.query, 40),
              q.impressions.toLocaleString(),
              q.clicks.toLocaleString(),
              q.position.toFixed(1),
            ]),
        ),
        spacer(),
      );
    }

    // Google Analytics
    if (data.integrations.ga4) {
      bodyParagraphs.push(
        heading("Google Analytics", HeadingLevel.HEADING_2),
        simpleTable(
          ["Metric", "Value"],
          [
            [
              "Bounce Rate",
              `${(data.integrations.ga4.bounceRate * 100).toFixed(1)}%`,
            ],
            [
              "Avg Engagement Time",
              `${data.integrations.ga4.avgEngagement.toFixed(0)}s`,
            ],
          ],
        ),
      );

      if (data.integrations.ga4.topPages.length > 0) {
        bodyParagraphs.push(
          spacer(),
          bodyText("Top Pages by Sessions", { bold: true }),
          simpleTable(
            ["URL", "Sessions"],
            data.integrations.ga4.topPages
              .slice(0, 10)
              .map((p) => [
                truncateUrl(p.url, 60),
                p.sessions.toLocaleString(),
              ]),
          ),
        );
      }

      bodyParagraphs.push(spacer());
    }

    // Microsoft Clarity
    if (data.integrations.clarity) {
      bodyParagraphs.push(
        heading("Microsoft Clarity", HeadingLevel.HEADING_2),
        simpleTable(
          ["Metric", "Value"],
          [
            [
              "Average UX Score",
              data.integrations.clarity.avgUxScore.toFixed(1),
            ],
          ],
        ),
      );

      if (data.integrations.clarity.rageClickPages.length > 0) {
        bodyParagraphs.push(
          spacer(),
          bodyText("Pages with Rage Clicks", { bold: true }),
          ...bulletList(
            data.integrations.clarity.rageClickPages
              .slice(0, 10)
              .map((url) => ({ text: truncateUrl(url, 70) })),
          ),
        );
      }

      bodyParagraphs.push(spacer());
    }
  }

  // ── Assemble document ─────────────────────────────────────────────────
  return new Document({
    title: `AI-Readiness Detailed Report - ${data.project.domain}`,
    description: `Generated by ${brandName}`,
    sections: [
      // Cover page (no header/footer)
      { children: coverParagraphs },
      // Body with header/footer
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: brandName,
                    color: BRAND_COLOR,
                    size: 16,
                    bold: true,
                  }),
                  new TextRun({
                    text: ` | ${data.project.domain} | Detailed Report`,
                    color: GRAY_400,
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Generated by ${brandName} | Page `,
                    color: GRAY_400,
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: GRAY_400,
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children: bodyParagraphs,
      },
    ],
  });
}
