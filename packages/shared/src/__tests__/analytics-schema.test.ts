import { describe, it, expect } from "vitest";
import { CollectEventSchema } from "../schemas/analytics";

describe("CollectEventSchema", () => {
  it("accepts valid collect payload", () => {
    const result = CollectEventSchema.safeParse({
      pid: "123e4567-e89b-12d3-a456-426614174000",
      url: "https://example.com/page",
      ref: "https://chat.openai.com/",
      ua: "Mozilla/5.0",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without optional fields", () => {
    const result = CollectEventSchema.safeParse({
      pid: "123e4567-e89b-12d3-a456-426614174000",
      url: "https://example.com/page",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for pid", () => {
    const result = CollectEventSchema.safeParse({
      pid: "not-a-uuid",
      url: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = CollectEventSchema.safeParse({
      pid: "123e4567-e89b-12d3-a456-426614174000",
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
