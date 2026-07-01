import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getByPage: vi.fn(),
  update: vi.fn(),
  clearIssues: vi.fn(),
  createIssues: vi.fn(),
  listByJob: vi.fn(),
  getById: vi.fn(),
}));

vi.mock("@llm-boost/db", () => ({
  scoreQueries: () => ({
    getByPage: mocks.getByPage,
    update: mocks.update,
    clearIssues: mocks.clearIssues,
    createIssues: mocks.createIssues,
  }),
  pageQueries: () => ({ listByJob: mocks.listByJob }),
  crawlQueries: () => ({ getById: mocks.getById }),
}));

import {
  rescoreFactors,
  rescorePageFromStored,
  buildSiteContext,
} from "../../services/factor-rescoring";

const SITE_CONTEXT = JSON.stringify({
  has_llms_txt: true,
  ai_crawlers_blocked: [],
  has_sitemap: true,
  sitemap_analysis: {
    is_valid: true,
    url_count: 10,
    stale_url_count: 0,
    discovered_page_count: 10,
  },
  content_hashes: {},
});

// The families.care shape: long present title + valid @graph schema, stored
// exactly as the (old) crawler persisted it (schema_types empty, @graph wrapper).
function familiesCarePage() {
  return {
    id: "page-1",
    url: "https://families.care/us/providers/age-well-south-bay-llc-torrance",
    statusCode: 200,
    title:
      "Age Well South Bay, LLC — Geriatric Care Management in Torrance, CA | families.care",
    metaDesc: "Short but present description for this provider page.",
    canonicalUrl:
      "https://families.care/us/providers/age-well-south-bay-llc-torrance",
    wordCount: 208,
    contentHash: "hash-1",
  };
}

function storedScore() {
  return {
    id: "score-1",
    detail: JSON.stringify({
      performanceScore: 80,
      letterGrade: "C",
      lighthouse: null,
      extracted: {
        h1: ["Age Well South Bay"],
        h2: ["Services"],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
        schema_types: [],
        internal_links: ["/a", "/b"],
        external_links: [],
        images_without_alt: 0,
        has_robots_meta: false,
        robots_directives: [],
        og_tags: {},
        structured_data: [
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "LocalBusiness",
                name: "Age Well South Bay",
                address: "Torrance, CA",
              },
              { "@type": "BreadcrumbList" },
            ],
          },
        ],
      },
    }),
  };
}

describe("rescoreFactors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockResolvedValue({ siteContext: SITE_CONTEXT });
    mocks.update.mockResolvedValue({});
    mocks.clearIssues.mockResolvedValue(undefined);
    mocks.createIssues.mockResolvedValue([]);
  });

  it("rewrites issues without the title/@graph false positives", async () => {
    mocks.listByJob.mockResolvedValue([familiesCarePage()]); // 1 <= limit -> done
    mocks.getByPage.mockResolvedValue(storedScore());

    const result = await rescoreFactors({
      db: {} as never,
      jobId: "job-1",
      limit: 100,
    });

    expect(result).toMatchObject({
      processed: 1,
      updated: 1,
      skipped: 0,
      nextCursor: null,
      done: true,
    });

    // Issues were cleared then rewritten for the page.
    expect(mocks.clearIssues).toHaveBeenCalledWith("page-1");
    const writtenIssues = mocks.createIssues.mock.calls[0][0] as Array<{
      code: string;
    }>;
    const codes = writtenIssues.map((i) => i.code);
    expect(codes).not.toContain("MISSING_TITLE");
    expect(codes).toContain("TITLE_LENGTH");
    expect(codes).not.toContain("INVALID_SCHEMA");
    expect(codes).not.toContain("MISSING_ENTITY_MARKUP");

    // The score row was updated (not deleted/recreated), preserving its id.
    expect(mocks.update).toHaveBeenCalledWith(
      "score-1",
      expect.objectContaining({ metaTagsScore: expect.any(Number) }),
    );
  });

  it("paginates via cursor when more pages remain", async () => {
    // limit=1, two rows returned -> hasMore, nextCursor = last of trimmed batch.
    mocks.listByJob.mockResolvedValue([
      familiesCarePage(),
      { ...familiesCarePage(), id: "page-2" },
    ]);
    mocks.getByPage.mockResolvedValue(storedScore());

    const result = await rescoreFactors({
      db: {} as never,
      jobId: "job-1",
      limit: 1,
    });

    expect(result.processed).toBe(1);
    expect(result.done).toBe(false);
    expect(result.nextCursor).toBe("page-1");
  });

  it("skips pages with no stored score/extracted data", async () => {
    mocks.listByJob.mockResolvedValue([familiesCarePage()]);
    mocks.getByPage.mockResolvedValue(null);

    const result = await rescoreFactors({
      db: {} as never,
      jobId: "job-1",
      limit: 100,
    });

    expect(result).toMatchObject({ updated: 0, skipped: 1, done: true });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.createIssues).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the job does not exist", async () => {
    mocks.getById.mockResolvedValue(undefined);
    await expect(
      rescoreFactors({ db: {} as never, jobId: "missing", limit: 100 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("rescorePageFromStored", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({});
    mocks.clearIssues.mockResolvedValue(undefined);
    mocks.createIssues.mockResolvedValue([]);
  });

  it("applies + persists a fresh llmScores override into detail (per-crawl paid path)", async () => {
    mocks.getByPage.mockResolvedValue(storedScore());
    const llmScores = {
      clarity: 90,
      authority: 85,
      comprehensiveness: 88,
      structure: 92,
      citation_worthiness: 80,
    };

    const outcome = await rescorePageFromStored({
      db: {} as never,
      jobId: "job-1",
      page: familiesCarePage(),
      siteContext: buildSiteContext(SITE_CONTEXT),
      llmScores,
    });

    expect(outcome).toBe("updated");
    // The fresh Sonnet scores are written durably into detail so the dashboard
    // "LLM Quality" card + any later factor-rescore reuse them.
    const updateArg = mocks.update.mock.calls[0][1];
    expect(updateArg.detail.llmContentScores).toEqual(llmScores);
  });

  it("skips when there is no stored extracted data", async () => {
    mocks.getByPage.mockResolvedValue(null);

    const outcome = await rescorePageFromStored({
      db: {} as never,
      jobId: "job-1",
      page: familiesCarePage(),
      siteContext: buildSiteContext(SITE_CONTEXT),
    });

    expect(outcome).toBe("skipped");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
