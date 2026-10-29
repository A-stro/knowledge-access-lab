// runner/lab.ts — lab CLI entry point.
//
// The lab drives one agent harness behind a HarnessDriver interface (F3,
// ISC-17), executes lanes over the shared corpus, and emits neutral traces
// (ISC-16) — one question through one lane per `run` invocation (ISC-15).
// This file is a thin arg parser; the production wiring lives in run.ts,
// which the probes drive directly.
//   run     → one question through one lane, emitting a schema-conformant
//             trace into results/runs/<lane>/<question>.json (F3, ISC-15)
//   suite   → all four lanes over the full gold set in one execution (F5, ISC-22)
//   dry-run → print each lane's exact active tool set (F2, ISC-14)

const HELP = `
Knowledge Access Lab — lab CLI

Usage:
  bun run lab run --lane <rag|wiki|graph|direct> --question <gold-set id>
  bun run lab score --lane <rag|wiki|graph|direct> --question <gold-set id> [--no-judge]
  bun run lab suite [--jobs N]                                       (F5, ISC-22)
  bun run lab dry-run                                              (F2, ISC-14)

\`lab run\` drives the pinned agent-under-test (runner/model-pin.json) through
exactly one lane and writes a neutral, harness-agnostic trace to
results/runs/<lane>/<question>.json. The direct lane runs inside a throwaway
corpus-only sandbox: its native tools can see nothing but the corpus. The
harness binary is \`pi\` from PATH; override with the PI_BIN environment
variable.

\`lab score\` grades one committed trace: deterministic evidence scoring (gold
citations — exact-passage and record-path presence — measured from tool
results alone) plus a blind judge verdict on answer agreement, unless
--no-judge is passed. Scores land in results/scores/<lane>/<question>.json.

\`lab suite\` runs the full comparative experiment: all lanes over the
full gold set in one execution — every (lane × question) cell gets one
committed trace and one scored, judged verdict — then writes the rollup
(results/rollup.json + its human render, results/rollup.md) built from the
complete cell set. The suite is resumable: cells with valid committed
artifacts are reused, a killed suite loses nothing, and the rollup is
written only when coverage is complete. \`--jobs N\` bounds the worker pool
(default 3, comfortably under the pinned endpoint's rate limits).

The direct lane has no MCP server: it is the native read/grep/find/ls
allowlist control group. All other lanes are in-repo MCP servers wired
through .pi/mcp.json.
`;

import { join } from "node:path";
import { DIRECT_LANE_TOOLS } from "../lanes/direct/allowlist";
import { PiDriver } from "./harness";
import { ALL_LANES, laneSurface, loadGold, runOne, scoreOne, writeScore, writeTrace } from "./run";
import { suiteRun } from "./suite";
import { LANES, type Lane } from "./trace";

const REPO_ROOT = join(import.meta.dir, "..");

/** ISC-14: print each lane's exact active tool set, straight off the wire.
 * Derived from laneSurface() over LANES, so a new lane (F6's seeded lane)
 * appears here the moment its wiring lands — no second list to drift. */
async function dryRun(): Promise<void> {
  console.log("lane      active tool set");
  console.log("----      ---------------");
  for (const lane of LANES) {
    if (lane === "direct") {
      console.log(`${lane.padEnd(9)} ${[...DIRECT_LANE_TOOLS].sort().join(", ")}  (native allowlist — no MCP server)`);
      continue;
    }
    const surface = await laneSurface(lane);
    console.log(`${lane.padEnd(9)} ${surface.laneTools.join(", ")}`);
  }
}

function argValue(argv: string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
}

const argv = process.argv.slice(2);
const cmd = argv[0];

switch (cmd) {
  case undefined:
  case "help":
  case "--help":
    console.log(HELP);
    break;
  case "run": {
    const lane = argValue(argv, "--lane");
    const questionId = argValue(argv, "--question");
    if (!lane || !ALL_LANES.includes(lane as Lane)) {
      console.error(`[lab] \`run\` needs --lane <${ALL_LANES.join("|")}> (got: ${String(lane)})`);
      process.exit(2);
    }
    if (!questionId) {
      console.error("[lab] `run` needs --question <gold-set id>");
      process.exit(2);
    }
    const gold = loadGold();
    if (!gold.some((q) => q.id === questionId)) {
      console.error(`[lab] unknown question id: ${questionId}`);
      console.error(`[lab] gold-set ids: ${gold.map((q) => q.id).join(", ")}`);
      process.exit(2);
    }
    const timeoutMs = argValue(argv, "--timeout-ms");
    const deadline = timeoutMs === undefined ? undefined : Number.parseInt(timeoutMs, 10);
    if (deadline !== undefined && (!Number.isInteger(deadline) || deadline < 1000)) {
      console.error("[lab] `--timeout-ms` needs an integer of at least 1000 (ms)");
      process.exit(2);
    }
    try {
      const trace = await runOne(new PiDriver(), lane as Lane, questionId, deadline);
      const outPath = writeTrace(trace);
      console.log(`[lab] trace → ${join("results", "runs", trace.lane, `${trace.question_id}.json`)} (${trace.steps.length} tool call(s))`);
      console.log(`[lab] answer: ${trace.final_answer.slice(0, 200)}`);
    } catch (err) {
      console.error(`[lab] run failed: ${String(err)}`);
      process.exit(1);
    }
    break;
  }
  case "score": {
    const lane = argValue(argv, "--lane");
    const questionId = argValue(argv, "--question");
    const withJudge = !argv.includes("--no-judge");
    if (!lane || !ALL_LANES.includes(lane as Lane)) {
      console.error(`[lab] \`score\` needs --lane <${ALL_LANES.join("|")}> (got: ${String(lane)})`);
      process.exit(2);
    }
    if (!questionId) {
      console.error("[lab] \`score\` needs --question <gold-set id>");
      process.exit(2);
    }
    const gold = loadGold();
    if (!gold.some((q) => q.id === questionId)) {
      console.error(`[lab] unknown question id: ${questionId}`);
      console.error(`[lab] gold-set ids: ${gold.map((q) => q.id).join(", ")}`);
      process.exit(2);
    }
    try {
      const score = await scoreOne(new PiDriver(), lane as Lane, questionId, withJudge);
      writeScore(score);
      const ratios =
        score.evidence.evidence_expected
          ? `passages ${score.evidence.passages_exact_ratio} · records ${score.evidence.records_found_ratio}`
          : "absence question (no gold citations)";
      console.log(`[lab] score → ${join("results", "scores", score.lane, `${score.question_id}.json`)}`);
      console.log(`[lab] evidence: ${ratios} · retrieval: ${score.retrieval.steps} step(s), ${score.retrieval.result_bytes} result bytes`);
      if (score.judge) {
        console.log(`[lab] judge (blind): ${score.judge.verdict} — ${score.judge.rationale.slice(0, 180)}`);
      } else {
        console.log("[lab] judge: skipped (--no-judge)");
      }
    } catch (err) {
      console.error(`[lab] scoring failed: ${String(err)}`);
      process.exit(1);
    }
    break;
  }
  case "suite": {
    const jobs = Number.parseInt(argValue(argv, "--jobs") ?? "3", 10);
    if (!Number.isInteger(jobs) || jobs < 1 || jobs > 16) {
      console.error("[lab] `suite` needs --jobs <1..16> (default 3)");
      process.exit(2);
    }
    try {
      const outcome = await suiteRun(new PiDriver(), { jobs });
      console.log(
        `[lab] suite: ${outcome.cells} cells · ${outcome.reused} reused · ${outcome.ran} ran · ` +
          `${outcome.failed} failed · ${outcome.recorded} recorded non-settlement(s)`,
      );
      if (outcome.rollupWritten) {
        console.log("[lab] rollup → results/rollup.json · results/rollup.md");
      } else {
        console.error("[lab] suite did not complete — run `lab suite` again to resume the missing cells");
        process.exit(1);
      }
    } catch (err) {
      console.error(`[lab] suite failed: ${String(err)}`);
      process.exit(1);
    }
    break;
  }
  case "dry-run":
    await dryRun();
    break;
  default:
    console.error(`[lab] unknown command: ${String(cmd)}`);
    process.exit(2);
}
