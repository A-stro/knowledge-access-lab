// runner/rollup.ts — the suite rollup (F5, ISC-24/25/26; F6: five lanes and the
// recorded non-settlements — the schema is @2 from F6 because a cell may now be
// missing only when results/unsettled.json names it).
//
// The rollup is the committed comparative result the README promised: the
// per-lane × per-category numbers on BOTH axes — evidence fidelity (the
// deterministic scorer) and judged answers (the blind judge) — plus the
// per-question rows that receipt every aggregate.
//
// Framing (accepted for F5, extended for F6): the graph lanes (graph,
// graph-seed) return traversal-shaped evidence — paths, typed edges, and
// name→path metadata, never record text — so they score zero on passage
// fidelity BY ARCHITECTURE. That zero is the measured difference this lab
// exists to report, not a bug in the graph lanes. The rollup therefore
// carries the two axes side by side and never folds them into one "winner"
// number: the graph lanes' judged-answer quality stands on its own, next to
// their structural zero on passage fidelity.
//
// Purity: buildRollup() is a pure function of the committed cells (one
// validated trace + one validated score per lane × question) and the frozen
// gold set. No clock, no filesystem, no randomness — the committed rollup
// re-derives byte-identically, and the probe (ISC-25) holds the repo to
// exactly that. The judge verdicts inside it are receipts recorded at score
// time (an LLM graded the answers once); everything else recomputes.

import { containsHomeRoot, LANES, type Lane, type Trace } from "./trace";
import type { Score } from "./score";
import type { GoldQuestion } from "./run";

export const ROLLUP_SCHEMA = "knowledge-access-lab/rollup@2";

/** The category whose questions carry no gold citations by design. */
export const ABSENCE_CATEGORY = "absence";

/** The accepted framing decision, pinned verbatim in every rollup. F6 extended
 * its scope to the seeded lane (2026-10-28): both graph lanes return
 * traversal-shaped evidence, so both score zero on passage fidelity by
 * architecture, and only their judged-answer axes can move. */
export const FRAMING_NOTE =
  "Framing (accepted for F5, 2026-10-27; extended for F6, 2026-10-28): the graph lanes " +
  "(graph, graph-seed) return traversal-shaped evidence — paths, typed edges, and " +
  "name→path metadata, never record text — so they score zero on passage fidelity by " +
  "architecture. That zero is the measured difference this lab exists to report, not a " +
  "bug. The rollup carries both axes — evidence fidelity and judged answers — so the " +
  "graph lanes' answer quality stands on its own.";

/** An explicitly recorded non-settlement: a suite cell that never produced a
 * trace + score within every operational deadline, recorded instead of
 * silently dropped. The rollup's rule is complete coverage OR an explicit,
 * validated record — a partial rollup may exist only when every missing
 * cell is named here with its attempt history. */
export type UnsettledCell = {
  lane: Lane;
  question_id: string;
  /** how many times the suite (or a longer-leash one-off) attempted the cell */
  attempts: number;
  /** the deadline of each attempt in seconds — the measured cost, re-derivable */
  attempt_seconds: number[];
  why: string;
};

export type RollupVerdict = "correct" | "partial" | "incorrect";

/** One per-question receipt row — the evidence behind every aggregate. */
export type RollupRow = {
  question_id: string;
  category: string;
  lane: Lane;
  trace_ref: string;
  score_ref: string;
  passages_exact_ratio: number | null;
  records_found_ratio: number | null;
  judge_verdict: RollupVerdict;
  judge_model: string;
  absence_stated: boolean | null;
  retrieval: { steps: number; error_steps: number; result_bytes: number };
};

/** One lane × category aggregate cell on both axes. */
export type RollupCell = {
  lane: Lane;
  category: string;
  n: number;
  /** evidence axis — null for the absence category (no gold citations) */
  passages_exact_ratio_mean: number | null;
  records_found_ratio_mean: number | null;
  /** judged axis — counts always sum to n (every suite cell is judged) */
  judge_correct: number;
  judge_partial: number;
  judge_incorrect: number;
  judged_correct_ratio: number;
  /** absence axis — stated-count over the cell's absence questions; null for other categories */
  absence_stated_count: number | null;
  absence_stated_ratio: number | null;
};

/** Per-lane retrieval cost, derived from the same rows. */
export type RollupRetrieval = {
  lane: Lane;
  steps_mean: number;
  error_steps_total: number;
  result_bytes_mean: number;
};

export type Rollup = {
  schema: typeof ROLLUP_SCHEMA;
  framing: string;
  gold_set: { questions: number; categories: string[] };
  lanes: Lane[];
  model: { provider: string; model: string };
  judge_model: { provider: string; model: string };
  harness: { name: string; versions: string[] };
  cells: RollupCell[];
  lane_totals: RollupCell[];
  lane_retrieval: RollupRetrieval[];
  questions: RollupRow[];
  /** the recorded non-settlements, in lane order then gold order; empty for a
   * fully settled suite (the F5 shape) */
  unsettled: UnsettledCell[];
};

export type RollupCheck = { ok: true; rollup: Rollup } | { ok: false; errors: string[] };

/** round to 3 decimals — the scorer's own ratio precision, reused everywhere. */
export function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export function traceRefFor(lane: Lane, questionId: string): string {
  return `results/runs/${lane}/${questionId}.json`;
}

export function scoreRefFor(lane: Lane, questionId: string): string {
  return `results/scores/${lane}/${questionId}.json`;
}

/** The category axis, in frozen gold-set first-appearance order. */
export function goldCategories(gold: GoldQuestion[]): string[] {
  const seen: string[] = [];
  for (const q of gold) if (!seen.includes(q.category)) seen.push(q.category);
  return seen;
}

function meanRatio(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return round3(nums.reduce((s, v) => s + v, 0) / nums.length);
}

function aggregateCell(lane: Lane, category: string, rows: RollupRow[]): RollupCell {
  const cellRows = rows.filter((r) => r.lane === lane && (category === "all" || r.category === category));
  const absence = category === ABSENCE_CATEGORY;
  const absenceRows = cellRows.filter((r) => r.absence_stated !== null);
  const stated = absenceRows.filter((r) => r.absence_stated === true).length;
  const correct = cellRows.filter((r) => r.judge_verdict === "correct").length;
  const partial = cellRows.filter((r) => r.judge_verdict === "partial").length;
  const incorrect = cellRows.filter((r) => r.judge_verdict === "incorrect").length;
  return {
    lane,
    category,
    n: cellRows.length,
    passages_exact_ratio_mean: absence ? null : meanRatio(cellRows.map((r) => r.passages_exact_ratio)),
    records_found_ratio_mean: absence ? null : meanRatio(cellRows.map((r) => r.records_found_ratio)),
    judge_correct: correct,
    judge_partial: partial,
    judge_incorrect: incorrect,
    judged_correct_ratio: cellRows.length === 0 ? 0 : round3(correct / cellRows.length),
    absence_stated_count: absence ? stated : null,
    absence_stated_ratio: absence ? (absenceRows.length === 0 ? 0 : round3(stated / absenceRows.length)) : null,
  };
}

/**
 * Builds the rollup from the cell set — one validated trace + one validated
 * score per lane × gold question — plus any explicitly recorded
 * non-settlements. Pure: same cells + same gold + same record →
 * byte-identical rollup. Throws loudly on any incompleteness or drift, so a
 * partial or inconsistent suite can never produce a rollup UNLESS every
 * missing cell is named in the record with its attempt history.
 */
export function buildRollup(
  cells: { lane: Lane; trace: Trace; score: Score }[],
  gold: GoldQuestion[],
  unsettled: UnsettledCell[] = [],
): Rollup {
  if (gold.length === 0) throw new Error("buildRollup: the gold set is empty");

  // The recorded non-settlements: well-formed, never duplicating a settled
  // cell, never duplicating each other.
  const unsettledByKey = new Map<string, UnsettledCell>();
  for (const u of unsettled) {
    if (!LANES.includes(u.lane)) {
      throw new Error(`buildRollup: unsettled record names unknown lane ${u.lane}`);
    }
    if (!gold.some((q) => q.id === u.question_id)) {
      throw new Error(`buildRollup: unsettled record names unknown question ${u.question_id}`);
    }
    if (!Number.isInteger(u.attempts) || u.attempts < 1) {
      throw new Error(`buildRollup: unsettled record for ${u.lane} ${u.question_id} needs attempts >= 1`);
    }
    if (!Array.isArray(u.attempt_seconds) || u.attempt_seconds.length !== u.attempts ||
        !u.attempt_seconds.every((s) => Number.isInteger(s) && s > 0)) {
      throw new Error(`buildRollup: unsettled record for ${u.lane} ${u.question_id} needs one positive attempt_seconds per attempt`);
    }
    if (typeof u.why !== "string" || u.why.trim() === "") {
      throw new Error(`buildRollup: unsettled record for ${u.lane} ${u.question_id} needs a reason`);
    }
    const key = `${u.lane}::${u.question_id}`;
    if (unsettledByKey.has(key)) {
      throw new Error(`buildRollup: unsettled record lists ${u.lane} ${u.question_id} twice`);
    }
    unsettledByKey.set(key, u);
  }

  // Complete coverage OR an explicit record: every lane × every gold question
  // is either settled or named in the record — nothing silently missing.
  const byKey = new Map(cells.map((c) => [`${c.lane}::${c.trace.question_id}`, c]));
  for (const [key, u] of unsettledByKey) {
    if (byKey.has(key)) {
      throw new Error(`buildRollup: unsettled record names ${u.lane} ${u.question_id}, which HAS a committed cell — remove the stale record`);
    }
  }
  for (const lane of LANES) {
    for (const q of gold) {
      const cell = byKey.get(`${lane}::${q.id}`);
      if (cell === undefined) {
        if (unsettledByKey.has(`${lane}::${q.id}`)) continue;
        throw new Error(`buildRollup: no cell for lane ${lane} · question ${q.id} — suite is incomplete (and no unsettled record names it)`);
      }
      if (cell.score.question_id !== q.id || cell.trace.question_id !== q.id) {
        throw new Error(`buildRollup: cell (${lane}, ${q.id}) carries mismatched ids`);
      }
      if (cell.score.category !== q.category || cell.trace.category !== q.category) {
        throw new Error(`buildRollup: cell (${lane}, ${q.id}) category disagrees with the frozen gold set`);
      }
      if (cell.trace.lane !== lane) {
        throw new Error(`buildRollup: cell (${lane}, ${q.id}) trace carries lane ${cell.trace.lane}`);
      }
      if (cell.score.trace_ref !== traceRefFor(lane, q.id)) {
        throw new Error(`buildRollup: cell (${lane}, ${q.id}) score points at ${cell.score.trace_ref}`);
      }
      if (cell.score.judge === undefined) {
        throw new Error(`buildRollup: cell (${lane}, ${q.id}) has no judge verdict — the suite judges every cell`);
      }
    }
  }
  const expectedCells = LANES.length * gold.length - unsettledByKey.size;
  if (cells.length !== expectedCells) {
    throw new Error(
      `buildRollup: expected ${expectedCells} cells (${LANES.length * gold.length} minus ${unsettledByKey.size} recorded), got ${cells.length} — extra cells present`,
    );
  }

  // The experiment's constants, asserted across the whole suite.
  const model = cells[0]!.trace.model;
  if (!cells.every((c) => c.trace.model.provider === model.provider && c.trace.model.model === model.model)) {
    throw new Error("buildRollup: traces carry mixed models — architecture is the variable, model is the constant");
  }
  const judgeScore = cells[0]!.score.judge!.model;
  if (!cells.every((c) => {
    const m = c.score.judge!.model;
    return m.provider === judgeScore.provider && m.model === judgeScore.model;
  })) {
    throw new Error("buildRollup: scores carry mixed judge models — the judge pin is part of the experiment");
  }
  if (judgeScore.model === model.model) {
    throw new Error("buildRollup: the judge model matches the agent-under-test — blindness requires a different model");
  }
  const harnessName = cells[0]!.trace.harness.name;
  if (!cells.every((c) => c.trace.harness.name === harnessName)) {
    throw new Error("buildRollup: traces carry mixed harness names");
  }
  const versions = [...new Set(cells.map((c) => c.trace.harness.version))].sort();

  const categories = goldCategories(gold);

  // Rows: lane-major, gold order within a lane — deterministic. Recorded
  // non-settlements carry no row: the aggregates below average over the
  // settled cells only, and the render names the gap.
  const questions: RollupRow[] = [];
  for (const lane of LANES) {
    for (const q of gold) {
      const cell = byKey.get(`${lane}::${q.id}`);
      if (cell === undefined) continue; // recorded unsettled — see the record

      const absence = q.category === ABSENCE_CATEGORY;
      if (absence !== (cell.score.absence_stated !== null)) {
        throw new Error(`buildRollup: cell (${lane}, ${q.id}) absence flag disagrees with its category`);
      }
      if (absence !== (cell.score.evidence.evidence_expected === false)) {
        throw new Error(`buildRollup: cell (${lane}, ${q.id}) evidence expectation disagrees with its category`);
      }
      questions.push({
        question_id: q.id,
        category: q.category,
        lane,
        trace_ref: traceRefFor(lane, q.id),
        score_ref: scoreRefFor(lane, q.id),
        passages_exact_ratio: cell.score.evidence.passages_exact_ratio,
        records_found_ratio: cell.score.evidence.records_found_ratio,
        judge_verdict: cell.score.judge!.verdict,
        judge_model: `${cell.score.judge!.model.provider}/${cell.score.judge!.model.model}`,
        absence_stated: cell.score.absence_stated,
        retrieval: {
          steps: cell.score.retrieval.steps,
          error_steps: cell.score.retrieval.error_steps,
          result_bytes: cell.score.retrieval.result_bytes,
        },
      });
    }
  }

  const perLaneCells: RollupCell[] = [];
  for (const lane of LANES) {
    for (const category of categories) perLaneCells.push(aggregateCell(lane, category, questions));
  }
  const laneTotals = LANES.map((lane) => aggregateCell(lane, "all", questions));
  const laneRetrieval = LANES.map((lane) => {
    const rows = questions.filter((r) => r.lane === lane);
    return {
      lane,
      steps_mean: round3(rows.reduce((s, r) => s + r.retrieval.steps, 0) / rows.length),
      error_steps_total: rows.reduce((s, r) => s + r.retrieval.error_steps, 0),
      result_bytes_mean: round3(rows.reduce((s, r) => s + r.retrieval.result_bytes, 0) / rows.length),
    };
  });

  const rollup: Rollup = {
    schema: ROLLUP_SCHEMA,
    framing: FRAMING_NOTE,
    gold_set: { questions: gold.length, categories },
    lanes: [...LANES],
    model: { provider: model.provider, model: model.model },
    judge_model: { provider: judgeScore.provider, model: judgeScore.model },
    harness: { name: harnessName, versions },
    cells: perLaneCells,
    lane_totals: laneTotals,
    lane_retrieval: laneRetrieval,
    questions,
    unsettled: LANES.flatMap((lane) =>
      gold.filter((q) => unsettledByKey.has(`${lane}::${q.id}`)).map((q) => unsettledByKey.get(`${lane}::${q.id}`)!),
    ),
  };

  const check = validateRollup(rollup);
  if (!check.ok) {
    throw new Error(`buildRollup: the built rollup fails its own schema:\n${check.errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  return rollup;
}

const VERDICTS = ["correct", "partial", "incorrect"] as const;

function isRatioInUnit(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && (value as number) >= 0;
}

/**
 * ISC-24: the rollup schema. Internal consistency, the way the score schema
 * does it — every aggregate is cross-checked against the per-question rows,
 * counts must sum, absence cells carry null evidence and non-absence cells
 * carry null absence fields, and the leak invariant holds. Gold-set and pin
 * cross-checks against the repo live in the probe (ISC-25), which re-derives
 * the whole artifact.
 */
export function validateRollup(value: unknown): RollupCheck {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["rollup must be a JSON object"] };
  }
  const v = value as Record<string, unknown>;

  if (v.schema !== ROLLUP_SCHEMA) errors.push(`schema must be "${ROLLUP_SCHEMA}"`);
  if (v.framing !== FRAMING_NOTE) errors.push("framing must carry the pinned framing note, verbatim");

  const goldSet = v.gold_set;
  if (
    typeof goldSet !== "object" ||
    goldSet === null ||
    !isCount((goldSet as Record<string, unknown>).questions) ||
    (goldSet as Record<string, unknown>).questions < 1 ||
    !Array.isArray((goldSet as Record<string, unknown>).categories) ||
    (goldSet as Record<string, unknown>).categories.length === 0 ||
    !(goldSet as Record<string, unknown>).categories.every((c) => typeof c === "string" && c !== "")
  ) {
    errors.push("gold_set must carry a positive question count and non-empty category strings");
  }
  const categories = (typeof goldSet === "object" && goldSet !== null
    ? ((goldSet as Record<string, unknown>).categories as unknown)
    : []) as string[];
  if (new Set(categories).size !== categories.length) errors.push("gold_set.categories must be unique");
  if (!Array.isArray(v.lanes) || v.lanes.length === 0 || !v.lanes.every((l) => LANES.includes(l as Lane))) {
    errors.push(`lanes must be exactly the ${LANES.length} lanes (${LANES.join(", ")})`);
  } else if (JSON.stringify(v.lanes) !== JSON.stringify([...LANES])) {
    errors.push(`lanes must be in the pinned order (${LANES.join(", ")})`);
  }

  const model = v.model;
  if (
    typeof model !== "object" ||
    model === null ||
    typeof (model as Record<string, unknown>).provider !== "string" ||
    typeof (model as Record<string, unknown>).model !== "string" ||
    (model as Record<string, unknown>).provider === "" ||
    (model as Record<string, unknown>).model === ""
  ) {
    errors.push("model must carry non-empty provider and model strings");
  }
  const judgeModel = v.judge_model;
  if (
    typeof judgeModel !== "object" ||
    judgeModel === null ||
    typeof (judgeModel as Record<string, unknown>).provider !== "string" ||
    typeof (judgeModel as Record<string, unknown>).model !== "string" ||
    (judgeModel as Record<string, unknown>).provider === "" ||
    (judgeModel as Record<string, unknown>).model === ""
  ) {
    errors.push("judge_model must carry non-empty provider and model strings");
  } else if (typeof model === "object" && model !== null) {
    if ((judgeModel as Record<string, unknown>).model === (model as Record<string, unknown>).model) {
      errors.push("judge_model must differ from the agent-under-test model — no run graded by its own family");
    }
  }
  const harness = v.harness;
  if (
    typeof harness !== "object" ||
    harness === null ||
    typeof (harness as Record<string, unknown>).name !== "string" ||
    (harness as Record<string, unknown>).name === "" ||
    !Array.isArray((harness as Record<string, unknown>).versions) ||
    (harness as Record<string, unknown>).versions.length === 0 ||
    !(harness as Record<string, unknown>).versions.every((x) => typeof x === "string" && x !== "")
  ) {
    errors.push("harness must carry a non-empty name and at least one version string");
  } else {
    const versions = (harness as Record<string, unknown>).versions as string[];
    if (JSON.stringify(versions) !== JSON.stringify([...versions].sort())) {
      errors.push("harness.versions must be sorted");
    }
    if (new Set(versions).size !== versions.length) errors.push("harness.versions must be unique");
  }

  const lanesOk = Array.isArray(v.lanes) && JSON.stringify(v.lanes) === JSON.stringify([...LANES]);

  // ---- recorded non-settlements (the only legal reason a cell is missing) ----
  type Unsettled = Record<string, unknown>;
  const unsettled: Unsettled[] = [];
  let unsettledOk = false;
  if (!Array.isArray(v.unsettled)) {
    errors.push("unsettled must be an array (empty for a fully settled suite)");
  } else {
    unsettledOk = true;
    const unsettledKeys = new Set<string>();
    (v.unsettled as unknown[]).forEach((raw, i) => {
      const label = `unsettled[${i}]`;
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        errors.push(`${label} must be an object`);
        unsettledOk = false;
        return;
      }
      const u = raw as Unsettled;
      if (typeof u.lane !== "string" || !LANES.includes(u.lane as Lane)) {
        errors.push(`${label}.lane must be one of ${LANES.join(", ")}`);
        unsettledOk = false;
      }
      if (typeof u.question_id !== "string" || u.question_id === "") {
        errors.push(`${label}.question_id must be a non-empty string`);
        unsettledOk = false;
      }
      if (!isCount(u.attempts) || (u.attempts as number) < 1) {
        errors.push(`${label}.attempts must be an integer >= 1`);
        unsettledOk = false;
      }
      if (!Array.isArray(u.attempt_seconds) || (u.attempt_seconds as unknown[]).length === 0) {
        errors.push(`${label}.attempt_seconds must be a non-empty array`);
        unsettledOk = false;
      } else if (isCount(u.attempts) && (u.attempt_seconds as unknown[]).length !== u.attempts) {
        errors.push(`${label}.attempt_seconds must carry one entry per attempt`);
        unsettledOk = false;
      } else if (!(u.attempt_seconds as unknown[]).every((s) => Number.isInteger(s) && (s as number) > 0)) {
        errors.push(`${label}.attempt_seconds must all be positive integers`);
        unsettledOk = false;
      }
      if (typeof u.why !== "string" || u.why.trim() === "") {
        errors.push(`${label}.why must be a non-empty reason`);
        unsettledOk = false;
      }
      if (typeof u.lane === "string" && typeof u.question_id === "string") {
        const key = `${u.lane}::${u.question_id}`;
        if (unsettledKeys.has(key)) {
          errors.push(`${label} duplicates lane ${u.lane} question ${u.question_id}`);
          unsettledOk = false;
        }
        unsettledKeys.add(key);
        unsettled.push(u);
      }
    });
  }

  // ---- per-question rows ----
  type Row = Record<string, unknown>;
  const rows = v.questions;
  let rowsOk = false;
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push("questions must be a non-empty array of per-question rows");
  } else {
    rowsOk = true;
    const seen = new Set<string>();
    (rows as Row[]).forEach((rawRow, i) => {
      const label = `questions[${i}]`;
      if (typeof rawRow !== "object" || rawRow === null || Array.isArray(rawRow)) {
        errors.push(`${label} must be an object`);
        rowsOk = false;
        return;
      }
      const row = rawRow as Row;
      if (typeof row.question_id !== "string" || row.question_id === "") {
        errors.push(`${label}.question_id must be a non-empty string`);
        rowsOk = false;
      }
      if (typeof row.category !== "string" || row.category === "") {
        errors.push(`${label}.category must be a non-empty string`);
        rowsOk = false;
      }
      const lane = row.lane;
      if (typeof lane !== "string" || !LANES.includes(lane as Lane)) {
        errors.push(`${label}.lane must be one of ${LANES.join(", ")}`);
        rowsOk = false;
      }
      if (typeof row.question_id === "string" && typeof lane === "string") {
        const key = `${lane}::${row.question_id}`;
        if (seen.has(key)) {
          errors.push(`${label}: duplicate cell (${lane}, ${String(row.question_id)})`);
          rowsOk = false;
        }
        seen.add(key);
      }
      if (typeof row.trace_ref !== "string" || (typeof row.question_id === "string" && typeof lane === "string" && row.trace_ref !== traceRefFor(lane as Lane, row.question_id))) {
        errors.push(`${label}.trace_ref must be results/runs/<lane>/<question>.json for this row`);
        rowsOk = false;
      }
      if (typeof row.score_ref !== "string" || (typeof row.question_id === "string" && typeof lane === "string" && row.score_ref !== scoreRefFor(lane as Lane, row.question_id))) {
        errors.push(`${label}.score_ref must be results/scores/<lane>/<question>.json for this row`);
        rowsOk = false;
      }
      const absence = row.category === ABSENCE_CATEGORY;
      for (const name of ["passages_exact_ratio", "records_found_ratio"]) {
        const ratio = row[name];
        if (absence && ratio !== null) {
          errors.push(`${label}.${name} must be null for absence questions`);
          rowsOk = false;
        } else if (!absence && !isRatioInUnit(ratio)) {
          errors.push(`${label}.${name} must be a number in [0,1] for non-absence questions`);
          rowsOk = false;
        }
      }
      if (typeof row.judge_verdict !== "string" || !VERDICTS.includes(row.judge_verdict as (typeof VERDICTS)[number])) {
        errors.push(`${label}.judge_verdict must be one of ${VERDICTS.join(", ")}`);
        rowsOk = false;
      }
      if (typeof row.judge_model !== "string" || row.judge_model === "") {
        errors.push(`${label}.judge_model must be a non-empty string`);
        rowsOk = false;
      } else if (typeof judgeModel === "object" && judgeModel !== null) {
        const jm = judgeModel as Record<string, string>;
        if (row.judge_model !== `${jm.provider}/${jm.model}`) {
          errors.push(`${label}.judge_model disagrees with the rollup's judge_model`);
          rowsOk = false;
        }
      }
      if (absence && typeof row.absence_stated !== "boolean") {
        errors.push(`${label}.absence_stated must be a boolean for absence questions`);
        rowsOk = false;
      }
      if (!absence && row.absence_stated !== null) {
        errors.push(`${label}.absence_stated must be null for non-absence questions`);
        rowsOk = false;
      }
      const retrieval = row.retrieval;
      if (
        typeof retrieval !== "object" ||
        retrieval === null ||
        Array.isArray(retrieval) ||
        !isCount((retrieval as Row).steps) ||
        (retrieval as Row).steps < 1 ||
        !isCount((retrieval as Row).error_steps) ||
        !isCount((retrieval as Row).result_bytes) ||
        ((retrieval as Row).error_steps as number) > ((retrieval as Row).steps as number)
      ) {
        errors.push(`${label}.retrieval must carry integer steps (≥1), error_steps (≤ steps), result_bytes (≥0)`);
        rowsOk = false;
      }
    });
    // Every lane must cover the identical question sequence — complete,
    // cross-lane-aligned coverage — and the row total must be lanes × gold
    // questions.
    const goldSetOk =
      typeof goldSet === "object" && goldSet !== null && isCount((goldSet as Record<string, unknown>).questions);
    if (rowsOk && lanesOk && goldSetOk) {
      const questionsCount = (goldSet as Record<string, unknown>).questions as number;
      const unsettledKeys = new Set(unsettled.map((u) => `${String(u.lane)}::${String(u.question_id)}`));
      // coverage: settled rows + recorded non-settlements == lanes × gold
      if (rows.length + unsettled.length !== (v.lanes as string[]).length * questionsCount) {
        errors.push(
          "questions rows plus unsettled records must equal lanes × gold_set.questions — every cell is settled or recorded",
        );
      }
      // no row may exist for a cell the record calls unsettled
      for (const row of rows as Row[]) {
        if (unsettledKeys.has(`${String(row.lane)}::${String(row.question_id)}`)) {
          errors.push(`row ${String(row.lane)} ${String(row.question_id)} exists but the record calls it unsettled`);
          rowsOk = false;
        }
      }
      // the gold-order union: first-appearance order across all lanes (every
      // lane's rows follow gold order, so the union does too)
      const unionSeq: string[] = [];
      for (const row of rows as Row[]) {
        const id = String(row.question_id);
        if (!unionSeq.includes(id)) unionSeq.push(id);
      }
      // every gold question appears at least once across settled rows and
      // recorded non-settlements, and nothing else does — an unknown id in
      // the record, or a question no lane covers, breaks the gold set
      const covered = new Set([...unionSeq, ...unsettled.map((u) => String(u.question_id))]);
      if (covered.size !== questionsCount) {
        errors.push(
          `settled rows plus unsettled records must cover exactly gold_set.questions distinct questions (got ${covered.size})`,
        );
        rowsOk = false;
      }
      for (const lane of LANES) {
        const ids = (rows as Row[]).filter((r) => r.lane === lane).map((r) => String(r.question_id));
        const recorded = unsettled.filter((u) => u.lane === lane).length;
        if (ids.length + recorded !== questionsCount) {
          errors.push(`lane ${lane}: settled rows plus recorded non-settlements must equal gold_set.questions`);
          rowsOk = false;
        }
        // each lane's settled rows must follow the shared gold order
        let at = 0;
        for (const id of ids) {
          const found = unionSeq.indexOf(id, at);
          if (found < 0) {
            errors.push(`lane ${lane}: row sequence departs from the shared gold order at ${id}`);
            rowsOk = false;
            break;
          }
          at = found + 1;
        }
      }
    }
  }

  // ---- aggregate cells, cross-checked against the rows ----
  const checkCells = (rawCells: unknown, label: string): Row[] | null => {
    if (!Array.isArray(rawCells) || rawCells.length === 0) {
      errors.push(`${label} must be a non-empty array of cells`);
      return null;
    }
    rawCells.forEach((rawCell, i) => {
      const cellLabel = `${label}[${i}]`;
      if (typeof rawCell !== "object" || rawCell === null || Array.isArray(rawCell)) {
        errors.push(`${cellLabel} must be an object`);
        return;
      }
      const cell = rawCell as Row;
      if (typeof cell.lane !== "string" || !LANES.includes(cell.lane as Lane)) {
        errors.push(`${cellLabel}.lane must be one of ${LANES.join(", ")}`);
      }
      if (typeof cell.category !== "string" || cell.category === "") {
        errors.push(`${cellLabel}.category must be a non-empty string`);
      }
      const absence = cell.category === ABSENCE_CATEGORY;
      if (!absence && !isRatioInUnit(cell.judged_correct_ratio)) {
        errors.push(`${cellLabel}.judged_correct_ratio must be a number in [0,1]`);
      }
      for (const name of ["judge_correct", "judge_partial", "judge_incorrect"]) {
        if (!isCount(cell[name])) errors.push(`${cellLabel}.${name} must be a non-negative integer`);
      }
      if (
        isCount(cell.judge_correct) &&
        isCount(cell.judge_partial) &&
        isCount(cell.judge_incorrect) &&
        isCount(cell.n) &&
        cell.judge_correct + cell.judge_partial + cell.judge_incorrect !== cell.n
      ) {
        errors.push(`${cellLabel}: judge counts must sum to n — every suite cell is judged`);
      }
      for (const name of ["passages_exact_ratio_mean", "records_found_ratio_mean"]) {
        if (absence && cell[name] !== null) {
          errors.push(`${cellLabel}.${name} must be null for the absence category`);
        }
        if (!absence && cell[name] !== null && !isRatioInUnit(cell[name])) {
          errors.push(`${cellLabel}.${name} must be null or a number in [0,1]`);
        }
      }
      if (absence) {
        if (!isCount(cell.absence_stated_count)) {
          errors.push(`${cellLabel}.absence_stated_count must be a non-negative integer for the absence category`);
        }
        if (!isRatioInUnit(cell.absence_stated_ratio)) {
          errors.push(`${cellLabel}.absence_stated_ratio must be a number in [0,1] for the absence category`);
        }
      } else {
        if (cell.absence_stated_count !== null || cell.absence_stated_ratio !== null) {
          errors.push(`${cellLabel}: absence fields must be null outside the absence category`);
        }
      }
    });
    return rawCells as Row[];
  };

  const cells = checkCells(v.cells, "cells");
  const laneTotals = checkCells(v.lane_totals, "lane_totals");
  if (cells !== null && lanesOk) {
    const expected = [...LANES].flatMap((lane) => categories.map((category) => `${lane}::${category}`));
    const actual = cells.map((c) => `${String(c.lane)}::${String(c.category)}`);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push("cells must cover every lane × gold category, in pinned lane-major order");
    }
  }
  if (laneTotals !== null && lanesOk) {
    const actual = laneTotals.map((c) => String(c.lane));
    if (JSON.stringify(actual) !== JSON.stringify([...LANES])) {
      errors.push("lane_totals must cover every lane in pinned order");
    }
    if (laneTotals.some((c) => c.category !== "all")) {
      errors.push('lane_totals cells must carry category "all"');
    }
  }

  // Cross-check aggregates against the rows: means, counts, ratios, retrieval.
  if (rowsOk && cells !== null) {
    const rowsArr = rows as Row[];
    for (const cell of [...cells, ...((laneTotals ?? []) as Row[])]) {
      const lane = String(cell.lane);
      const category = String(cell.category);
      const cellRows = rowsArr.filter((r) => r.lane === lane && (category === "all" || r.category === category));
      const absence = category === ABSENCE_CATEGORY;
      if (isCount(cell.n) && cell.n !== cellRows.length) {
        errors.push(`cell (${lane}, ${category}): n disagrees with the row count`);
      }
      for (const [name, key] of [
        ["passages_exact_ratio_mean", "passages_exact_ratio"],
        ["records_found_ratio_mean", "records_found_ratio"],
      ] as const) {
        if (absence) continue;
        const nums = cellRows.map((r) => r[key]).filter((x): x is number => typeof x === "number");
        const expected = nums.length === 0 ? null : round3(nums.reduce((s, x) => s + x, 0) / nums.length);
        if (cell[name] !== expected) {
          errors.push(`cell (${lane}, ${category}).${name} does not match its rows`);
        }
      }
      for (const [name, verdict] of [
        ["judge_correct", "correct"],
        ["judge_partial", "partial"],
        ["judge_incorrect", "incorrect"],
      ] as const) {
        const expected = cellRows.filter((r) => r.judge_verdict === verdict).length;
        if (isCount(cell[name]) && cell[name] !== expected) {
          errors.push(`cell (${lane}, ${category}).${name} does not match its rows`);
        }
      }
      if (isRatioInUnit(cell.judged_correct_ratio) && cellRows.length > 0) {
        const correct = cellRows.filter((r) => r.judge_verdict === "correct").length;
        if (cell.judged_correct_ratio !== round3(correct / cellRows.length)) {
          errors.push(`cell (${lane}, ${category}).judged_correct_ratio does not match its rows`);
        }
      }
      if (absence && isCount(cell.absence_stated_count) && isRatioInUnit(cell.absence_stated_ratio)) {
        const absenceRows = cellRows.filter((r) => r.absence_stated !== null);
        const stated = absenceRows.filter((r) => r.absence_stated === true).length;
        if (cell.absence_stated_count !== stated) {
          errors.push(`cell (${lane}, ${category}).absence_stated_count does not match its rows`);
        }
        if (absenceRows.length > 0 && cell.absence_stated_ratio !== round3(stated / absenceRows.length)) {
          errors.push(`cell (${lane}, ${category}).absence_stated_ratio does not match its rows`);
        }
      }
    }
  }

  if (Array.isArray(v.lane_retrieval)) {
    if (lanesOk && JSON.stringify(v.lane_retrieval.map((r) => (r as Row)?.lane)) !== JSON.stringify([...LANES])) {
      errors.push("lane_retrieval must cover every lane in pinned order");
    }
    (v.lane_retrieval as Row[]).forEach((r, i) => {
      if (typeof r.steps_mean !== "number" || !Number.isFinite(r.steps_mean) || r.steps_mean < 0) {
        errors.push(`lane_retrieval[${i}].steps_mean must be a non-negative number`);
      }
      if (!isCount(r.error_steps_total)) errors.push(`lane_retrieval[${i}].error_steps_total must be a non-negative integer`);
      if (typeof r.result_bytes_mean !== "number" || !Number.isFinite(r.result_bytes_mean) || r.result_bytes_mean < 0) {
        errors.push(`lane_retrieval[${i}].result_bytes_mean must be a non-negative number`);
      }
    });
    if (rowsOk) {
      const rowsArr = rows as Row[];
      (v.lane_retrieval as Row[]).forEach((r, i) => {
        const lane = String(r.lane);
        const laneRows = rowsArr.filter((x) => x.lane === lane);
        if (laneRows.length === 0) return;
        const retrievalRows = laneRows.map((x) => x.retrieval as Row);
        const stepsMean = round3(retrievalRows.reduce((s, x) => s + (x.steps as number), 0) / laneRows.length);
        const bytesMean = round3(retrievalRows.reduce((s, x) => s + (x.result_bytes as number), 0) / laneRows.length);
        const errorsTotal = retrievalRows.reduce((s, x) => s + (x.error_steps as number), 0);
        if (r.steps_mean !== stepsMean) errors.push(`lane_retrieval[${i}].steps_mean does not match its rows`);
        if (r.result_bytes_mean !== bytesMean) errors.push(`lane_retrieval[${i}].result_bytes_mean does not match its rows`);
        if (isCount(r.error_steps_total) && r.error_steps_total !== errorsTotal) {
          errors.push(`lane_retrieval[${i}].error_steps_total does not match its rows`);
        }
      });
    }
  } else {
    errors.push("lane_retrieval must be an array");
  }

  // Unconditional and whole-document, the trace-schema pattern: a leak must
  // be reported even alongside other errors — every field here is internally
  // cross-checked, so a conditional check could never fire on a row mutant.
  if (containsHomeRoot(JSON.stringify(value))) {
    errors.push("rollup contains an absolute home path — leak invariant");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rollup: value as Rollup };
}

// ---------------------------------------------------------------------------
// ISC-26: the human render — a deterministic function of the rollup. The
// committed results/rollup.md must byte-match renderRollupMd(rollup).
// ---------------------------------------------------------------------------

function verdictCell(cell: RollupCell): string {
  return `${cell.judge_correct}/${cell.judge_partial}/${cell.judge_incorrect} · ${cell.judged_correct_ratio.toFixed(2)}`;
}

function evidenceCell(cell: RollupCell): string {
  if (cell.category === ABSENCE_CATEGORY) {
    return `stated ${cell.absence_stated_count}/${cell.n} · ${(cell.absence_stated_ratio ?? 0).toFixed(2)}`;
  }
  const passages = cell.passages_exact_ratio_mean ?? 0;
  const records = cell.records_found_ratio_mean ?? 0;
  return `${passages.toFixed(2)} / ${records.toFixed(2)}`;
}

function cellFor(rollup: Rollup, lane: Lane, category: string, cells: RollupCell[]): RollupCell {
  const cell = cells.find((c) => c.lane === lane && c.category === category);
  if (cell === undefined) throw new Error(`renderRollupMd: no cell for (${lane}, ${category})`);
  return cell;
}

/** Renders the committed human-readable rollup — byte-deterministic. */
export function renderRollupMd(rollup: Rollup): string {
  const categories = rollup.gold_set.categories;
  const lines: string[] = [];
  lines.push("# Suite rollup — per-lane × per-category results");
  lines.push("");
  lines.push(`> ${rollup.framing}`);
  lines.push("");
  lines.push(`Gold set: ${rollup.gold_set.questions} questions across ${categories.length} categories. ` +
    `Lanes: ${rollup.lanes.join(", ")}. Architecture is the variable; the model is the constant.`);
  if (rollup.unsettled.length > 0) {
    lines.push("");
    lines.push(`Settled cells: ${rollup.questions.length} of ${rollup.lanes.length * rollup.gold_set.questions} ` +
      `(${rollup.unsettled.length} recorded non-settlement(s), listed at the end — their lanes' means are over settled cells only).`);
  }
  lines.push("");
  lines.push(`Agent-under-test (pinned): ${rollup.model.provider}/${rollup.model.model}. ` +
    `Blind judge (pinned, different family): ${rollup.judge_model.provider}/${rollup.judge_model.model}. ` +
    `Harness: ${rollup.harness.name} ${rollup.harness.versions.join(", ")}.`);
  lines.push("");
  lines.push("Evidence ratios are deterministic and re-derive from the committed traces; " +
    "judge verdicts are receipts recorded at score time. Every aggregate below cross-checks " +
    "against the per-question rows in [rollup.json](rollup.json).");
  lines.push("");
  lines.push("## Judged answers — correct/partial/incorrect · correct ratio");
  lines.push("");
  lines.push(`| lane | ${categories.join(" | ")} | all |`);
  lines.push(`|---|${categories.map(() => "---").join("|")}|---|`);
  for (const lane of rollup.lanes) {
    const cells = categories.map((c) => verdictCell(cellFor(rollup, lane, c, rollup.cells))).join(" | ");
    const total = verdictCell(cellFor(rollup, lane, "all", rollup.lane_totals));
    lines.push(`| ${lane} | ${cells} | ${total} |`);
  }
  lines.push("");
  lines.push("## Evidence fidelity — passage-exact / record-found means " +
    `(absence column: stated "no evidence found" count · ratio)`);
  lines.push("");
  lines.push(`| lane | ${categories.join(" | ")} | all |`);
  lines.push(`|---|${categories.map(() => "---").join("|")}|---|`);
  for (const lane of rollup.lanes) {
    const cells = categories.map((c) => evidenceCell(cellFor(rollup, lane, c, rollup.cells))).join(" | ");
    const total = evidenceCell(cellFor(rollup, lane, "all", rollup.lane_totals));
    lines.push(`| ${lane} | ${cells} | ${total} |`);
  }
  lines.push("");
  lines.push("## Retrieval cost per lane");
  lines.push("");
  lines.push("| lane | mean steps | mean result bytes | error steps |");
  lines.push("|---|---|---|---|");
  for (const r of rollup.lane_retrieval) {
    lines.push(`| ${r.lane} | ${r.steps_mean.toFixed(1)} | ${r.result_bytes_mean.toFixed(0)} | ${r.error_steps_total} |`);
  }
  lines.push("");
  if (rollup.unsettled.length > 0) {
    lines.push("## Recorded non-settlements — measured, not silent");
    lines.push("");
    lines.push("| lane | question | attempts | attempt seconds | why it never settled |");
    lines.push("|---|---|---|---|---|");
    for (const u of rollup.unsettled) {
      lines.push(`| ${u.lane} | ${u.question_id} | ${u.attempts} | ${u.attempt_seconds.join(", ")} | ${u.why} |`);
    }
    lines.push("");
  }
  lines.push(`Per-question receipts (every ratio, verdict, and byte count): [rollup.json](rollup.json).`);
  lines.push("");
  return lines.join("\n");
}
