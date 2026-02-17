import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "../../types";
import { ReportHeader } from "../components/header";
import { ReportFooter } from "../components/footer";
import { Section } from "../components/section";
import { PdfScoreCircle } from "../charts/score-circle";
import { PdfRadarChart } from "../charts/radar-chart";
import { PdfLineChart } from "../charts/line-chart";
import { PdfBarChart } from "../charts/bar-chart";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  coverCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginTop: 16,
  },
  coverDomain: { fontSize: 14, color: "#4f46e5", marginTop: 4 },
  coverSubtitle: { fontSize: 11, color: "#6b7280", marginTop: 8 },
  preparedFor: { fontSize: 10, color: "#6b7280", marginTop: 24 },
  row: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  scoreCard: {
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    marginBottom: 4,
  },
  scoreLabel: { fontSize: 9, color: "#6b7280" },
  scoreValue: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  summaryText: { fontSize: 10, lineHeight: 1.5, color: "#374151" },
  quickWinRow: {
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    marginBottom: 4,
  },
  quickWinTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  quickWinRec: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  quickWinMeta: { fontSize: 8, color: "#4f46e5", marginTop: 2 },
});

function gradeColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 80) return "#2563eb";
  if (score >= 70) return "#ca8a04";
  if (score >= 60) return "#ea580c";
  return "#dc2626";
}

export function SummaryReportPdf({ data }: { data: ReportData }) {
  const brandColor = data.config.brandingColor ?? "#4f46e5";
  const brandName = data.project.branding?.companyName;
  const categories = [
    { label: "Technical SEO", score: data.scores.technical },
    { label: "Content Quality", score: data.scores.content },
    { label: "AI Readiness", score: data.scores.aiReadiness },
    { label: "Performance", score: data.scores.performance ?? 0 },
  ];

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} />
        <View style={styles.coverCenter}>
          <PdfScoreCircle score={data.scores.overall} size={180} />
          <Text style={styles.coverTitle}>AI-Readiness Report</Text>
          <Text style={styles.coverDomain}>{data.project.domain}</Text>
          <Text style={styles.coverSubtitle}>
            {data.crawl.pagesScored} pages analyzed | {data.scores.letterGrade}{" "}
            Grade
          </Text>
          {data.config.preparedFor && (
            <Text style={styles.preparedFor}>
              Prepared for {data.config.preparedFor}
            </Text>
          )}
        </View>
        <ReportFooter brandName={brandName} />
      </Page>

      {/* Scores + Summary */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} compact />

        <Section title="Category Scorecard">
          <View style={styles.row}>
            <View style={styles.col}>
              <PdfRadarChart scores={data.scores} size={180} />
            </View>
            <View style={styles.col}>
              {categories.map((cat) => (
                <View key={cat.label} style={styles.scoreCard}>
                  <Text style={styles.scoreLabel}>{cat.label}</Text>
                  <Text
                    style={[
                      styles.scoreValue,
                      { color: gradeColor(cat.score) },
                    ]}
                  >
                    {Math.round(cat.score)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Section>

        {data.crawl.summary && (
          <Section title="Executive Summary">
            <Text style={styles.summaryText}>{data.crawl.summary}</Text>
          </Section>
        )}

        <Section title="Top Quick Wins">
          {data.quickWins.slice(0, 5).map((win, i) => (
            <View key={i} style={styles.quickWinRow}>
              <Text style={styles.quickWinTitle}>
                {i + 1}. {win.message}
              </Text>
              <Text style={styles.quickWinRec}>{win.recommendation}</Text>
              <Text style={styles.quickWinMeta}>
                +{win.scoreImpact} pts | {win.affectedPages} pages | Effort:{" "}
                {win.effort}
                {win.roi.trafficEstimate ? ` | ${win.roi.trafficEstimate}` : ""}
              </Text>
            </View>
          ))}
        </Section>

        <ReportFooter brandName={brandName} />
      </Page>

      {/* Trends + Visibility */}
      {(data.history.length > 1 || data.visibility) && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          {data.history.length > 1 && (
            <Section title="Score Trend">
              <PdfLineChart
                series={[
                  {
                    name: "Overall",
                    data: data.history.map((h) => ({
                      label: new Date(h.completedAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      ),
                      value: h.overall,
                    })),
                    color: "#4f46e5",
                  },
                ]}
                width={500}
                height={200}
              />
            </Section>
          )}

          {data.visibility && (
            <Section title="AI Visibility Snapshot">
              <PdfBarChart
                data={data.visibility.platforms.map((p) => ({
                  label:
                    p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
                  value: p.brandMentionRate,
                  color: brandColor,
                }))}
                width={450}
                height={140}
                title="Brand Mention Rate (%)"
              />
            </Section>
          )}

          <ReportFooter brandName={brandName} />
        </Page>
      )}

      {/* Lead Capture Page (Public only) */}
      {data.isPublic && (
        <Page size="A4" style={[styles.page, { backgroundColor: brandColor }]}>
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold" }}>
              Ready to optimize for AI Search?
            </Text>
            <Text style={{ fontSize: 12, marginTop: 10, opacity: 0.9 }}>
              {brandName
                ? `Contact ${brandName} to implement these expert AI SEO optimizations.`
                : "Scan your site free and start your journey to AI visibility."}
            </Text>
            <View
              style={{
                marginTop: 30,
                padding: 12,
                backgroundColor: "#ffffff",
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  color: brandColor,
                  fontSize: 14,
                  fontFamily: "Helvetica-Bold",
                }}
              >
                {brandName ? "Contact Agency" : "llmboost.io"}
              </Text>
            </View>
          </View>
          <View
            style={{
              position: "absolute",
              bottom: 40,
              left: 40,
              right: 40,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#ffffff", opacity: 0.6, fontSize: 8 }}>
              Powered by LLM Boost
            </Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
