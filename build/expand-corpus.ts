// build/expand-corpus.ts — the committed deterministic corpus expander.
//
// Expands the hand-authored core (provenance: hand-authored) with the
// generated side-world (provenance: generated) for distractor density: a
// coherent parallel fictional story — Copperleaf Studio and its clients —
// authored as data in build/copperleaf-*.ts. It shares the corpus's
// vocabulary (timesheets, departure displays, OCR, billing runs, archives)
// so retrieval gets harder, but it never mentions a hand-authored entity:
// the expander enforces story separation with a protected-term check, so
// every gold-set answer stays unambiguous.
//
// Determinism: the content is authored data — no randomness, no clocks, no
// network. Byte-identical output on every rebuild; `--check` verifies the
// on-disk generated records match the generator's emission exactly.
//
// Self-validating: before writing and again after, the expander checks its
// output with the same vocabulary the integrity probes use (imported from
// probes/lib/corpus): frontmatter schema, link integrity, provenance
// marking, story separation, and the corpus size floors.
//
// Usage:
//   bun run build:expand          write the generated records (idempotent)
//   bun run build:expand --check  verify on-disk generated records are
//                                 byte-identical to the emission

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DECISION_STATUSES,
  EDGE_TYPES,
  GENRES,
  ORG_KINDS,
  PROJECT_STATUSES,
  PROVENANCE_VALUES,
  asDateString,
  loadCorpus,
  paths,
  type CorpusRecord,
  type EdgeType,
} from "../probes/lib/corpus";
import { ORG_SPECS, PEOPLE_SPECS, PROJECT_SPECS, REFERENCE_SPECS, type Spec } from "./copperleaf-world";
import { DECISION_SPECS, MEETING_SPECS } from "./copperleaf-story";
import { SESSION_SPECS } from "./copperleaf-sessions";

const SPECS: Spec[] = [
  ...ORG_SPECS,
  ...PEOPLE_SPECS,
  ...PROJECT_SPECS,
  ...REFERENCE_SPECS,
  ...DECISION_SPECS,
  ...MEETING_SPECS,
  ...SESSION_SPECS,
];

// ---------------------------------------------------------------------------
// Hand-authored entities that generated records must never mention. Story
// separation is what keeps gold answers unambiguous while the generated
// world supplies lexical distractors. (Lowercased at check time.)
const numericIds = (prefix: string, from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(3, "0")}`);

const HAND_PROTECTED_TERMS: string[] = [
  // organizations, city, stations
  "Meridian", "Ashport", "Halcyon", "Bellweather", "Greenline", "Northpost",
  "Quill", "Marrow", "Ferry Quay", "Millbrook",
  // projects
  "Wayfare", "Ledgerline", "Larkspur", "Kestrel", "Beacon Grid",
  // people
  "Mara Voss", "Theo Kanda", "Dev Okonkwo", "June Park", "Katrin Ilic",
  "Lorna Vey", "Noor Haddad", "Odessa Klein", "Bram Oyelaran",
  "Petra Lindqvist", "Rowan Ellery", "Silas Brandt",
  // hand-only technologies and signature facts
  "SQLite", "DuckDB", "IIIF", "WCAG", "MQTT 3.1.1", "Dublin Core",
  "green-and-amber",
  // hand record ids and reference ids
  ...numericIds("d-", 1, 11),
  ...numericIds("m-", 1, 8),
  ...numericIds("s-", 1, 10),
  "sqlite-wal-notes", "mqtt-311-notes", "ocr-comparison", "duckdb-notes",
  "iiif-overview", "wcag-contrast-notes", "latency-budget-notes",
  "fleet-provisioning-notes", "embedded-single-board-notes",
  "archive-metadata-notes",
];

// ---------------------------------------------------------------------------
// Resolution and rendering

const specPath = (s: Spec): string => `${s.genre}/${s.id}.md`;

const idToSpec = new Map<string, Spec>();
for (const s of SPECS) idToSpec.set(s.id, s);

type Edge = { type: EdgeType; to: string };

function edgesFor(s: Spec, problems: string[]): Edge[] {
  const out: Edge[] = [];
  const add = (type: EdgeType, targets: string[] | undefined): void => {
    for (const id of targets ?? []) {
      const target = idToSpec.get(id);
      if (!target) {
        problems.push(`${specPath(s)}: ${type} target "${id}" is not a generated record id`);
        continue;
      }
      if (target === s) {
        problems.push(`${specPath(s)}: self-edge (${type})`);
        continue;
      }
      const to = specPath(target);
      if (out.some((e) => e.type === type && e.to === to)) {
        problems.push(`${specPath(s)}: duplicate edge ${type} -> ${to}`);
        continue;
      }
      out.push({ type, to });
    }
  };
  add("supersedes", s.supersedes);
  add("contradicts", s.contradicts);
  add("influenced_by", s.influencedBy);
  add("relates_to", s.relatesTo);
  add("mentions", s.mentions);
  return out;
}

const WRAP_WIDTH = 76;

function wrapParagraph(text: string): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= WRAP_WIDTH) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join("\n");
}

function renderRecord(s: Spec, edges: Edge[]): string {
  const fm: string[] = ["---"];
  const flow = (items: string[]): string => `[${items.join(", ")}]`;
  fm.push(`id: ${s.id}`);
  fm.push(`genre: ${s.genre}`);
  fm.push(`title: ${JSON.stringify(s.title)}`);
  fm.push(`created: ${s.created}`);
  if (s.updated !== undefined) fm.push(`updated: ${s.updated}`);
  switch (s.genre) {
    case "decisions":
      fm.push("provenance: generated");
      fm.push(`tags: ${flow(s.tags)}`);
      fm.push(`status: ${s.status ?? ""}`);
      break;
    case "meetings":
      fm.push("provenance: generated");
      fm.push(`tags: ${flow(s.tags)}`);
      fm.push(`attendees: ${flow(s.attendees ?? [])}`);
      break;
    case "orgs":
      fm.push("provenance: generated");
      fm.push(`tags: ${flow(s.tags)}`);
      break;
    case "people":
      fm.push("provenance: generated");
      fm.push(`tags: ${flow(s.tags)}`);
      break;
    case "projects":
      fm.push(`status: ${s.status ?? ""}`);
      if (s.client !== undefined) fm.push(`client: ${s.client}`);
      fm.push("provenance: generated");
      fm.push(`tags: ${flow(s.tags)}`);
      break;
    case "references":
      fm.push("provenance: generated");
      fm.push(`tags: ${flow(s.tags)}`);
      fm.push(`source: ${JSON.stringify(s.source ?? "")}`);
      break;
    case "sessions":
      fm.push("provenance: generated");
      fm.push(`tags: ${flow(s.tags)}`);
      break;
  }
  if (edges.length > 0) {
    fm.push("related:");
    for (const e of edges) {
      fm.push(`  - type: ${e.type}`);
      fm.push(`    to: ${e.to}`);
    }
  }
  switch (s.genre) {
    case "orgs":
      fm.push(`kind: ${s.kind ?? ""}`);
      break;
    case "people":
      fm.push(`role: ${JSON.stringify(s.role ?? "")}`);
      break;
  }
  fm.push("---");
  return `${fm.join("\n")}\n\n${s.body.map(wrapParagraph).join("\n\n")}\n`;
}

// ---------------------------------------------------------------------------
// Spec validation (pre-render)

function peopleIds(): Set<string> {
  return new Set(PEOPLE_SPECS.map((p) => p.id));
}
function orgIds(): Set<string> {
  return new Set(ORG_SPECS.map((o) => o.id));
}

function validateSpecs(): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  const people = peopleIds();
  const orgs = orgIds();

  for (const s of SPECS) {
    const where = specPath(s);
    if (!GENRES.includes(s.genre as (typeof GENRES)[number])) {
      problems.push(`${where}: genre "${s.genre}" is not a corpus genre`);
    }
    if (seen.has(s.id)) problems.push(`${where}: duplicate id "${s.id}" (also ${seen.get(s.id)})`);
    else seen.set(s.id, where);
    if (s.id !== s.id.toLowerCase().replace(/[^a-z0-9-]/g, "-")) {
      problems.push(`${where}: id must be a lowercase slug`);
    }
    if (s.title.length === 0 || s.title.includes(`"`)) {
      problems.push(`${where}: title must be non-empty and quote-free`);
    }
    if (asDateString(s.created) === null) problems.push(`${where}: created "${s.created}" is not a date`);
    if (s.updated !== undefined && asDateString(s.updated) === null) {
      problems.push(`${where}: updated "${s.updated}" is not a date`);
    }
    if (s.updated !== undefined && s.updated < s.created) {
      problems.push(`${where}: updated ${s.updated} predates created ${s.created}`);
    }
    if (s.tags.length === 0) problems.push(`${where}: tags must not be empty`);
    if (s.body.length === 0) problems.push(`${where}: body must not be empty`);
    for (const tag of s.tags) {
      if (!/^[a-z][a-z0-9-]*$/.test(tag)) problems.push(`${where}: tag "${tag}" must be a lowercase slug`);
    }
    if (!EDGE_TYPES.every(() => true)) problems.push("unreachable");

    // genre-specific required fields
    switch (s.genre) {
      case "decisions":
        if (!DECISION_STATUSES.includes(s.status as (typeof DECISION_STATUSES)[number])) {
          problems.push(`${where}: decisions status "${String(s.status)}" not in {${DECISION_STATUSES.join(", ")}}`);
        }
        break;
      case "projects":
        if (!PROJECT_STATUSES.includes(s.status as (typeof PROJECT_STATUSES)[number])) {
          problems.push(`${where}: projects status "${String(s.status)}" not in {${PROJECT_STATUSES.join(", ")}}`);
        }
        if (s.client !== undefined && !orgs.has(s.client)) {
          problems.push(`${where}: client "${s.client}" is not a generated orgs record id`);
        }
        break;
      case "meetings":
        if ((s.attendees ?? []).length === 0) problems.push(`${where}: meetings need a non-empty attendees array`);
        for (const a of s.attendees ?? []) {
          if (!people.has(a)) problems.push(`${where}: attendee "${a}" is not a generated people record id`);
        }
        break;
      case "orgs":
        if (!ORG_KINDS.includes(s.kind as (typeof ORG_KINDS)[number])) {
          problems.push(`${where}: orgs kind "${String(s.kind)}" not in {${ORG_KINDS.join(", ")}}`);
        }
        break;
      case "people":
        if (!s.role || s.role.trim().length === 0) problems.push(`${where}: people need a non-empty role`);
        break;
      case "references":
        if (!s.source || s.source.trim().length === 0) {
          problems.push(`${where}: references need a non-empty source`);
        }
        break;
      case "sessions":
        break; // no extra fields
    }
  }
  return problems;
}

function storySeparationViolations(raws: Map<string, string>): string[] {
  const problems: string[] = [];
  const lowered = [...HAND_PROTECTED_TERMS.map((t) => [t, t.toLowerCase()] as const)];
  for (const [relPath, raw] of raws) {
    const rawLower = raw.toLowerCase();
    for (const [term, termLower] of lowered) {
      if (rawLower.includes(termLower)) {
        problems.push(`${relPath}: generated record mentions hand-authored term "${term}"`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Disk corpus validation (post-write) — mirrors the committed probes.

function validateCorpus(records: CorpusRecord[]): string[] {
  const problems: string[] = [];
  const allPaths = paths(records);
  const people = new Set<string>();
  const orgs = new Set<string>();
  for (const r of records) {
    if (r.genre === "people" && typeof r.fm?.["id"] === "string") people.add(r.fm["id"]);
    if (r.genre === "orgs" && typeof r.fm?.["id"] === "string") orgs.add(r.fm["id"]);
  }
  for (const r of records) {
    const where = r.relPath;
    if (r.frontmatterError) {
      problems.push(`${where}: ${r.frontmatterError}`);
      continue;
    }
    if (r.fm?.["id"] !== r.stem) problems.push(`${where}: id must equal filename stem`);
    if (r.fm?.["genre"] !== r.genre) problems.push(`${where}: genre must equal directory`);
    const provenance = r.fm?.["provenance"];
    if (!PROVENANCE_VALUES.includes(provenance as (typeof PROVENANCE_VALUES)[number])) {
      problems.push(`${where}: provenance "${String(provenance)}" not in {${PROVENANCE_VALUES.join(", ")}}`);
    }
    if (asDateString(r.fm?.["created"]) === null) problems.push(`${where}: created is not a date`);
    const related = r.fm?.["related"];
    if (related !== undefined) {
      if (!Array.isArray(related)) problems.push(`${where}: related must be an array`);
      else {
        const seen = new Set<string>();
        for (const edge of related) {
          const e = edge as Record<string, unknown>;
          if (!EDGE_TYPES.includes(e.type as EdgeType)) problems.push(`${where}: bad edge type ${String(e.type)}`);
          const to = String(e.to ?? "");
          if (to === where) problems.push(`${where}: self-edge`);
          if (!allPaths.has(to)) problems.push(`${where}: edge target ${to} does not exist`);
          const key = `${String(e.type)}->${to}`;
          if (seen.has(key)) problems.push(`${where}: duplicate edge ${key}`);
          seen.add(key);
        }
      }
    }
    if (r.genre === "meetings" && Array.isArray(r.fm?.["attendees"])) {
      for (const a of r.fm["attendees"]) {
        if (!people.has(String(a))) problems.push(`${where}: attendee "${String(a)}" is not a people record id`);
      }
    }
    if (r.genre === "projects" && typeof r.fm?.["client"] === "string" && !orgs.has(r.fm["client"])) {
      problems.push(`${where}: client "${r.fm["client"]}" is not an orgs record id`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Modes

function fail(label: string, problems: string[], show = 25): never {
  const shown = problems.slice(0, show).map((p) => `  - ${p}`).join("\n");
  const more = problems.length > show ? `\n  ... and ${problems.length - show} more` : "";
  console.error(`[expand] ${label}: ${problems.length} violation(s)\n${shown}${more}`);
  process.exit(1);
}

const checkMode = process.argv.includes("--check");
// The hand core is identified by its provenance mark, not by "whatever is on
// disk" — after the first run the generated records are on disk too.
const hand = loadCorpus().filter((r) => r.fm?.["provenance"] === "hand-authored");
const handStems = new Set(hand.map((r) => r.stem));
const handPaths = new Set(hand.map((r) => r.relPath));

// spec-level checks
const specProblems = validateSpecs();
if (specProblems.length > 0) fail("spec validation failed", specProblems);

// id collisions with the hand core
const collisions = SPECS.filter((s) => handStems.has(s.id)).map((s) => `id "${s.id}" collides with a hand-authored record`);
if (collisions.length > 0) fail("id collision with hand-authored core", collisions);

// render
const edgeProblems: string[] = [];
const rendered = new Map<string, string>();
for (const s of SPECS) {
  rendered.set(specPath(s), renderRecord(s, edgesFor(s, edgeProblems)));
}
if (edgeProblems.length > 0) fail("edge validation failed", edgeProblems);

// story separation
const separation = storySeparationViolations(rendered);
if (separation.length > 0) fail("story separation failed", separation);

// size floors
const generatedCount = SPECS.length;
const totalCount = hand.length + generatedCount;
if (generatedCount < 140) fail("size floor", [`generated expansion is ${generatedCount}, need >= 140`]);
if (totalCount < 200) fail("size floor", [`corpus is ${totalCount}, need >= 200`]);

const genreCounts = new Map<string, number>();
for (const s of SPECS) genreCounts.set(s.genre, (genreCounts.get(s.genre) ?? 0) + 1);

if (checkMode) {
  const drift: string[] = [];
  for (const [relPath, raw] of rendered) {
    const abs = join("corpus", relPath);
    if (!existsSync(abs)) {
      drift.push(`${relPath}: missing (generator would create it)`);
      continue;
    }
    if (readFileSync(abs, "utf8") !== raw) drift.push(`${relPath}: content differs from generator output`);
  }
  // files in genre dirs owned by neither the hand core nor the generator
  const knownPaths = new Set([...handPaths, ...rendered.keys()]);
  for (const genre of GENRES) {
    for (const name of readdirSync(join("corpus", genre))) {
      const rel = `${genre}/${name}`;
      if (name.endsWith(".md") && !knownPaths.has(rel)) drift.push(`${rel}: stray file (neither hand-authored nor generated)`);
      if (!name.endsWith(".md") && name !== ".gitkeep") drift.push(`${rel}: unexpected non-markdown file`);
    }
  }
  if (drift.length > 0) fail("check failed — rebuild with `bun run build:expand`", drift);
  console.log(`[expand] check passed — ${generatedCount} generated records are byte-identical to the generator output`);
  process.exit(0);
}

// write (only changed files; content is deterministic so this is idempotent)
let written = 0;
let unchanged = 0;
for (const [relPath, raw] of rendered) {
  const abs = join("corpus", relPath);
  if (existsSync(abs) && readFileSync(abs, "utf8") === raw) {
    unchanged += 1;
    continue;
  }
  mkdirSync(join("corpus", relPath.split("/")[0]), { recursive: true });
  writeFileSync(abs, raw);
  written += 1;
}

// post-write validation over the full corpus on disk
const after = loadCorpus();
const corpusProblems = validateCorpus(after);
if (corpusProblems.length > 0) fail("post-write corpus validation failed", corpusProblems);

const generatedOnDisk = after.filter((r) => r.fm?.["provenance"] === "generated");
const handOnDisk = after.filter((r) => r.fm?.["provenance"] === "hand-authored");
const postSeparation = storySeparationViolations(
  new Map(generatedOnDisk.map((r) => [r.relPath, r.raw])),
);
if (postSeparation.length > 0) fail("post-write story separation failed", postSeparation);

const stats = [...genreCounts.entries()].map(([g, n]) => `${g} ${n}`).join(", ");
console.log(
  `[expand] wrote ${written} record(s) (${unchanged} already up to date) — ` +
    `${generatedCount} generated across genres: ${stats}`,
);
console.log(
  `[expand] corpus now ${after.length} records: ${handOnDisk.length} hand-authored + ${generatedOnDisk.length} generated`,
);
console.log("[expand] self-validation passed: frontmatter schema, link integrity, provenance, story separation, size floors");
