// probes/rag-lane.test.ts — ISC-9 (lane behavior)
// Drives the RAG lane MCP server over stdio exactly as a harness would.
// Covers the two documented input paths for semantic_search — the exact-text
// path is the one a lane agent falls back to, so a regression there burns
// agent turns silently (it shipped once; this probe exists so it cannot
// ship again) — plus result shape, ranking order, get, and input rejection.

import { describe, expect, test } from "bun:test";
import { callLane, resultText, type RpcLine } from "./lib/lane-driver";

type SearchPayload = {
  question: string;
  dims: number;
  results: { path: string; para: number; score: number; passage: string }[];
};

const searchPayload = (reply: RpcLine): SearchPayload => JSON.parse(resultText(reply));

describe("ISC-9 — RAG lane behavior over the committed index", () => {
  test("initialize handshake responds with the protocol version", async () => {
    const replies = await callLane("lanes/rag/server.ts", [
      { jsonrpc: "2.0", id: 0, method: "initialize", params: {} },
    ]);
    const init = replies.get(0)!;
    expect(init.error).toBeUndefined();
    expect((init.result as { protocolVersion: string }).protocolVersion).toBeTruthy();
  });

  test("semantic_search by question id returns ranked passages with the gold record", async () => {
    const replies = await callLane("lanes/rag/server.ts", [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "semantic_search", arguments: { question_id: "q-pl-01" } },
      },
    ]);
    const payload = searchPayload(replies.get(1)!);
    expect(payload.question).toBe("q-pl-01");
    expect(payload.dims).toBe(1024);
    expect(payload.results.length).toBe(10);
    for (let i = 1; i < payload.results.length; i++) {
      expect(payload.results[i].score).toBeLessThanOrEqual(payload.results[i - 1].score);
    }
    expect(payload.results.some((r) => r.path === "decisions/d-001.md")).toBe(true);
    for (const r of payload.results) {
      expect(r.passage.trim().length).toBeGreaterThan(0);
      expect(r.path).toMatch(
        /^(?:decisions|meetings|orgs|people|projects|references|sessions)\/[a-z0-9-]+\.md$/,
      );
    }
  });

  test("semantic_search by exact question text resolves the same question (the path a fallback agent takes)", async () => {
    const replies = await callLane("lanes/rag/server.ts", [
      {
        jsonrpc: "2.0",
        id: 0,
        method: "tools/call",
        params: {
          name: "semantic_search",
          arguments: { query: "What datastore does the Ledgerline service use?" },
        },
      },
    ]);
    const payload = searchPayload(replies.get(0)!);
    expect(payload.question).toBe("q-pl-01");
    expect(payload.results.length).toBe(10);
  });

  test("get returns the full raw record (frontmatter + body)", async () => {
    const replies = await callLane("lanes/rag/server.ts", [
      {
        jsonrpc: "2.0",
        id: 0,
        method: "tools/call",
        params: { name: "get", arguments: { path: "decisions/d-001.md" } },
      },
    ]);
    const text = resultText(replies.get(0)!);
    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toContain("use SQLite in WAL mode as the sole datastore for Ledgerline v1;");
  });

  test("invalid input is rejected with JSON-RPC errors, not silently empty results", async () => {
    const replies = await callLane("lanes/rag/server.ts", [
      {
        jsonrpc: "2.0",
        id: 0,
        method: "tools/call",
        params: { name: "get", arguments: { path: "../README.md" } },
      },
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get", arguments: { path: "corpus/decisions/d-001.md" } },
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "semantic_search", arguments: { question_id: "q-does-not-exist" } },
      },
    ]);
    for (const id of [0, 1, 2]) {
      const call = replies.get(id)!;
      expect(call.error?.message, `request ${id} should have failed`).toBeTruthy();
    }
  });
});
