import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNarrativeService } from "../../services/narrative-service";
import {
  createMockCrawlRepo,
  createMockNarrativeRepo,
  createMockProjectRepo,
  createMockUserRepo,
} from "../helpers/mock-repositories";
import { buildCrawlJob, buildProject } from "../helpers/factories";

describe("NarrativeService", () => {
  let narratives: ReturnType<typeof createMockNarrativeRepo>;
  let projects: ReturnType<typeof createMockProjectRepo>;
  let users: ReturnType<typeof createMockUserRepo>;
  let crawls: ReturnType<typeof createMockCrawlRepo>;

  beforeEach(() => {
    vi.clearAllMocks();

    narratives = createMockNarrativeRepo();
    projects = createMockProjectRepo();
    users = createMockUserRepo();
    crawls = createMockCrawlRepo();

    crawls.getById.mockResolvedValue(
      buildCrawlJob({ id: "crawl-1", projectId: "proj-1" }),
    );
    projects.getById.mockResolvedValue(
      buildProject({ id: "proj-1", userId: "user-1" }),
    );
  });

  function createService() {
    return createNarrativeService({
      db: {} as any,
      adminDb: {} as any,
      narratives,
      projects,
      users,
      crawls,
    });
  }

  describe("get", () => {
    it("returns null when an owned crawl has no generated narrative yet", async () => {
      // Regression: ISSUE-002 - empty narrative state caused dashboard 404s.
      // Found by /qa on 2026-06-27.
      narratives.getByCrawlAndTone.mockResolvedValue(null as any);

      const result = await createService().get(
        "user-1",
        "crawl-1",
        "technical",
      );

      expect(result).toBeNull();
      expect(narratives.getByCrawlAndTone).toHaveBeenCalledWith(
        "crawl-1",
        "technical",
      );
    });
  });
});
