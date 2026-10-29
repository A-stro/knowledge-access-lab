// lanes/wiki/server.ts — wiki lane MCP server (F2, ISC-11).
//
// The wiki surface over the shared tree:
//   `list`  → the corpus structure tree plus the seven-genre taxonomy
//   `open`  → a full record
//   `links` → outgoing AND incoming links for a record — backlinks are the
//             gap real wiki tools demonstrably lack; this fills it
//
// Retrieval-only: reads the committed corpus through lanes/lib/graph.ts
// (which shares the probes' corpus contract). All outputs deterministic.

import { serve, type ToolHandler, type ToolSpec } from "../mcp-kit";
import { GENRES, listRecords, linksOf, readRecord, recordTitle } from "../lib/graph";

const TAXONOMY: Record<string, string> = {
  decisions: "decision records with status: accepted, rejected, or superseded",
  meetings: "meeting notes with attendees and cross-references",
  orgs: "organizations: clients, partners, vendors, and the studio itself",
  people: "people records with roles across the studio and its clients",
  projects: "project records with status and an optional client org",
  references: "reading notes and ops notes that informed decisions",
  sessions: "work-session records",
};

// The list render is COMPACT JSON, deliberately: the pinned harness (pi 1.4.0)
// mid-truncates MCP results over MCP_OUTPUT_MAX_BYTES (20 * 1024) with a
// "…N chars truncated…" marker, and the trace schema's full-results invariant
// refuses to record elided results — a run that triggers elision cannot
// produce a valid artifact. Over the frozen corpus the pretty-printed render
// measured 31,423 bytes (elided); the compact render carries the identical
// fields and values in 20,063 bytes, under the cap with margin. The wiki-lane
// probe pins this: if the corpus ever grows past the cap, the probe fails
// loudly instead of a suite run silently losing its tree to elision.
const list: ToolHandler = (args) => {
  const genre = typeof args.genre === "string" ? args.genre : undefined;
  const genres = listRecords(genre);
  return JSON.stringify({
    taxonomy: Object.fromEntries(genres.map((g) => [g.genre, TAXONOMY[g.genre] ?? ""])),
    genres: genres.map((g) => ({ genre: g.genre, count: g.records.length, records: g.records })),
  });
};

const open: ToolHandler = (args) => {
  const path = typeof args.path === "string" ? args.path : "";
  return readRecord(path);
};

const links: ToolHandler = (args) => {
  const path = typeof args.path === "string" ? args.path : "";
  const { outgoing, incoming } = linksOf(path);
  return JSON.stringify({ path, title: recordTitle(path), outgoing, incoming }, null, 2);
};

const tools: ToolSpec[] = [
  {
    name: "list",
    description:
      "List the corpus structure tree with the seven-genre taxonomy. " +
      "Without a genre filter, returns every genre with its record ids, titles, and paths.",
    inputSchema: {
      type: "object",
      properties: { genre: { type: "string", description: `Optional filter: one of ${GENRES.join(", ")}` } },
    },
  },
  {
    name: "open",
    description: "Open a full record (frontmatter + body) by its corpus-relative path, e.g. decisions/d-001.md.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "links",
    description:
      "Links of a record: outgoing typed edges AND incoming backlinks from other records — the backlink surface most wiki tools lack.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

serve("wiki-lane", tools, { list, open, links });
