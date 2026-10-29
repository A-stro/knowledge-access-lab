// probes/corpus-lint.test.ts — ISC-5
// Corpus lint: seven genres, ≥200 records, frontmatter schema + link integrity.
//
// The corpus is the shared substrate every lane reads; this probe is what
// makes "same data, different architectures" checkable rather than assumed.

import { describe, expect, test } from "bun:test";
import {
  EDGE_TYPES,
  GENRES,
  DECISION_STATUSES,
  ORG_KINDS,
  PROJECT_STATUSES,
  asDateString,
  formatViolations,
  idsByGenre,
  listCorpusTop,
  loadCorpus,
  normalizeEdgeTarget,
  paths,
  recordId,
  type CorpusRecord,
} from "./lib/corpus";

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function schemaViolations(records: CorpusRecord[]): string[] {
  const out: string[] = [];
  const seenIds = new Map<string, string>();
  for (const r of records) {
    const where = r.relPath;
    if (r.frontmatterError) {
      out.push(`${where}: ${r.frontmatterError}`);
      continue;
    }
    const fm = r.fm;
    if (!fm) {
      out.push(`${where}: missing frontmatter`);
      continue;
    }
    if (!isNonEmptyString(fm.id)) out.push(`${where}: id must be a non-empty string`);
    else if (fm.id !== r.stem) out.push(`${where}: id "${fm.id}" must equal filename stem "${r.stem}"`);
    else {
      const clash = seenIds.get(fm.id);
      if (clash) out.push(`${where}: duplicate id "${fm.id}" (already used by ${clash})`);
      else seenIds.set(fm.id, where);
    }
    if (fm.genre !== r.genre) out.push(`${where}: genre "${String(fm.genre)}" must equal directory "${r.genre}"`);
    if (!isNonEmptyString(fm.title)) out.push(`${where}: title must be a non-empty string`);
    const created = asDateString(fm.created);
    if (created === null) out.push(`${where}: created must be a YYYY-MM-DD date (got ${JSON.stringify(fm.created)})`);
    if (fm.updated !== undefined && asDateString(fm.updated) === null) {
      out.push(`${where}: updated must be a YYYY-MM-DD date (got ${JSON.stringify(fm.updated)})`);
    }
    if (fm.tags !== undefined) {
      if (!Array.isArray(fm.tags) || fm.tags.some((t) => typeof t !== "string")) {
        out.push(`${where}: tags must be an array of strings`);
      }
    }
    // genre-specific required fields
    if (r.genre === "projects") {
      if (!PROJECT_STATUSES.includes(fm.status as (typeof PROJECT_STATUSES)[number])) {
        out.push(`${where}: projects record needs status in {${PROJECT_STATUSES.join(", ")}} (got ${JSON.stringify(fm.status)})`);
      }
      if (fm.client !== undefined && !isNonEmptyString(fm.client)) {
        out.push(`${where}: client must be a non-empty string`);
      }
    }
    if (r.genre === "decisions") {
      if (!DECISION_STATUSES.includes(fm.status as (typeof DECISION_STATUSES)[number])) {
        out.push(`${where}: decisions record needs status in {${DECISION_STATUSES.join(", ")}} (got ${JSON.stringify(fm.status)})`);
      }
    }
    if (r.genre === "meetings") {
      const attendees = fm.attendees;
      if (!Array.isArray(attendees) || attendees.length === 0 || attendees.some((a) => typeof a !== "string")) {
        out.push(`${where}: meetings record needs a non-empty attendees array of person ids`);
      }
    }
    if (r.genre === "people") {
      if (!isNonEmptyString(fm.role)) out.push(`${where}: people record needs a non-empty role`);
    }
    if (r.genre === "orgs") {
      if (!ORG_KINDS.includes(fm.kind as (typeof ORG_KINDS)[number])) {
        out.push(`${where}: orgs record needs kind in {${ORG_KINDS.join(", ")}} (got ${JSON.stringify(fm.kind)})`);
      }
    }
    if (r.genre === "references") {
      if (!isNonEmptyString(fm.source)) out.push(`${where}: references record needs a non-empty source`);
    }
  }
  return out;
}

function linkViolations(records: CorpusRecord[]): string[] {
  const out: string[] = [];
  const allPaths = paths(records);
  const peopleIds = idsByGenre(records, "people");
  const orgIds = idsByGenre(records, "orgs");
  for (const r of records) {
    if (!r.fm) continue;
    const where = r.relPath;
    const related = r.fm.related;
    if (related === undefined) continue;
    if (!Array.isArray(related)) {
      out.push(`${where}: related must be an array of {type, to} edges`);
      continue;
    }
    const seen = new Set<string>();
    for (const edge of related) {
      if (typeof edge !== "object" || edge === null || Array.isArray(edge)) {
        out.push(`${where}: related edge must be an object (got ${JSON.stringify(edge)})`);
        continue;
      }
      const e = edge as Record<string, unknown>;
      if (!EDGE_TYPES.includes(e.type as (typeof EDGE_TYPES)[number])) {
        out.push(`${where}: edge type "${String(e.type)}" not in {${EDGE_TYPES.join(", ")}}`);
      }
      const to = normalizeEdgeTarget(e.to);
      if (to === null) {
        out.push(`${where}: edge target must be a corpus-relative .md path (got ${JSON.stringify(e.to)})`);
        continue;
      }
      if (to === r.relPath) out.push(`${where}: self-edge to ${to}`);
      if (!allPaths.has(to)) out.push(`${where}: edge target ${to} does not exist`);
      const key = `${String(e.type)}→${to}`;
      if (seen.has(key)) out.push(`${where}: duplicate edge ${key}`);
      seen.add(key);
    }
    // cross-record id references
    if (r.genre === "meetings" && Array.isArray(r.fm.attendees)) {
      for (const a of r.fm.attendees) {
        if (typeof a === "string" && !peopleIds.has(a)) {
          out.push(`${where}: attendee "${a}" is not an existing people record id`);
        }
      }
    }
    if (r.genre === "projects" && typeof r.fm.client === "string" && !orgIds.has(r.fm.client)) {
      out.push(`${where}: client "${r.fm.client}" is not an existing orgs record id`);
    }
  }
  return out;
}

describe("ISC-5 — corpus lint: 7 genres, ≥200 records, schema + link integrity", () => {
  const records = loadCorpus();

  test("corpus root holds exactly the seven genre directories and no stray files", () => {
    const { dirs, strays } = listCorpusTop();
    expect([...dirs].sort()).toEqual([...GENRES].sort());
    expect(strays.filter((s) => s !== ".gitkeep")).toEqual([]);
  });

  test(`corpus holds at least 200 records (found ${records.length})`, () => {
    expect(records.length).toBeGreaterThanOrEqual(200);
  });

  test("every record passes the frontmatter schema", () => {
    const violations = schemaViolations(records);
    if (violations.length > 0) throw new Error(formatViolations("frontmatter schema", violations));
    expect(violations).toEqual([]);
  });

  test("every record passes link integrity (typed edges resolve; no self/duplicate edges; id refs exist)", () => {
    const violations = linkViolations(records);
    if (violations.length > 0) throw new Error(formatViolations("link integrity", violations));
    expect(violations).toEqual([]);
  });

  test("every record id is unique", () => {
    const ids = records.map((r) => String(recordId(r) ?? ""));
    const dupes = ids.filter((id, i) => id !== "" && ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});
