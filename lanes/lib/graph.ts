// lanes/lib/graph.ts — shared corpus + graph access for the structure lanes.
//
// The wiki and graph lanes both read the committed corpus through this layer;
// the vocabulary (genres, five typed edges) and the loader are imported from
// probes/lib/corpus.ts so lanes and probes share one corpus contract. Edges
// are the curated `related:` frontmatter links authored at write time —
// never extracted. All outputs are deterministic: records, edges, neighbors,
// and paths are emitted in fixed sorted order.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EDGE_TYPES,
  GENRES,
  loadCorpus,
  normalizeEdgeTarget,
  type CorpusRecord,
  type EdgeType,
} from "../../probes/lib/corpus";

export const REPO_ROOT = join(import.meta.dir, "..", "..");
const CORPUS_DIR = join(REPO_ROOT, "corpus");

export const RECORD_PATH_RE =
  /^(?:decisions|meetings|orgs|people|projects|references|sessions)\/[a-z0-9-]+\.md$/;

export type Edge = { from: string; type: EdgeType; to: string };
export type PathStep = { type: EdgeType; path: string };

const records: CorpusRecord[] = loadCorpus().sort((a, b) => (a.relPath < b.relPath ? -1 : 1));
const byPath = new Map<string, CorpusRecord>(records.map((r) => [r.relPath, r]));
const titleByPath = new Map<string, string>(
  records.map((r) => [r.relPath, String(r.fm?.["title"] ?? r.stem)]),
);

const edges: Edge[] = [];
for (const r of records) {
  const related = r.fm?.["related"];
  if (!Array.isArray(related)) continue;
  for (const e of related) {
    const type = (e as { type?: unknown }).type;
    const to = normalizeEdgeTarget((e as { to?: unknown }).to);
    if (to === null || !EDGE_TYPES.includes(type as EdgeType)) continue; // corpus-lint enforces upstream
    edges.push({ from: r.relPath, type: type as EdgeType, to });
  }
}
edges.sort((a, b) =>
  a.from < b.from ? -1 : a.from > b.from ? 1 : a.type < b.type ? -1 : a.type > b.type ? 1 : a.path < b.path ? -1 : 1,
);

const byFrom = new Map<string, Edge[]>();
const byTo = new Map<string, Edge[]>();
for (const e of edges) {
  if (!byFrom.has(e.from)) byFrom.set(e.from, []);
  byFrom.get(e.from)!.push(e);
  if (!byTo.has(e.to)) byTo.set(e.to, []);
  byTo.get(e.to)!.push(e);
}

// ---------------------------------------------------------------------------
// record access (shared by lanes' open/get surfaces)

export function existsRecord(path: string): boolean {
  return RECORD_PATH_RE.test(path) && byPath.has(path);
}

export function readRecord(path: string): string {
  if (!RECORD_PATH_RE.test(path)) {
    throw new Error(`invalid record path: ${JSON.stringify(path)} — expected <genre>/<id>.md`);
  }
  if (!byPath.has(path)) throw new Error(`record not found: ${path}`);
  return readFileSync(join(CORPUS_DIR, path), "utf8");
}

export function listRecords(genre?: string): { genre: string; records: { id: string; title: string; path: string }[] }[] {
  const wanted = genre !== undefined ? [genre] : [...GENRES];
  if (genre !== undefined && !GENRES.includes(genre as (typeof GENRES)[number])) {
    throw new Error(`invalid genre: ${JSON.stringify(genre)} — expected one of ${GENRES.join(", ")}`);
  }
  return wanted.map((g) => ({
    genre: g,
    records: records
      .filter((r) => r.genre === g)
      .map((r) => ({ id: r.stem, title: String(r.fm?.["title"] ?? r.stem), path: r.relPath })),
  }));
}

// ---------------------------------------------------------------------------
// entity resolution (F6's seeded entry point — lookup, never record text)

export type LookupMatch = {
  path: string;
  title: string;
  /** why this record matched — "path", "id", "id-partial", or "title-partial" */
  match: "path" | "id" | "id-partial" | "title-partial";
};

/** Matches returned per lookup (the payload is tiny — titles only — so this
 * is a sanity bound, not the MCP transport cap). */
export const LOOKUP_RESULT_CAP = 24;

const LOOKUP_RANKS: LookupMatch["match"][] = ["path", "id", "id-partial", "title-partial"];

/**
 * Resolve a name, title, or record path to record paths + titles — the
 * cold-start entry point the bare graph lane lacks (ISC-12 measured it at
 * 0/908 successful calls: every call needs a record path, and the questions
 * carry names). Returns paths and titles ONLY, never record text, so a
 * seeded lane's passage fidelity stays structurally zero (ISC-28: no record
 * title carries any gold passage).
 *
 * Deterministic: best rank per record (exact path > exact id > id substring
 * > title substring, all case-insensitive), then path order.
 */
export function lookupRecords(query: string, genre?: string): { found: number; matches: LookupMatch[] } {
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("invalid query: expected a non-empty name, title, or record path");
  }
  let q = query.trim().replace(/^\.\//, "");
  // accept a sandbox-absolute path too ("<any>/corpus/<genre>/<id>.md"), the
  // same transport tolerance the F4 scorer applies to tool arguments
  const sandboxed = q.match(/^\/.*\/corpus\/(.+)$/);
  if (sandboxed) q = sandboxed[1]!;
  if (genre !== undefined && !GENRES.includes(genre as (typeof GENRES)[number])) {
    throw new Error(`invalid genre: ${JSON.stringify(genre)} — expected one of ${GENRES.join(", ")}`);
  }
  const wanted = genre === undefined ? records : records.filter((r) => r.genre === genre);
  const needle = q.toLowerCase();
  const best = new Map<string, { rank: number; match: LookupMatch }>();
  for (const r of wanted) {
    const title = String(r.fm?.["title"] ?? r.stem);
    const stem = r.stem.toLowerCase();
    let rank: number;
    if (q === r.relPath) rank = 0;
    else if (stem === needle) rank = 1;
    else if (stem.includes(needle)) rank = 2;
    else if (title.toLowerCase().includes(needle)) rank = 3;
    else continue;
    const prev = best.get(r.relPath);
    if (prev === undefined || rank < prev.rank) {
      best.set(r.relPath, { rank, match: { path: r.relPath, title, match: LOOKUP_RANKS[rank]! } });
    }
  }
  const ordered = [...best.values()]
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.match.path < b.match.path ? -1 : 1))
    .map((v) => v.match);
  return { found: ordered.length, matches: ordered.slice(0, LOOKUP_RESULT_CAP) };
}

// ---------------------------------------------------------------------------
// edges, backlinks, traversal

export function linksOf(path: string): {
  outgoing: { type: EdgeType; to: string }[];
  incoming: { type: EdgeType; from: string }[];
} {
  if (!existsRecord(path)) throw new Error(`record not found: ${path}`);
  const outgoing = (byFrom.get(path) ?? []).map((e) => ({ type: e.type, to: e.to }));
  const incoming = (byTo.get(path) ?? []).map((e) => ({ type: e.type, from: e.from }));
  const byTypePath = (a: { type: string; [k: string]: unknown }, b: { type: string; [k: string]: unknown }) =>
    a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
  outgoing.sort(byTypePath);
  incoming.sort(byTypePath);
  return { outgoing, incoming };
}

export function neighborsOf(
  path: string,
  opts: { types?: string[]; direction?: string } = {},
): { type: EdgeType; direction: "incoming" | "outgoing"; path: string }[] {
  if (!existsRecord(path)) throw new Error(`record not found: ${path}`);
  const direction = opts.direction ?? "both";
  if (direction !== "both" && direction !== "incoming" && direction !== "outgoing") {
    throw new Error(`invalid direction: ${JSON.stringify(direction)} — expected incoming, outgoing, or both`);
  }
  const typeFilter = opts.types !== undefined ? new Set(opts.types) : null;
  if (typeFilter) {
    const invalid = [...typeFilter].filter((t) => !EDGE_TYPES.includes(t as EdgeType));
    if (invalid.length > 0) throw new Error(`invalid edge_types: ${invalid.join(", ")} — expected subset of ${EDGE_TYPES.join(", ")}`);
  }
  const out: { type: EdgeType; direction: "incoming" | "outgoing"; path: string }[] = [];
  if (direction === "both" || direction === "incoming") {
    for (const e of byTo.get(path) ?? []) out.push({ type: e.type, direction: "incoming", path: e.from });
  }
  if (direction === "both" || direction === "outgoing") {
    for (const e of byFrom.get(path) ?? []) out.push({ type: e.type, direction: "outgoing", path: e.to });
  }
  const filtered = typeFilter ? out.filter((n) => typeFilter.has(n.type)) : out;
  filtered.sort((a, b) =>
    a.direction < b.direction ? -1 : a.direction > b.direction ? 1 : a.type < b.type ? -1 : a.type > b.type ? 1 : a.path < b.path ? -1 : 1,
  );
  return filtered;
}

export const PATH_RESULT_CAP = 8;
export const PATH_MAX_DEPTH = 6;

function adjacency(node: string): { type: EdgeType; next: string }[] {
  const out: { type: EdgeType; next: string }[] = [];
  for (const e of byFrom.get(node) ?? []) out.push({ type: e.type, next: e.to });
  for (const e of byTo.get(node) ?? []) out.push({ type: e.type, next: e.from });
  out.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.next < b.next ? -1 : 1));
  return out;
}

/** Simple typed-edge paths from `from` to `to`, 1..maxDepth hops, shortest first (deterministic). */
export function findPaths(from: string, to: string, maxDepth: number): PathStep[][] {
  const results: PathStep[][] = [];
  const walk = (node: string, visited: Set<string>, steps: PathStep[]): void => {
    for (const { type, next } of adjacency(node)) {
      if (visited.has(next)) continue;
      const nextSteps: PathStep[] = [...steps, { type, path: next }];
      if (next === to) {
        results.push(nextSteps);
        continue;
      }
      if (nextSteps.length < maxDepth) {
        visited.add(next);
        walk(next, visited, nextSteps);
        visited.delete(next);
      }
    }
  };
  walk(from, new Set([from]), []);
  results.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    const ja = JSON.stringify(a);
    const jb = JSON.stringify(b);
    return ja < jb ? -1 : ja > jb ? 1 : 0;
  });
  return results.slice(0, PATH_RESULT_CAP);
}

export function recordTitle(path: string): string {
  return titleByPath.get(path) ?? path;
}

export { EDGE_TYPES, GENRES };
export type { EdgeType };
