import React from "react";
import { pdf } from "@react-pdf/renderer";
import type { ReportData } from "../types";
import { SummaryReportPdf } from "./templates/summary";
import { DetailedReportPdf } from "./templates/detailed";

export async function renderPdf(
  data: ReportData,
  type: "summary" | "detailed",
): Promise<Uint8Array> {
  const element =
    type === "summary"
      ? React.createElement(SummaryReportPdf, { data })
      : React.createElement(DetailedReportPdf, { data });

  // Use pdf().toBlob() which works in both Node.js and edge/Worker environments
  // (renderToBuffer is Node-only and fails in Cloudflare Workers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(element as any).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
