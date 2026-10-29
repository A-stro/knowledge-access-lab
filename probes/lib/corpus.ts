// probes/lib/corpus.ts
// Shared corpus loading + schema vocabulary for the integrity probes.
// The corpus contract: one markdown tree, seven genres, five typed edges,
// provenance marking on every record (see README "The corpus").

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export const REPO_ROOT = join(import.meta.dir, "..", "..");
export const CORPUS_DIR = join(REPO_ROOT, "corpus");
export const QUESTIONS_FILE = join(REPO_ROOT, "questions", "gold.json");

export const GENRES = [
  "decisions",
  "meetings",
  "orgs",
  "people",
  "projects",
  "references",
  "sessions",
] as const;
export type Genre = (typeof GENRES)[number];

export const EDGE_TYPES = [
  "contradicts",
  "influenced_by",
  "mentions",
  "relates_to",
  "supersedes",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const PROVENANCE_VALUES = ["hand-authored", "generated"] as const;
export const PROJECT_STATUSES = ["active", "cancelled", "paused", "shipped"] as const;
export const DECISION_STATUSES = ["accepted", "rejected", "superseded"] as const;
export const ORG_KINDS = ["client", "partner", "studio", "vendor"] as const;
export const QUESTION_CATEGORIES = [
  "point-lookup",
  "multi-hop",
  "synthesis",
  "temporal",
  "absence",
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export type CorpusRecord = {
  /** posix repo-relative path, e.g. "projects/wayfare.md" */
  relPath: string;
  /** parent directory name (= expected genre) */
  genre: string;
  /** filename without .md (= expected id) */
  stem: string;
  /** parsed frontmatter mapping; null when absent or unparseable */
  fm: Record<string, unknown> | null;
  /** markdown body after the frontmatter block */
  body: string;
  /** full raw file content */
  raw: string;
  /** parse error, if any */
  frontmatterError?: string;
};

export function listCorpusTop(): { dirs: string[]; strays: string[] } {
  if (!existsSync(CORPUS_DIR)) return { dirs: [], strays: [] };
  const entries = readdirSync(CORPUS_DIR, { withFileTypes: true });
  return {
    dirs: entries.filter((e) => e.isDirectory()).map((e) => e.name).sort(),
    strays: entries.filter((e) => !e.isDirectory()).map((e) => e.name).sort(),
  };
}

export function parseRecordFile(
  raw: string,
): { fm: Record<string, unknown> | null; body: string; error?: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { fm: null, body: "", error: "missing frontmatter block" };
  const fmText = match[1];
  const body = match[2] ?? "";
  if (typeof fmText !== "string") return { fm: null, body, error: "unreachable" };
  try {
    const fm = parseYaml(fmText) as unknown;
    if (fm === null || typeof fm !== "object" || Array.isArray(fm)) {
      return { fm: null, body, error: "frontmatter is not a mapping" };
    }
    return { fm: fm as Record<string, unknown>, body };
  } catch (err) {
    return { fm: null, body, error: `YAML parse error: ${String(err)}` };
  }
}

export function loadCorpus(): CorpusRecord[] {
  const records: CorpusRecord[] = [];
  for (const genre of listCorpusTop().dirs) {
    const genreDir = join(CORPUS_DIR, genre);
    for (const entry of readdirSync(genreDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const raw = readFileSync(join(genreDir, entry.name), "utf8");
        const { fm, body, error } = parseRecordFile(raw);
        records.push({
          relPath: `${genre}/${entry.name}`,
          genre,
          stem: entry.name.replace(/\.md$/, ""),
          fm,
          body,
          raw,
          frontmatterError: error,
        });
      }
    }
  }
  return records;
}

export function recordId(record: CorpusRecord): unknown {
  return record.fm?.["id"];
}

export function idsByGenre(records: CorpusRecord[], genre: string): Set<unknown> {
  const ids = new Set<unknown>();
  for (const r of records) if (r.genre === genre && typeof recordId(r) === "string") ids.add(recordId(r));
  return ids;
}

export function paths(records: CorpusRecord[]): Set<string> {
  return new Set(records.map((r) => r.relPath));
}

/** Accepts a `YYYY-MM-DD` string (or a YAML-parsed date) and returns it normalized, else null. */
export function asDateString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return value;
  }
  return null;
}

/** Normalizes an edge target like "./projects/wayfare.md" to "projects/wayfare.md". */
export function normalizeEdgeTarget(to: unknown): string | null {
  if (typeof to !== "string" || to.length === 0) return null;
  const normalized = to.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  return normalized.endsWith(".md") ? normalized : null;
}

export function formatViolations(label: string, violations: string[], show = 25): string {
  const shown = violations.slice(0, show).map((v) => `  - ${v}`).join("\n");
  const more = violations.length > show ? `\n  ... and ${violations.length - show} more` : "";
  return `${label}: ${violations.length} violation(s)\n${shown}${more}`;
}
