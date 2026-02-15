import { BorderStyle, ShadingType } from "docx";

export const BRAND_COLOR = "4F46E5";
export const GRAY_600 = "4B5563";
export const GRAY_400 = "9CA3AF";
export const GREEN = "16A34A";
export const RED = "DC2626";
export const YELLOW = "CA8A04";
export const BLUE = "2563EB";

export function gradeColor(score: number): string {
  if (score >= 90) return GREEN;
  if (score >= 80) return BLUE;
  if (score >= 70) return YELLOW;
  if (score >= 60) return "EA580C";
  return RED;
}

export function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export const TABLE_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
};

export const HEADER_SHADING = {
  type: ShadingType.CLEAR,
  fill: "F3F4F6",
  color: "auto",
};
