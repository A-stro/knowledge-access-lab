// probes/graph-lane.test.ts — ISC-12 (lane behavior)
// Drives the graph lane MCP server over stdio: typed-edge neighbors with
// direction and type filters, and multi-hop typed-edge paths — the surface
// the multi-hop gold category exists to reward. Cross-world reachability is
// asserted unreachable: story separation must hold in the graph itself.

import { describe, expect, test } from "bun:test";
import { callLane, resultText } from "./lib/lane-driver";

const SERVER = "lanes/graph/server.ts";
const call = (id: number, name: string, arguments_: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: arguments_ },
});

type Neighbor = { type: string; direction: string; path: string };
type Step = { type: string; path: string };

describe("ISC-12 — graph lane behavior over the five typed edges", () => {
  test("neighbors of sessions/s-004.md across both directions", async () => {
    const replies = await callLane(SERVER, [call(1, "neighbors", { path: "sessions/s-004.md" })]);
    const payload = JSON.parse(resultText(replies.get(1)!)) as { path: string; neighbors: Neighbor[] };
    expect(payload.path).toBe("sessions/s-004.md");
    expect(payload.neighbors).toContainEqual({ type: "contradicts", direction: "outgoing", path: "decisions/d-003.md" });
    expect(payload.neighbors).toContainEqual({ type: "influenced_by", direction: "incoming", path: "decisions/d-008.md" });
    expect(payload.neighbors).toContainEqual({ type: "mentions", direction: "incoming", path: "meetings/m-005.md" });
  });

  test("edge_types and direction filters narrow the neighbor set", async () => {
    const replies = await callLane(SERVER, [
      call(1, "neighbors", { path: "decisions/d-008.md", edge_types: ["supersedes"] }),
      call(2, "neighbors", { path: "decisions/d-008.md", direction: "incoming" }),
      call(3, "neighbors", { path: "decisions/d-008.md", edge_types: ["smoke_signals"] }),
    ]);
    const onlySupersedes = JSON.parse(resultText(replies.get(1)!)) as { neighbors: Neighbor[] };
    expect(onlySupersedes.neighbors).toEqual([
      { type: "supersedes", direction: "outgoing", path: "decisions/d-003.md" },
    ]);
    const incoming = JSON.parse(resultText(replies.get(2)!)) as { neighbors: Neighbor[] };
    expect(incoming.neighbors.length).toBeGreaterThan(0);
    for (const n of incoming.neighbors) expect(n.direction).toBe("incoming");
    expect(replies.get(3)!.error?.message).toBeTruthy();
  });

  test("paths d-003 → m-005 finds the 2-hop chain via d-008 (supersedes, influenced_by)", async () => {
    const replies = await callLane(SERVER, [
      call(1, "paths", { from: "decisions/d-003.md", to: "meetings/m-005.md" }),
    ]);
    const payload = JSON.parse(resultText(replies.get(1)!)) as { found: number; paths: Step[][] };
    expect(payload.found).toBeGreaterThanOrEqual(2); // via d-008 AND via wayfare.md
    const viaD008 = payload.paths.find(
      (p) =>
        p.length === 2 &&
        p[0].type === "supersedes" &&
        p[0].path === "decisions/d-008.md" &&
        p[1].type === "influenced_by" &&
        p[1].path === "meetings/m-005.md",
    );
    expect(viaD008).toBeDefined();
    for (const p of payload.paths) {
      expect(p.length).toBeLessThanOrEqual(4);
      expect(p[p.length - 1].path).toBe("meetings/m-005.md");
    }
  });

  test("cross-world pairs are unreachable — story separation holds in the graph", async () => {
    const replies = await callLane(SERVER, [
      call(1, "paths", { from: "references/wcag-contrast-notes.md", to: "orgs/wharfworks-collective.md" }),
    ]);
    const payload = JSON.parse(resultText(replies.get(1)!)) as { found: number; paths: Step[][] };
    expect(payload.found).toBe(0);
    expect(payload.paths).toEqual([]);
  });

  test("invalid input errors: missing records, from === to, bad max_depth, bad path", async () => {
    const replies = await callLane(SERVER, [
      call(1, "neighbors", { path: "decisions/d-999.md" }),
      call(2, "paths", { from: "decisions/d-001.md", to: "decisions/d-001.md" }),
      call(3, "paths", { from: "decisions/d-001.md", to: "meetings/m-999.md" }),
      call(4, "paths", { from: "decisions/d-001.md", to: "meetings/m-001.md", max_depth: 0 }),
      call(5, "paths", { from: "../README.md", to: "meetings/m-001.md" }),
    ]);
    for (const id of [1, 2, 3, 4, 5]) {
      expect(replies.get(id)!.error?.message, `request ${id} should have failed`).toBeTruthy();
    }
  });
});
