// runner/trace.ts — the neutral, harness-agnostic run trace (F3, ISC-16; v2
// after the OpenCode review of 85c0c2a).
//
// One JSON document per lab run: the question, the lane, the pinned model, the
// exact prompt the agent received, EVERY tool call with its complete result
// text as the harness delivered it (evidence is graded from tool results
// alone — never summaries), and the final assistant answer. The schema
// deliberately knows nothing about any particular harness: `harness` records
// which one produced the run, including the argv that can re-derive it, and
// any harness able to drive the lanes could emit the same shape. F4's grader
// and F5's committed suite artifacts consume this schema.
//
// v2 hardening (review findings 2/3/5/7/8/12/14): steps must be non-empty
// (the protocol requires retrieval before answering); every called tool must
// be in the lane's declared surface; timestamps must be strict ISO 8601 and
// ordered; harness argv is recorded so any artifact can be re-derived; leak
// checks run unconditionally and match bare home roots.
//
// Full-results invariant, precisely: a step's result_text must be the
// complete tool result the harness delivered — the harness-side mid-result
// elision marker ("…N chars truncated…", what pi inserts into >20 KB MCP
// results) is REJECTED. Native tools may apply their own line-length and
// size caps (pi's grep/read truncate long lines with "[truncated]" and a
// notice) — that is the tool's actual output, a real and graded property of
// the direct lane's toolset, and therefore allowed and honest to record.

export const TRACE_SCHEMA = "knowledge-access-lab/trace@2";

export const LANES = ["rag", "wiki", "graph", "graph-seed", "direct"] as const;
export type Lane = (typeof LANES)[number];

export type TraceStep = {
  /** 1-based execution order */
  seq: number;
  /** lane-local tool name — must be in the trace's lane_tools */
  tool: string;
  /** the tool name the harness itself reported */
  harness_tool: string;
  /** arguments exactly as the agent passed them */
  arguments: Record<string, unknown>;
  /** complete result text as the harness delivered it — the grader's evidence */
  result_text: string;
  is_error: boolean;
  duration_ms: number;
};

export type Trace = {
  schema: typeof TRACE_SCHEMA;
  question_id: string;
  category: string;
  question_text: string;
  lane: Lane;
  /** the lane's tool surface as it actually answered on the wire for this run */
  lane_tools: string[];
  model: { provider: string; model: string };
  harness: { name: string; version: string; argv: string[] };
  /** the exact prompt string the agent-under-test received */
  prompt: string;
  steps: TraceStep[];
  final_answer: string;
  started_at: string;
  finished_at: string;
};

export type TraceCheck = { ok: true; trace: Trace } | { ok: false; errors: string[] };

// Harness-side mid-result elision — never allowed in a trace.
const RESULT_ELISION_MARKER = "chars truncated";

// Leak invariant, defense in depth: the repo-wide leak scan polices committed
// files; this check refuses to validate any trace carrying a home root, so a
// fresh run cannot write one either. Matches bare roots (`…/Users/name` at
// end-of-string) as well as paths. The regex is written so no literal home
// path appears in this source.
const HOME_ROOT = /\/(?:Users|home|root)\/[A-Za-z0-9._-]+/;

/** Leak invariant check shared by every committed artifact schema (trace, score). */
export function containsHomeRoot(text: string): boolean {
  return HOME_ROOT.test(text);
}

// ISO 8601 as written by Date.toISOString(): YYYY-MM-DDTHH:MM:SS(.sss)Z.
const ISO_STRICT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Strict ISO 8601 as written by Date.toISOString() — shared by every artifact schema. */
export function isStrictIso(value: string): boolean {
  return ISO_STRICT.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateTrace(value: unknown): TraceCheck {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["trace must be a JSON object"] };
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

  if (v.schema !== TRACE_SCHEMA) errors.push(`schema must be "${TRACE_SCHEMA}"`);
  stringField("question_id", 1);
  stringField("category", 1);
  stringField("question_text", 1);
  const lane = v.lane;
  if (typeof lane !== "string" || !LANES.includes(lane as Lane)) {
    errors.push(`lane must be one of ${LANES.join(", ")}`);
  }

  const stringPair = (
    containerName: string,
    a: unknown,
    b: unknown,
    aName: string,
    bName: string,
  ): { a: string; b: string } | null => {
    if (typeof a !== "string" || typeof b !== "string" || a === "" || b === "") {
      errors.push(`${containerName} must be an object with non-empty ${aName} and ${bName} strings`);
      return null;
    }
    return { a, b };
  };
  const model = v.model;
  stringPair("model", (model as Record<string, unknown> | null)?.provider, (model as Record<string, unknown> | null)?.model, "provider", "model");
  const harness = v.harness;
  const harnessPair =
    typeof harness === "object" && harness !== null && !Array.isArray(harness)
      ? stringPair("harness", (harness as Record<string, unknown>).name, (harness as Record<string, unknown>).version, "name", "version")
      : (errors.push("harness must be an object with non-empty name and version strings"), null);
  if (harnessPair !== null) {
    const argv = (harness as Record<string, unknown>).argv;
    if (!Array.isArray(argv) || argv.length === 0 || !argv.every((x) => typeof x === "string" && x.length > 0)) {
      errors.push("harness.argv must be a non-empty array of non-empty strings");
    }
  }

  stringField("prompt", 1);
  stringField("final_answer", 1);
  const startedAt = stringField("started_at", 1);
  const finishedAt = stringField("finished_at", 1);
  if (startedAt !== null && !isStrictIso(startedAt)) errors.push("started_at must be a strict ISO 8601 timestamp");
  if (finishedAt !== null && !isStrictIso(finishedAt)) errors.push("finished_at must be a strict ISO 8601 timestamp");
  if (startedAt !== null && finishedAt !== null && isStrictIso(startedAt) && isStrictIso(finishedAt) && finishedAt < startedAt) {
    errors.push("finished_at must not precede started_at");
  }

  let laneTools: string[] | null = null;
  if (!Array.isArray(v.lane_tools) || v.lane_tools.length === 0) {
    errors.push("lane_tools must be a non-empty array");
  } else if (!v.lane_tools.every((t) => typeof t === "string" && t.length > 0)) {
    errors.push("lane_tools entries must be non-empty strings");
  } else {
    laneTools = v.lane_tools as string[];
  }

  if (!Array.isArray(v.steps) || v.steps.length === 0) {
    errors.push("steps must be a non-empty array — the protocol requires retrieval before answering");
  } else if (laneTools !== null) {
    (v.steps as unknown[]).forEach((rawStep, i) => {
      const label = `steps[${i}]`;
      if (typeof rawStep !== "object" || rawStep === null || Array.isArray(rawStep)) {
        errors.push(`${label} must be an object`);
        return;
      }
      const step = rawStep as Record<string, unknown>;
      if (step.seq !== i + 1) errors.push(`${label}.seq must be ${i + 1} (1-based execution order)`);
      for (const name of ["tool", "harness_tool"]) {
        if (typeof step[name] !== "string" || (step[name] as string).length === 0) {
          errors.push(`${label}.${name} must be a non-empty string`);
        }
      }
      if (typeof step.tool === "string" && !laneTools!.includes(step.tool)) {
        errors.push(`${label}.tool "${step.tool}" is not in the lane's lane_tools — out-of-lane evidence`);
      }
      if (typeof step.arguments !== "object" || step.arguments === null || Array.isArray(step.arguments)) {
        errors.push(`${label}.arguments must be an object`);
      }
      const resultText = step.result_text;
      if (typeof resultText !== "string") {
        errors.push(`${label}.result_text must be a string`);
      } else if (resultText.includes(RESULT_ELISION_MARKER)) {
        errors.push(`${label}.result_text carries a harness elision marker — complete results only`);
      }
      if (typeof step.is_error !== "boolean") errors.push(`${label}.is_error must be a boolean`);
      if (typeof step.duration_ms !== "number" || !Number.isFinite(step.duration_ms) || step.duration_ms < 0) {
        errors.push(`${label}.duration_ms must be a non-negative number`);
      }
    });
  }

  // Unconditional (a leak alongside other errors must still be reported) and
  // whole-document: every string field, including arguments and argv, is
  // covered by serializing the full value.
  if (HOME_ROOT.test(JSON.stringify(value))) {
    errors.push("trace contains an absolute home path — leak invariant");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, trace: value as Trace };
}
