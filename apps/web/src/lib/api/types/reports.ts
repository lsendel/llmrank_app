export interface Report {
  id: string;
  projectId: string;
  crawlJobId: string;
  type: "summary" | "detailed";
  format: "pdf" | "docx";
  status: "queued" | "generating" | "complete" | "failed";
  r2Key: string | null;
  fileSize: number | null;
  config: Record<string, unknown>;
  error: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReportSchedule {
  id: string;
  projectId: string;
  format: "pdf" | "docx";
  type: "summary" | "detailed";
  recipientEmail: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
