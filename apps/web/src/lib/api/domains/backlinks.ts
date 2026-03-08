import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";

export function createBacklinksApi() {
  return {
    async getSummary(projectId: string) {
      const res = await apiClient.get<
        ApiEnvelope<{
          domain: string;
          totalBacklinks: number;
          referringDomains: number;
          dofollowRatio: number;
          topReferringDomains: {
            domain: string;
            linkCount: number;
            latestAnchor: string | null;
            firstSeen: string;
          }[];
        }>
      >(`/api/backlinks/project/${projectId}`);
      return res.data;
    },

    async getLinks(projectId: string, limit = 50, offset = 0) {
      const res = await apiClient.get<
        ApiEnvelope<{
          links: {
            sourceUrl: string;
            sourceDomain: string;
            targetUrl: string;
            anchorText: string | null;
            rel: string;
            lastSeenAt: string;
          }[];
          total: number;
          limit: number;
          offset: number;
        }>
      >(
        `/api/backlinks/project/${projectId}/links?limit=${limit}&offset=${offset}`,
      );
      return res.data;
    },

    async getReferringDomains(projectId: string) {
      const res = await apiClient.get<
        ApiEnvelope<
          {
            domain: string;
            linkCount: number;
            latestAnchor: string | null;
            firstSeen: string;
          }[]
        >
      >(`/api/backlinks/project/${projectId}/referring-domains`);
      return res.data;
    },
  };
}
