import React from "react";
import { View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import type { ReportData } from "../../types";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: "1 solid #e5e7eb",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 24, height: 24, objectFit: "contain" },
  brandName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  date: { fontSize: 9, color: "#6b7280" },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: "0.5 solid #e5e7eb",
  },
  compactBrand: { fontSize: 9, fontFamily: "Helvetica-Bold" },
});

export function ReportHeader({
  data,
  compact,
}: {
  data: ReportData;
  compact?: boolean;
}) {
  const brandName = data.project.branding?.companyName || "LLM Rank";
  const brandColor = data.project.branding?.primaryColor || "#4f46e5";
  const logoUrl = data.project.branding?.logoUrl;

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (compact) {
    return (
      <View style={styles.compactHeader}>
        <Text style={[styles.compactBrand, { color: brandColor }]}>
          {brandName}
        </Text>
        <Text style={styles.date}>
          {data.project.domain} | {date}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        <Text style={[styles.brandName, { color: brandColor }]}>
          {brandName}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.date}>{date}</Text>
        <Text style={{ fontSize: 7, color: "#9ca3af", marginTop: 2 }}>
          {data.project.domain}
        </Text>
      </View>
    </View>
  );
}
