import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { chunkForD1Insert, D1_MAX_BIND_PARAMS } from "../../queries/d1-batch";
import { issues, pageScores, competitors } from "../../schema";

describe("chunkForD1Insert", () => {
  it("returns [] for empty input", () => {
    expect(chunkForD1Insert([], issues)).toEqual([]);
  });

  it("returns one chunk for a single row", () => {
    expect(chunkForD1Insert([{ id: "a" }], issues)).toEqual([[{ id: "a" }]]);
  });

  it("sizes chunks by table column count, not the row's key count", () => {
    // Rows with a single key. Naive Object.keys() sizing would allow 100
    // rows/chunk and blow past D1's limit, because Drizzle binds a param per
    // table column. Sizing must use the table's column count.
    const cols = Object.keys(getTableColumns(pageScores)).length;
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: String(i) }));
    const chunks = chunkForD1Insert(rows, pageScores);

    expect(cols).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length * cols).toBeLessThanOrEqual(D1_MAX_BIND_PARAMS);
    }
    // No rows dropped, order preserved.
    expect(chunks.flat()).toEqual(rows);
  });

  it("keeps every chunk within the bound-param budget for each table", () => {
    for (const table of [issues, pageScores, competitors]) {
      const cols = Object.keys(getTableColumns(table)).length;
      const rows = Array.from({ length: 60 }, (_, i) => ({ i }));
      for (const chunk of chunkForD1Insert(rows, table)) {
        expect(chunk.length * cols).toBeLessThanOrEqual(D1_MAX_BIND_PARAMS);
      }
    }
  });

  it("reserves headroom for conflict-clause params", () => {
    const cols = Object.keys(getTableColumns(competitors)).length;
    const rows = Array.from({ length: 60 }, (_, i) => ({ i }));
    for (const chunk of chunkForD1Insert(rows, competitors, 2)) {
      expect(chunk.length * cols).toBeLessThanOrEqual(D1_MAX_BIND_PARAMS - 2);
    }
  });
});
