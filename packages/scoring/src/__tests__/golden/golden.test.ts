import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ISSUE_DEFINITIONS } from "@llm-boost/shared";
import { GOLDEN_FIXTURES } from "./fixtures";
import { scoreToSnapshot, type FixtureSnapshot } from "./snapshot";

// ---------------------------------------------------------------------------
// Golden-set regression harness for the scoring engine.
//
// WHY: multiple silent scoring-accuracy regressions have shipped with no test
// catching them (POOR_READABILITY firing on ~100% of pages; the LLM-content
// metric quietly dying and inflating content_score). This harness pins the
// engine's output on a diverse, representative set of pages and adds
// distribution guards that catch MASS miscalibration.
//
// TWO layers:
//   1. Snapshot regression — every fixture's full scored output is committed to
//      `golden.snapshot.json`. Any change fails the test, forcing either a
//      reviewed snapshot update or a caught regression.
//   2. Distribution guards — assertions over the whole set that catch blanket
//      miscalibration no single-page snapshot would reveal.
//
// TO UPDATE THE SNAPSHOT (after an INTENTIONAL scoring change):
//   UPDATE_GOLDEN=1 pnpm --filter @llm-boost/scoring test golden
//   …then review the golden.snapshot.json diff before committing.
// ---------------------------------------------------------------------------

const SNAPSHOT_PATH = fileURLToPath(
  new URL("./golden.snapshot.json", import.meta.url),
);

// Score comparison tolerance. Scores are deterministic rounded integers, so the
// default is 0 (exact). Raise only if a legitimately non-deterministic signal is
// ever added — a scoring change should move a fixture and fail this test.
const SCORE_TOLERANCE = 0;

// A single deduction factor firing on more than this fraction of the diverse
// fixture set is treated as blanket miscalibration (this is the guard that would
// have caught POOR_READABILITY firing on ~100% of pages).
const BLANKET_FIRE_LIMIT = 0.8;

// LLM-content-score-driven issue codes. These may ONLY appear when a page
// actually carries llmContentScores (top-N gating). Locks #108/#114.
const LLM_DRIVEN_CODES = new Set([
  "CONTENT_DEPTH",
  "CONTENT_CLARITY",
  "CONTENT_AUTHORITY",
  "CITATION_WORTHINESS",
  "POOR_QUESTION_COVERAGE",
]);

// Score every fixture with the CURRENT engine. Deterministic, so computed once.
const current: Record<string, FixtureSnapshot> = {};
for (const f of GOLDEN_FIXTURES) {
  current[f.id] = scoreToSnapshot(f.page);
}

const updateMode = process.env.UPDATE_GOLDEN === "1";
if (updateMode) {
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2) + "\n");
  console.log(
    `\n[golden] Wrote ${Object.keys(current).length} snapshots to ${SNAPSHOT_PATH}\n`,
  );
}

const committed: Record<string, FixtureSnapshot> = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"))
  : {};

/** Human-readable diff of a fixture snapshot vs its committed baseline. */
function diffSnapshot(
  cur: FixtureSnapshot,
  base: FixtureSnapshot | undefined,
): string[] {
  const diffs: string[] = [];
  if (!base) {
    return [
      "no committed snapshot — run `UPDATE_GOLDEN=1 pnpm --filter @llm-boost/scoring test golden`",
    ];
  }

  const numericKeys = [
    "overallScore",
    "technicalScore",
    "contentScore",
    "aiReadinessScore",
    "performanceScore",
  ] as const;
  for (const k of numericKeys) {
    if (Math.abs(cur[k] - base[k]) > SCORE_TOLERANCE) {
      diffs.push(`${k}: ${base[k]} -> ${cur[k]}`);
    }
  }
  if (cur.letterGrade !== base.letterGrade) {
    diffs.push(`letterGrade: ${base.letterGrade} -> ${cur.letterGrade}`);
  }

  // Issue set diff (by code).
  const curCodes = new Set(cur.issueCodes);
  const baseCodes = new Set(base.issueCodes);
  for (const c of curCodes) {
    if (!baseCodes.has(c)) diffs.push(`issue ADDED: ${c}`);
  }
  for (const c of baseCodes) {
    if (!curCodes.has(c)) diffs.push(`issue REMOVED: ${c}`);
  }

  // scoreImpact / severity drift on shared codes.
  const baseByCode = new Map(base.issues.map((i) => [i.code, i]));
  for (const i of cur.issues) {
    const b = baseByCode.get(i.code);
    if (!b) continue;
    if (i.severity !== b.severity) {
      diffs.push(`${i.code} severity: ${b.severity} -> ${i.severity}`);
    }
    const a = i.scoreImpact ?? 0;
    const bi = b.scoreImpact ?? 0;
    if (Math.abs(a - bi) > SCORE_TOLERANCE) {
      diffs.push(`${i.code} scoreImpact: ${bi} -> ${a}`);
    }
  }

  // Platform score drift.
  for (const [id, score] of Object.entries(cur.platformScores)) {
    const b = base.platformScores[id];
    if (b === undefined) {
      diffs.push(`platform ADDED: ${id}`);
    } else if (Math.abs(score - b) > SCORE_TOLERANCE) {
      diffs.push(`platform ${id}: ${b} -> ${score}`);
    }
  }
  for (const id of Object.keys(base.platformScores)) {
    if (!(id in cur.platformScores)) diffs.push(`platform REMOVED: ${id}`);
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Layer 1 — snapshot regression
// ---------------------------------------------------------------------------

describe("golden-set snapshot regression", () => {
  it("has a committed snapshot for every fixture", () => {
    if (updateMode) return; // just wrote it
    const missing = GOLDEN_FIXTURES.filter((f) => !(f.id in committed)).map(
      (f) => f.id,
    );
    expect(
      missing,
      `Fixtures without a committed snapshot: ${missing.join(", ")}. ` +
        "Run `UPDATE_GOLDEN=1 pnpm --filter @llm-boost/scoring test golden`.",
    ).toEqual([]);
  });

  it("has no orphaned snapshots (committed key with no fixture)", () => {
    if (updateMode) return;
    const ids = new Set(GOLDEN_FIXTURES.map((f) => f.id));
    const orphans = Object.keys(committed).filter((k) => !ids.has(k));
    expect(orphans, `Orphaned snapshot keys: ${orphans.join(", ")}`).toEqual(
      [],
    );
  });

  for (const f of GOLDEN_FIXTURES) {
    it(`matches golden: ${f.id}`, () => {
      const diffs = diffSnapshot(current[f.id], committed[f.id]);
      expect(
        diffs,
        diffs.length
          ? `\nScoring output for "${f.id}" changed:\n  - ${diffs.join(
              "\n  - ",
            )}\n` +
              "If intentional, regenerate with " +
              "`UPDATE_GOLDEN=1 pnpm --filter @llm-boost/scoring test golden` and review the diff.\n"
          : "",
      ).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Layer 2 — distribution guards (catch MASS miscalibration)
// ---------------------------------------------------------------------------

describe("scoring distribution guards", () => {
  const byId = (id: string) => {
    const snap = current[id];
    if (!snap) throw new Error(`unknown fixture id: ${id}`);
    return snap;
  };

  it("no single deduction factor fires on more than 80% of the fixture set", () => {
    const total = GOLDEN_FIXTURES.length;
    const counts = new Map<string, number>();
    for (const snap of Object.values(current)) {
      for (const code of snap.issueCodes) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    const offenders = [...counts.entries()]
      .filter(([, n]) => n / total > BLANKET_FIRE_LIMIT)
      .map(([code, n]) => `${code} fires on ${n}/${total} fixtures`);
    expect(
      offenders,
      `Blanket-firing factor(s) detected (a factor over ${
        BLANKET_FIRE_LIMIT * 100
      }% of a diverse set is almost certainly miscalibrated — this is the guard ` +
        `that would have caught POOR_READABILITY firing on ~100% of pages):\n  - ${offenders.join(
          "\n  - ",
        )}`,
    ).toEqual([]);
  });

  it("every emitted issue code is a known ISSUE_DEFINITIONS code", () => {
    const unknown = new Set<string>();
    for (const snap of Object.values(current)) {
      for (const code of snap.issueCodes) {
        if (!(code in ISSUE_DEFINITIONS)) unknown.add(code);
      }
    }
    expect(
      [...unknown],
      `Unknown issue codes: ${[...unknown].join(", ")}`,
    ).toEqual([]);
  });

  it("all fixture scores stay within [0, 100]", () => {
    for (const [id, snap] of Object.entries(current)) {
      for (const k of [
        "overallScore",
        "technicalScore",
        "contentScore",
        "aiReadinessScore",
        "performanceScore",
      ] as const) {
        expect(snap[k], `${id}.${k} out of range`).toBeGreaterThanOrEqual(0);
        expect(snap[k], `${id}.${k} out of range`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("the set discriminates quality (wide score spread, multiple grades)", () => {
    const overalls = Object.values(current).map((s) => s.overallScore);
    const spread = Math.max(...overalls) - Math.min(...overalls);
    expect(
      spread,
      `overall-score spread is only ${spread}; a healthy set should span a wide range`,
    ).toBeGreaterThanOrEqual(40);

    const grades = new Set(Object.values(current).map((s) => s.letterGrade));
    expect(
      grades.size,
      `only ${grades.size} distinct grade(s) present — the engine may have collapsed`,
    ).toBeGreaterThanOrEqual(2);
  });

  // --- Readability lock (#112 / #116) -------------------------------------

  it("clinical + SHORT-sentence page does NOT flag POOR_READABILITY", () => {
    const snap = byId("readability-clinical-short-sentences");
    expect(
      snap.issueCodes,
      "A page of dense clinical vocabulary but short sentences must not be " +
        "penalized on readability — vocabulary difficulty is not a machine-" +
        "extraction problem (#112/#116).",
    ).not.toContain("POOR_READABILITY");
  });

  it("run-on / long-sentence pages DO flag POOR_READABILITY", () => {
    for (const id of [
      "readability-run-on-sentences",
      "readability-long-sentences-mild",
      "readability-flesch-fallback-difficult",
      "readability-flesch-fallback-very-difficult",
    ]) {
      expect(
        byId(id).issueCodes,
        `${id} should flag POOR_READABILITY (long/run-on sentences hurt LLM extraction)`,
      ).toContain("POOR_READABILITY");
    }
  });

  // --- LLM-content gating lock (#108 / #114) ------------------------------

  it("LLM-driven issue codes appear ONLY on pages that were LLM-scored", () => {
    for (const f of GOLDEN_FIXTURES) {
      const snap = current[f.id];
      const llmCodes = snap.issueCodes.filter((c) => LLM_DRIVEN_CODES.has(c));
      if (llmCodes.length > 0) {
        expect(
          f.page.llmScores,
          `${f.id} emitted LLM-driven codes ${llmCodes.join(
            ", ",
          )} but has no llmScores — the engine must not fabricate LLM deductions`,
        ).not.toBeNull();
      }
    }
  });

  it("a well-LLM-scored page carries no LLM deductions", () => {
    const snap = byId("llm-scored-clean");
    for (const code of LLM_DRIVEN_CODES) {
      expect(
        snap.issueCodes,
        `${code} should not fire on an all-100 page`,
      ).not.toContain(code);
    }
  });

  it("dropping llmScores INFLATES content/AI (the #108 failure mode)", () => {
    const withLlm = byId("llm-scored-poor-with");
    const withoutLlm = byId("llm-scored-poor-without");

    // WITH poor LLM scores present, the metric must actively deduct.
    expect(withLlm.issueCodes).toContain("CONTENT_DEPTH");
    expect(withoutLlm.issueCodes).not.toContain("CONTENT_DEPTH");

    // So removing the LLM signal can only RAISE (never lower) content/AI —
    // exactly the silent inflation that #108 caused when the metric died.
    expect(
      withoutLlm.contentScore,
      "content_score must not be higher WITH LLM scores than without",
    ).toBeGreaterThan(withLlm.contentScore);
    expect(withoutLlm.aiReadinessScore).toBeGreaterThan(
      withLlm.aiReadinessScore,
    );
  });

  // --- Error short-circuit -------------------------------------------------

  it("4xx/5xx pages short-circuit to zero with a single HTTP_STATUS issue", () => {
    for (const id of ["http-404", "http-500"]) {
      const snap = byId(id);
      expect(snap.overallScore).toBe(0);
      expect(snap.letterGrade).toBe("F");
      expect(snap.issueCodes).toEqual(["HTTP_STATUS"]);
    }
  });
});
