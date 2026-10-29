// probes/leak-scan.test.ts — ISC-1
// Anti-leak probe: zero hits for private path roots across the repo.
// Nothing from the maintainer's private environment may ship here: no private
// harness config dirs, no private-system names, no home paths.
//
// The scanner scans the whole working tree INCLUDING probe sources, so every
// pattern below is assembled from fragments that never appear as one literal
// in this file — the scanner must not match its own definitions.

import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { formatHits, literal, literalInsensitive, regexPattern, scanLines, walkRepoFiles } from "./lib/repo-scan";

type Pattern = { name: string; match: (line: string) => string | null };

const patterns: Pattern[] = [
  { name: "private harness config dir", match: literal("~/.cl" + "aude") },
  { name: "private system name", match: literalInsensitive("life" + "os") },
  { name: "macOS absolute home path", match: regexPattern(/\/Users\/[A-Za-z0-9._-]+\//) },
  { name: "linux absolute home path", match: regexPattern(/\/home\/[A-Za-z0-9._-]+\//) },
];

const home = homedir();
if (home.length > 1 && home !== "/Users" && home !== "/home") {
  patterns.push({ name: "this machine's home directory", match: literal(home) });
}

describe("ISC-1 — leak scan: private path roots have zero hits repo-wide", () => {
  for (const pattern of patterns) {
    test(`zero hits: ${pattern.name}`, () => {
      const hits = scanLines(walkRepoFiles(), pattern.match);
      if (hits.length > 0) {
        throw new Error(
          `ISC-1 violation — ${hits.length} hit(s) for [${pattern.name}]:\n${formatHits(hits)}`,
        );
      }
      expect(hits).toEqual([]);
    });
  }
});
