import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock @llm-boost/db modules used by extractors route and ownership middleware
// ---------------------------------------------------------------------------

const mockProjectGetById = vi.fn().mockResolvedValue(null);
const mockExtractorListByProject = vi.fn().mockResolvedValue([]);
const mockExtractorCreate = vi.fn().mockResolvedValue({ id: "ext-1" });
const mockExtractorUpdate = vi.fn().mockResolvedValue(null);
const mockExtractorRemove = vi.fn().mockResolvedValue(undefined);

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    projectQueries: () => ({
      getById: mockProjectGetById,
    }),
    extractorQueries: () => ({
      listByProject: mockExtractorListByProject,
      create: mockExtractorCreate,
      update: mockExtractorUpdate,
      remove: mockExtractorRemove,
    }),
    createDb: orig.createDb,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Extractor Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectGetById.mockResolvedValue(
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    );
  });

  // -----------------------------------------------------------------------
  // GET /api/extractors/:projectId
  // -----------------------------------------------------------------------

  describe("GET /api/extractors/:projectId", () => {
    it("returns 200 with list of extractors", async () => {
      mockExtractorListByProject.mockResolvedValue([
        {
          id: "ext-1",
          name: "Price",
          type: "css_selector",
          selector: ".price",
        },
      ]);

      const res = await request("/api/extractors/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(1);
      expect(body.data[0]).toHaveProperty("id", "ext-1");
    });

    it("returns 200 with empty array when no extractors exist", async () => {
      mockExtractorListByProject.mockResolvedValue([]);

      const res = await request("/api/extractors/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });

    it("returns 404 when project does not exist", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request("/api/extractors/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when project belongs to different user", async () => {
      mockProjectGetById.mockResolvedValue(
        buildProject({ id: "proj-1", userId: "other-user" }),
      );

      const res = await request("/api/extractors/proj-1");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/extractors/:projectId
  // -----------------------------------------------------------------------

  describe("POST /api/extractors/:projectId", () => {
    it("returns 201 when creating extractor with valid data", async () => {
      mockExtractorCreate.mockResolvedValue({
        id: "ext-new",
        name: "Price",
        type: "css_selector",
        selector: ".price",
      });

      const res = await request("/api/extractors/proj-1", {
        method: "POST",
        json: { name: "Price", type: "css_selector", selector: ".price" },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "ext-new");
    });

    it("returns 422 when name is missing", async () => {
      const res = await request("/api/extractors/proj-1", {
        method: "POST",
        json: { type: "css_selector", selector: ".price" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("name");
    });

    it("returns 422 when type is missing", async () => {
      const res = await request("/api/extractors/proj-1", {
        method: "POST",
        json: { name: "Price", selector: ".price" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when selector is missing", async () => {
      const res = await request("/api/extractors/proj-1", {
        method: "POST",
        json: { name: "Price", type: "css_selector" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when type is invalid (not css_selector or regex)", async () => {
      const res = await request("/api/extractors/proj-1", {
        method: "POST",
        json: { name: "Price", type: "xpath", selector: "//div" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("css_selector or regex");
    });

    it("accepts regex type", async () => {
      mockExtractorCreate.mockResolvedValue({
        id: "ext-regex",
        name: "Version",
        type: "regex",
        selector: "v\\d+\\.\\d+",
      });

      const res = await request("/api/extractors/proj-1", {
        method: "POST",
        json: {
          name: "Version",
          type: "regex",
          selector: "v\\d+\\.\\d+",
        },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data.type).toBe("regex");
    });

    it("returns 404 when project does not belong to user", async () => {
      mockProjectGetById.mockResolvedValue(
        buildProject({ id: "proj-1", userId: "other-user" }),
      );

      const res = await request("/api/extractors/proj-1", {
        method: "POST",
        json: { name: "Price", type: "css_selector", selector: ".price" },
      });
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // PUT /api/extractors/:projectId/:id
  // -----------------------------------------------------------------------

  describe("PUT /api/extractors/:projectId/:id", () => {
    it("returns 200 when update succeeds", async () => {
      mockExtractorUpdate.mockResolvedValue({
        id: "ext-1",
        name: "Updated Price",
        type: "css_selector",
        selector: ".new-price",
      });

      const res = await request("/api/extractors/proj-1/ext-1", {
        method: "PUT",
        json: { name: "Updated Price", selector: ".new-price" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("name", "Updated Price");
    });

    it("returns 404 when extractor is not found", async () => {
      mockExtractorUpdate.mockResolvedValue(null);

      const res = await request("/api/extractors/proj-1/nonexistent", {
        method: "PUT",
        json: { name: "Updated" },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("Extractor not found");
    });

    it("returns 404 when project does not belong to user", async () => {
      mockProjectGetById.mockResolvedValue(
        buildProject({ id: "proj-1", userId: "other-user" }),
      );

      const res = await request("/api/extractors/proj-1/ext-1", {
        method: "PUT",
        json: { name: "Updated" },
      });
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/extractors/:projectId/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/extractors/:projectId/:id", () => {
    it("returns 200 with deleted confirmation", async () => {
      const res = await request("/api/extractors/proj-1/ext-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual({ deleted: true });
    });

    it("returns 404 when project does not belong to user", async () => {
      mockProjectGetById.mockResolvedValue(
        buildProject({ id: "proj-1", userId: "other-user" }),
      );

      const res = await request("/api/extractors/proj-1/ext-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });
});
