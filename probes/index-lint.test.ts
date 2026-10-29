// probes/index-lint.test.ts — ISC-9 + ISC-10
// Committed embedding index: model pin + coverage + passage fidelity (ISC-9),
// and byte-integrity against the manifest (ISC-10).
//
// The index is the RAG lane's substrate and the artifact that makes the model
// build-time-only: this probe checks the committed files with no model stack
// installed. The full rebuild check (re-embed and byte-compare) lives in
// build/build_index.py --check, which requires the pinned local endpoint.

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENRES, QUESTIONS_FILE, REPO_ROOT, loadCorpus, type CorpusRecord } from "./lib/corpus";

const INDEX_DIR = join(REPO_ROOT, "build", "index");
const readIndex = () => JSON.parse(readFileSync(join(INDEX_DIR, "index.json"), "utf8")) as unknown;
const readManifest = () => JSON.parse(readFileSync(join(INDEX_DIR, "manifest.json"), "utf8")) as unknown;

type Chunk = { path: string; title: string; para: number; text: string; vector: number[] };
type QEntry = { id: string; text: string; vector: number[] };
type Index = {
  schema: string;
  model: { base: string; dims: number; endpoint: string; jang_quantization: Record<string, unknown> };
  questions: QEntry[];
  chunks: Chunk[];
};
type Manifest = {
  schema: string;
  model: Index["model"] & Record<string, unknown>;
  pin_probe: { input: string; sha256: string; first8: number[] };
  corpus: { records: number; hand_authored: number; generated: number; passages: number };
  questions: number;
  index_sha256: string;
};

describe("ISC-9 — committed embedding index: model pin + coverage + passage fidelity", () => {
  const index = readIndex() as Index;
  const records: CorpusRecord[] = loadCorpus();
  const recordPaths = new Set(records.map((r) => r.relPath));

  test("index and manifest parse with the pinned model recorded", () => {
    const manifest = readManifest() as Manifest;
    expect(index.schema).toBe("knowledge-access-lab/index@1");
    expect(manifest.schema).toBe("knowledge-access-lab/index-manifest@1");
    expect(index.model.base).toBe("unsloth/Qwen3-Embedding-0.6B");
    expect(index.model.jang_quantization).toMatchObject({ profile: "JANG_3M", quality: "max" });
    expect(index.model.dims).toBe(1024);
    expect(manifest.pin_probe.first8.length).toBe(8);
    expect(manifest.pin_probe.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("every corpus record is covered by at least one passage chunk", () => {
    const covered = new Set(index.chunks.map((c) => c.path));
    const missing = records.filter((r) => !covered.has(r.relPath)).map((r) => r.relPath);
    expect(missing).toEqual([]);
  });

  test("chunks partition each record's body exactly (byte-exact, contiguous, complete)", () => {
    // Mirrors the builder's split: strip leading/trailing newlines, split on
    // blank lines, drop blank paragraphs. Exact (path, para, text) equality
    // gives byte-exactness AND contiguity AND completeness in one assertion —
    // a splitter regression cannot slip through.
    const violations: string[] = [];
    const chunksByPath = new Map<string, Chunk[]>();
    for (const c of index.chunks) {
      if (!recordPaths.has(c.path)) {
        violations.push(`${c.path}: chunk path is not a corpus record`);
        continue;
      }
      const list = chunksByPath.get(c.path) ?? [];
      if (list.some((x) => x.para === c.para)) violations.push(`${c.path} [para ${c.para}]: duplicate chunk`);
      list.push(c);
      chunksByPath.set(c.path, list);
      const genre = c.path.split("/")[0];
      if (!GENRES.includes(genre as (typeof GENRES)[number])) violations.push(`${c.path}: not a genre path`);
    }
    for (const r of records) {
      const expected = r.body
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")
        .split("\n\n")
        .filter((p) => p.trim().length > 0);
      const actual = (chunksByPath.get(r.relPath) ?? []).sort((a, b) => a.para - b.para);
      if (expected.length !== actual.length) {
        violations.push(`${r.relPath}: ${actual.length} chunks vs ${expected.length} body paragraphs`);
        continue;
      }
      for (let i = 0; i < expected.length; i++) {
        if (actual[i].para !== i || actual[i].text !== expected[i]) {
          violations.push(`${r.relPath} [para ${i}]: chunk text or index diverges from the record body`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("all 45 gold questions are embedded with text matching gold.json", () => {
    const gold = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8")) as { id: string; question: string }[];
    const byId = new Map(index.questions.map((q) => [q.id, q]));
    expect(index.questions.length).toBe(gold.length);
    for (const g of gold) {
      const e = byId.get(g.id);
      expect(e, `question ${g.id} missing from the index`).toBeDefined();
      if (e) expect(e.text).toBe(g.question);
    }
  });

  test("every vector has the pinned dimensionality and finite values", () => {
    const bad: string[] = [];
    const check = (label: string, v: number[]) => {
      if (v.length !== 1024) bad.push(`${label}: dims ${v.length}`);
      if (v.some((x) => !Number.isFinite(x))) bad.push(`${label}: non-finite component`);
    };
    for (const c of index.chunks) check(`${c.path} [para ${c.para}]`, c.vector);
    for (const q of index.questions) check(q.id, q.vector);
    expect(bad).toEqual([]);
  });
});

describe("ISC-10 — committed index integrity: sha256 + manifest counts", () => {
  test("sha256(build/index/index.json) matches the committed manifest", () => {
    const manifest = readManifest() as Manifest;
    const digest = createHash("sha256").update(readFileSync(join(INDEX_DIR, "index.json"))).digest("hex");
    expect(digest).toBe(manifest.index_sha256);
  });

  test("manifest model pin equals the index model pin exactly", () => {
    const manifest = readManifest() as Manifest;
    const index = readIndex() as Index;
    expect(manifest.model).toEqual(index.model);
  });

  test("manifest counts match the corpus, the gold set, and the index", () => {
    const manifest = readManifest() as Manifest;
    const index = readIndex() as Index;
    const records = loadCorpus();
    const hand = records.filter((r) => r.fm?.["provenance"] === "hand-authored").length;
    expect(manifest.corpus.records).toBe(records.length);
    expect(manifest.corpus.hand_authored).toBe(hand);
    expect(manifest.corpus.generated).toBe(records.length - hand);
    expect(manifest.corpus.passages).toBe(index.chunks.length);
    expect(manifest.questions).toBe(index.questions.length);
  });
});
