// runner/suite.ts — the F5 suite engine (ISC-22/23).
//
// `lab suite` runs the full comparative experiment in one execution: all
// lanes over the full gold set — every (lane × question) cell gets one
// committed trace and one committed score with a blind judge verdict — then
// the rollup is built from the complete cell set and written with its human
// render (rollup.ts, ISC-24/25/26).
//
// ISC-22 mechanics:
//   · resumable  — a cell with a valid committed trace + reconciling score
//     (judge included) is REUSED, never silently re-run. A killed suite
//     loses nothing; re-invoking picks up exactly where it stopped.
//   · loud       — a cell that still fails after its retries is recorded and
//     reported; the suite refuses to write the rollup unless coverage is
//     complete. A partial rollup would be a misleading artifact.
//   · bounded    — cells run through a small worker pool (default 3: far
//     under the pinned endpoint's rate limits); a wedged cell costs its own
//     run timeout, not the suite.
//
// ISC-23: the experiment's constants are asserted, not assumed — the suite
// reuses a cell only when the agent-under-test pin in its trace matches the
// current pin, and its score only when the judge matches the current judge
// pin and carries blind: true. buildRollup then asserts constancy across
// every cell (one model, one judge, one harness name) before any rollup
// exists.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type HarnessDriver } from "./harness";
import {
  atomicWrite,
  loadGold,
  readJudgePin,
  readModelPin,
  runOne,
  scoreOne,
  writeScore,
  writeTrace,
  type GoldQuestion,
} from "./run";
import { absenceStated, scoreEvidence, utf8Bytes, validateScore, type Score } from "./score";
import { LANES, validateTrace, type Lane, type Trace } from "./trace";
import {
  buildRollup,
  renderRollupMd,
  traceRefFor,
  validateRollup,
  type UnsettledCell,
} from "./rollup";

const REPO_ROOT = join(import.meta.dir, "..");
const RUNS_DIR = join(REPO_ROOT, "results", "runs");
const SCORES_DIR = join(REPO_ROOT, "results", "scores");
const ROLLUP_JSON = join(REPO_ROOT, "results", "rollup.json");
const ROLLUP_MD = join(REPO_ROOT, "results", "rollup.md");
const UNSETTLED_FILE = join(REPO_ROOT, "results", "unsettled.json");

/**
 * The committed non-settlement record (F6): the only legal reason a suite
 * cell may be missing from the rollup. Absent file = no exceptions (the F5
 * shape). A present file is validated here and again inside buildRollup —
 * an entry naming a settled cell throws there, so the record can never
 * quietly outlive the cell it excuses.
 */
export function loadUnsettled(gold: GoldQuestion[]): UnsettledCell[] {
  if (!existsSync(UNSETTLED_FILE)) return [];
  const record = JSON.parse(readFileSync(UNSETTLED_FILE, "utf8")) as { cells?: unknown };
  if (typeof record !== "object" || record === null || !Array.isArray(record.cells)) {
    throw new Error("results/unsettled.json is malformed: expected { schema, cells: [...] }");
  }
  const goldIds = new Set(gold.map((q) => q.id));
  return record.cells.map((raw, i) => {
    const u = raw as Record<string, unknown>;
    if (typeof u.lane !== "string" || !LANES.includes(u.lane as Lane)) {
      throw new Error(`results/unsettled.json cells[${i}].lane must be one of ${LANES.join(", ")}`);
    }
    if (typeof u.question_id !== "string" || !goldIds.has(u.question_id)) {
      throw new Error(`results/unsettled.json cells[${i}].question_id is not a gold-set id`);
    }
    if (typeof u.why !== "string" || u.why.trim() === "") {
      throw new Error(`results/unsettled.json cells[${i}].why must be a non-empty reason`);
    }
    return u as unknown as UnsettledCell;
  });
}

/** One unit of suite work: one gold question through one lane. */
export type SuiteCell = { lane: Lane; questionId: string; gold: GoldQuestion };

/** Every cell, lane-major in pinned lane order, gold order within a lane. */
export function suiteCells(gold: GoldQuestion[]): SuiteCell[] {
  const cells: SuiteCell[] = [];
  for (const lane of LANES) {
    for (const q of gold) cells.push({ lane, questionId: q.id, gold: q });
  }
  return cells;
}

/**
 * Full re-derivation of a score from its trace + the frozen gold question —
 * the same predicate score-lint (ISC-21) polices for every committed score.
 * The suite's resume logic and the suite probe both drive THIS function, so
 * the probe cannot drift from what actually gates a cell (the pattern the
 * F3 review set: probes drive production wiring).
 */
export function scoreReconciles(score: Score, trace: Trace, gold: GoldQuestion): boolean {
  return (
    score.question_id === trace.question_id &&
    score.question_id === gold.id &&
    score.lane === trace.lane &&
    score.category === gold.category &&
    score.trace_ref === traceRefFor(score.lane, gold.id) &&
    JSON.stringify(score.evidence) === JSON.stringify(scoreEvidence(trace, gold.citations)) &&
    score.retrieval.steps === trace.steps.length &&
    score.retrieval.error_steps === trace.steps.filter((s) => s.is_error).length &&
    score.retrieval.result_bytes === trace.steps.reduce((sum, s) => sum + utf8Bytes(s.result_text), 0) &&
    score.absence_stated === absenceStated(gold.category, trace.final_answer)
  );
}

/** The committed trace for a cell, if it exists, validates, and matches gold + the current pin. */
export function loadCommittedTrace(
  lane: Lane,
  questionId: string,
  gold: GoldQuestion,
): Trace | null {
  const path = join(RUNS_DIR, lane, `${questionId}.json`);
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  const check = validateTrace(parsed);
  if (!check.ok) return null;
  const trace = check.trace;
  const pin = readModelPin();
  if (
    trace.lane !== lane ||
    trace.question_id !== questionId ||
    trace.question_id !== gold.id ||
    trace.question_text !== gold.question ||
    trace.category !== gold.category ||
    trace.model.provider !== pin.provider ||
    trace.model.model !== pin.model
  ) {
    return null;
  }
  return trace;
}

/**
 * The committed score for a cell, if it exists, validates, reconciles with
 * its trace + gold, carries a structurally blind judge verdict from the
 * CURRENT judge pin. Anything else means the cell re-scores.
 */
export function loadCommittedScore(trace: Trace, gold: GoldQuestion): Score | null {
  const path = join(SCORES_DIR, trace.lane, `${gold.id}.json`);
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  const check = validateScore(parsed);
  if (!check.ok) return null;
  const score = check.score;
  const judgePin = readJudgePin();
  if (
    !scoreReconciles(score, trace, gold) ||
    score.judge === undefined ||
    score.judge.blind !== true ||
    score.judge.model.provider !== judgePin.provider ||
    score.judge.model.model !== judgePin.model
  ) {
    return null;
  }
  return score;
}

export type CellOutcome = {
  lane: Lane;
  questionId: string;
  status: "reused" | "ran" | "failed" | "recorded";
  error?: string;
};

export type SuiteOutcome = {
  cells: number;
  reused: number;
  ran: number;
  failed: number;
  /** cells skipped because the committed non-settlement record names them */
  recorded: number;
  failures: { lane: Lane; questionId: string; error: string }[];
  rollupWritten: boolean;
};

export type SuiteOptions = {
  /** worker-pool size; 3 stays far under the pinned endpoint's rate limits */
  jobs?: number;
  /** attempts per cell run (the judge already retries internally) */
  runAttempts?: number;
};

/**
 * Loads the complete cell set — one validated (trace, score) pair per lane ×
 * gold question — plus the cells still missing. Shared by the suite (before
 * building the rollup) and the probe (ISC-22/25), so both walk the same
 * production code path.
 */
export function loadSuiteCells(
  gold: GoldQuestion[],
): { cells: { lane: Lane; trace: Trace; score: Score }[]; missing: SuiteCell[] } {
  const cells: { lane: Lane; trace: Trace; score: Score }[] = [];
  const missing: SuiteCell[] = [];
  for (const cell of suiteCells(gold)) {
    const trace = loadCommittedTrace(cell.lane, cell.questionId, cell.gold);
    const score = trace === null ? null : loadCommittedScore(trace, cell.gold);
    if (trace === null || score === null) missing.push(cell);
    else cells.push({ lane: cell.lane, trace, score });
  }
  return { cells, missing };
}

/** Runs the full suite. See the file header for the ISC-22 mechanics. */
export async function suiteRun(driver: HarnessDriver, opts: SuiteOptions = {}): Promise<SuiteOutcome> {
  const jobs = Math.max(1, opts.jobs ?? 3);
  const runAttempts = Math.max(1, opts.runAttempts ?? 2);
  const gold = loadGold();
  const allCells = suiteCells(gold);

  const outcomes: CellOutcome[] = [];
  const pending: SuiteCell[] = [];
  const recorded = loadUnsettled(gold);
  const recordedKeys = new Set(recorded.map((u) => `${u.lane}::${u.question_id}`));

  // Pass 1 — reconcile what is already committed (resume). A cell with no
  // committed artifacts that the non-settlement record names is SKIPPED, not
  // re-attempted: the record is the measured outcome, and re-burning its
  // deadline on every invocation would be waste. Retiring the record (or
  // running the cell as a one-off) is the explicit way back.
  for (const cell of allCells) {
    const trace = loadCommittedTrace(cell.lane, cell.questionId, cell.gold);
    const score = trace === null ? null : loadCommittedScore(trace, cell.gold);
    if (trace !== null && score !== null) {
      outcomes.push({ lane: cell.lane, questionId: cell.questionId, status: "reused" });
    } else if (recordedKeys.has(`${cell.lane}::${cell.questionId}`)) {
      outcomes.push({ lane: cell.lane, questionId: cell.questionId, status: "recorded" });
    } else {
      pending.push(cell);
    }
  }
  const reused = outcomes.length;
  console.log(
    `[suite] ${allCells.length} cells (${LANES.length} lanes × ${gold.length} questions) · ` +
      `${reused} reused, ${pending.length} to run`,
  );

  // Pass 2 — run the missing cells through a bounded worker pool.
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const at = cursor++;
      if (at >= pending.length) return;
      const cell = pending[at]!;
      const t0 = Date.now();
      let settled = false;
      let lastError = "";
      for (let attempt = 1; attempt <= runAttempts && !settled; attempt++) {
        try {
          if (loadCommittedTrace(cell.lane, cell.questionId, cell.gold) === null) {
            const fresh = await runOne(driver, cell.lane, cell.questionId);
            writeTrace(fresh);
          }
          const score = await scoreOne(driver, cell.lane, cell.questionId, true);
          writeScore(score);
          const secs = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(
            `[suite] ${String(at + 1).padStart(String(pending.length).length, " ")}/${pending.length} · ` +
              `${cell.lane} ${cell.questionId} (${cell.gold.category}) → ` +
              `${score.judge!.verdict} · passages ${score.evidence.passages_exact_ratio ?? "—"} · ` +
              `records ${score.evidence.records_found_ratio ?? "—"} · ${secs}s`,
          );
          outcomes.push({ lane: cell.lane, questionId: cell.questionId, status: "ran" });
          settled = true;
        } catch (err) {
          lastError = String(err).slice(0, 300);
          if (attempt < runAttempts) {
            console.warn(
              `[suite] ${cell.lane} ${cell.questionId} attempt ${attempt}/${runAttempts} failed — retrying: ${lastError}`,
            );
            await Bun.sleep(5_000 * attempt);
          }
        }
      }
      if (!settled) {
        console.error(
          `[suite] ${cell.lane} ${cell.questionId} FAILED after ${runAttempts} attempt(s): ${lastError}`,
        );
        outcomes.push({ lane: cell.lane, questionId: cell.questionId, status: "failed", error: lastError });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, Math.max(pending.length, 1)) }, () => worker()));

  // Pass 3 — complete coverage or loud failure; the rollup only exists for
  // a complete suite.
  const loaded = loadSuiteCells(gold);
  const ran = outcomes.filter((o) => o.status === "ran").length;
  const failedOutcomes = outcomes.filter((o) => o.status === "failed");
  const outcome: SuiteOutcome = {
    cells: allCells.length,
    reused,
    ran,
    failed: failedOutcomes.length,
    recorded: outcomes.filter((o) => o.status === "recorded").length,
    failures: failedOutcomes.map((o) => ({ lane: o.lane, questionId: o.questionId, error: o.error ?? "" })),
    rollupWritten: false,
  };
  // ISC-23/24/25: build from the complete, re-validated cell set and write
  // the rollup + its render atomically. Complete coverage OR a committed
  // non-settlement record covering EVERY missing cell (F6) — anything else
  // is silent incompleteness and refuses the rollup.
  const writeRollup = (recorded: UnsettledCell[]): boolean => {
    const rollup = buildRollup(loaded.cells, gold, recorded);
    const check = validateRollup(rollup);
    if (!check.ok) {
      console.error(
        `[suite] the built rollup failed validation — refusing to write:\n${check.errors.map((e) => `  - ${e}`).join("\n")}`,
      );
      return false;
    }
    atomicWrite(ROLLUP_JSON, JSON.stringify(rollup, null, 2) + "\n");
    atomicWrite(ROLLUP_MD, renderRollupMd(rollup));
    outcome.rollupWritten = true;
    console.log(`[suite] rollup → results/rollup.json · render → results/rollup.md`);
    return true;
  };

  if (loaded.missing.length === 0 && loaded.cells.length === allCells.length) {
    writeRollup([]);
    return outcome;
  }

  if (loaded.missing.length === 0) {
    console.error(
      `[suite] loaded ${loaded.cells.length} cells for ${allCells.length} expected, with none reported missing — refusing the rollup`,
    );
    return outcome;
  }

  const unrecorded = loaded.missing.filter((c) => !recordedKeys.has(`${c.lane}::${c.questionId}`));
  if (unrecorded.length > 0) {
    console.error(
      `[suite] coverage incomplete: ${loaded.missing.length} cell(s) missing, ${unrecorded.length} of them NOT recorded — rollup NOT written.\n` +
        loaded.missing
          .map((c) => `  - ${c.lane} ${c.questionId}${recordedKeys.has(`${c.lane}::${c.questionId}`) ? " (recorded)" : ""}`)
          .join("\n"),
    );
    return outcome;
  }
  console.error(
    `[suite] ${recorded.length} missing cell(s) are recorded non-settlements — the rollup is written WITH the record:\n` +
      recorded.map((u) => `  - ${u.lane} ${u.question_id} (${u.attempts} attempt(s), ${u.attempt_seconds.join("+")}s)`).join("\n"),
  );
  writeRollup(recorded);
  return outcome;
}
