// probes/readme-lint.test.ts — ISC-31
// README↔rollup coherence. Every other published number in this repo is a
// receipt: ISC-25 re-derives the rollup from the committed cells, ISC-26
// re-renders results/rollup.md byte-identically from it — but the README's
// own copy of the results was hand-typed from the rollup, verified by hand
// at F5 and F6 close and by nothing since. One prose edit could silently
// drift a published number away from the artifact it claims to summarize.
//
// This probe closes that gap: the README's judged-answers table and its
// evidence-fidelity paragraph are parsed and compared against the committed
// rollup — lane by lane, category by category, both axes. The parser is
// deliberately format-tolerant (bold markers, `·` separators, row order) so
// the probe fails only on NUMBER drift, never on rewording; the lane set
// itself is pinned, so a lane added to the rollup and missing from the
// README (or vice versa) fails loudly too.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateRollup, type Rollup } from "../runner/rollup";
import { REPO_ROOT } from "./lib/corpus";

const README_FILE = join(REPO_ROOT, "README.md");
const ROLLUP_FILE = join(REPO_ROOT, "results", "rollup.json");

function committedRollup(): Rollup {
  if (!existsSync(ROLLUP_FILE)) throw new Error("results/rollup.json is missing — run `lab suite`");
  const check = validateRollup(JSON.parse(readFileSync(ROLLUP_FILE, "utf8")));
  if (!check.ok) throw new Error(`results/rollup.json: ${check.errors.join("; ")}`);
  return check.rollup;
}

/** The README's judged-answers table: one row per lane, ratio per category. */
function judgedTable(readme: string): { lane: string; values: number[] }[] {
  const lines = readme.split("\n");
  const start = lines.findIndex((l) => l.trimStart().startsWith("**Judged answers"));
  if (start < 0) throw new Error("README has no '**Judged answers' results table");
  const rows: { lane: string; values: number[] }[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue; // the heading and its table are blank-separated
    if (!line.startsWith("|")) break;
    const cells = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
    if (cells[0] === "lane" || cells[0]!.startsWith("---")) continue;
    const values = cells.slice(1).map((c) => Number(c.replace(/\*/g, "").trim()));
    if (values.some((v) => !Number.isFinite(v))) {
      throw new Error(`README judged row '${cells[0]}' carries a non-numeric cell: ${line}`);
    }
    rows.push({ lane: cells[0]!, values });
  }
  if (rows.length === 0) throw new Error("README judged-answers table parsed to zero rows");
  return rows;
}

/** The README's evidence paragraph: each lane fragment's first float, plus every
 * float anywhere in the paragraph (for disclosed-but-not-tabulated numbers). */
function evidenceParagraph(readme: string): { perLane: Map<string, number>; all: number[] } {
  const line = readme.split("\n").find((l) => l.trimStart().startsWith("**Evidence fidelity"));
  if (line === undefined) throw new Error("README has no '**Evidence fidelity' paragraph");
  // the parenthetical after the lane list is prose — parse the list itself
  const list = line.slice(0, line.indexOf("(") >= 0 ? line.indexOf("(") : line.length);
  const perLane = new Map<string, number>();
  for (const fragment of list.split("·")) {
    const lane = ["rag", "wiki", "graph-seed", "graph", "direct"].find((l) => fragment.includes(l));
    if (lane === undefined) continue;
    const number = fragment.replace(/\*/g, "").match(/-?\d+(?:\.\d+)?/);
    if (number === null) throw new Error(`evidence fragment for ${lane} carries no number: ${fragment.trim()}`);
    perLane.set(lane, Number(number[0]));
  }
  const all = [...line.replace(/\*/g, "").matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (perLane.size === 0) throw new Error("evidence paragraph parsed to zero lanes");
  return { perLane, all };
}

/** 2-decimal comparison — the precision both the rollup and the README publish. */
function round2(x: number): number {
  return Number(x.toFixed(2));
}

describe("ISC-31 — the README's published results are the committed rollup's, pinned", () => {
  test("the judged table publishes exactly the rollup's per-lane × per-category correct ratios", () => {
    const rollup = committedRollup();
    const rows = judgedTable(readFileSync(README_FILE, "utf8"));
    expect(rows.map((r) => r.lane).sort()).toEqual([...rollup.lanes].sort());
    const cellFor = (lane: string, category: string) =>
      rollup.cells.find((c) => c.lane === lane && c.category === category) ??
      rollup.lane_totals.find((c) => c.lane === lane && c.category === category);
    for (const row of rows) {
      const expected = [...rollup.gold_set.categories.map((c) => c), "all"].map((category) =>
        round2(cellFor(row.lane, category)!.judged_correct_ratio),
      );
      expect(row.values, `${row.lane}: judged ratios drifted from the rollup`).toEqual(expected);
    }
  });

  test("the evidence paragraph publishes exactly the rollup's passage-fidelity means per lane", () => {
    const rollup = committedRollup();
    const { perLane } = evidenceParagraph(readFileSync(README_FILE, "utf8"));
    expect([...perLane.keys()].sort()).toEqual([...rollup.lanes].sort());
    for (const lane of rollup.lanes) {
      const total = rollup.lane_totals.find((c) => c.lane === lane)!;
      expect(perLane.get(lane), `${lane}: passage mean drifted from the rollup`).toBe(
        round2(total.passages_exact_ratio_mean ?? 0),
      );
    }
  });

  test("the graph lanes' record-found means disclosed in the paragraph match the rollup", () => {
    // the paragraph discloses the seeded lane's record-found mean (the axis
    // the framing said could move) and the bare lane's zero — the two
    // record-found numbers the README publishes anywhere
    const rollup = committedRollup();
    const { all } = evidenceParagraph(readFileSync(README_FILE, "utf8"));
    for (const lane of ["graph", "graph-seed"]) {
      const total = rollup.lane_totals.find((c) => c.lane === lane)!;
      expect(all, `${lane}: record-found mean ${round2(total.records_found_ratio_mean ?? 0)} not published`).toContain(
        round2(total.records_found_ratio_mean ?? 0),
      );
    }
  });

  test("every unsettled cell named in the rollup is named in the README", () => {
    // the gap must be disclosed wherever the results are published, not
    // only in the rollup and the record
    const rollup = committedRollup();
    const readme = readFileSync(README_FILE, "utf8");
    for (const u of rollup.unsettled) {
      expect(readme.includes(u.question_id), `README never mentions the recorded non-settlement ${u.question_id}`).toBe(true);
    }
    expect(rollup.unsettled.length === 0 || readme.includes("unsettled.json")).toBe(true);
  });
});
