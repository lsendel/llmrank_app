import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type { Persona } from "../types/personas";

export function createPersonasApi() {
  return {
    async list(projectId: string): Promise<Persona[]> {
      const res = await apiClient.get<ApiEnvelope<Persona[]>>(
        `/api/personas/${projectId}`,
      );
      return res.data;
    },

    async create(projectId: string, data: Partial<Persona>): Promise<Persona> {
      const res = await apiClient.post<ApiEnvelope<Persona>>(
        `/api/personas/${projectId}`,
        data,
      );
      return res.data;
    },

    async update(id: string, data: Partial<Persona>): Promise<Persona> {
      const res = await apiClient.patch<ApiEnvelope<Persona>>(
        `/api/personas/${id}`,
        data,
      );
      return res.data;
    },

    async remove(id: string): Promise<void> {
      await apiClient.delete(`/api/personas/${id}`);
    },

    async generate(projectId: string, role: string): Promise<Partial<Persona>> {
      const res = await apiClient.post<ApiEnvelope<Partial<Persona>>>(
        `/api/personas/${projectId}/generate`,
        { role },
      );
      return res.data;
    },

    async refine(id: string): Promise<Partial<Persona>> {
      const res = await apiClient.post<ApiEnvelope<Partial<Persona>>>(
        `/api/personas/${id}/refine`,
        {},
      );
      return res.data;
    },
  };
}
