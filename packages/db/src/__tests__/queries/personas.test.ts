import { beforeEach, describe, expect, it, vi } from "vitest";
import { personaQueries } from "../../queries/personas";

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);

  return {
    chain,
    db: {
      query: {
        personas: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
      },
      ...chain,
    } as any,
  };
}

describe("personaQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof personaQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = personaQueries(mock.db);
  });

  it("deserializes vocabulary and sample query JSON strings on list", async () => {
    mock.db.query.personas.findMany.mockResolvedValueOnce([
      {
        id: "persona-1",
        vocabulary: '["senior care","Medicaid"]',
        sampleQueries:
          '["best assisted living near me","does Medicaid cover care"]',
      },
    ]);

    const result = await queries.listByProject("project-1");

    expect(result[0]).toEqual(
      expect.objectContaining({
        vocabulary: ["senior care", "Medicaid"],
        sampleQueries: [
          "best assisted living near me",
          "does Medicaid cover care",
        ],
      }),
    );
  });

  it("returns arrays after create even though D1 stores JSON text", async () => {
    mock.chain.returning.mockResolvedValueOnce([
      {
        id: "persona-1",
        vocabulary: '["home care"]',
        sampleQueries: '["home care near me"]',
      },
    ]);

    const result = await queries.create({
      projectId: "project-1",
      name: "Adult Daughter Care Researcher",
      role: "Adult child caregiver",
      vocabulary: ["home care"],
      sampleQueries: ["home care near me"],
    });

    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        vocabulary: '["home care"]',
        sampleQueries: '["home care near me"]',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        vocabulary: ["home care"],
        sampleQueries: ["home care near me"],
      }),
    );
  });
});
