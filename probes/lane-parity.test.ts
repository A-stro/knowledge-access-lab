// probes/lane-parity.test.ts — ISC-2 + ISC-3
// Lane parity: every lane is a tiny (2-4 tool) retrieval-only surface, and
// every lane reads the SAME committed corpus — the invariant that makes the
// architecture comparison fair. Checks the MCP lanes' served tool sets,
// cross-lane byte parity on the same record, the .pi/mcp.json wiring, and the
// direct lane's committed allowlist. F6's seeded graph lane (lanes/graph-seed)
// shares the frozen neighbors/paths implementation with the bare graph lane
// (lanes/lib/graph-tools.ts) and adds lookup — byte parity between the two
// servers is pinned in probes/graph-seed-lane.test.ts (ISC-30).

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DIRECT_LANE_TOOLS } from "../lanes/direct/allowlist";
import { REPO_ROOT } from "./lib/corpus";
import { callLane, resultText } from "./lib/lane-driver";

const EXPECTED_TOOLS: Record<string, string[]> = {
  "lanes/rag/server.ts": ["get", "semantic_search"],
  "lanes/wiki/server.ts": ["links", "list", "open"],
  "lanes/graph/server.ts": ["neighbors", "paths"],
  "lanes/graph-seed/server.ts": ["lookup", "neighbors", "paths"],
};

describe("ISC-2/3 — lane parity: tiny retrieval-only surfaces over one corpus", () => {
  test("every MCP lane serves exactly its spec'd tool set, 2-4 tools (ISC-2)", async () => {
    for (const [server, expected] of Object.entries(EXPECTED_TOOLS)) {
      const replies = await callLane(server, [
        { jsonrpc: "2.0", id: 0, method: "initialize", params: {} },
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
      ]);
      const tools = ((replies.get(1)!.result as { tools: { name: string }[] }).tools ?? [])
        .map((t) => t.name)
        .sort();
      expect(tools, server).toEqual(expected);
      expect(tools.length, server).toBeGreaterThanOrEqual(2);
      expect(tools.length, server).toBeLessThanOrEqual(4);
    }
  });

  test("the same record returns byte-identical content through every lane's record surface (ISC-3)", async () => {
    const ragReplies = await callLane("lanes/rag/server.ts", [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get", arguments: { path: "decisions/d-001.md" } },
      },
    ]);
    const wikiReplies = await callLane("lanes/wiki/server.ts", [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "open", arguments: { path: "decisions/d-001.md" } },
      },
    ]);
    const viaRag = resultText(ragReplies.get(1)!);
    const viaWiki = resultText(wikiReplies.get(1)!);
    expect(viaWiki).toBe(viaRag);
    const raw = readFileSync(join(REPO_ROOT, "corpus", "decisions", "d-001.md"), "utf8");
    expect(viaRag).toBe(raw);
  });

  test(".pi/mcp.json wires exactly the lane servers that exist", () => {
    const wiring = JSON.parse(readFileSync(join(REPO_ROOT, ".pi", "mcp.json"), "utf8")) as {
      mcpServers: Record<string, { args: string[] }>;
    };
    expect(Object.keys(wiring.mcpServers).sort()).toEqual([
      "graph-lane",
      "graph-seed-lane",
      "rag-lane",
      "wiki-lane",
    ]);
    for (const [name, cfg] of Object.entries(wiring.mcpServers)) {
      const serverPath = `lanes/${name.replace("-lane", "")}/server.ts`;
      expect(cfg.args[0], name).toBe(serverPath);
      expect(existsSync(join(REPO_ROOT, serverPath)), name).toBe(true);
    }
  });

  test("the direct lane allowlist is the four read-only native tools, matching the README spec", () => {
    expect([...DIRECT_LANE_TOOLS].sort()).toEqual(["find", "grep", "ls", "read"]);
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toContain("`read`, `grep`, `find`, `ls`");
  });
});
