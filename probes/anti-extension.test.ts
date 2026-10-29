// probes/anti-extension.test.ts — ISC-4
// Anti-extension probe: zero hits for harness extension APIs or
// extension-loading invocations anywhere in the repo. The design decision is
// zero extensions: every lane is an in-repo MCP server wired through
// .pi/mcp.json, which is what makes the lab harness-agnostic.
//
// Patterns are assembled from fragments so the scanner can scan its own
// source without self-matching.

import { describe, expect, test } from "bun:test";
import { formatHits, literalInsensitive, scanLines, walkRepoFiles } from "./lib/repo-scan";

type Pattern = { name: string; match: (line: string) => string | null };

const patterns: Pattern[] = [
  { name: "harness extension API", match: literalInsensitive("extension" + "api") },
  { name: "harness tool registration hook", match: literalInsensitive("register" + "tool") },
  { name: "extension-loading invocation", match: literalInsensitive("-e " + "./") },
];

describe("ISC-4 — anti-extension scan: zero hits repo-wide", () => {
  for (const pattern of patterns) {
    test(`zero hits: ${pattern.name}`, () => {
      const hits = scanLines(walkRepoFiles(), pattern.match);
      if (hits.length > 0) {
        throw new Error(
          `ISC-4 violation — ${hits.length} hit(s) for [${pattern.name}]:\n${formatHits(hits)}`,
        );
      }
      expect(hits).toEqual([]);
    });
  }
});
