import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractorQueries } from "../../queries/extractors";

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
  chain.offset = vi.fn().mockReturnValue(chain);

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

describe("extractorQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof extractorQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = extractorQueries(mock.db);
  });

  // --- listByProject ---
  it("listByProject returns all extractors for a project", async () => {
    const extractors = [
      {
        id: "ex1",
        projectId: "p1",
        name: "Price",
        type: "css_selector",
        selector: ".price",
      },
      {
        id: "ex2",
        projectId: "p1",
        name: "Phone",
        type: "regex",
        selector: "\\d{3}-\\d{4}",
      },
    ];
    mock.db.query.customExtractors.findMany.mockResolvedValueOnce(extractors);

    const result = await queries.listByProject("p1");

    expect(mock.db.query.customExtractors.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Price");
  });

  it("listByProject returns empty array when no extractors exist", async () => {
    const result = await queries.listByProject("p-empty");
    expect(result).toEqual([]);
  });

  // --- create ---
  it("create inserts a new extractor and returns it", async () => {
    const extractor = {
      id: "ex3",
      projectId: "p1",
      name: "Email",
      type: "regex",
      selector: "[a-z]+@[a-z]+\\.com",
    };
    mock.chain.returning.mockResolvedValueOnce([extractor]);

    const result = await queries.create({
      projectId: "p1",
      name: "Email",
      type: "regex",
      selector: "[a-z]+@[a-z]+\\.com",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith({
      projectId: "p1",
      name: "Email",
      type: "regex",
      selector: "[a-z]+@[a-z]+\\.com",
    });
    expect(result).toEqual(extractor);
  });

  it("create passes optional attribute when provided", async () => {
    const extractor = {
      id: "ex4",
      projectId: "p1",
      name: "Logo",
      type: "css_selector",
      selector: "img.logo",
      attribute: "src",
    };
    mock.chain.returning.mockResolvedValueOnce([extractor]);

    const result = await queries.create({
      projectId: "p1",
      name: "Logo",
      type: "css_selector",
      selector: "img.logo",
      attribute: "src",
    });

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ attribute: "src" }),
    );
    expect(result).toEqual(extractor);
  });

  // --- update ---
  it("update modifies extractor fields and returns updated row", async () => {
    const updated = {
      id: "ex1",
      name: "Updated Price",
      selector: ".new-price",
    };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.update("ex1", "p1", {
      name: "Updated Price",
      selector: ".new-price",
    });

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated Price",
        selector: ".new-price",
      }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it("update includes updatedAt timestamp in the set", async () => {
    mock.chain.returning.mockResolvedValueOnce([{ id: "ex1" }]);

    await queries.update("ex1", "p1", { name: "New Name" });

    const setArg = mock.chain.set.mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  // --- remove ---
  it("remove deletes the extractor by id and project", async () => {
    await queries.remove("ex1", "p1");

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
  });
});
