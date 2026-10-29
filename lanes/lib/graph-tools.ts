// lanes/lib/graph-tools.ts — the frozen F2 traversal surface, shared.
//
// `neighbors` and `paths` are the F2-frozen graph surface: the bare graph
// lane (ISC-12) and F6's seeded graph lane (ISC-30) serve THE SAME handlers
// and THE SAME tool specs from here, so "the seeded lane adds lookup and
// leaves the frozen surface untouched" is structural, not copy-paste — one
// implementation, two servers. Behavior and descriptions are byte-identical
// by construction; the lane-parity and graph-seed probes assert exactly that
// on the wire.

import {
  EDGE_TYPES,
  PATH_MAX_DEPTH,
  PATH_RESULT_CAP,
  existsRecord,
  findPaths,
  neighborsOf,
} from "./graph";
import type { ToolHandler, ToolSpec } from "../mcp-kit";

export const neighborsSpec: ToolSpec = {
  name: "neighbors",
  description:
    "Traverse the typed edges from one record to its adjacent records, " +
    "with edge type and direction. Optionally filter by edge_types " +
    `(${EDGE_TYPES.join(", ")}) and direction (incoming, outgoing, both — default both).`,
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      edge_types: { type: "array", items: { type: "string" } },
      direction: { type: "string", enum: ["incoming", "outgoing", "both"] },
    },
    required: ["path"],
  },
};

export const pathsSpec: ToolSpec = {
  name: "paths",
  description:
    "Find typed-edge paths between two records — multi-hop chains over the five edge types, " +
    `shortest first, up to ${PATH_RESULT_CAP} results, default max_depth 4 (max ${PATH_MAX_DEPTH}).`,
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string" },
      to: { type: "string" },
      max_depth: { type: "number", description: `Path length cap, integer 1..${PATH_MAX_DEPTH} (default 4)` },
    },
    required: ["from", "to"],
  },
};

export const neighborsHandler: ToolHandler = (args) => {
  const path = typeof args.path === "string" ? args.path : "";
  const edgeTypes = Array.isArray(args.edge_types) ? args.edge_types.map((t) => String(t)) : undefined;
  const direction = typeof args.direction === "string" ? args.direction : undefined;
  const result = neighborsOf(path, { types: edgeTypes, direction });
  return JSON.stringify({ path, neighbors: result }, null, 2);
};

export const pathsHandler: ToolHandler = (args) => {
  const from = typeof args.from === "string" ? args.from : "";
  const to = typeof args.to === "string" ? args.to : "";
  let maxDepth = typeof args.max_depth === "number" ? args.max_depth : 4;
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > PATH_MAX_DEPTH) {
    throw new Error(`invalid max_depth: must be an integer 1..${PATH_MAX_DEPTH}`);
  }
  if (!existsRecord(from)) throw new Error(`record not found: ${from}`);
  if (!existsRecord(to)) throw new Error(`record not found: ${to}`);
  if (from === to) throw new Error("from and to must differ");
  const found = findPaths(from, to, maxDepth);
  return JSON.stringify(
    { from, to, max_depth: maxDepth, result_cap: PATH_RESULT_CAP, found: found.length, paths: found },
    null,
    2,
  );
};
