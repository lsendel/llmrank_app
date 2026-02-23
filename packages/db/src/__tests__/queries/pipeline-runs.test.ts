import { describe, it, expect, vi, beforeEach } from "vitest";
import { pipelineRunQueries } from "../../queries/pipeline-runs";

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);

  chain.then = vi.fn().mockImplementation((resolve: any) => resolve([]));

  const queryHandlers: Record<
    string,
    Record<string, ReturnType<typeof vi.fn>>
  > = {};
  const queryProxy = new Proxy(
    {},
    {
      get(_target, tableName: string) {
        if (!queryHandlers[tableName]) {
          queryHandlers[tableName] = {
            findFirst: vi.fn().mockResolvedValue(undefined),
            findMany: vi.fn().mockResolvedValue([]),
          };
        }
        return queryHandlers[tableName];
      },
    },
  );

  return { chain, queryHandlers, db: { ...chain, query: queryProxy } as any };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pipelineRunQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let q: ReturnType<typeof pipelineRunQueries>;

  beforeEach(() => {
    mock = createMockDb();
    q = pipelineRunQueries(mock.db);
  });

  it("create inserts a new pipeline run", async () => {
    const data = {
      projectId: "proj-1",
      crawlJobId: "crawl-1",
      settings: { autoRunOnCrawl: true, skipSteps: [] },
    };
    mock.chain.returning.mockResolvedValueOnce([{ id: "run-1", ...data }]);

    const result = await q.create(data);
    expect(mock.db.insert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "run-1" });
  });

  it("getById returns a pipeline run", async () => {
    const fakeRun = { id: "run-1", status: "pending" };
    mock.db.query.pipelineRuns.findFirst.mockResolvedValueOnce(fakeRun);

    const result = await q.getById("run-1");
    expect(result).toEqual(fakeRun);
  });

  it("getLatestByProject returns most recent run", async () => {
    const fakeRun = { id: "run-2", projectId: "proj-1" };
    mock.db.query.pipelineRuns.findFirst.mockResolvedValueOnce(fakeRun);

    const result = await q.getLatestByProject("proj-1");
    expect(result).toEqual(fakeRun);
  });

  it("listByProject returns all runs for a project", async () => {
    const runs = [
      { id: "run-1", projectId: "proj-1" },
      { id: "run-2", projectId: "proj-1" },
    ];
    mock.db.query.pipelineRuns.findMany.mockResolvedValueOnce(runs);

    const result = await q.listByProject("proj-1");
    expect(result).toHaveLength(2);
  });

  it("updateStatus updates status and extra fields", async () => {
    mock.chain.returning.mockResolvedValueOnce([
      { id: "run-1", status: "running" },
    ]);

    const result = await q.updateStatus("run-1", "running", {
      startedAt: new Date(),
    });
    expect(mock.db.update).toHaveBeenCalled();
    expect(result).toMatchObject({ status: "running" });
  });

  it("updateStep updates currentStep and merges stepResults", async () => {
    mock.db.query.pipelineRuns.findFirst.mockResolvedValueOnce({
      id: "run-1",
      stepResults: { site_description: { status: "completed" } },
    });
    mock.chain.returning.mockResolvedValueOnce([{ id: "run-1" }]);

    await q.updateStep("run-1", "competitors", {
      status: "completed",
      duration_ms: 500,
    });
    expect(mock.db.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: "competitors",
        stepResults: expect.objectContaining({
          site_description: { status: "completed" },
          competitors: { status: "completed", duration_ms: 500 },
        }),
      }),
    );
  });
});
