// probes/lib/repo-scan.ts
// Shared repository-wide file scanner for the anti probes (ISC-1, ISC-4).
// Walks the working tree (tracked and untracked), skipping dependency and VCS
// internals plus known-binary suffixes, and reports pattern hits with
// file:line references.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "./corpus";

const SKIP_DIRS = new Set([".git", "node_modules"]);
const SKIP_SUFFIXES = [".lockb", ".pyc", ".DS_Store"];

export function* walkRepoFiles(): Generator<string> {
  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue; // dir in normal checkouts; a worktree pointer FILE with an absolute path
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        yield* walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        if (SKIP_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) continue;
        yield join(dir, entry.name);
      }
    }
  }
  yield* walk(REPO_ROOT);
}

export type Hit = { file: string; line: number; text: string };

/** Runs `test` over every line of every walked file; a returned string is a hit. */
export function scanLines(
  files: Iterable<string>,
  test: (line: string) => string | null,
): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const found = test(lines[i] ?? "");
      if (found !== null) hits.push({ file: relative(REPO_ROOT, file), line: i + 1, text: found });
    }
  }
  return hits;
}

export function formatHits(hits: Hit[], show = 25): string {
  return hits
    .slice(0, show)
    .map((h) => `  - ${h.file}:${h.line}: ${h.text}`)
    .join("\n");
}

export function literal(substring: string): (line: string) => string | null {
  return (line) => (line.includes(substring) ? substring : null);
}

export function literalInsensitive(substring: string): (line: string) => string | null {
  return (line) => (line.toLowerCase().includes(substring) ? substring : null);
}

export function regexPattern(pattern: RegExp): (line: string) => string | null {
  return (line) => line.match(pattern)?.[0] ?? null;
}
