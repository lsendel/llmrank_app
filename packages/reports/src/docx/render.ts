import { Packer } from "docx";
import type { ReportData } from "../types";
import { buildSummaryDocx } from "./templates/summary";
import { buildDetailedDocx } from "./templates/detailed";

export async function renderDocx(
  data: ReportData,
  type: "summary" | "detailed",
): Promise<Buffer> {
  const doc =
    type === "summary" ? buildSummaryDocx(data) : buildDetailedDocx(data);
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
