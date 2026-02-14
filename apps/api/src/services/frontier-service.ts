import { type Database } from "@llm-boost/db";

export interface FrontierService {
  isSeen(projectId: string, url: string): Promise<boolean>;
  markSeen(projectId: string, url: string): Promise<void>;
  clearProject(projectId: string): Promise<void>;
}

export function createFrontierService(kv: KVNamespace): FrontierService {
  return {
    async isSeen(projectId, url) {
      const key = `seen:${projectId}:${url}`;
      const val = await kv.get(key);
      return !!val;
    },

    async markSeen(projectId, url) {
      const key = `seen:${projectId}:${url}`;
      // Set with 7 day expiry so we don't leak memory indefinitely
      await kv.put(key, new Date().toISOString(), {
        expirationTtl: 60 * 60 * 24 * 7,
      });
    },

    async clearProject(projectId) {
      // Note: KV doesn't support bulk delete by prefix easily in a single op
      // In production, we'd list keys and delete them.
    },
  };
}
