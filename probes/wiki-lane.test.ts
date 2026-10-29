// probes/wiki-lane.test.ts — ISC-11 (lane behavior)
// Drives the wiki lane MCP server over stdio: the genre-filterable tree with
// the seven-genre taxonomy, full-record open, and the backlink surface — the
// differentiator this lane exists to demonstrate.

import { describe, expect, test } from "bun:test";
import { GENRES, loadCorpus } from "./lib/corpus";
import { callLane, resultText } from "./lib/lane-driver";

const SERVER = "lanes/wiki/server.ts";
const call = (id: number, name: string, arguments_: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: arguments_ },
});

describe("ISC-11 — wiki lane behavior over the shared corpus", () => {
  test("list returns the seven-genre taxonomy with counts matching the corpus", async () => {
    const replies = await callLane(SERVER, [call(1, "list", {})]);
    const payload = JSON.parse(resultText(replies.get(1)!)) as {
      taxonomy: Record<string, string>;
      genres: { genre: string; count: number; records: { id: string; title: string; path: string }[] }[];
    };
    const records = loadCorpus();
    expect(Object.keys(payload.taxonomy).sort()).toEqual([...GENRES].sort());
    expect(payload.genres.map((g) => g.genre)).toEqual([...GENRES]);
    for (const g of payload.genres) {
      const expected = records.filter((r) => r.genre === g.genre).length;
      expect(g.count, g.genre).toBe(expected);
      expect(g.records.length, g.genre).toBe(expected);
      expect(payload.taxonomy[g.genre].length, g.genre).toBeGreaterThan(0);
    }
    expect(payload.genres.reduce((s, g) => s + g.count, 0)).toBe(records.length);
    const d001 = payload.genres.find((g) => g.genre === "decisions")!.records.find((r) => r.path === "decisions/d-001.md");
    expect(d001?.id).toBe("d-001");
    expect(d001?.title).toBe("Ledgerline stores its data in SQLite");
  });

  test("list output fits the pinned harness's MCP cap — no elided tree can ever reach a trace", async () => {
    // pi 1.4.0 (the pinned reference harness) mid-truncates MCP results over
    // MCP_OUTPUT_MAX_BYTES = 20 * 1024 with a "…N chars truncated…" marker, and
    // the trace schema refuses elided results (full-results invariant). This
    // pins the lane against that wall: over the full corpus, list's render
    // must stay under the cap. If the corpus ever grows past it, this fails
    // loudly instead of a suite run silently losing its tree to elision.
    const HARNESS_MCP_OUTPUT_MAX_BYTES = 20 * 1024;
    const replies = await callLane(SERVER, [call(1, "list", {})]);
    const bytes = Buffer.byteLength(resultText(replies.get(1)!), "utf8");
    expect(bytes).toBeLessThanOrEqual(HARNESS_MCP_OUTPUT_MAX_BYTES);
  });

  test("list with a genre filter returns just that genre; an invalid genre errors", async () => {
    const replies = await callLane(SERVER, [
      call(1, "list", { genre: "decisions" }),
      call(2, "list", { genre: "telegrams" }),
    ]);
    const payload = JSON.parse(resultText(replies.get(1)!)) as { genres: { genre: string; count: number }[] };
    expect(payload.genres.map((g) => g.genre)).toEqual(["decisions"]);
    expect(payload.genres[0].count).toBe(29);
    expect(replies.get(2)!.error?.message).toBeTruthy();
  });

  test("open returns the full raw record; invalid paths error", async () => {
    const replies = await callLane(SERVER, [
      call(1, "open", { path: "decisions/d-001.md" }),
      call(2, "open", { path: "../README.md" }),
      call(3, "open", { path: "decisions/d-999.md" }),
    ]);
    const text = resultText(replies.get(1)!);
    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toContain("use SQLite in WAL mode as the sole datastore for Ledgerline v1;");
    for (const id of [2, 3]) {
      expect(replies.get(id)!.error?.message, `request ${id} should have failed`).toBeTruthy();
    }
  });

  test("links returns outgoing edges AND incoming backlinks (decisions/d-008.md)", async () => {
    const replies = await callLane(SERVER, [call(1, "links", { path: "decisions/d-008.md" })]);
    const payload = JSON.parse(resultText(replies.get(1)!)) as {
      path: string;
      title: string;
      outgoing: { type: string; to: string }[];
      incoming: { type: string; from: string }[];
    };
    expect(payload.title).toBe("Wayfare moves to an edge-gateway hub per station");
    expect(payload.outgoing).toContainEqual({ type: "supersedes", to: "decisions/d-003.md" });
    expect(payload.outgoing).toContainEqual({ type: "influenced_by", to: "sessions/s-004.md" });
    const incomingFrom = payload.incoming.map((l) => l.from);
    expect(incomingFrom).toEqual(expect.arrayContaining(["projects/wayfare.md", "meetings/m-008.md"]));
    // story separation holds structurally: a hand-authored record's links
    // stay inside the hand-authored world
    const handPaths = new Set(
      loadCorpus()
        .filter((r) => r.fm?.["provenance"] === "hand-authored")
        .map((r) => r.relPath),
    );
    for (const l of [...payload.outgoing, ...payload.incoming]) {
      const other = "to" in l ? l.to : l.from;
      expect(handPaths.has(other), `link ${l.type} → ${other}`).toBe(true);
    }
  });

  test("links on a missing record errors", async () => {
    const replies = await callLane(SERVER, [call(1, "links", { path: "decisions/d-999.md" })]);
    expect(replies.get(1)!.error?.message).toBeTruthy();
  });
});
