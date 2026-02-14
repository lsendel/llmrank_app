import type { AdminRepository } from "../repositories";
import { ServiceError } from "./errors";

export interface AdminServiceDeps {
  admin: AdminRepository;
}

export function createAdminService(deps: AdminServiceDeps) {
  return {
    getStats() {
      return deps.admin.getStats();
    },

    getCustomers(args: { page?: number; limit?: number; search?: string }) {
      return deps.admin.getCustomers(args);
    },

    async getCustomerDetail(id: string) {
      const detail = await deps.admin.getCustomerDetail(id);
      if (!detail) {
        throw new ServiceError("NOT_FOUND", 404, "Customer not found");
      }
      return detail;
    },

    getIngestDetails() {
      return deps.admin.getIngestDetails();
    },

    async retryCrawlJob(jobId: string, adminId: string) {
      const updated = await deps.admin.retryCrawlJob(jobId);
      if (!updated) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }
      await deps.admin.recordAction({
        actorId: adminId,
        action: "retry_crawl_job",
        targetType: "crawl_job",
        targetId: jobId,
      });
      return updated;
    },

    async replayOutboxEvent(eventId: string, adminId: string) {
      const updated = await deps.admin.replayOutboxEvent(eventId);
      if (!updated) {
        throw new ServiceError("NOT_FOUND", 404, "Outbox event not found");
      }
      await deps.admin.recordAction({
        actorId: adminId,
        action: "replay_outbox_event",
        targetType: "outbox_event",
        targetId: eventId,
      });
      return updated;
    },

    async cancelCrawlJob(jobId: string, reason: string, adminId: string) {
      const updated = await deps.admin.cancelCrawlJob(jobId, reason, adminId);
      if (!updated) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }
      await deps.admin.recordAction({
        actorId: adminId,
        action: "cancel_crawl_job",
        targetType: "crawl_job",
        targetId: jobId,
        reason,
      });
      return updated;
    },
  };
}
