import { describe, it, expect } from "vitest";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PageScoreSchema,
  IssueSchema,
  LLMContentScoresSchema,
  CrawlJobPayloadSchema,
  PaginationSchema,
  UpdateProfileSchema,
  ConnectIntegrationSchema,
} from "../index";

describe("CreateProjectSchema", () => {
  it("normalizes domain by stripping protocol and www", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "https://www.example.com/",
    });
    expect(result.domain).toBe("example.com");
  });

  it("normalizes bare domain input", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "example.com",
    });
    expect(result.domain).toBe("example.com");
  });

  it("preserves subdomains", () => {
    const result = CreateProjectSchema.parse({
      name: "My Blog",
      domain: "https://blog.example.com",
    });
    expect(result.domain).toBe("blog.example.com");
  });

  it("lowercases domain", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "WWW.Example.COM",
    });
    expect(result.domain).toBe("example.com");
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateProjectSchema.parse({ name: "", domain: "example.com" }),
    ).toThrow();
  });

  it("rejects empty domain", () => {
    expect(() =>
      CreateProjectSchema.parse({ name: "Test", domain: "" }),
    ).toThrow();
  });
});

describe("PageScoreSchema", () => {
  it("accepts valid score", () => {
    const result = PageScoreSchema.parse({
      overall_score: 85,
      technical_score: 90,
      content_score: 80,
      ai_readiness_score: 85,
      performance_score: 75,
      letter_grade: "B",
    });
    expect(result.letter_grade).toBe("B");
  });

  it("rejects score > 100", () => {
    expect(() =>
      PageScoreSchema.parse({
        overall_score: 101,
        technical_score: 90,
        content_score: 80,
        ai_readiness_score: 85,
        performance_score: 75,
        letter_grade: "A",
      }),
    ).toThrow();
  });

  it("rejects invalid letter grade", () => {
    expect(() =>
      PageScoreSchema.parse({
        overall_score: 50,
        technical_score: 50,
        content_score: 50,
        ai_readiness_score: 50,
        performance_score: 50,
        letter_grade: "Z",
      }),
    ).toThrow();
  });
});

describe("UpdateProjectSchema", () => {
  it("accepts partial update", () => {
    const result = UpdateProjectSchema.parse({ name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("accepts settings with schedule", () => {
    const result = UpdateProjectSchema.parse({
      settings: { schedule: "weekly", maxPages: 50 },
    });
    expect(result.settings?.schedule).toBe("weekly");
  });

  it("rejects invalid schedule value", () => {
    expect(() =>
      UpdateProjectSchema.parse({ settings: { schedule: "biweekly" } }),
    ).toThrow();
  });

  it("accepts branding with hex color", () => {
    const result = UpdateProjectSchema.parse({
      branding: { primaryColor: "#ff5500" },
    });
    expect(result.branding?.primaryColor).toBe("#ff5500");
  });

  it("rejects invalid hex color", () => {
    expect(() =>
      UpdateProjectSchema.parse({ branding: { primaryColor: "red" } }),
    ).toThrow();
  });
});

describe("IssueSchema", () => {
  it("accepts valid issue", () => {
    const result = IssueSchema.parse({
      code: "MISSING_TITLE",
      category: "technical",
      severity: "critical",
      message: "Page is missing a title tag",
      recommendation: "Add a descriptive title tag",
    });
    expect(result.code).toBe("MISSING_TITLE");
  });

  it("rejects invalid severity", () => {
    expect(() =>
      IssueSchema.parse({
        code: "TEST",
        category: "technical",
        severity: "fatal",
        message: "msg",
        recommendation: "rec",
      }),
    ).toThrow();
  });

  it("rejects invalid category", () => {
    expect(() =>
      IssueSchema.parse({
        code: "TEST",
        category: "seo",
        severity: "warning",
        message: "msg",
        recommendation: "rec",
      }),
    ).toThrow();
  });
});

describe("LLMContentScoresSchema", () => {
  it("accepts valid scores", () => {
    const result = LLMContentScoresSchema.parse({
      clarity: 85,
      authority: 70,
      comprehensiveness: 90,
      structure: 80,
      citation_worthiness: 75,
    });
    expect(result.clarity).toBe(85);
  });

  it("rejects score below 0", () => {
    expect(() =>
      LLMContentScoresSchema.parse({
        clarity: -1,
        authority: 70,
        comprehensiveness: 90,
        structure: 80,
        citation_worthiness: 75,
      }),
    ).toThrow();
  });
});

describe("PaginationSchema", () => {
  it("applies defaults", () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("coerces string numbers", () => {
    const result = PaginationSchema.parse({ page: "3", limit: "50" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it("rejects limit > 100", () => {
    expect(() => PaginationSchema.parse({ limit: 200 })).toThrow();
  });

  it("rejects page < 1", () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
  });
});

describe("UpdateProfileSchema", () => {
  it("accepts valid E.164 phone", () => {
    const result = UpdateProfileSchema.parse({ phone: "+14155551234" });
    expect(result.phone).toBe("+14155551234");
  });

  it("strips formatting from phone", () => {
    const result = UpdateProfileSchema.parse({ phone: "(415) 555-1234" });
    expect(result.phone).toBe("4155551234");
  });

  it("rejects too-short phone", () => {
    expect(() => UpdateProfileSchema.parse({ phone: "123" })).toThrow();
  });
});

describe("ConnectIntegrationSchema", () => {
  it("accepts valid provider", () => {
    const result = ConnectIntegrationSchema.parse({ provider: "gsc" });
    expect(result.provider).toBe("gsc");
  });

  it("rejects unknown provider", () => {
    expect(() =>
      ConnectIntegrationSchema.parse({ provider: "unknown" }),
    ).toThrow();
  });
});

describe("CrawlJobPayloadSchema", () => {
  const validPayload = {
    job_id: "job-1",
    callback_url: "https://api.test/ingest/batch",
    config: {
      seed_urls: ["https://example.com"],
      max_pages: 100,
      max_depth: 3,
    },
  };

  it("accepts valid payload with defaults", () => {
    const result = CrawlJobPayloadSchema.parse(validPayload);
    expect(result.config.respect_robots).toBe(true);
    expect(result.config.user_agent).toBe("AISEOBot/1.0");
  });

  it("rejects max_pages > 2000", () => {
    expect(() =>
      CrawlJobPayloadSchema.parse({
        ...validPayload,
        config: { ...validPayload.config, max_pages: 5000 },
      }),
    ).toThrow();
  });

  it("rejects invalid callback URL", () => {
    expect(() =>
      CrawlJobPayloadSchema.parse({
        ...validPayload,
        callback_url: "not-a-url",
      }),
    ).toThrow();
  });
});
