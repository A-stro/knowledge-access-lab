// lanes/graph/server.ts — graph lane MCP server (F2, ISC-12).
//
// The BARE graph lane: traversal over the five typed edges
// (mentions, influenced_by, supersedes, contradicts, relates_to):
//   `neighbors` → typed adjacent records for one record (either direction, filterable)
//   `paths`      → typed-edge paths between two records (multi-hop chains,
//                  shortest first, deterministic)
// Edges are authored in `related:` frontmatter at write time, never extracted.
// Retrieval-only. All outputs deterministic.
//
// The tool specs and handlers live in lanes/lib/graph-tools.ts — the frozen
// F2 surface shared verbatim with F6's seeded lane (lanes/graph-seed), which
// adds `lookup` without touching anything here. This server is unchanged in
// behavior: the extraction is structural sharing, and the lane-parity probe
// pins byte-identical wire output across the two servers.

import { serve } from "../mcp-kit";
import { neighborsHandler, neighborsSpec, pathsHandler, pathsSpec } from "../lib/graph-tools";

serve("graph-lane", [neighborsSpec, pathsSpec], {
  neighbors: neighborsHandler,
  paths: pathsHandler,
});
