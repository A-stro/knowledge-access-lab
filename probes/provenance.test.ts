// probes/provenance.test.ts — ISC-8
// Provenance: every corpus record is marked hand-authored (the ~50-record
// fictional core story) or generated (the deterministic expansion pass for
// distractor density). 100% marking is what keeps the corpus's evidence
// reproducible and honestly labeled.

import { describe, expect, test } from "bun:test";
import { PROVENANCE_VALUES, formatViolations, loadCorpus, type CorpusRecord } from "./lib/corpus";

function provenanceViolations(records: CorpusRecord[]): string[] {
  const out: string[] = [];
  for (const r of records) {
    const p = r.fm?.["provenance"];
    if (!PROVENANCE_VALUES.includes(p as (typeof PROVENANCE_VALUES)[number])) {
      out.push(`${r.relPath}: provenance must be one of {${PROVENANCE_VALUES.join(", ")}} (got ${JSON.stringify(p)})`);
    }
  }
  return out;
}

describe("ISC-8 — provenance: every record marked hand-authored or generated", () => {
  const records = loadCorpus();

  test("100% of corpus records carry a valid provenance mark", () => {
    const violations = provenanceViolations(records);
    if (violations.length > 0) throw new Error(formatViolations("provenance", violations));
    expect(records.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  test("the hand-authored core is ≥50 records (the fictional studio story)", () => {
    const hand = records.filter((r) => r.fm?.["provenance"] === "hand-authored").length;
    expect(hand).toBeGreaterThanOrEqual(50);
  });

  test("the generated expansion provides distractor density (≥140 records)", () => {
    const generated = records.filter((r) => r.fm?.["provenance"] === "generated").length;
    expect(generated).toBeGreaterThanOrEqual(140);
  });
});
