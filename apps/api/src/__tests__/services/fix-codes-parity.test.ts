import { describe, it, expect } from "vitest";
import { SUPPORTED_FIX_CODES, FIX_TYPE_BY_CODE } from "@llm-boost/shared";
import { createFixGeneratorService } from "../../services/fix-generator-service";

/**
 * Drift guard. The web UI gates the "AI Fix" button on the shared
 * `SUPPORTED_FIX_CODES`, while the API actually generates fixes from
 * `FIX_PROMPTS` (exposed via `getSupportedIssueCodes()`). If these two lists
 * diverge the UI either shows a button that 422s, or hides a button for a code
 * the backend can fix. Keep them identical.
 */
describe("fix code parity (shared ↔ backend prompts)", () => {
  const service = createFixGeneratorService({
    contentFixes: {
      create: async () => null,
      countByUserThisMonth: async () => 0,
    },
  });

  const backendCodes = [...service.getSupportedIssueCodes()].sort();
  const sharedCodes = [...SUPPORTED_FIX_CODES].sort();

  it("backend FIX_PROMPTS keys exactly match shared SUPPORTED_FIX_CODES", () => {
    expect(backendCodes).toEqual(sharedCodes);
  });

  it("shared SUPPORTED_FIX_CODES is derived from FIX_TYPE_BY_CODE", () => {
    expect(sharedCodes).toEqual(Object.keys(FIX_TYPE_BY_CODE).sort());
  });

  it("every supported code has a download/persistence fix type", () => {
    for (const code of sharedCodes) {
      expect(FIX_TYPE_BY_CODE[code]).toBeTruthy();
    }
  });
});
