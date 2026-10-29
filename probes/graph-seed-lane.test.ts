// probes/graph-seed-lane.test.ts — ISC-30 (F6: the seeded graph lane)
//
// F6 exists because of a measurement, not a hunch: the bare graph lane
// (ISC-12) answered 0 of 908 tool calls successfully — every call needs a
// corpus record path, the questions carry names and titles, and the lane has
// no entry point — so the F2 expectation that typed-edge traversal wins
// multi-hop was never actually tested (ISC-29 pinned that character). This
// lane adds exactly ONE tool over the F2-frozen surface:
//
//   `lookup`    → name / title / record path → record paths + titles ONLY,
//                 never record text
//   `neighbors` → the frozen surface (lanes/lib/graph-tools.ts, shared)
//   `paths`     → the frozen surface (lanes/lib/graph-tools.ts, shared)
//
// This probe pins the seeded lane's contract:
//   (a) the served tool set is exactly lookup + the frozen graph surface
//   (b) lookup solves the measured cold start: every gold-cited record
//       resolves by title AND by id — the entry points ISC-27's chains need
//   (c) lookup payloads are {path, title, match} shapes only, and a match's
//       title is exactly that record's corpus title — never record text
//   (d) the framing extends to the seeded lane: NO output of ANY of the three
//       tools contains any gold citation passage (ISC-28's title property,
//       verified over the actual surface — titles, paths and edge types only),
//       so the seeded lane's passage fidelity stays structurally zero too
//   (e) neighbors/paths are byte-identical to the frozen bare graph lane —
//       the seeded lane cannot drift from the F2 surface
//   (f) determinism, ranking, invalid inputs, sandbox-path tolerance
//   (g) once the suite has run the lane: all 45 cells committed, every
//       successful step carries no gold passage (the architectural zero,
//       verified over receipts), and only the declared surface ever ran
//
// Part (g) is receipt-driven like ISC-29 and fails loudly pre-suite.

import { describe, expect, test } from "bun:test";
import { loadGold } from "../runner/run";
import { loadCommittedScore, loadCommittedTrace, loadUnsettled, suiteCells } from "../runner/suite";
import type { Score } from "../runner/score";
import type { Trace } from "../runner/trace";
import { callLane, resultText } from "./lib/lane-driver";
import { loadCorpus } from "./lib/corpus";

const GOLD = loadGold();
const SERVER = "lanes/graph-seed/server.ts";
const FROZEN_SERVER = "lanes/graph/server.ts";
const SURFACE = ["lookup", "neighbors", "paths"];

const call = (id: number, name: string, arguments_: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: arguments_ },
});

type LookupMatch = { path: string; title: string; match: string };

/** One lookup call, parsed to its matches. */
async function lookup(query: string, genre?: string): Promise<LookupMatch[]> {
  const replies = await callLane(SERVER, [call(1, "lookup", genre === undefined ? { query } : { query, genre })]);
  const payload = JSON.parse(resultText(replies.get(1)!)) as { found: number; matches: LookupMatch[] };
  return payload.matches;
}

/** id-keyed successful result texts for a request list carrying explicit ids. */
async function textsById(requests: { id: number }[], chunk = 40): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (let i = 0; i < requests.length; i += chunk) {
    const replies = await callLane(SERVER, requests.slice(i, i + chunk));
    for (const [id, reply] of replies) if (!reply.error) out.set(id, resultText(reply));
  }
  return out;
}

const CORPUS = loadCorpus();
const TITLE_OF = new Map(CORPUS.map((r) => [r.relPath, String(r.fm?.["title"] ?? r.stem)]));
const CITED = [...new Set(GOLD.flatMap((q) => q.citations.map((c) => c.record)))];
const PASSAGES = GOLD.flatMap((q) => q.citations.map((c) => c.passage));

describe("ISC-30 — the seeded graph lane: entity resolution, frozen traversal, still no record text", () => {
  test("(a) serves exactly lookup + the frozen graph surface — three tools, within ISC-2's bound", async () => {
    const replies = await callLane(SERVER, [
      { jsonrpc: "2.0", id: 0, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
    ]);
    const tools = ((replies.get(1)!.result as { tools: { name: string }[] }).tools ?? []).map((t) => t.name).sort();
    expect(tools).toEqual([...SURFACE].sort());
    expect(tools.length).toBeLessThanOrEqual(4);
  });

  test("(b) lookup resolves every gold-cited record by title AND by id — the measured cold start is solved", async () => {
    expect(CITED.length).toBeGreaterThan(0);
    const requests: { id: number }[] = [];
    for (const [i, path] of CITED.entries()) {
      const rec = CORPUS.find((r) => r.relPath === path);
      expect(rec, path).toBeDefined();
      requests.push(call(2 * i, "lookup", { query: TITLE_OF.get(path)! }));
      requests.push(call(2 * i + 1, "lookup", { query: rec!.stem }));
    }
    const texts = await textsById(requests);
    expect(texts.size).toBe(CITED.length * 2);
    for (const [i, path] of CITED.entries()) {
      const byTitle = JSON.parse(texts.get(2 * i)!) as { matches: LookupMatch[] };
      const byId = JSON.parse(texts.get(2 * i + 1)!) as { matches: LookupMatch[] };
      expect(byTitle.matches.some((m) => m.path === path), `by title: ${path}`).toBe(true);
      expect(byId.matches[0], `by id: ${path}`).toMatchObject({ path, match: "id" });
    }
  });

  test("(c) lookup payloads are {path, title, match} shapes whose title IS the corpus title — never record text", async () => {
    // the payload has no other fields, so record text could only ride inside
    // a path or a title — and both are pinned to the corpus's own values
    const requests = CORPUS.map((r, i) => call(i, "lookup", { query: String(r.fm?.["title"] ?? r.stem) }));
    const texts = await textsById(requests);
    expect(texts.size).toBe(CORPUS.length);
    for (const [id, text] of texts) {
      const payload = JSON.parse(text) as { matches: LookupMatch[] };
      expect(payload.matches.length).toBeGreaterThan(0);
      for (const m of payload.matches) {
        expect(Object.keys(m).sort()).toEqual(["match", "path", "title"]);
        expect(TITLE_OF.get(m.path), m.path).toBe(m.title);
        expect(m.path.endsWith(".md")).toBe(true);
      }
    }
  });

  test("(d) no output of any tool carries any gold citation passage — the architectural zero over the actual surface", async () => {
    // ISC-28 proved no TITLE contains a passage; this drives the real surface:
    // lookup over every title and id, traversal over every cited record. If
    // any tool ever starts returning record text, this fails first.
    const requests: { id: number }[] = [];
    let id = 0;
    for (const r of CORPUS) {
      requests.push(call(id++, "lookup", { query: String(r.fm?.["title"] ?? r.stem) }));
      requests.push(call(id++, "lookup", { query: r.stem }));
    }
    for (const [i, path] of CITED.entries()) {
      requests.push(call(id++, "neighbors", { path }));
      requests.push(call(id++, "paths", { from: path, to: CITED[(i + 1) % CITED.length]! }));
    }
    const texts = await textsById(requests);
    expect(texts.size).toBeGreaterThan(CORPUS.length * 2);
    for (const passage of PASSAGES) {
      const carrier = [...texts.values()].find((t) => t.includes(passage));
      expect(carrier === undefined, `passage ${JSON.stringify(passage.slice(0, 50))} rode along in an output`).toBe(true);
    }
  });

  test("(e) neighbors and paths are byte-identical to the frozen bare graph lane", async () => {
    const requests = [
      call(1, "neighbors", { path: "sessions/s-004.md" }),
      call(2, "neighbors", { path: "decisions/d-008.md", edge_types: ["supersedes"] }),
      call(3, "neighbors", { path: "decisions/d-008.md", direction: "incoming" }),
      call(4, "paths", { from: "decisions/d-003.md", to: "meetings/m-005.md" }),
      call(5, "paths", { from: "decisions/d-001.md", to: "decisions/d-001.md" }),
      call(6, "neighbors", { path: "decisions/d-999.md" }),
    ];
    const seeded = await callLane(SERVER, requests);
    const frozen = await callLane(FROZEN_SERVER, requests);
    expect(seeded.size).toBe(6);
    for (const [id, reply] of seeded) {
      const other = frozen.get(id)!;
      if (reply.error) {
        expect(other.error?.message, `request ${id}`).toBe(reply.error.message);
        continue;
      }
      expect(resultText(reply), `request ${id} result`).toBe(resultText(other));
    }
  });

  test("(f) lookup is deterministic, ranks exact ids above title substrings, and rejects invalid input", async () => {
    const first = await lookup("wayfare");
    expect(await lookup("wayfare")).toEqual(first);
    // "wayfare" is an exact id AND a title substring ("Wayfare displays speak
    // MQTT" ...): the id hit ranks first, title hits follow — deterministic
    expect(first[0]).toMatchObject({ path: "projects/wayfare.md", match: "id" });
    expect(first.some((m) => m.match === "title-partial")).toBe(true);

    // invalid inputs are loud tool errors, not silent empties
    for (const bad of [{ query: "" }, { query: "   " }, { query: "wayfare", genre: "nonexistent" }]) {
      const replies = await callLane(SERVER, [call(1, "lookup", bad)]);
      expect(replies.get(1)!.error?.message, JSON.stringify(bad)).toBeTruthy();
    }

    // a query that matches nothing is an honest empty, not an error
    expect(await lookup("zzzzz-no-such-name-zzzzz")).toEqual([]);
  });

  test("(f) lookup resolves record paths directly and tolerates sandbox-absolute spellings", async () => {
    // the exact-path rank: an agent that already holds a path can seed with it
    expect((await lookup("decisions/d-008.md"))[0]).toMatchObject({ path: "decisions/d-008.md", match: "path" });
    // the same tolerance the F4 scorer applies to tool arguments: a path
    // spelled absolutely under a throwaway corpus copy still resolves
    const sandbox = await lookup("/tmp/kal-corpus-abc123/corpus/decisions/d-008.md");
    expect(sandbox[0]).toMatchObject({ path: "decisions/d-008.md", match: "path" });
  });
});

describe("ISC-30 receipts — the seeded lane's settled cells keep the structural zero", () => {
  // Receipt-driven, exactly like ISC-29: the architectural guarantee (no tool
  // output carries record text) re-verified over the committed suite cells,
  // plus the lane discipline (only the declared surface ever ran). Fails
  // loudly pre-suite with a run instruction.
  type SeededReceipt = { trace: Trace; score: Score };

  function seededReceipts(): SeededReceipt[] {
    // the recorded non-settlement (F6) has no trace by definition — the
    // production loader names it, and suite-lint pins the record itself
    const recorded = new Set(loadUnsettled(GOLD).map((u) => `${u.lane}::${u.question_id}`));
    const out: SeededReceipt[] = [];
    for (const cell of suiteCells(GOLD).filter((c) => c.lane === "graph-seed")) {
      if (recorded.has(`${cell.lane}::${cell.questionId}`)) continue;
      const trace = loadCommittedTrace(cell.lane, cell.questionId, cell.gold);
      if (!trace) throw new Error(`results/runs/graph-seed/${cell.questionId}.json is missing, stale, or invalid — run \`lab suite\``);
      const score = loadCommittedScore(trace, cell.gold);
      if (!score) throw new Error(`results/scores/graph-seed/${cell.questionId}.json is missing, stale, or invalid — run \`lab suite\``);
      out.push({ trace, score });
    }
    return out;
  }

  // loaded inside each test, not at collection: pre-suite the artifact is
  // absent, and the probe must fail loudly AND cleanly with a run
  // instruction — never crash the file (the suite-lint pattern)

  test("every settled seeded cell is committed, and the declared surface is the only surface that ran", () => {
    // 44 of 45 — q-mh-08 is F6's recorded non-settlement (no trace exists by
    // definition; suite-lint pins the record against the artifacts)
    const RECEIPTS = seededReceipts();
    expect(RECEIPTS.length).toBe(44);
    for (const { trace } of RECEIPTS) {
      expect([...trace.lane_tools].sort()).toEqual([...SURFACE].sort());
      for (const step of trace.steps) {
        expect(SURFACE, `${trace.question_id} step ${step.seq}`).toContain(step.tool);
      }
    }
  });

  test("no successful step carried any gold passage — passage fidelity stays zero over the receipts", () => {
    const RECEIPTS = seededReceipts();
    for (const { trace } of RECEIPTS) {
      const gold = GOLD.find((q) => q.id === trace.question_id)!;
      for (const step of trace.steps) {
        if (step.is_error) continue;
        for (const c of gold.citations) {
          expect(step.result_text.includes(c.passage), `${trace.question_id} step ${step.seq} carried a passage`).toBe(false);
        }
      }
    }
    // and the committed scores agree: every evidence cell's deterministic
    // passage ratio is the architectural zero (absence cells carry null —
    // no gold citations by design)
    for (const { score } of RECEIPTS) {
      if (score.evidence.evidence_expected) {
        expect(score.evidence.passages_exact_ratio, score.question_id).toBe(0);
      } else {
        expect(score.evidence.passages_exact_ratio, score.question_id).toBeNull();
      }
    }
  });
});
