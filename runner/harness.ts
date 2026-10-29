// runner/harness.ts — HarnessDriver: the lab drives one agent harness behind
// this interface (F3, ISC-17). pi is the reference implementation; the lab
// never links against it in-process — the driver is the boundary that keeps
// the rest of the repo harness-agnostic (README: The demonstration).
//
// Driver wiring notes, verified live against pi 1.4.0 (see F3 commit):
//   `--approve`    trusts the project-local .pi/mcp.json for this one process
//                  (project MCP config is otherwise ignored in untrusted runs)
//   `-e builtin:mcp` re-adds the built-in MCP support after `-ne` disables
//                  every extension — the only harness support lane runs load
//   `--no-mcp`     (direct lane) disables MCP entirely: no server exists
//   exposure "direct" in .pi/mcp.json makes the first prompt wait for lane
//                  servers and declare their tools (default codemode exposure
//                  would race the first request)
//   `--tools`      names the run's entire tool surface; an entry starting
//                  with mcp__ filters MCP tools, so `mcp__<server>__*` admits
//                  exactly one lane's tools and nothing native
//   `-nc -ns -np -ne` strip context files, skills, prompt templates, and
//                  extensions: the agent-under-test sees pi's stock system
//                  prompt plus the lane's tools — the constant, not the
//                  operator's machine
//   `--mode json`  is the trace source: one JSONL event stream on stdout
//   `--no-session` keeps runs out of session storage — the committed trace
//                  is the artifact
//
// v2 hardening (OpenCode review of 85c0c2a, findings 3/5/9/10/11):
//   laneTools       — every tool result must come from the run's lane, for
//                     ALL lanes (the prefix check covered MCP lanes only)
//   correlation     — a tool_execution_end without its matching start aborts
//                     the run; arguments are never silently defaulted
//   final answer    — the LAST assistant message must carry the answer text;
//                     a run ending on a tool-call-only/thinking-only message,
//                     or aborted by the harness, aborts the run
//   timeout + `--`  — a wedged harness process is killed after a deadline,
//                     and the prompt sits after `--` so no prompt text can be
//                     parsed as a flag
//   cwd             — the direct lane runs in a throwaway corpus-only sandbox
//                     (see runner/run.ts): native tools can see nothing but
//                     the corpus — no answer key, no other lanes' traces
//   stderr          — returned to the caller (the CLI surfaces it); never
//                     written into the trace

import { join } from "node:path";
import type { TraceStep } from "./trace";

export type ModelPin = { provider: string; model: string };

export type HarnessRunInput = {
  prompt: string;
  /** the harness's own selector for the lane's entire tool surface */
  toolsSelector: string;
  /** disable MCP support entirely (the direct lane has no server) */
  disableMcp: boolean;
  /** prefix the harness puts on the lane's MCP tool names; "" for native tools */
  mcpToolPrefix: string;
  /** the lane's tool names, lane-local — the only tools results may contain */
  laneTools: string[];
  model: ModelPin;
  /** working directory for the harness process; defaults to the repo root.
   * The direct lane passes a throwaway corpus-only sandbox dir instead. */
  cwd?: string;
};

export type HarnessRunResult = {
  steps: TraceStep[];
  final_answer: string;
  started_at: string;
  finished_at: string;
  /** the exact argv the harness process ran with (trace re-derivation) */
  argv: string[];
  /** harness stderr, raw — the CLI surfaces it; it never enters the trace */
  stderr: string;
};

export interface HarnessDriver {
  readonly name: string;
  run(input: HarnessRunInput): Promise<HarnessRunResult>;
}

const REPO_ROOT = join(import.meta.dir, "..");

/** A wedged harness process is killed after this long (one-question runs). */
export const DEFAULT_RUN_TIMEOUT_MS = 20 * 60_000;

/** Pure argv builder for the pi reference driver — snapshot-probed (ISC-17). */
export function buildPiArgv(input: HarnessRunInput): string[] {
  return [
    "--approve",
    "-nc",
    "-ns",
    "-np",
    "-ne",
    ...(input.disableMcp ? ["--no-mcp"] : ["-e", "builtin:mcp"]),
    "--no-session",
    "--mode",
    "json",
    "--provider",
    input.model.provider,
    "--model",
    input.model.model,
    ...(input.toolsSelector === "" ? ["--no-tools"] : ["--tools", input.toolsSelector]),
    "--print",
    "--",
    input.prompt,
  ];
}

/** True when this run is a toolless harness call (the blind judge, F4 ISC-19). */
export function isToollessRun(input: HarnessRunInput): boolean {
  return input.toolsSelector === "";
}

type PiEvent = Record<string, unknown>;

function asToolName(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function argsRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Pulls `.content` out of a tool-result or message object, else undefined. */
function contentOf(container: unknown): unknown {
  if (typeof container !== "object" || container === null || Array.isArray(container)) return undefined;
  return (container as Record<string, unknown>).content;
}

/** Concatenates the text blocks of an LLM content array (tool result or
 * assistant message) — the one extractor both consumers share. */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  let text = "";
  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      !Array.isArray(block) &&
      (block as Record<string, unknown>).type === "text"
    ) {
      const chunk = (block as Record<string, unknown>).text;
      if (typeof chunk === "string") text += chunk;
    }
  }
  return text;
}

/**
 * Parses pi's JSONL event stream into neutral steps + the final answer.
 * json.md: split records only on LF; strip an optional preceding CR. JS string
 * split never treats Unicode line separators as boundaries, which is exactly
 * the framing contract.
 *
 * Integrity rules (v2): every tool_execution_end must correlate to its start
 * event (arguments are never invented); every called tool must be in
 * laneTools (every lane, not just MCP-prefixed ones); the last assistant
 * message must carry the answer text; a harness-aborted run throws.
 */
export function parsePiEvents(
  stdout: string,
  mcpToolPrefix: string,
  laneTools: string[],
): { steps: TraceStep[]; finalAnswer: string } {
  const starts = new Map<string, { toolName: string; args: Record<string, unknown> }>();
  const steps: TraceStep[] = [];
  // The text of the most recent assistant message_end, even when empty —
  // the run must end with an assistant message that actually answers.
  let lastAssistantText: string | null = null;
  let aborted = false;

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.trim() === "") continue;
    let event: PiEvent;
    try {
      event = JSON.parse(line) as PiEvent;
    } catch {
      throw new Error(`harness event stream: unparseable record: ${line.slice(0, 120)}`);
    }
    if (event.type === "tool_execution_start") {
      const callId = event.toolCallId;
      if (typeof callId !== "string" || callId === "") {
        throw new Error("harness event stream: tool_execution_start without a tool call id");
      }
      starts.set(callId, { toolName: asToolName(event.toolName), args: argsRecord(event.args) });
    } else if (event.type === "tool_execution_end") {
      const callId = event.toolCallId;
      if (typeof callId !== "string" || callId === "") {
        throw new Error("harness event stream: tool_execution_end without a tool call id");
      }
      const start = starts.get(callId);
      if (start === undefined) {
        throw new Error(
          `harness event stream: tool_execution_end ${callId} has no matching start — refusing to record unattributed arguments`,
        );
      }
      starts.delete(callId);
      const toolName = asToolName(event.toolName) || start.toolName;
      if (toolName === "") {
        throw new Error("harness event stream: tool_execution_end without a tool name");
      }
      let tool: string;
      if (mcpToolPrefix === "") {
        tool = toolName;
      } else if (toolName.startsWith(mcpToolPrefix)) {
        tool = toolName.slice(mcpToolPrefix.length);
      } else {
        throw new Error(
          `lane integrity violation: the agent called "${toolName}", which is outside the run's lane ` +
            `(prefix "${mcpToolPrefix}") — refusing to record a trace with out-of-lane evidence`,
        );
      }
      if (!laneTools.includes(tool)) {
        throw new Error(
          `lane integrity violation: the agent called "${tool}", which is not in the lane's tool surface ` +
            `(${laneTools.join(", ")}) — refusing to record out-of-lane evidence`,
        );
      }
      const isError = event.isError === true;
      const duration = typeof event.durationMs === "number" && Number.isFinite(event.durationMs) ? event.durationMs : 0;
      steps.push({
        seq: steps.length + 1,
        tool,
        harness_tool: toolName,
        arguments: start.args,
        result_text: textOf(contentOf(event.result)),
        is_error: isError,
        duration_ms: duration,
      });
    } else if (event.type === "message_end") {
      const message = event.message;
      if (
        typeof message === "object" &&
        message !== null &&
        (message as Record<string, unknown>).role === "assistant"
      ) {
        lastAssistantText = textOf(contentOf(message));
      }
    } else if (event.type === "agent_settled") {
      if (event.aborted === true) aborted = true;
    }
  }

  if (aborted) {
    throw new Error("harness aborted the run — refusing to record an incomplete trace");
  }
  if (lastAssistantText === null) {
    throw new Error("harness event stream: no assistant message — run produced no answer");
  }
  if (lastAssistantText === "") {
    throw new Error(
      "harness event stream: the last assistant message carries no answer text " +
        "(the run ended on tool calls or thinking) — refusing to record a preamble as the answer",
    );
  }
  return { steps, finalAnswer: lastAssistantText };
}

export class PiDriver implements HarnessDriver {
  readonly name = "pi";
  private cachedVersion: string | null = null;

  /** pi binary; override with PI_BIN (kept out of repo files — leak invariant). */
  private get bin(): string {
    return process.env.PI_BIN ?? "pi";
  }

  async version(): Promise<string> {
    if (this.cachedVersion === null) {
      const proc = Bun.spawn([this.bin, "--version"], {
        cwd: REPO_ROOT,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore",
      });
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      this.cachedVersion = out.trim();
      if (this.cachedVersion === "") throw new Error(`could not resolve the harness version via ${this.bin}`);
    }
    return this.cachedVersion;
  }

  async run(input: HarnessRunInput, timeoutMs: number = DEFAULT_RUN_TIMEOUT_MS): Promise<HarnessRunResult> {
    const startedAt = new Date().toISOString();
    const argv = buildPiArgv(input);
    const proc = Bun.spawn([this.bin, ...argv], {
      cwd: input.cwd ?? REPO_ROOT,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    let stdout: string;
    let stderr: string;
    let code: number | null;
    try {
      const [out, err, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      stdout = out;
      stderr = err;
      code = exitCode;
    } finally {
      clearTimeout(timer);
    }
    const finishedAt = new Date().toISOString();
    if (timedOut) {
      throw new Error(`pi did not finish within ${Math.round(timeoutMs / 1000)}s — run aborted and killed`);
    }
    if (code !== 0) {
      throw new Error(`pi exited with code ${String(code)}\n${stderr.slice(-2000)}`);
    }
    const parsed = parsePiEvents(stdout, input.mcpToolPrefix, input.laneTools);
    return {
      steps: parsed.steps,
      final_answer: parsed.finalAnswer,
      started_at: startedAt,
      finished_at: finishedAt,
      argv,
      stderr,
    };
  }
}
