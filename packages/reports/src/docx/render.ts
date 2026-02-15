import { Packer } from "docx";
import type { ReportData } from "../types";
import { buildSummaryDocx } from "./templates/summary";
import { buildDetailedDocx } from "./templates/detailed";

export async function renderDocx(
  data: ReportData,
  type: "summary" | "detailed",
): Promise<Uint8Array> {
  const doc =
    type === "summary" ? buildSummaryDocx(data) : buildDetailedDocx(data);
  // Use toBlob() which works in both Node.js and edge/Worker environments
  // (toBuffer() is Node-only and may fail in Cloudflare Workers)
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
