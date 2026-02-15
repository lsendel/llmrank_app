import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAdminService } from "../../services/admin-service";
import { createMockAdminRepo } from "../helpers/mock-repositories";

describe("AdminService", () => {
  let admin: ReturnType<typeof createMockAdminRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    admin = createMockAdminRepo();
  });

  it("returns stats from admin repository", async () => {
    const statsData = { totalUsers: 100, totalCrawls: 50 };
    admin.getStats.mockResolvedValue(statsData as any);
    const service = createAdminService({ admin });

    const result = await service.getStats();
    expect(result).toEqual(statsData);
    expect(admin.getStats).toHaveBeenCalledTimes(1);
  });

  it("returns paginated customers", async () => {
    const customers = {
      data: [{ id: "user-1", email: "a@b.com" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    admin.getCustomers.mockResolvedValue(customers as any);
    const service = createAdminService({ admin });

    const result = await service.getCustomers({ page: 1, limit: 20 });
    expect(result).toEqual(customers);
    expect(admin.getCustomers).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it("throws NOT_FOUND when customer detail is null", async () => {
    admin.getCustomerDetail.mockResolvedValue(null);
    const service = createAdminService({ admin });

    await expect(service.getCustomerDetail("unknown-id")).rejects.toThrow(
      "Customer not found",
    );
  });

  it("retries crawl job and records admin action", async () => {
    admin.retryCrawlJob.mockResolvedValue({ id: "crawl-1", status: "queued" });
    const service = createAdminService({ admin });

    const result = await service.retryCrawlJob("crawl-1", "admin-1");
    expect(result).toEqual({ id: "crawl-1", status: "queued" });
    expect(admin.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "retry_crawl_job",
        targetType: "crawl_job",
        targetId: "crawl-1",
      }),
    );
  });

  it("cancels crawl job with reason and records admin action", async () => {
    admin.cancelCrawlJob.mockResolvedValue({
      id: "crawl-1",
      status: "cancelled",
    });
    const service = createAdminService({ admin });

    const result = await service.cancelCrawlJob("crawl-1", "stuck", "admin-1");
    expect(result).toEqual({ id: "crawl-1", status: "cancelled" });
    expect(admin.cancelCrawlJob).toHaveBeenCalledWith(
      "crawl-1",
      "stuck",
      "admin-1",
    );
    expect(admin.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cancel_crawl_job",
        reason: "stuck",
      }),
    );
  });
});
