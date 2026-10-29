// lanes/rag/server.ts — RAG lane MCP server (F2, ISC-9/ISC-10 consumer).
//
// The RAG architecture variable: semantic retrieval over the committed
// embedding index (build/index/index.json) plus direct record access (the
// shared lanes/lib/graph.ts record reader — the same bytes every lane's
// record surface returns).
//   `semantic_search` → ranked passages with record paths (passages, not
//     pointers — citation fidelity is gradeable from tool results alone)
//   `get`             → a full record by corpus-relative path
//
// The index is a build-time artifact: chunk and question vectors were
// embedded once by build/build_index.py against the pinned model stack
// (unsloth/Qwen3-Embedding-0.6B, JANG-3M/max quant, fp16 serving copy) and
// committed. This server NEVER embeds at runtime — queries resolve to their
// committed question vectors by gold-set id (or exact question text), so a
// fresh clone runs this lane with no model stack installed and every result
// is a pure function of the committed index (byte-identical rebuilds, ISC-10).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serve, type ToolHandler, type ToolSpec } from "../mcp-kit";
import { readRecord } from "../lib/graph";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const INDEX_FILE = join(REPO_ROOT, "build", "index", "index.json");

type Chunk = { path: string; title: string; para: number; text: string; vector: number[] };
type QEntry = { id: string; text: string; vector: number[] };
type Index = {
  model: { dims: number; top_k: number };
  questions: QEntry[];
  chunks: Chunk[];
};

const index = JSON.parse(readFileSync(INDEX_FILE, "utf8")) as Index;
if (!Array.isArray(index.chunks) || index.chunks.length === 0 || !Array.isArray(index.questions)) {
  throw new Error("committed index missing or empty — run EMBED_MODEL=... python3 build/build_index.py");
}
const DIMS = index.model.dims;
const TOP_K = index.model.top_k ?? 5;

// precompute norms once at startup
const norm = (v: number[]): number => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const chunks = index.chunks.map((c) => ({ chunk: c, n: norm(c.vector) }));
const byQuestionId = new Map<string, QEntry>(index.questions.map((q) => [q.id, q]));
const byQuestionText = new Map<string, QEntry>(index.questions.map((q) => [q.text, q]));

function cosineRank(queryVector: number[]): { chunk: Chunk; score: number }[] {
  const qn = norm(queryVector);
  return chunks
    .map(({ chunk, n }) => ({
      chunk,
      score: queryVector.reduce((s, x, i) => s + x * (chunk.vector[i] ?? 0), 0) / (qn * n),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.chunk.path < b.chunk.path ? -1 : a.chunk.path > b.chunk.path ? 1 : a.chunk.para - b.chunk.para),
    )
    .slice(0, TOP_K);
}

const semanticSearch: ToolHandler = (args) => {
  const questionId = typeof args.question_id === "string" ? args.question_id : undefined;
  const query = typeof args.query === "string" ? args.query : undefined;
  const entry =
    (questionId !== undefined ? byQuestionId.get(questionId) : undefined) ??
    (query !== undefined ? byQuestionText.get(query) : undefined);
  if (!entry) {
    throw new Error(
      "unknown question — pass question_id (a gold-set id) or the exact gold question text; " +
        "query vectors are committed at build time and this lane never embeds at runtime",
    );
  }
  if (entry.vector.length !== DIMS) throw new Error(`question ${entry.id}: vector dims ${entry.vector.length} != ${DIMS}`);
  const results = cosineRank(entry.vector).map(({ chunk, score }) => ({
    path: chunk.path,
    para: chunk.para,
    score: Math.round(score * 1e6) / 1e6,
    passage: chunk.text,
  }));
  return JSON.stringify({ question: entry.id, dims: DIMS, results }, null, 2);
};

const getRecord: ToolHandler = (args) => {
  const path = typeof args.path === "string" ? args.path : "";
  return readRecord(path);
};

const tools: ToolSpec[] = [
  {
    name: "semantic_search",
    description:
      "Semantic search over the corpus embedding index. Pass question_id (a gold-set id) or the exact gold question text. " +
      "Returns ranked passages with their record paths — passages, not pointers.",
    inputSchema: {
      type: "object",
      properties: {
        question_id: { type: "string", description: "Gold-set question id, e.g. q-pl-01" },
        query: { type: "string", description: "The exact gold question text" },
      },
    },
  },
  {
    name: "get",
    description: "Return a full corpus record (frontmatter + body) by its corpus-relative path, e.g. decisions/d-001.md.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

serve("rag-lane", tools, { semantic_search: semanticSearch, get: getRecord });
