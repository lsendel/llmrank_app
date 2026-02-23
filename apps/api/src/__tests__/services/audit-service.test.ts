import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuditQueries = {
  create: vi.fn().mockResolvedValue({ id: "log-1" }),
};
const mockOutbox = {
  enqueue: vi.fn().mockResolvedValue({ id: "evt-1" }),
};

vi.mock("@llm-boost/db", () => ({
  auditLogWriteQueries: () => mockAuditQueries,
  outboxQueries: () => mockOutbox,
}));

import { createAuditService } from "../../services/audit-service";

describe("AuditService", () => {
  const fakeDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emitEvent writes to auditLogs and enqueues outbox event", async () => {
    const service = createAuditService(fakeDb);
    await service.emitEvent({
      action: "crawl.started",
      actorId: "user-1",
      resourceType: "crawl_job",
      resourceId: "crawl-1",
    });

    expect(mockAuditQueries.create).toHaveBeenCalledWith({
      action: "crawl.started",
      actorId: "user-1",
      resourceType: "crawl_job",
      resourceId: "crawl-1",
      metadata: undefined,
    });
    expect(mockOutbox.enqueue).toHaveBeenCalledWith({
      type: "audit.crawl.started",
      payload: expect.objectContaining({ action: "crawl.started" }),
    });
  });

  it("emitEvent does not throw if outbox enqueue fails", async () => {
    mockOutbox.enqueue.mockRejectedValueOnce(new Error("DB error"));
    const service = createAuditService(fakeDb);

    await expect(
      service.emitEvent({
        action: "project.created",
        actorId: "user-1",
        resourceType: "project",
      }),
    ).resolves.not.toThrow();

    expect(mockAuditQueries.create).toHaveBeenCalled();
  });

  it("passes metadata through to audit log", async () => {
    const service = createAuditService(fakeDb);
    await service.emitEvent({
      action: "pipeline.completed",
      actorId: "system",
      resourceType: "pipeline_run",
      resourceId: "run-1",
      metadata: { duration_ms: 5000, steps: 7 },
    });

    expect(mockAuditQueries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { duration_ms: 5000, steps: 7 },
      }),
    );
  });
});
