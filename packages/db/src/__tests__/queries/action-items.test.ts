import { beforeEach, describe, expect, it, vi } from "vitest";
import { actionItemQueries } from "../../queries/action-items";

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);

  return { chain, db: chain as any };
}

describe("actionItemQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof actionItemQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = actionItemQueries(mock.db);
  });

  it("update accepts an already-normalized ISO due date string", async () => {
    const dueAt = "2026-06-30T12:00:00.000Z";
    const updated = { id: "action-1", dueAt };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.update("action-1", { dueAt });

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAt,
        updatedAt: expect.any(String),
      }),
    );
    expect(result).toEqual(updated);
  });

  it("update still serializes Date due values", async () => {
    const dueAtDate = new Date("2026-07-01T12:00:00.000Z");
    mock.chain.returning.mockResolvedValueOnce([{ id: "action-1" }]);

    await queries.update("action-1", { dueAt: dueAtDate });

    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAt: "2026-07-01T12:00:00.000Z",
      }),
    );
  });
});
