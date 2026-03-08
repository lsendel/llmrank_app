export type ActionItemStatus =
  | "pending"
  | "in_progress"
  | "fixed"
  | "dismissed";

export interface ActionItem {
  id: string;
  projectId: string;
  pageId?: string | null;
  issueCode: string;
  status: ActionItemStatus;
  severity: "critical" | "warning" | "info";
  category: string;
  scoreImpact: number;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  verifiedAt: string | null;
  verifiedByCrawlId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItemStats {
  total: number;
  fixed: number;
  inProgress: number;
  dismissed: number;
  pending: number;
  fixRate: number;
}

export interface ActionItemBulkResult {
  items: ActionItem[];
  created: number;
  updated: number;
}
