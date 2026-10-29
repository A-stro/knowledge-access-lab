// runner/run.ts — production wiring behind the lab CLI (F3, ISC-15; v2
// after the OpenCode review of 85c0c2a).
//
// Everything here is importable, probe-driven code: the CLI (lab.ts) is a thin
// arg parser over runOne(), and probes/trace-lint.test.ts drives
// laneSurface()/harnessInput() directly so the probe cannot drift from the
// wiring that actually runs (review finding 6). Lane wiring reads .pi/mcp.json
// as the single source of truth for server names (finding 13).
//
// The direct lane runs inside a throwaway corpus-only sandbox (finding 1):
// its native tools could otherwise grep the answer key under questions/ and
// other lanes' traces under results/, contaminating the control group.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DIRECT_LANE_TOOLS } from "../lanes/direct/allowlist";
import { callLane } from "../probes/lib/lane-driver";
import { type HarnessDriver, type HarnessRunInput, type ModelPin } from "./harness";
import { LANES, TRACE_SCHEMA, type Lane, type Trace, validateTrace } from "./trace";
import { buildPrompt } from "./prompt";
import { judgeAnswer } from "./judge";
import { absenceStated, SCORE_SCHEMA, scoreEvidence, utf8Bytes, type Score, validateScore } from "./score";

const REPO_ROOT = join(import.meta.dir, "..");
const GOLD_FILE = join(REPO_ROOT, "questions", "gold.json");
const PIN_FILE = join(REPO_ROOT, "runner", "model-pin.json");
const MCP_CONFIG_FILE = join(REPO_ROOT, ".pi", "mcp.json");
const RUNS_DIR = join(REPO_ROOT, "results", "runs");
const SCORES_DIR = join(REPO_ROOT, "results", "scores");

/** Atomic artifact write (review finding 9): a killed run leaves either the
 * previous artifact or the new one — never a truncated JSON file. Shared by
 * traces, scores, and the F5 rollup writes. */
export function atomicWrite(path: string, contents: string): void {
  writeFileSync(`${path}.tmp`, contents);
  renameSync(`${path}.tmp`, path);
}

export type GoldQuestion = {
  id: string;
  category: string;
  question: string;
  gold_answer: string;
  citations: { record: string; passage: string }[];
};

let goldCache: GoldQuestion[] | null = null;

export function loadGold(): GoldQuestion[] {
  if (goldCache === null) {
    const gold = JSON.parse(readFileSync(GOLD_FILE, "utf8")) as GoldQuestion[];
    if (!Array.isArray(gold) || gold.length === 0) throw new Error("questions/gold.json is empty or malformed");
    goldCache = gold;
  }
  return goldCache;
}

export function readModelPin(): ModelPin {
  return readPin("primary");
}

/** The blind judge's pin — deliberately a different family than the agent-under-test. */
export function readJudgePin(): ModelPin {
  return readPin("judge");
}

export type PinKind = "primary" | "judge";

function readPin(kind: PinKind): ModelPin {
  const pin = JSON.parse(readFileSync(PIN_FILE, "utf8")) as Record<string, Record<string, unknown> | undefined>;
  const entry = pin[kind];
  if (
    typeof entry?.provider !== "string" ||
    typeof entry.model !== "string" ||
    entry.provider === "" ||
    entry.model === ""
  ) {
    throw new Error(`runner/model-pin.json has no usable ${kind} pin (provider + model strings)`);
  }
  return { provider: entry.provider, model: entry.model };
}

/** Lane wiring lives in .pi/mcp.json — this is the one committed source. */
type McpWiring = { mcpServers: Record<string, { command: string; args: string[] }> };

function readMcpWiring(): McpWiring {
  const wiring = JSON.parse(readFileSync(MCP_CONFIG_FILE, "utf8")) as McpWiring;
  if (
    typeof wiring !== "object" ||
    wiring === null ||
    typeof wiring.mcpServers !== "object" ||
    wiring.mcpServers === null
  ) {
    throw new Error(".pi/mcp.json is malformed (no mcpServers object)");
  }
  return wiring;
}

export type LaneSurface = {
  toolsSelector: string;
  mcpToolPrefix: string;
  disableMcp: boolean;
  laneTools: string[];
};

/**
 * The lane's tool surface for a run: the harness tool selector, the MCP wire
 * prefix, and the lane-local tool names — the last read live off the lane
 * server's tools/list, so traces record the surface that actually answered
 * (receipts, not claims). The three MCP server names come from .pi/mcp.json;
 * the direct lane needs no server.
 */
export async function laneSurface(lane: Lane): Promise<LaneSurface> {
  if (lane === "direct") {
    return {
      toolsSelector: DIRECT_LANE_TOOLS.join(","),
      mcpToolPrefix: "",
      disableMcp: true,
      laneTools: [...DIRECT_LANE_TOOLS].sort(),
    };
  }
  const wiring = readMcpWiring();
  const server = `${lane}-lane`;
  const entry = wiring.mcpServers[server];
  if (!entry || typeof entry.args?.[0] !== "string") {
    throw new Error(`.pi/mcp.json has no usable "${server}" entry — lane wiring is broken`);
  }
  const serverFile = entry.args[0];
  if (!existsSync(join(REPO_ROOT, serverFile))) {
    throw new Error(`.pi/mcp.json points "${server}" at a missing server: ${serverFile}`);
  }
  const replies = await callLane(serverFile, [{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
  const result = replies.get(1)?.result as { tools?: { name: string }[] } | undefined;
  const laneTools = (result?.tools ?? []).map((t) => t.name).sort();
  if (laneTools.length === 0) throw new Error(`lane server ${serverFile} reported no tools`);
  const wire = server.replace(/-/g, "_");
  return {
    toolsSelector: `mcp__${wire}__*`,
    mcpToolPrefix: `mcp__${wire}__`,
    disableMcp: false,
    laneTools,
  };
}

/** Production HarnessRunInput for a lane — the one place the wiring is built. */
export function harnessInput(lane: Lane, surface: LaneSurface, model: ModelPin, prompt: string, cwd?: string): HarnessRunInput {
  return {
    prompt,
    toolsSelector: surface.toolsSelector,
    disableMcp: surface.disableMcp,
    mcpToolPrefix: surface.mcpToolPrefix,
    laneTools: surface.laneTools,
    model,
    cwd,
  };
}

/**
 * The direct lane's containment (review finding 1): a throwaway directory
 * holding ONLY a copy of the corpus tree. Native tools can see nothing but
 * the corpus — no answer key under questions/, no other lanes' traces under
 * results/, no repo config. The harness process runs with cwd = the corpus
 * copy itself, so the model's relative paths are corpus-relative — the same
 * shape every MCP lane reports, and the answer key is unreachable.
 */
export function withCorpusSandbox<T>(fn: (corpusDir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "kal-corpus-"));
  cpSync(join(REPO_ROOT, "corpus"), join(dir, "corpus"), { recursive: true });
  return fn(join(dir, "corpus")).finally(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

/** ISC-15: one question through one lane → one schema-conformant trace.
 * `timeoutMs` is an operational harness deadline (default 20 min), pinned by
 * nothing in the artifact: a trace records the run's real duration, so a
 * slower lane (F6's seeded lane explores far more than the bare one) can be
 * given a longer deadline without changing what is measured. */
export async function runOne(
  driver: HarnessDriver,
  lane: Lane,
  questionId: string,
  timeoutMs?: number,
): Promise<Trace> {
  const question = loadGold().find((q) => q.id === questionId);
  if (!question) {
    throw new Error(
      `unknown question id: ${questionId} — gold-set ids: ${loadGold().map((q) => q.id).join(", ")}`,
    );
  }

  const model = readModelPin();
  const surface = await laneSurface(lane);
  const prompt = buildPrompt(question.question);

  console.log(`[lab] q ${question.id} (${question.category}) → lane ${lane} [${surface.laneTools.join(", ")}]`);
  console.log(`[lab] harness ${driver.name} ${await driver.version()} · model ${model.provider}/${model.model}`);

  const result =
    lane === "direct"
      ? await withCorpusSandbox((corpusDir) =>
          driver.run(harnessInput(lane, surface, model, prompt, corpusDir), timeoutMs),
        )
      : await driver.run(harnessInput(lane, surface, model, prompt), timeoutMs);

  if (result.stderr.trim() !== "") {
    console.warn(`[lab] harness stderr (never enters the trace):\n${result.stderr.slice(-1500)}`);
  }

  const trace: Trace = {
    schema: TRACE_SCHEMA,
    question_id: question.id,
    category: question.category,
    question_text: question.question,
    lane,
    lane_tools: surface.laneTools,
    model,
    harness: { name: driver.name, version: await driver.version(), argv: result.argv },
    prompt,
    steps: result.steps,
    final_answer: result.final_answer,
    started_at: result.started_at,
    finished_at: result.finished_at,
  };

  const check = validateTrace(trace);
  if (!check.ok) {
    throw new Error(`trace failed validation — refusing to write:\n${check.errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  return trace;
}

/** Writes a validated trace to results/runs/<lane>/<question>.json (atomically). */
export function writeTrace(trace: Trace): string {
  const outDir = join(RUNS_DIR, trace.lane);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${trace.question_id}.json`);
  atomicWrite(outPath, JSON.stringify(trace, null, 2) + "\n");
  return outPath;
}

/**
 * ISC-18/19/20: score one committed trace — deterministic evidence scoring
 * over the trace's tool results, plus (unless the caller opts out) one blind
 * judge call for answer agreement. The score validates before writing, the
 * same way traces do.
 */
export async function scoreOne(
  driver: HarnessDriver,
  lane: Lane,
  questionId: string,
  withJudge: boolean,
): Promise<Score> {
  const traceRef = `results/runs/${lane}/${questionId}.json`;
  const tracePath = join(REPO_ROOT, traceRef);
  if (!existsSync(tracePath)) {
    throw new Error(
      `no committed trace at ${traceRef} — run \`lab run --lane ${lane} --question ${questionId}\` first`,
    );
  }
  const traceCheck = validateTrace(JSON.parse(readFileSync(tracePath, "utf8")));
  if (!traceCheck.ok) {
    throw new Error(
      `trace at ${traceRef} fails validation:\n${traceCheck.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
  const trace = traceCheck.trace;
  if (trace.lane !== lane || trace.question_id !== questionId) {
    throw new Error(`trace at ${traceRef} does not match --lane/--question`);
  }
  const gold = loadGold().find((q) => q.id === questionId);
  if (!gold) {
    throw new Error(
      `unknown question id: ${questionId} — gold-set ids: ${loadGold().map((q) => q.id).join(", ")}`,
    );
  }

  const evidence = scoreEvidence(trace, gold.citations);
  const score: Score = {
    schema: SCORE_SCHEMA,
    question_id: questionId,
    category: gold.category,
    lane,
    trace_ref: traceRef,
    evidence,
    retrieval: {
      steps: trace.steps.length,
      error_steps: trace.steps.filter((s) => s.is_error).length,
      result_bytes: trace.steps.reduce((sum, s) => sum + utf8Bytes(s.result_text), 0),
    },
    absence_stated: absenceStated(gold.category, trace.final_answer),
    scored_at: new Date().toISOString(),
  };

  if (withJudge) {
    const judgePin = readJudgePin();
    console.log(`[lab] judging answer (blind) · judge ${judgePin.provider}/${judgePin.model}`);
    const verdict = await judgeAnswer(driver, judgePin, gold.question, gold.gold_answer, trace.final_answer);
    score.judge = { ...verdict, model: judgePin, blind: true, judged_at: new Date().toISOString() };
  }

  const check = validateScore(score);
  if (!check.ok) {
    throw new Error(`score failed validation — refusing to write:\n${check.errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  return score;
}

/** Writes a validated score to results/scores/<lane>/<question>.json (atomically). */
export function writeScore(score: Score): string {
  const outDir = join(SCORES_DIR, score.lane);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${score.question_id}.json`);
  atomicWrite(outPath, JSON.stringify(score, null, 2) + "\n");
  return outPath;
}

/** All lane names, pinned once for the CLI's arg validation. */
export const ALL_LANES: readonly Lane[] = LANES;
