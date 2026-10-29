// lanes/graph-seed/server.ts — the seeded graph lane (F6, ISC-30).
//
// The F6 experiment: the bare graph lane (ISC-12) measured 0/908 successful
// tool calls — every call needs a corpus record path, the questions carry
// names and titles, and there was no entry point — so the F2 expectation
// that typed-edge traversal wins multi-hop was never actually tested. This
// lane adds ONE tool, `lookup`, and changes NOTHING else:
//
//   `lookup`    → name / title / record path → record paths + titles ONLY
//                 (never record text — ISC-28: no title carries a gold
//                 passage, so this lane's passage fidelity stays zero BY
//                 ARCHITECTURE exactly like the bare lane's; only its
//                 judged-answer axis can move)
//   `neighbors` → the F2-frozen typed-edge surface, byte-identical
//   `paths`     → the F2-frozen typed-edge surface, byte-identical
//
// The frozen surface is shared from lanes/lib/graph-tools.ts, so this lane
// cannot drift from the bare lane's traversal semantics. Retrieval-only,
// three tools (within ISC-2's 2-4 bound), all outputs deterministic.

import { serve, type ToolHandler, type ToolSpec } from "../mcp-kit";
import { lookupRecords } from "../lib/graph";
import { neighborsHandler, neighborsSpec, pathsHandler, pathsSpec } from "../lib/graph-tools";

const lookup: ToolHandler = (args) => {
  const query = typeof args.query === "string" ? args.query : "";
  const genre = typeof args.genre === "string" ? args.genre : undefined;
  const { found, matches } = lookupRecords(query, genre);
  return JSON.stringify(
    { query, genre: genre ?? null, found, capped: found > matches.length, matches },
    null,
    2,
  );
};

const lookupSpec: ToolSpec = {
  name: "lookup",
  description:
    "Resolve a name, title, or record path to the records it refers to — the entry point for " +
    "graph traversal. Matches record ids and titles (exact, then case-insensitive substring), " +
    "optionally restricted to one genre. Returns record paths and titles only, never record text.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "A record name, title, or corpus-relative record path" },
      genre: {
        type: "string",
        description: "Optional genre filter (decisions, meetings, orgs, people, projects, references, sessions)",
      },
    },
    required: ["query"],
  },
};

const tools: ToolSpec[] = [lookupSpec, neighborsSpec, pathsSpec];

serve("graph-seed-lane", tools, { lookup, neighbors: neighborsHandler, paths: pathsHandler });
