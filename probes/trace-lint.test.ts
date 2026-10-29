// probes/trace-lint.test.ts — ISC-15 + ISC-16 + ISC-17
// Trace-lint probe: the neutral trace schema (ISC-16) accepts a canonical
// fixture and rejects mutants — including harness elision markers, home-root
// leaks, out-of-lane tool calls, and zero-tool runs; the pi reference
// HarnessDriver (ISC-17) builds a pinned, lane-restricted, purity-flagged argv
// DETERMINED BY PRODUCTION WIRING (laneSurface/harnessInput — the probe cannot
// drift from what actually runs, review finding 6) and parses the real event
// shapes with strict integrity rules; and every committed run trace under
// results/runs/ is schema-conformant, laid out as <lane>/<question>.json
// against the frozen gold set, prompt-verified against the template, and free
// of answer-key contamination markers (ISC-15).
//
// Home-root mutants are assembled from fragments so the repo-wide leak scan
// can scan this source without matching its own fixtures.

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { buildPiArgv, parsePiEvents } from "../runner/harness";
import { buildPrompt } from "../runner/prompt";
import { harnessInput, laneSurface, readModelPin } from "../runner/run";
import { DIRECT_LANE_TOOLS } from "../lanes/direct/allowlist";
import { LANES, TRACE_SCHEMA, validateTrace, type Trace, type TraceStep } from "../runner/trace";
import { REPO_ROOT } from "./lib/corpus";

function step(seq: number, tool: string, harnessTool: string, resultText: string): TraceStep {
  return {
    seq,
    tool,
    harness_tool: harnessTool,
    arguments: { path: "decisions/d-001.md" },
    result_text: resultText,
    is_error: false,
    duration_ms: 10,
  };
}

const CANONICAL_PROMPT = buildPrompt("What datastore does the Ledgerline service use?");

function canonicalTrace(): Trace {
  return {
    schema: TRACE_SCHEMA,
    question_id: "q-pl-01",
    category: "point-lookup",
    question_text: "What datastore does the Ledgerline service use?",
    lane: "rag",
    lane_tools: ["get", "semantic_search"],
    model: { provider: "nvidia", model: "nvidia/nemotron-3-ultra-550b-a55b" },
    harness: {
      name: "pi",
      version: "1.4.0",
      argv: [
        "--approve", "-nc", "-ns", "-np", "-ne", "-e", "builtin:mcp",
        "--no-session", "--mode", "json",
        "--provider", "nvidia", "--model", "nvidia/nemotron-3-ultra-550b-a55b",
        "--tools", "mcp__rag_lane__*",
        "--print", "--", CANONICAL_PROMPT,
      ],
    },
    prompt: CANONICAL_PROMPT,
    steps: [
      step(1, "semantic_search", "mcp__rag_lane__semantic_search", '{\n  "question": "q-pl-01",\n  "results": []\n}'),
      step(2, "get", "mcp__rag_lane__get", "---\nid: d-001\n---\nDecision: use SQLite in WAL mode."),
    ],
    final_answer: "Ledgerline uses SQLite in WAL mode. Evidence: decisions/d-001.md.",
    started_at: "2026-10-27T10:00:00.000Z",
    finished_at: "2026-10-27T10:01:30.000Z",
  };
}

type Mutant = { name: string; mutate: (t: Trace) => void; expect: string };

// Fragment-assembled so the leak scan never sees one literal home root here.
const USERS_PATH = "/Us" + "ers/alice/secret.md";
const USERS_BARE = "/Us" + "ers/alice";
const HOME_PATH = "/ho" + "me/alice/secret.md";
const ROOT_PATH = "/ro" + "ot/alice/secret.md";
const ELISION_RESULT = '{\n  "results": []\n}\n…12 chars truncated…\n';
// pi's native line-truncation notice — tool output, NOT harness elision.
const NATIVE_LINE_CAP = "some long passage [truncated]\n[Some lines truncated to 500 chars. Use read tool to see full lines]";

const mutants: Mutant[] = [
  {
    name: "wrong schema string",
    mutate: (t) => {
      (t as { schema?: unknown }).schema = "knowledge-access-lab/trace@3";
    },
    expect: "schema must be",
  },
  {
    name: "lane outside the four",
    mutate: (t) => {
      (t as { lane?: unknown }).lane = "vector-db";
    },
    expect: "lane must be one of",
  },
  {
    name: "empty question_id",
    mutate: (t) => {
      t.question_id = "";
    },
    expect: "question_id must not be empty",
  },
  {
    name: "steps not an array",
    mutate: (t) => {
      (t as { steps?: unknown }).steps = 3;
    },
    expect: "steps must be a non-empty array",
  },
  {
    name: "empty steps — the toolless-run failure mode must not be a valid trace",
    mutate: (t) => {
      t.steps = [];
    },
    expect: "steps must be a non-empty array",
  },
  {
    name: "non-contiguous step seq",
    mutate: (t) => {
      t.steps[1]!.seq = 7;
    },
    expect: "seq must be 2",
  },
  {
    name: "result_text not a string",
    mutate: (t) => {
      (t.steps[0] as unknown as { result_text?: unknown }).result_text = 7;
    },
    expect: "result_text must be a string",
  },
  {
    name: "harness elision marker in a result (full-results invariant)",
    mutate: (t) => {
      t.steps[1]!.result_text = ELISION_RESULT;
    },
    expect: "elision marker — complete results only",
  },
  {
    name: "called tool not in the lane's surface (out-of-lane evidence)",
    mutate: (t) => {
      t.steps[1]!.tool = "bash";
    },
    expect: "not in the lane's lane_tools",
  },
  {
    name: "macOS home path in a result (leak invariant)",
    mutate: (t) => {
      t.steps[1]!.result_text += USERS_PATH;
    },
    expect: "absolute home path",
  },
  {
    name: "bare macOS home root without a trailing component (leak invariant)",
    mutate: (t) => {
      t.steps[1]!.result_text += USERS_BARE;
    },
    expect: "absolute home path",
  },
  {
    name: "linux home path in the prompt (leak invariant)",
    mutate: (t) => {
      t.prompt += HOME_PATH;
    },
    expect: "absolute home path",
  },
  {
    name: "root home path in the final answer (leak invariant)",
    mutate: (t) => {
      t.final_answer += ROOT_PATH;
    },
    expect: "absolute home path",
  },
  {
    name: "leak reported even alongside other schema errors",
    mutate: (t) => {
      (t.steps[0] as unknown as { is_error?: unknown }).is_error = "no";
      t.prompt += HOME_PATH;
    },
    expect: "absolute home path",
  },
  {
    name: "is_error not a boolean",
    mutate: (t) => {
      (t.steps[0] as unknown as { is_error?: unknown }).is_error = "false";
    },
    expect: "is_error must be a boolean",
  },
  {
    name: "negative duration_ms",
    mutate: (t) => {
      t.steps[0]!.duration_ms = -1;
    },
    expect: "duration_ms must be a non-negative number",
  },
  {
    name: "empty final_answer",
    mutate: (t) => {
      t.final_answer = "";
    },
    expect: "final_answer must not be empty",
  },
  {
    name: "empty lane_tools",
    mutate: (t) => {
      t.lane_tools = [];
    },
    expect: "lane_tools must be a non-empty array",
  },
  {
    name: "arguments not an object",
    mutate: (t) => {
      (t.steps[0] as unknown as { arguments?: unknown }).arguments = ["q-pl-01"];
    },
    expect: "arguments must be an object",
  },
  {
    name: "started_at year-only string",
    mutate: (t) => {
      t.started_at = "2026";
    },
    expect: "strict ISO 8601",
  },
  {
    name: "started_at with a space instead of T",
    mutate: (t) => {
      t.started_at = "2026-10-27 10:00:00.000Z";
    },
    expect: "strict ISO 8601",
  },
  {
    name: "finished_at precedes started_at",
    mutate: (t) => {
      t.finished_at = "2026-10-27T09:59:00.000Z";
    },
    expect: "must not precede",
  },
  {
    name: "harness.argv missing",
    mutate: (t) => {
      delete (t.harness as { argv?: unknown }).argv;
    },
    expect: "harness.argv",
  },
  {
    name: "harness.argv empty",
    mutate: (t) => {
      t.harness.argv = [];
    },
    expect: "harness.argv",
  },
  {
    name: "empty harness.version",
    mutate: (t) => {
      t.harness.version = "";
    },
    expect: "non-empty name and version strings",
  },
  {
    name: "empty model.provider",
    mutate: (t) => {
      t.model.provider = "";
    },
    expect: "non-empty provider and model strings",
  },
];

describe("ISC-16 — neutral trace schema: canonical accept, mutant reject", () => {
  test("the schema is versioned", () => {
    expect(TRACE_SCHEMA).toBe("knowledge-access-lab/trace@2");
  });

  test("a canonical trace validates", () => {
    const check = validateTrace(canonicalTrace());
    if (!check.ok) throw new Error(check.errors.join("; "));
    expect(check.ok).toBe(true);
  });

  test("empty result_text is legal — a no-match is the complete result", () => {
    const trace = canonicalTrace();
    trace.steps[1]!.result_text = "";
    expect(validateTrace(trace).ok).toBe(true);
  });

  test("pi native line-truncation notices are tool output, not harness elision — they validate", () => {
    const trace = canonicalTrace();
    trace.steps[1]!.result_text = NATIVE_LINE_CAP;
    const check = validateTrace(trace);
    if (!check.ok) throw new Error(check.errors.join("; "));
    expect(check.ok).toBe(true);
  });

  for (const mutant of mutants) {
    test(`rejects: ${mutant.name}`, () => {
      const trace = canonicalTrace();
      mutant.mutate(trace);
      const check = validateTrace(structuredClone(trace));
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.errors.join("; ")).toContain(mutant.expect);
      }
    });
  }
});

describe("ISC-17 — pi HarnessDriver: pinned, lane-restricted, pure argv (production wiring)", () => {
  // The committed lane-parity tool expectations — the runner must agree.
  const EXPECTED_LANE_TOOLS: Record<string, string[]> = {
    rag: ["get", "semantic_search"],
    wiki: ["links", "list", "open"],
    graph: ["neighbors", "paths"],
    "graph-seed": ["lookup", "neighbors", "paths"],
    direct: [...DIRECT_LANE_TOOLS].sort(),
  };

  const pin = readModelPin();

  test("laneSurface reads the lane's real tool surface off the wire and matches lane parity", async () => {
    for (const lane of LANES) {
      const surface = await laneSurface(lane);
      expect(surface.laneTools.sort()).toEqual(EXPECTED_LANE_TOOLS[lane]!.sort());
      if (lane === "direct") {
        expect(surface.disableMcp).toBe(true);
        expect(surface.mcpToolPrefix).toBe("");
        expect(surface.toolsSelector).toBe(DIRECT_LANE_TOOLS.join(","));
      } else {
        expect(surface.disableMcp).toBe(false);
        expect(surface.mcpToolPrefix).toBe(`mcp__${lane.replace(/-/g, "_")}_lane__`);
        expect(surface.toolsSelector).toBe(`mcp__${lane.replace(/-/g, "_")}_lane__*`);
      }
    }
  });

  test("every lane's argv is fully pinned: approval, purity, model pin, lane-only tools", async () => {
    const base = ["--approve", "-nc", "-ns", "-np", "-ne"];
    const tail = ["--no-session", "--mode", "json", "--provider", pin.provider, "--model", pin.model];
    for (const lane of LANES.filter((l) => l !== "direct")) {
      const surface = await laneSurface(lane);
      const argv = buildPiArgv(harnessInput(lane, surface, pin, "PROMPT"));
      expect(argv).toEqual([
        ...base, "-e", "builtin:mcp", ...tail,
        "--tools", `mcp__${lane.replace(/-/g, "_")}_lane__*`, "--print", "--", "PROMPT",
      ]);
    }
    const directSurface = await laneSurface("direct");
    const direct = buildPiArgv(harnessInput("direct", directSurface, pin, "PROMPT"));
    expect(direct).toEqual([
      ...base, "--no-mcp", ...tail,
      "--tools", DIRECT_LANE_TOOLS.join(","), "--print", "--", "PROMPT",
    ]);
    expect(direct).not.toContain("builtin:mcp"); // the direct lane loads no MCP support at all
  });

  test("the argv pins the agent-under-test to the model pin file", async () => {
    const surface = await laneSurface("rag");
    const argv = buildPiArgv(harnessInput("rag", surface, pin, "P"));
    expect(argv).toContain(pin.provider);
    expect(argv).toContain(pin.model);
  });

  test("the prompt sits after `--` and cannot be parsed as a flag", async () => {
    const surface = await laneSurface("rag");
    const argv = buildPiArgv(harnessInput("rag", surface, pin, "-p --danger"));
    const dd = argv.indexOf("--");
    expect(argv[argv.length - 1]).toBe("-p --danger");
    expect(argv.indexOf("--print")).toBe(dd - 1);
  });

  test("parsePiEvents turns the real event shapes into steps + final answer", () => {
    const stream = [
      '{"type":"session","version":3,"id":"x","cwd":"/private/never/copied"}',
      '{"type":"agent_start"}',
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"thinking","thinking":"x"},{"type":"toolCall","name":"mcp__rag_lane__semantic_search","arguments":{"query":"q"}}]}}',
      '{"type":"tool_execution_start","toolCallId":"c1","toolName":"mcp__rag_lane__semantic_search","args":{"query":"q"}}',
      '{"type":"tool_execution_update","toolCallId":"c1","toolName":"mcp__rag_lane__semantic_search","args":{},"partialResult":{"content":[{"type":"text","text":"partial"}]}}',
      '{"type":"tool_execution_end","toolCallId":"c1","toolName":"mcp__rag_lane__semantic_search","result":{"content":[{"type":"text","text":"{\\"results\\": []}"}]},"isError":false,"durationMs":12}',
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"Ledgerline uses SQLite."}]}}',
      '{"type":"agent_settled","aborted":false}',
    ].join("\n");
    const parsed = parsePiEvents(stream, "mcp__rag_lane__", ["get", "semantic_search"]);
    expect(parsed.steps).toEqual([
      {
        seq: 1,
        tool: "semantic_search",
        harness_tool: "mcp__rag_lane__semantic_search",
        arguments: { query: "q" },
        result_text: '{"results": []}',
        is_error: false,
        duration_ms: 12,
      },
    ]);
    expect(parsed.finalAnswer).toBe("Ledgerline uses SQLite.");
  });

  test("an out-of-allowlist tool in the DIRECT lane is refused, not recorded", () => {
    const stream = [
      '{"type":"tool_execution_start","toolCallId":"c1","toolName":"bash","args":{"command":"ls"}}',
      '{"type":"tool_execution_end","toolCallId":"c1","toolName":"bash","result":{"content":[{"type":"text","text":"x"}]},"isError":false,"durationMs":1}',
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"done"}]}}',
    ].join("\n");
    expect(() => parsePiEvents(stream, "", ["find", "grep", "ls", "read"])).toThrow("not in the lane's tool surface");
  });

  test("out-of-lane MCP tool calls are refused, not recorded", () => {
    const stream = [
      '{"type":"tool_execution_start","toolCallId":"c1","toolName":"mcp__wiki_lane__open","args":{"path":"x"}}',
      '{"type":"tool_execution_end","toolCallId":"c1","toolName":"mcp__wiki_lane__open","result":{"content":[{"type":"text","text":"x"}]},"isError":false,"durationMs":1}',
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"done"}]}}',
    ].join("\n");
    expect(() => parsePiEvents(stream, "mcp__rag_lane__", ["get", "semantic_search"])).toThrow("outside the run's lane");
  });

  test("a tool result without its matching start is refused — arguments are never invented", () => {
    const stream = [
      '{"type":"tool_execution_end","toolCallId":"c1","toolName":"mcp__rag_lane__get","result":{"content":[{"type":"text","text":"x"}]},"isError":false,"durationMs":1}',
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"done"}]}}',
    ].join("\n");
    expect(() => parsePiEvents(stream, "mcp__rag_lane__", ["get", "semantic_search"])).toThrow("no matching start");
  });

  test("a run ending on a tool-call-only message is refused — a preamble is not an answer", () => {
    const stream = [
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"Let me look that up."}]}}',
      '{"type":"tool_execution_start","toolCallId":"c1","toolName":"mcp__rag_lane__get","args":{}}',
      '{"type":"tool_execution_end","toolCallId":"c1","toolName":"mcp__rag_lane__get","result":{"content":[{"type":"text","text":"x"}]},"isError":false,"durationMs":1}',
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"thinking","thinking":"..."}]}}',
      '{"type":"agent_settled","aborted":false}',
    ].join("\n");
    expect(() => parsePiEvents(stream, "mcp__rag_lane__", ["get", "semantic_search"])).toThrow("no answer text");
  });

  test("a harness-aborted run is refused", () => {
    const stream = [
      '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"partial"}]}}',
      '{"type":"agent_settled","aborted":true}',
    ].join("\n");
    expect(() => parsePiEvents(stream, "mcp__rag_lane__", ["get", "semantic_search"])).toThrow("aborted the run");
  });

  test("a stream with no assistant message fails loudly", () => {
    expect(() => parsePiEvents('{"type":"agent_start"}\n', "mcp__rag_lane__", ["get"])).toThrow("no assistant message");
  });
});

describe("ISC-15 — committed run traces: schema-conformant, honest, uncontaminated", () => {
  const runsDir = join(REPO_ROOT, "results", "runs");
  const gold = JSON.parse(readFileSync(join(REPO_ROOT, "questions", "gold.json"), "utf8")) as {
    id: string;
    category: string;
    question: string;
  }[];
  const goldById = new Map(gold.map((q) => [q.id, q]));

  const EXPECTED_LANE_TOOLS: Record<string, string[]> = {
    rag: ["get", "semantic_search"],
    wiki: ["links", "list", "open"],
    graph: ["neighbors", "paths"],
    "graph-seed": ["lookup", "neighbors", "paths"],
    direct: [...DIRECT_LANE_TOOLS].sort(),
  };

  function traceFiles(): string[] {
    if (!existsSync(runsDir)) return [];
    const files: string[] = [];
    for (const laneDir of readdirSync(runsDir, { withFileTypes: true })) {
      if (!laneDir.isDirectory()) continue;
      for (const f of readdirSync(join(runsDir, laneDir.name))) {
        if (f.endsWith(".json")) files.push(join(runsDir, laneDir.name, f));
      }
    }
    return files;
  }

  test("at least one committed run trace exists (receipts, not claims)", () => {
    expect(traceFiles().length).toBeGreaterThanOrEqual(1);
  });

  test("every committed trace validates, matches the gold set, and its prompt is the template", () => {
    for (const file of traceFiles()) {
      const check = validateTrace(JSON.parse(readFileSync(file, "utf8")));
      if (!check.ok) throw new Error(`${file}: ${check.errors.join("; ")}`);
      const trace = check.trace;
      const lane = basename(dirname(file));
      expect(trace.lane, file).toBe(lane);
      expect(LANES).toContain(lane);
      expect(basename(file), file).toBe(`${trace.question_id}.json`);
      const question = goldById.get(trace.question_id);
      expect(question, file).toBeDefined();
      if (question) {
        expect(trace.question_text, file).toBe(question.question);
        expect(trace.category, file).toBe(question.category);
      }
      expect(trace.prompt, file).toBe(buildPrompt(trace.question_text));
      expect(trace.lane_tools.sort(), file).toEqual(EXPECTED_LANE_TOOLS[lane]!.sort());
      // the recorded argv must be able to re-derive the run
      expect(trace.harness.argv[trace.harness.argv.length - 1], file).toBe(trace.prompt);
      expect(trace.harness.argv).toContain("--");
    }
  });

  test("no trace carries answer-key or rival-trace contamination (review finding 1)", () => {
    for (const file of traceFiles()) {
      const raw = readFileSync(file, "utf8");
      expect(raw.includes("gold_answer"), file).toBe(false);
      expect(raw.includes("gold citations"), file).toBe(false);
      expect(raw.includes("results/runs/"), file).toBe(false);
    }
  });
});
