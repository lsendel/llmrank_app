import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  ActionItem,
  ActionItemBulkResult,
  ActionItemStats,
  ActionItemStatus,
} from "../types/action-items";

type ActionItemSeverity = "critical" | "warning" | "info";

type ActionItemCategory =
  | "technical"
  | "content"
  | "ai_readiness"
  | "performance"
  | "schema"
  | "llm_visibility";

type CreateActionItemInput = {
  projectId: string;
  pageId?: string | null;
  issueCode: string;
  status?: ActionItemStatus;
  severity?: ActionItemSeverity;
  category?: ActionItemCategory;
  scoreImpact?: number;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
};

type BulkActionItemInput = Omit<CreateActionItemInput, "projectId">;

type BulkCreateActionItemsInput = {
  projectId: string;
  items: BulkActionItemInput[];
};

type UpdateActionItemInput = Partial<{
  status: ActionItemStatus;
  assigneeId: string | null;
  dueAt: string | null;
  title: string;
  description: string | null;
}>;

export function createActionItemsApi() {
  return {
    async create(data: CreateActionItemInput): Promise<ActionItem> {
      const res = await apiClient.post<ApiEnvelope<ActionItem>>(
        "/api/action-items",
        data,
      );
      return res.data;
    },

    async bulkCreate(
      data: BulkCreateActionItemsInput,
    ): Promise<ActionItemBulkResult> {
      const res = await apiClient.post<ApiEnvelope<ActionItemBulkResult>>(
        "/api/action-items/bulk",
        data,
      );
      return res.data;
    },

    async update(id: string, data: UpdateActionItemInput): Promise<ActionItem> {
      const res = await apiClient.patch<ApiEnvelope<ActionItem>>(
        `/api/action-items/${id}`,
        data,
      );
      return res.data;
    },

    async list(projectId: string): Promise<ActionItem[]> {
      const res = await apiClient.get<ApiEnvelope<ActionItem[]>>(
        `/api/action-items?projectId=${projectId}`,
      );
      return res.data;
    },

    async updateStatus(
      id: string,
      status: ActionItemStatus,
    ): Promise<ActionItem> {
      const res = await apiClient.patch<ApiEnvelope<ActionItem>>(
        `/api/action-items/${id}/status`,
        { status },
      );
      return res.data;
    },

    async stats(projectId: string): Promise<ActionItemStats> {
      const res = await apiClient.get<ApiEnvelope<ActionItemStats>>(
        `/api/action-items/stats?projectId=${projectId}`,
      );
      return res.data;
    },
  };
}
