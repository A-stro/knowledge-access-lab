// probes/suite-lint.test.ts — ISC-22 + ISC-23 + ISC-24 + ISC-25 + ISC-26
// Suite-lint probe (F5): `lab suite` runs every lane over the full gold
// set in one execution and commits the rollup — this probe polices exactly
// that, the way the trace/score probes police their artifacts:
//
//   ISC-22 the suite is complete and layout-pinned — every (lane × gold
//          question) cell carries exactly one valid trace and one valid,
//          judged score at results/{runs,scores}/<lane>/<question>.json, no
//          stray artifacts, and the resume gate (loadCommittedTrace /
//          loadCommittedScore / scoreReconciles — production wiring, driven
//          here rather than re-implemented) refuses anything that does not
//          reconcile, so a re-invoked suite can never silently reuse
//          tampered or stale cells. F6's one amendment: a cell may be missing
//          only when results/unsettled.json names it (validated against the
//          artifacts — a record entry for a SETTLED cell fails loudly), and
//          every other gap still refuses the rollup. The record's contents
//          are pinned here against the committed rollup and the artifacts.
//   ISC-23 the experiment's constants hold across every cell (225 from F6): one pinned
//          agent-under-test in every trace, one pinned blind judge (blind:
//          true) in every score, one harness name — the rollup records them
//          and this probe re-derives them from the artifacts.
//   ISC-24 the rollup schema accepts the committed rollup and rejects
//          mutants — every aggregate cross-checked against the per-question
//          rows, judge counts summing to n, absence cells null-evidenced,
//          the pinned framing note carried verbatim, leak-free.
//   ISC-25 the committed rollup re-derives identically from the committed
//          cells + the frozen gold set — the same pure function that built
//          it, run again over the same receipts.
//   ISC-26 the committed human render (results/rollup.md) re-renders
//          byte-identically from the rollup and carries the per-lane ×
//          per-category tables on BOTH axes, framing included.
//
// Home-path mutants are fragment-assembled so the repo-wide leak scan can
// scan this source without matching its own fixtures.

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGold, readJudgePin, readModelPin } from "../runner/run";
import {
  loadCommittedScore,
  loadCommittedTrace,
  loadSuiteCells,
  loadUnsettled,
  scoreReconciles,
  suiteCells,
} from "../runner/suite";
import {
  buildRollup,
  FRAMING_NOTE,
  renderRollupMd,
  ROLLUP_SCHEMA,
  validateRollup,
  type Rollup,
} from "../runner/rollup";
import { LANES } from "../runner/trace";
import { REPO_ROOT } from "./lib/corpus";

const GOLD = loadGold();
const GOLD_IDS = GOLD.map((q) => q.id);
const PIN = readModelPin();
const JUDGE_PIN = readJudgePin();

const ROLLUP_FILE = join(REPO_ROOT, "results", "rollup.json");
const ROLLUP_MD_FILE = join(REPO_ROOT, "results", "rollup.md");
const UNSETTLED_FILE = join(REPO_ROOT, "results", "unsettled.json");

function committedRollup(): Rollup {
  if (!existsSync(ROLLUP_FILE)) throw new Error("results/rollup.json is missing — run `lab suite`");
  const check = validateRollup(JSON.parse(readFileSync(ROLLUP_FILE, "utf8")));
  if (!check.ok) throw new Error(`results/rollup.json: ${check.errors.join("; ")}`);
  return check.rollup;
}

function committedMd(): string {
  if (!existsSync(ROLLUP_MD_FILE)) throw new Error("results/rollup.md is missing — run `lab suite`");
  return readFileSync(ROLLUP_MD_FILE, "utf8");
}

describe("ISC-22 — suite mechanics: complete, layout-pinned, resume-safe", () => {
  test("suiteCells enumerates every lane × gold question exactly once, lane-major", () => {
    const cells = suiteCells(GOLD);
    expect(cells.length).toBe(LANES.length * GOLD.length);
    const keys = new Set(cells.map((c) => `${c.lane}::${c.questionId}`));
    expect(keys.size).toBe(cells.length);
    let at = 0;
    for (const lane of LANES) {
      for (const q of GOLD) {
        expect(cells[at]!.lane).toBe(lane);
        expect(cells[at]!.questionId).toBe(q.id);
        at++;
      }
    }
  });

  test("the committed suite is complete — every cell carries a trace and a judged score, or is recorded", () => {
    const loaded = loadSuiteCells(GOLD);
    const recorded = loadUnsettled(GOLD);
    const recordedKeys = new Set(recorded.map((u) => `${u.lane}::${u.question_id}`));
    const unrecorded = loaded.missing.filter((c) => !recordedKeys.has(`${c.lane}::${c.questionId}`));
    if (unrecorded.length > 0) {
      throw new Error(
        `suite coverage incomplete (${unrecorded.length} missing, unrecorded) — run \`lab suite\`:\n` +
          unrecorded.map((c) => `  - ${c.lane} ${c.questionId}`).join("\n"),
      );
    }
    expect(loaded.cells.length + recorded.length).toBe(LANES.length * GOLD.length);
  });

  test("layout is pinned: exactly the suite artifacts exist under results/, nothing else", () => {
    const resultsRoot = join(REPO_ROOT, "results");
    const rootEntries = new Set(readdirSync(resultsRoot));
    expect([...rootEntries].sort()).toEqual(
      [".gitkeep", "rollup.json", "rollup.md", "runs", "scores", "unsettled.json"].sort(),
    );
    for (const [kind, expectedFiles] of [
      ["runs", `${GOLD.length} traces`],
      ["scores", `${GOLD.length} scores`],
    ] as const) {
      const laneDirs = readdirSync(join(resultsRoot, kind), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      expect(laneDirs).toEqual([...LANES].sort());
      const recordedByLane = new Map(loadUnsettled(GOLD).map((u) => [u.lane, u.question_id]));
      for (const lane of LANES) {
        const settledIds = GOLD_IDS.filter((id) => recordedByLane.get(lane) !== id);
        const files = readdirSync(join(resultsRoot, kind, lane)).sort();
        expect(files, `${kind}/${lane} — ${settledIds.length} settled of ${GOLD.length}`).toEqual(
          settledIds.map((id) => `${id}.json`).sort(),
        );
      }
    }
  });

  test("the non-settlement record pins against the artifacts and the committed rollup (F6)", () => {
    // the record is the ONLY legal reason a cell is missing — so it is
    // checked against reality, not trusted: every entry names a genuinely
    // missing cell, the committed rollup carries exactly the same record,
    // and the record re-derives from the committed artifacts.
    if (!existsSync(UNSETTLED_FILE)) throw new Error("results/unsettled.json is missing — F6's close committed it");
    const recorded = loadUnsettled(GOLD);
    expect(recorded.length).toBeGreaterThan(0); // F6 closed with exactly one
    const missing = loadSuiteCells(GOLD).missing;
    const missingKeys = new Set(missing.map((c) => `${c.lane}::${c.questionId}`));
    for (const u of recorded) {
      expect(missingKeys.has(`${u.lane}::${u.question_id}`), `${u.lane} ${u.question_id} is recorded but HAS artifacts — stale record`).toBe(true);
      expect(u.attempts).toBeGreaterThanOrEqual(1);
      expect(u.attempt_seconds.length).toBe(u.attempts);
      expect(typeof u.why).toBe("string");
      expect(u.why.length).toBeGreaterThan(20);
    }
    expect(missing.length).toBe(recorded.length); // no UNRECORDED gaps
    const rollup = committedRollup();
    expect(rollup.unsettled).toEqual(recorded);
  });

  test("the resume gate accepts the committed cells and refuses anything that does not reconcile", () => {
    const loaded = loadSuiteCells(GOLD);
    // the recorded non-settlement is the only cell the gate may leave unrun
    const recorded = new Set(loadUnsettled(GOLD).map((u) => `${u.lane}::${u.question_id}`));
    expect(loaded.missing.map((c) => `${c.lane}::${c.questionId}`).filter((k) => !recorded.has(k))).toEqual([]);
    const cell = loaded.cells[0]!;
    const gold = GOLD.find((q) => q.id === cell.trace.question_id)!;
    expect(loadCommittedTrace(cell.lane, cell.trace.question_id, gold)?.question_id).toBe(
      cell.trace.question_id,
    );
    expect(loadCommittedScore(cell.trace, gold)?.question_id).toBe(cell.trace.question_id);

    // a score that no longer re-derives from its trace + gold is refused
    const tamperedScore = structuredClone(cell.score);
    tamperedScore.evidence.passages_exact_ratio = tamperedScore.evidence.passages_exact_ratio === null
      ? null
      : 0.5;
    expect(scoreReconciles(tamperedScore, cell.trace, GOLD[0]!)).toBe(false);

    // a trace that disagrees with the frozen gold question is refused
    const otherGold = GOLD.find((q) => q.id !== cell.trace.question_id)!;
    expect(loadCommittedTrace(cell.lane, cell.trace.question_id, otherGold)).toBeNull();

    // an unknown question id has no committed cell
    expect(loadCommittedTrace("rag", "q-xx-99", GOLD[0]!)).toBeNull();
  });

  test("every committed cell's score fully re-derives from its trace + the frozen gold set", () => {
    const loaded = loadSuiteCells(GOLD);
    for (const cell of loaded.cells) {
      const gold = GOLD.find((q) => q.id === cell.trace.question_id);
      expect(gold).toBeDefined();
      if (gold) expect(scoreReconciles(cell.score, cell.trace, gold)).toBe(true);
    }
  });
});

describe("ISC-23 — the experiment's constants hold across every suite cell", () => {
  test("every trace carries the identical pinned agent-under-test; the rollup records it", () => {
    const loaded = loadSuiteCells(GOLD);
    for (const cell of loaded.cells) {
      expect(cell.trace.model).toEqual(PIN);
    }
    const rollup = committedRollup();
    expect(rollup.model).toEqual(PIN);
  });

  test("every score carries the pinned blind judge — structurally blind, different family", () => {
    const loaded = loadSuiteCells(GOLD);
    for (const cell of loaded.cells) {
      expect(cell.score.judge).toBeDefined();
      expect(cell.score.judge!.blind).toBe(true);
      expect(cell.score.judge!.model).toEqual(JUDGE_PIN);
    }
    const rollup = committedRollup();
    expect(rollup.judge_model).toEqual(JUDGE_PIN);
    expect(rollup.judge_model.model).not.toBe(rollup.model.model);
  });

  test("one harness name across the suite; the rollup's versions are the sorted distinct set", () => {
    const loaded = loadSuiteCells(GOLD);
    const names = new Set(loaded.cells.map((c) => c.trace.harness.name));
    expect(names.size).toBe(1);
    const versions = [...new Set(loaded.cells.map((c) => c.trace.harness.version))].sort();
    const rollup = committedRollup();
    expect(rollup.harness.name).toBe(loaded.cells[0]!.trace.harness.name);
    expect(rollup.harness.versions).toEqual(versions);
  });
});

describe("ISC-24 — rollup schema: canonical accept, mutant reject", () => {
  test("the schema is versioned", () => {
    expect(ROLLUP_SCHEMA).toBe("knowledge-access-lab/rollup@2");
  });

  test("the committed rollup validates", () => {
    committedRollup();
  });

  type Mutant = { name: string; mutate: (r: Rollup) => void; expect: string };

  // Fragment-assembled so the leak scan never sees one literal home root here.
  const USERS_LEAK = "/Us" + "ers/alice/secret.md";

  const mutants: Mutant[] = [
    {
      name: "wrong schema string",
      mutate: (r) => {
        (r as { schema?: unknown }).schema = "knowledge-access-lab/rollup@3";
      },
      expect: "schema must be",
    },
    {
      name: "framing note edited",
      mutate: (r) => {
        r.framing = "some other framing";
      },
      expect: "framing must carry the pinned framing note",
    },
    {
      name: "gold_set.questions bumped without more rows",
      mutate: (r) => {
        r.gold_set.questions += 1;
      },
      expect: "rows plus unsettled records must equal",
    },
    {
      name: "lanes reordered",
      mutate: (r) => {
        r.lanes = [...r.lanes].reverse() as Rollup["lanes"];
      },
      expect: "lanes must be in the pinned order",
    },
    {
      name: "lane outside the pinned set",
      mutate: (r) => {
        (r.lanes as unknown[]).push("vector-db");
      },
      expect: "lanes must be exactly the",
    },
    {
      name: "judge model equal to the agent-under-test (family violation)",
      mutate: (r) => {
        r.judge_model = { ...r.model };
      },
      expect: "judge_model must differ from the agent-under-test model",
    },
    {
      name: "harness versions emptied",
      mutate: (r) => {
        r.harness.versions = [];
      },
      expect: "harness must carry a non-empty name and at least one version string",
    },
    {
      name: "row verdict outside the enum",
      mutate: (r) => {
        (r.questions[0] as { judge_verdict?: unknown }).judge_verdict = "perfect";
      },
      expect: "judge_verdict must be one of",
    },
    {
      name: "row absence_stated set on a non-absence question",
      mutate: (r) => {
        const row = r.questions.find((q) => q.category !== "absence")!;
        row.absence_stated = true;
      },
      expect: "absence_stated must be null for non-absence questions",
    },
    {
      name: "row absence_stated null on an absence question",
      mutate: (r) => {
        const row = r.questions.find((q) => q.category === "absence")!;
        row.absence_stated = null;
      },
      expect: "absence_stated must be a boolean for absence questions",
    },
    {
      name: "row ratio above 1",
      mutate: (r) => {
        const row = r.questions.find((q) => q.category !== "absence")!;
        row.passages_exact_ratio = 1.5;
      },
      expect: "must be a number in [0,1] for non-absence questions",
    },
    {
      name: "row evidence ratios kept on an absence question",
      mutate: (r) => {
        const row = r.questions.find((q) => q.category === "absence")!;
        row.passages_exact_ratio = 1;
        row.records_found_ratio = 1;
      },
      expect: "must be null for absence questions",
    },
    {
      name: "row trace_ref pointing elsewhere",
      mutate: (r) => {
        r.questions[0]!.trace_ref = "results/scores/elsewhere.json";
      },
      expect: "trace_ref must be results/runs/<lane>/<question>.json for this row",
    },
    {
      name: "row judge_model disagreeing with the rollup's judge",
      mutate: (r) => {
        r.questions[0]!.judge_model = "other/judge";
      },
      expect: "judge_model disagrees with the rollup's judge_model",
    },
    {
      name: "row lane outside the pinned set",
      mutate: (r) => {
        (r.questions[0] as { lane?: unknown }).lane = "vector-db";
      },
      expect: "lane must be one of",
    },
    {
      name: "duplicate row",
      mutate: (r) => {
        r.questions.push(structuredClone(r.questions[0]!));
      },
      expect: "duplicate cell",
    },
    {
      name: "a lane's last row dropped — cross-lane sequence breaks",
      mutate: (r) => {
        r.questions.splice(r.questions.length - 1, 1);
      },
      expect: "settled rows plus recorded non-settlements must equal",
    },
    {
      name: "cell n bumped away from the row count",
      mutate: (r) => {
        r.cells[0]!.n += 1;
      },
      expect: "n disagrees with the row count",
    },
    {
      name: "cell judge counts no longer summing to n",
      mutate: (r) => {
        r.cells[0]!.judge_correct += 1;
      },
      expect: "judge counts must sum to n",
    },
    {
      name: "cell passages mean disagreeing with its rows",
      mutate: (r) => {
        const cell = r.cells.find((c) => c.category !== "absence")!;
        cell.passages_exact_ratio_mean =
          cell.passages_exact_ratio_mean === 0.123 ? 0.124 : 0.123;
      },
      expect: "passages_exact_ratio_mean does not match its rows",
    },
    {
      name: "absence cell carrying evidence means",
      mutate: (r) => {
        const cell = r.cells.find((c) => c.category === "absence")!;
        cell.passages_exact_ratio_mean = 1;
        cell.records_found_ratio_mean = 1;
      },
      expect: "must be null for the absence category",
    },
    {
      name: "non-absence cell carrying absence fields",
      mutate: (r) => {
        const cell = r.cells.find((c) => c.category !== "absence" && c.category !== "all")!;
        cell.absence_stated_count = 0;
        cell.absence_stated_ratio = 0;
      },
      expect: "absence fields must be null outside the absence category",
    },
    {
      name: "lane total's judged ratio disagreeing with its rows",
      mutate: (r) => {
        r.lane_totals[0]!.judged_correct_ratio =
          r.lane_totals[0]!.judged_correct_ratio === 0.123 ? 0.124 : 0.123;
      },
      expect: "judged_correct_ratio does not match its rows",
    },
    {
      name: "lane retrieval steps_mean disagreeing with its rows",
      mutate: (r) => {
        r.lane_retrieval[0]!.steps_mean += 1;
      },
      expect: "steps_mean does not match its rows",
    },
    {
      name: "cells missing one lane × category",
      mutate: (r) => {
        r.cells.splice(1, 1);
      },
      expect: "cells must cover every lane × gold category",
    },
    {
      name: "an unsettled entry removed (the gap becomes unrecorded)",
      mutate: (r) => {
        (r.unsettled as unknown[]).length = 0;
      },
      expect: "rows plus unsettled records must equal",
    },
    {
      name: "a settled cell recorded as unsettled (stale record)",
      mutate: (r) => {
        (r.unsettled as unknown[]).push({ ...(r.unsettled as Record<string, unknown>[])[0], lane: "rag", question_id: "q-pl-01" });
      },
      expect: "exists but the record calls it unsettled",
    },
    {
      name: "an unsettled entry for an unknown question",
      mutate: (r) => {
        (r.unsettled as Record<string, unknown>[])[0]!.question_id = "q-zz-99";
      },
      expect: "must cover exactly gold_set.questions distinct questions",
    },
    {
      name: "home path in a row's category (leak invariant)",
      mutate: (r) => {
        // category carries no cross-checks, so ONLY the leak invariant fires
        const row = r.questions.find((q) => q.category !== "absence")!;
        row.category += USERS_LEAK;
      },
      expect: "absolute home path",
    },
  ];

  test("the committed rollup carries the pinned framing note verbatim", () => {
    expect(committedRollup().framing).toBe(FRAMING_NOTE);
  });

  for (const mutant of mutants) {
    test(`rejects: ${mutant.name}`, () => {
      const rollup = committedRollup();
      mutant.mutate(rollup);
      const check = validateRollup(structuredClone(rollup));
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.errors.join("; ")).toContain(mutant.expect);
      }
    });
  }
});

describe("ISC-25 — the committed rollup re-derives from committed cells + the frozen gold set", () => {
  test("buildRollup over the committed cell set reproduces the committed rollup identically", () => {
    const loaded = loadSuiteCells(GOLD);
    const recorded = new Set(loadUnsettled(GOLD).map((u) => `${u.lane}::${u.question_id}`));
    expect(loaded.missing.map((c) => `${c.lane}::${c.questionId}`).filter((k) => !recorded.has(k))).toEqual([]);
    const rebuilt = buildRollup(loaded.cells, GOLD, loadUnsettled(GOLD));
    expect(rebuilt).toEqual(committedRollup());
  });

  test("the rollup's rows receipt the same scores the probes re-derive (spot cross-check)", () => {
    const rollup = committedRollup();
    const loaded = loadSuiteCells(GOLD);
    for (const row of rollup.questions) {
      const cell = loaded.cells.find(
        (c) => c.lane === row.lane && c.trace.question_id === row.question_id,
      );
      expect(cell).toBeDefined();
      if (cell) {
        expect(row.judge_verdict).toBe(cell.score.judge!.verdict);
        expect(row.passages_exact_ratio).toBe(cell.score.evidence.passages_exact_ratio);
        expect(row.records_found_ratio).toBe(cell.score.evidence.records_found_ratio);
        expect(row.retrieval).toEqual({
          steps: cell.score.retrieval.steps,
          error_steps: cell.score.retrieval.error_steps,
          result_bytes: cell.score.retrieval.result_bytes,
        });
      }
    }
  });
});

describe("ISC-26 — the human render: byte-identical re-render, both axes, all cells", () => {
  test("results/rollup.md exists and re-renders byte-identically from the rollup", () => {
    expect(renderRollupMd(committedRollup())).toBe(committedMd());
  });

  test("the render carries both axis tables over every lane × category", () => {
    const md = committedMd();
    const rollup = committedRollup();
    for (const heading of [
      "## Judged answers — correct/partial/incorrect · correct ratio",
      "## Evidence fidelity — passage-exact / record-found means",
      "## Retrieval cost per lane",
    ]) {
      expect(md.includes(heading)).toBe(true);
    }
    // one row per lane in each of the three result tables (the recorded
    // non-settlements table below them adds rows too — it is checked apart)
    const tables = md.split("## Recorded non-settlements")[0]!;
    for (const lane of rollup.lanes) {
      expect(tables.split(`| ${lane} |`).length).toBe(4);
    }
    for (const category of rollup.gold_set.categories) {
      expect(md.includes(category)).toBe(true);
    }
    // the accepted framing, verbatim, and the receipts link
    expect(md.includes(FRAMING_NOTE)).toBe(true);
    expect(md.includes("[rollup.json](rollup.json)")).toBe(true);
  });

  test("the graph lane's architectural zero on passage fidelity is in the render — the measured difference, not a footnote", () => {
    const md = committedMd();
    const rollup = committedRollup();
    // passage fidelity zero is architectural: the graph lane returns paths and
    // typed edges, never record text, so no gold passage bytes can ever appear
    // in a result. record retrieval is NOT pinned: a call that names a cited
    // record credits it under the F4-frozen scorer, and that is measured
    // behavior, not architecture.
    const graphEvidence = rollup.cells.filter((c) => c.lane === "graph" && c.category !== "absence");
    for (const cell of graphEvidence) {
      expect(cell.passages_exact_ratio_mean).toBe(0);
    }
    // the evidence table's graph row carries its 0.00 passage mean (the
    // judged table above it also has a graph row — scope to the evidence
    // section before matching)
    const evidenceSection = md.slice(md.indexOf("## Evidence fidelity"));
    const graphRow = evidenceSection.split("\n").find((l) => l.startsWith("| graph |"));
    expect(graphRow).toBeDefined();
    expect(graphRow!.includes("0.00 /")).toBe(true);
  });
});
