// build/render-gold.ts — render the gold set as human-readable markdown.
//
// Reads questions/gold.json (the graded artifact) and writes questions/GOLD.md
// (the principal-review artifact): one section per category, each question
// with its gold answer, exact-passage citations, and — for absence questions —
// the terms verified to have zero hits in the corpus.
//
// Deterministic: same input, same bytes. `--check` verifies the on-disk
// render is byte-identical, mirroring build/expand-corpus.ts --check.
//
// Usage:
//   bun run render:gold          write questions/GOLD.md (idempotent)
//   bun run render:gold --check  verify the on-disk render matches

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { QUESTION_CATEGORIES, QUESTIONS_FILE, REPO_ROOT } from "../probes/lib/corpus";

type Citation = { record: string; passage: string };
type GoldEntry = {
  id: string;
  category: string;
  question: string;
  gold_answer: string;
  citations: Citation[];
  absence_terms?: string[];
};

const GOLD_MD = join(REPO_ROOT, "questions", "GOLD.md");
const checkMode = process.argv.includes("--check");

const gold = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8")) as unknown;
if (!Array.isArray(gold)) {
  console.error("[render:gold] questions/gold.json must be a JSON array");
  process.exit(1);
}
const entries = gold as GoldEntry[];

const counts = new Map<string, number>();
for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);

const lines: string[] = [];
lines.push("# Gold set — Knowledge Access Lab");
lines.push("");
lines.push(
  `${entries.length} hand-verified questions in ${QUESTION_CATEGORIES.length} categories, ` +
    "each with a gold answer and exact-passage citations over the shared corpus.",
);
lines.push("");
lines.push(
  "> **Human gate: passed — principal review completed 2026-10-26.** This gold set passed its one " +
    "human gate before the first full suite run. The principal reviewed the questions, gold answers, " +
    "and citations, spot-checked by blind-answer retrieval (grep the entity and content terms, then " +
    "compare against the gold) and by an adversarial synonym sweep over the absence questions. Absence " +
    "questions are verified evidence-free by the gold lint (their terms have zero corpus hits, and " +
    "their citations are empty by design).",
);
lines.push("");
lines.push("| Category | Count |");
lines.push("|---|---|");
for (const category of QUESTION_CATEGORIES) {
  lines.push(`| ${category} | ${counts.get(category) ?? 0} |`);
}
lines.push(`| **total** | **${entries.length}** |`);
lines.push("");

for (const category of QUESTION_CATEGORIES) {
  lines.push(`## ${category}`);
  lines.push("");
  for (const e of entries.filter((x) => x.category === category)) {
    lines.push(`### ${e.id} — ${e.question}`);
    lines.push("");
    lines.push(`**Gold answer.** ${e.gold_answer}`);
    lines.push("");
    if (e.category === "absence") {
      lines.push("**Citations.** None by design — the gold answer is that no supporting evidence exists.");
      lines.push("");
      lines.push(`**Absence terms (zero corpus hits, enforced by gold lint):** ${(e.absence_terms ?? []).map((t) => `\`${t}\``).join(", ")}`);
      lines.push("");
    } else {
      lines.push("**Citations.**");
      lines.push("");
      for (const c of e.citations) {
        lines.push(`- \`${c.record}\`:`);
        for (const passageLine of c.passage.split("\n")) {
          lines.push(`  > ${passageLine}`);
        }
      }
      lines.push("");
    }
  }
}

const rendered = `${lines.join("\n")}\n`;

if (checkMode) {
  if (!existsSync(GOLD_MD)) {
    console.error("[render:gold] check failed — questions/GOLD.md is missing; run `bun run render:gold`");
    process.exit(1);
  }
  if (readFileSync(GOLD_MD, "utf8") !== rendered) {
    console.error("[render:gold] check failed — questions/GOLD.md differs from the render; run `bun run render:gold`");
    process.exit(1);
  }
  console.log(`[render:gold] check passed — questions/GOLD.md is byte-identical to the render (${entries.length} questions)`);
  process.exit(0);
}

writeFileSync(GOLD_MD, rendered);
console.log(`[render:gold] wrote questions/GOLD.md — ${entries.length} questions across ${QUESTION_CATEGORIES.length} categories`);
