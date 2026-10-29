// runner/score.ts — deterministic evidence scoring over committed traces
// (F4, ISC-18) + the score artifact schema (ISC-20; v2 after the minimax
// second review of 39a7a58, findings 1/2/4/6/10).
//
// The lab's headline metric is evidence quality, and it is measured WITHOUT a
// judge and without vibes: for every gold citation (record path + exact
// passage), did the run's tool results carry that passage, bound to that
// record? The scorer is a pure function of the committed trace and the
// frozen gold set — anyone re-running it gets the same numbers.
//
// v2 semantics (measurement validity fixes):
//
// Record-bound evidence (review finding 1): a passage or record credit must
// be earned BY THE CITED RECORD, not by free-floating bytes. A tree listing
// that dumps every path (wiki `list`) credits nothing; a passage that
// happens to exist byte-identical in another record does not credit the
// cited record unless it arrived alongside that record's path or via a call
// naming it. Formally, for a non-error step:
//   passage_exact  := the step's transport-normalized result contains the
//                     passage AND (the raw result carries the record path OR
//                     the step's arguments name the record exactly)
//   record_found   := arguments name the record exactly, OR the raw result
//                     carries the record path together with the passage —
//                     content-bearing retrieval, never a bare pointer.
// Residual approximation, documented: when a passage exists in records X
// and Y and a result pairs it with Y's path only, record X is not credited
// for record_found (correct) but the passage bytes were still retrieved;
// multi-item search results cannot always attribute an item to one record.
//
// Transport normalization (review finding 2): raw substring matching made
// identical evidence score differently by lane — RAG serializes passages
// into JSON (newlines escaped), direct grep prefixes every line with
// "path:NN:", and the direct lane's throwaway corpus sandbox exposes the
// corpus to native tools under an absolute "<tmp>/corpus/" root (pi's ls
// prints absolute paths, so the agent reads and greps by absolute path). The
// scorer unescapes the common JSON string escapes, strips per-line source
// prefixes, and — added in F5, same principle — strips the sandbox's
// absolute corpus prefix from path arguments before exact record matching,
// so read(path="<tmp>/corpus/people/x.md") credits exactly like
// get(path="people/x.md"). The metric measures retrieved evidence, not
// transport encoding or where the sandbox happened to live. Byte-fidelity is
// otherwise exact; the README does not claim more.
//
// Only successful tool results are evidence — a failed call is not
// retrieval, whatever bytes its error result carries.
//
// Absence questions carry no citations: evidence_expected is false, the
// ratios are null, and `absence_stated` reports exactly one thing — whether
// the answer states the no-evidence finding (phrase presence,
// case-insensitive). It does NOT certify the absence of invented facts;
// invention is the blind judge's axis (review finding 6 fixed by honest
// scoping, not by overclaiming).

import { containsHomeRoot, isStrictIso, LANES, type Lane } from "./trace";

export const SCORE_SCHEMA = "knowledge-access-lab/score@2";

export type CitationScore = {
  record: string;
  passage: string;
  passage_exact: boolean;
  /** step seqs whose normalized result carries the passage bound to the record */
  passage_in_steps: number[];
  record_found: boolean;
  /** step seqs whose arguments name the record exactly, or whose result
   * carries the record path together with the passage */
  record_in_steps: number[];
};

export type EvidenceScore = {
  evidence_expected: boolean;
  citations: CitationScore[];
  /** share of gold citations retrieved byte-exactly (transport-normalized); null for absence questions */
  passages_exact_ratio: number | null;
  /** share of gold records with content-bearing retrieval; null for absence questions */
  records_found_ratio: number | null;
};

export type JudgeVerdict = {
  verdict: "correct" | "partial" | "incorrect";
  rationale: string;
};

export type JudgeReceipt = JudgeVerdict & {
  model: { provider: string; model: string };
  blind: true;
  judged_at: string;
};

export type Score = {
  schema: typeof SCORE_SCHEMA;
  question_id: string;
  category: string;
  lane: Lane;
  /** repo-relative path of the scored trace */
  trace_ref: string;
  evidence: EvidenceScore;
  retrieval: { steps: number; error_steps: number; result_bytes: number };
  /** for absence questions: did the answer state the no-evidence finding */
  absence_stated: boolean | null;
  judge?: JudgeReceipt;
  scored_at: string;
};

export type ScoreCheck = { ok: true; score: Score } | { ok: false; errors: string[] };

export type TraceLike = {
  steps: { seq: number; result_text: string; is_error: boolean; arguments?: Record<string, unknown> }[];
  final_answer: string;
};
export type GoldCitation = { record: string; passage: string };

/**
 * Unescapes the common JSON string escapes (RAG results serialize passages
 * into JSON) and strips per-line "path:NN:" source prefixes (direct grep),
 * so passage matching measures evidence rather than transport encoding.
 */
export function transportNormalize(text: string): string {
  let out = text;
  out = out
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
  out = out
    .split("\n")
    .map((line) => line.replace(/^[^\s:]+\.(?:md|MD):\d+: ?/, ""))
    .join("\n");
  return out;
}

/**
 * Exact-path argument matching (first review, finding 1): a record is named
 * by a call only when an argument value IS the record path — never when the
 * path is merely a substring of some other value. Two prefix strips keep
 * that exact while acknowledging transport: a leading "./" (any lane), and
 * the direct lane's throwaway-sandbox absolute "<tmp>/corpus/" root (F5) —
 * the sandbox is where the corpus lives for native tools, so an absolute
 * path into it names the same record the citation cites. The remainder must
 * still equal the citation record exactly.
 */
function argsNameRecord(args: Record<string, unknown>, record: string): boolean {
  return Object.values(args).some((v) => {
    if (typeof v !== "string") return false;
    let p = v.replace(/^\.\//, "");
    if (p.startsWith("/")) p = p.replace(/^\/.*\/corpus\//, "");
    return p === record;
  });
}

function ratio(hit: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((hit / total) * 1000) / 1000;
}

/** ISC-18: pure, deterministic evidence scoring of a run trace. */
export function scoreEvidence(trace: TraceLike, citations: GoldCitation[]): EvidenceScore {
  const citationScores: CitationScore[] = citations.map((c) => {
    const passageInSteps: number[] = [];
    const recordInSteps: number[] = [];
    for (const step of trace.steps) {
      if (step.is_error) continue;
      const normalized = transportNormalize(step.result_text);
      const hasPassage = normalized.includes(c.passage);
      const namesRecord = step.arguments !== undefined && argsNameRecord(step.arguments, c.record);
      const carriesPath = step.result_text.includes(c.record);
      if (hasPassage && (namesRecord || carriesPath)) passageInSteps.push(step.seq);
      if (namesRecord || (carriesPath && hasPassage)) recordInSteps.push(step.seq);
    }
    return {
      record: c.record,
      passage: c.passage,
      passage_exact: passageInSteps.length > 0,
      passage_in_steps: passageInSteps,
      record_found: recordInSteps.length > 0,
      record_in_steps: recordInSteps,
    };
  });
  const total = citationScores.length;
  return {
    evidence_expected: total > 0,
    citations: citationScores,
    passages_exact_ratio: ratio(citationScores.filter((c) => c.passage_exact).length, total),
    records_found_ratio: ratio(citationScores.filter((c) => c.record_found).length, total),
  };
}

/** The prompt-enforced absence phrase — deterministic stated-flag only. */
export const ABSENCE_PHRASE = "no evidence found";

export function absenceStated(category: string, finalAnswer: string): boolean | null {
  if (category !== "absence") return null;
  return finalAnswer.toLowerCase().includes(ABSENCE_PHRASE);
}

/** UTF-8 bytes, not UTF-16 code units (review finding 10). */
export function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function isRatioInUnit(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

const VERDICTS = ["correct", "partial", "incorrect"] as const;

export function validateScore(value: unknown): ScoreCheck {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["score must be a JSON object"] };
  }
  const v = value as Record<string, unknown>;

  const stringField = (name: string, min = 0): string | null => {
    const x = v[name];
    if (typeof x !== "string") {
      errors.push(`${name} must be a string`);
      return null;
    }
    if (x.length < min) errors.push(`${name} must not be empty`);
    return x;
  };

  if (v.schema !== SCORE_SCHEMA) errors.push(`schema must be "${SCORE_SCHEMA}"`);
  stringField("question_id", 1);
  const category = stringField("category", 1);
  const lane = v.lane;
  if (typeof lane !== "string" || !LANES.includes(lane as (typeof LANES)[number])) {
    errors.push(`lane must be one of ${LANES.join(", ")}`);
  }
  const traceRef = stringField("trace_ref", 1);
  // the lane segment may carry hyphens (graph-seed); the question id may not
  if (traceRef !== null && !/^results\/runs\/[a-z][a-z-]*\/[a-z0-9-]+\.json$/.test(traceRef)) {
    errors.push("trace_ref must be a repo-relative results/runs/<lane>/<question>.json path");
  }
  const scoredAt = stringField("scored_at", 1);
  if (scoredAt !== null && !isStrictIso(scoredAt)) errors.push("scored_at must be a strict ISO 8601 timestamp");

  const evidence = v.evidence;
  let citationsOk = false;
  let citations: Record<string, unknown>[] = [];
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    errors.push("evidence must be an object");
  } else {
    const e = evidence as Record<string, unknown>;
    if (typeof e.evidence_expected !== "boolean") errors.push("evidence.evidence_expected must be a boolean");
    if (!Array.isArray(e.citations)) {
      errors.push("evidence.citations must be an array");
    } else {
      citations = e.citations as Record<string, unknown>[];
      citationsOk = true;
      citations.forEach((c, i) => {
        const label = `evidence.citations[${i}]`;
        if (typeof c !== "object" || c === null || Array.isArray(c)) {
          errors.push(`${label} must be an object`);
          return;
        }
        if (typeof c.record !== "string" || c.record === "") errors.push(`${label}.record must be a non-empty string`);
        if (typeof c.passage !== "string" || c.passage === "") errors.push(`${label}.passage must be a non-empty string`);
        if (typeof c.passage_exact !== "boolean") errors.push(`${label}.passage_exact must be a boolean`);
        if (typeof c.record_found !== "boolean") errors.push(`${label}.record_found must be a boolean`);
        for (const key of ["passage_in_steps", "record_in_steps"]) {
          const arr = c[key];
          if (!Array.isArray(arr) || !arr.every((n) => typeof n === "number" && Number.isInteger(n) && n > 0)) {
            errors.push(`${label}.${key} must be an array of positive step numbers`);
          }
        }
        // cross-field integrity (review finding 4): a credit without its
        // receipts — or receipts without the credit — is a contradiction
        if (c.passage_exact === true && Array.isArray(c.passage_in_steps) && c.passage_in_steps.length === 0) {
          errors.push(`${label}: passage_exact is true but passage_in_steps is empty`);
        }
        if (c.passage_exact === false && Array.isArray(c.passage_in_steps) && c.passage_in_steps.length > 0) {
          errors.push(`${label}: passage_exact is false but passage_in_steps is non-empty`);
        }
        if (c.record_found === true && Array.isArray(c.record_in_steps) && c.record_in_steps.length === 0) {
          errors.push(`${label}: record_found is true but record_in_steps is empty`);
        }
        if (c.record_found === false && Array.isArray(c.record_in_steps) && c.record_in_steps.length > 0) {
          errors.push(`${label}: record_found is false but record_in_steps is non-empty`);
        }
      });
      const total = citations.length;
      const exact = citations.filter((c) => c.passage_exact === true).length;
      const found = citations.filter((c) => c.record_found === true).length;
      const expected = e.evidence_expected === true;
      if (category !== null && category === "absence" && total > 0) {
        errors.push("absence questions carry no gold citations — category and citations contradict");
      }
      if (expected && total === 0) errors.push("evidence.evidence_expected is true but citations is empty");
      if (!expected && total !== 0) errors.push("evidence.evidence_expected is false but citations is non-empty");
      if (expected && !isRatioInUnit(e.passages_exact_ratio)) errors.push("evidence.passages_exact_ratio must be a number in [0,1]");
      if (expected && !isRatioInUnit(e.records_found_ratio)) errors.push("evidence.records_found_ratio must be a number in [0,1]");
      if (!expected && (e.passages_exact_ratio !== null || e.records_found_ratio !== null)) {
        errors.push("evidence ratios must be null for absence questions");
      }
      if (expected && isRatioInUnit(e.passages_exact_ratio) && (e.passages_exact_ratio as number) !== ratio(exact, total)) {
        errors.push("evidence.passages_exact_ratio does not match the citation receipts");
      }
      if (expected && isRatioInUnit(e.records_found_ratio) && (e.records_found_ratio as number) !== ratio(found, total)) {
        errors.push("evidence.records_found_ratio does not match the citation receipts");
      }
    }
  }

  const retrieval = v.retrieval;
  if (
    typeof retrieval !== "object" ||
    retrieval === null ||
    Array.isArray(retrieval) ||
    typeof (retrieval as Record<string, unknown>).steps !== "number" ||
    !Number.isInteger((retrieval as Record<string, unknown>).steps) ||
    (retrieval as Record<string, unknown>).steps < 1 ||
    typeof (retrieval as Record<string, unknown>).error_steps !== "number" ||
    !Number.isInteger((retrieval as Record<string, unknown>).error_steps) ||
    (retrieval as Record<string, unknown>).error_steps < 0 ||
    typeof (retrieval as Record<string, unknown>).result_bytes !== "number" ||
    !Number.isInteger((retrieval as Record<string, unknown>).result_bytes) ||
    (retrieval as Record<string, unknown>).result_bytes < 0
  ) {
    errors.push("retrieval must carry integer steps (≥1), error_steps (≥0), and result_bytes (≥0)");
  } else if (
    (retrieval as Record<string, unknown>).error_steps > (retrieval as Record<string, unknown>).steps
  ) {
    errors.push("retrieval.error_steps cannot exceed retrieval.steps");
  }

  if (!("absence_stated" in v)) {
    errors.push("absence_stated is required (boolean for absence questions, null otherwise)");
  } else if (v.absence_stated !== null && typeof v.absence_stated !== "boolean") {
    errors.push("absence_stated must be a boolean or null");
  } else if (category !== null) {
    const isAbsence = category === "absence";
    if (isAbsence && v.absence_stated === null) {
      errors.push("absence_stated must be a boolean for absence questions");
    }
    if (!isAbsence && v.absence_stated !== null) {
      errors.push("absence_stated must be null for non-absence questions");
    }
  }

  if ("judge" in v && v.judge !== undefined) {
    const j = v.judge;
    if (typeof j !== "object" || j === null || Array.isArray(j)) {
      errors.push("judge must be an object");
    } else {
      const jj = j as Record<string, unknown>;
      if (typeof jj.verdict !== "string" || !VERDICTS.includes(jj.verdict as (typeof VERDICTS)[number])) {
        errors.push(`judge.verdict must be one of ${VERDICTS.join(", ")}`);
      }
      if (typeof jj.rationale !== "string" || jj.rationale === "") {
        errors.push("judge.rationale must be a non-empty string");
      }
      const jm = jj.model;
      if (
        typeof jm !== "object" ||
        jm === null ||
        typeof (jm as Record<string, unknown>).provider !== "string" ||
        typeof (jm as Record<string, unknown>).model !== "string" ||
        (jm as Record<string, unknown>).provider === "" ||
        (jm as Record<string, unknown>).model === ""
      ) {
        errors.push("judge.model must carry non-empty provider and model strings");
      }
      if (jj.blind !== true) errors.push("judge.blind must be true — the judge never sees lane data");
      const judgedAt = jj.judged_at;
      if (typeof judgedAt !== "string" || judgedAt === "" || !isStrictIso(judgedAt)) {
        errors.push("judge.judged_at must be a strict ISO 8601 timestamp");
      }
    }
  }

  if (errors.length === 0 && containsHomeRoot(JSON.stringify(value))) {
    errors.push("score contains an absolute home path — leak invariant");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, score: value as Score };
}
