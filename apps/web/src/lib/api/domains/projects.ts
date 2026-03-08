import { apiClient } from "../core/client";
import { buildQueryString } from "../core/query";
import type { ApiEnvelope } from "../core/types";
import type { PaginatedResponse } from "../types/pagination";
import type {
  ChecklistData,
  CreateProjectInput,
  Project,
  ProjectProgress,
  UpdateProjectInput,
} from "../types/projects";

export function createProjectsApi() {
  return {
    async list(params?: {
      page?: number;
      limit?: number;
      q?: string;
      health?:
        | "all"
        | "good"
        | "needs_work"
        | "poor"
        | "no_crawl"
        | "in_progress"
        | "failed";
      sort?:
        | "activity_desc"
        | "score_desc"
        | "score_asc"
        | "name_asc"
        | "name_desc"
        | "created_desc"
        | "created_asc";
    }): Promise<PaginatedResponse<Project>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<Project>>(`/api/projects${qs}`);
    },

    async get(projectId: string): Promise<Project> {
      const res = await apiClient.get<ApiEnvelope<Project>>(
        `/api/projects/${projectId}`,
      );
      return res.data;
    },

    async create(data: CreateProjectInput): Promise<Project> {
      const res = await apiClient.post<ApiEnvelope<Project>>(
        "/api/projects",
        data,
      );
      return res.data;
    },

    async update(
      projectId: string,
      data: UpdateProjectInput,
    ): Promise<Project> {
      const res = await apiClient.put<ApiEnvelope<Project>>(
        `/api/projects/${projectId}`,
        data,
      );
      return res.data;
    },

    async delete(projectId: string): Promise<void> {
      await apiClient.delete<ApiEnvelope<{ id: string; deleted: boolean }>>(
        `/api/projects/${projectId}`,
      );
    },

    async progress(projectId: string): Promise<ProjectProgress | null> {
      const res = await apiClient.get<ApiEnvelope<ProjectProgress | null>>(
        `/api/projects/${projectId}/progress`,
      );
      return res.data;
    },

    async getChecklistStatus(projectId: string): Promise<ChecklistData> {
      const res = await apiClient.get<ApiEnvelope<ChecklistData>>(
        `/api/projects/${projectId}/checklist-status`,
      );
      return res.data;
    },

    async updateSiteContext(
      projectId: string,
      data: { siteDescription?: string; industry?: string },
    ): Promise<void> {
      await apiClient.patch(`/api/projects/${projectId}/site-context`, data);
    },

    async rerunAutoGeneration(
      projectId: string,
    ): Promise<{ pipelineRunId?: string; status?: string }> {
      const res = await apiClient.post<
        ApiEnvelope<{ pipelineRunId?: string; status?: string }>
      >(`/api/projects/${projectId}/rerun-auto-generation`, {});
      return res.data;
    },

    async rediscoverCompetitors(projectId: string): Promise<void> {
      await apiClient.post(
        `/api/projects/${projectId}/rediscover-competitors`,
        {},
      );
    },
  };
}
