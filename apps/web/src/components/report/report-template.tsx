"use client";

import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { CrawlJob, QuickWin } from "@/lib/api";

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 12,
    color: "#1a1a2e",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    // gap: 10, removed for safety
  },
  logo: {
    width: 30,
    height: 30,
    objectFit: "contain",
    marginRight: 10,
  },
  brand: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6366f1",
  },
  projectInfo: {
    textAlign: "right",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 30,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333333",
    backgroundColor: "#f8f9fa",
    padding: 5,
  },
  summaryCard: {
    backgroundColor: "#f0f4ff",
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
    marginBottom: 20,
  },
  summaryText: {
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    // gap: 10, removed for safety
    justifyContent: "space-between",
    marginBottom: 20,
  },
  scoreCard: {
    width: "48%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#eeeeee",
    borderRadius: 6,
    marginBottom: 10,
  },
  scoreLabel: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  issueRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  issueMessage: {
    fontWeight: "bold",
    fontSize: 11,
    marginBottom: 2,
  },
  issueRec: {
    fontSize: 10,
    color: "#444444",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: "#999999",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 10,
  },
});

export interface NarrativePDFSection {
  id: string;
  title: string;
  content: string;
  editedContent?: string | null;
}

export interface ReportProps {
  crawl: CrawlJob;
  quickWins: QuickWin[];
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  narrativeSections?: NarrativePDFSection[];
}

export const AIReadinessReport: React.FC<ReportProps> = ({
  crawl,
  quickWins,
  companyName = "LLM Rank",
  logoUrl,
  primaryColor = "#6366f1",
  narrativeSections,
}) => {
  // Ensure primaryColor is a valid 6-char hex, otherwise fallback
  const safePrimary = /^#[0-9A-F]{6}$/i.test(primaryColor || "")
    ? primaryColor
    : "#6366f1";

  // Dynamic styles based on props
  const dynamicStyles = {
    brand: { color: safePrimary },
    sectionTitle: { color: safePrimary },
    summaryCard: {
      backgroundColor: "#f0f4ff",
      borderLeftColor: safePrimary,
    },
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Colored header bar */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: safePrimary,
          }}
        />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <View>
              <Text style={[styles.brand, dynamicStyles.brand]}>
                {companyName}
              </Text>
              {companyName !== "LLM Rank" && (
                <Text style={{ fontSize: 8, color: "#999999" }}>
                  Prepared by {companyName}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.projectInfo}>
            <Text>{crawl.projectName}</Text>
            <Text style={{ fontSize: 9, color: "#666" }}>
              Generated {new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Hero */}
        <Text style={styles.title}>AI-Readiness Audit</Text>
        <Text style={styles.subtitle}>
          Overall Score: {crawl.overallScore}/100 ({crawl.letterGrade})
        </Text>

        {/* Executive Summary */}
        {crawl.summary && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
              Executive Summary
            </Text>
            <View style={[styles.summaryCard, dynamicStyles.summaryCard]}>
              <Text style={styles.summaryText}>{crawl.summary}</Text>
            </View>
          </View>
        )}

        {/* Scores */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
            Score Breakdown
          </Text>
          <View style={styles.scoreGrid}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Technical SEO</Text>
              <Text style={styles.scoreValue}>
                {crawl.scores?.technical ?? 0}
              </Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Content Quality</Text>
              <Text style={styles.scoreValue}>
                {crawl.scores?.content ?? 0}
              </Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>AI Readiness</Text>
              <Text style={styles.scoreValue}>
                {crawl.scores?.aiReadiness ?? 0}
              </Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Performance</Text>
              <Text style={styles.scoreValue}>
                {crawl.scores?.performance ?? 0}
              </Text>
            </View>
          </View>
        </View>

        {/* AI Narrative Sections */}
        {narrativeSections &&
          narrativeSections.length > 0 &&
          narrativeSections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
                {section.title}
              </Text>
              <Text style={{ fontSize: 10, lineHeight: 1.5 }}>
                {(section.editedContent ?? section.content)
                  .replace(/<[^>]*>/g, "")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")}
              </Text>
            </View>
          ))}

        {/* Quick Wins */}
        {quickWins.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
              Priority Recommendations
            </Text>
            {quickWins.map((win, i) => (
              <View key={i} style={styles.issueRow}>
                <Text style={styles.issueMessage}>
                  {i + 1}. {win.message}
                </Text>
                <Text style={styles.issueRec}>{win.recommendation}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {companyName !== "LLM Rank" ? `${companyName} \u2022 ` : ""}
          Confidence in AI discovery depends on continuous optimization. This
          report is based on current LLM indexing patterns as of February 2026.
        </Text>
      </Page>
    </Document>
  );
};
