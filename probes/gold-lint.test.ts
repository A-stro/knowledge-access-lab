// probes/gold-lint.test.ts — ISC-6
// Gold lint: ≥40 hand-verified questions tagged across five categories, each
// with a gold answer and gold citations (record path + exact supporting
// passage). Absence questions are verified evidence-free: their terms must
// have zero hits anywhere in the corpus, and their citations are empty by
// design — the gold answer is "no evidence found".

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  QUESTION_CATEGORIES,
  formatViolations,
  loadCorpus,
  normalizeEdgeTarget,
  paths,
  QUESTIONS_FILE,
  type QuestionCategory,
} from "./lib/corpus";

type GoldEntry = {
  id?: unknown;
  category?: unknown;
  question?: unknown;
  gold_answer?: unknown;
  citations?: unknown;
  absence_terms?: unknown;
};

type Violation = string;

function loadGold(): GoldEntry[] {
  const raw = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8")) as unknown;
  if (!Array.isArray(raw)) throw new Error("questions/gold.json must be a JSON array of question entries");
  return raw as GoldEntry[];
}

function isCategory(v: unknown): v is QuestionCategory {
  return QUESTION_CATEGORIES.includes(v as QuestionCategory);
}

function goldViolations(gold: GoldEntry[], corpusTexts: Map<string, string>): Violation[] {
  const out: Violation[] = [];
  const allPaths = paths([...knownRecords]);
  const seenIds = new Set<string>();
  for (const entry of gold) {
    const where = `questions/gold.json [${String(entry.id ?? "<missing id>")}]`;
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      out.push(`${where}: id must be a non-empty string`);
      continue;
    }
    if (seenIds.has(entry.id)) out.push(`${where}: duplicate question id`);
    seenIds.add(entry.id);
    if (!isCategory(entry.category)) {
      out.push(`${where}: category must be one of {${QUESTION_CATEGORIES.join(", ")}} (got ${JSON.stringify(entry.category)})`);
      continue;
    }
    if (typeof entry.question !== "string" || entry.question.trim().length === 0) {
      out.push(`${where}: question must be a non-empty string`);
    }
    if (typeof entry.gold_answer !== "string" || entry.gold_answer.trim().length === 0) {
      out.push(`${where}: gold_answer must be a non-empty string`);
    }
    const citations = entry.citations;
    if (!Array.isArray(citations)) {
      out.push(`${where}: citations must be an array`);
      continue;
    }
    if (entry.category === "absence") {
      if (typeof entry.gold_answer === "string" && !/^no evidence found/i.test(entry.gold_answer)) {
        out.push(`${where}: absence gold_answer must state "no evidence found" (got ${JSON.stringify(entry.gold_answer)})`);
      }
      if (citations.length !== 0) {
        out.push(`${where}: absence citations must be empty by design (found ${citations.length})`);
      }
      const terms = entry.absence_terms;
      if (!Array.isArray(terms) || terms.length === 0 || terms.some((t) => typeof t !== "string" || t.length === 0)) {
        out.push(`${where}: absence entry needs a non-empty absence_terms array`);
      } else {
        for (const term of terms) {
          const hits: string[] = [];
          for (const [relPath, text] of corpusTexts) {
            if (text.toLowerCase().includes(term.toLowerCase())) hits.push(relPath);
          }
          if (hits.length > 0) {
            out.push(`${where}: absence term "${term}" appears in the corpus (e.g. ${hits.slice(0, 3).join(", ")}) — absence questions must have no supporting evidence`);
          }
        }
      }
    } else {
      if (citations.length === 0) {
        out.push(`${where}: non-absence entry needs at least one gold citation`);
      }
      for (const c of citations) {
        if (typeof c !== "object" || c === null || Array.isArray(c)) {
          out.push(`${where}: citation must be an object {record, passage}`);
          continue;
        }
        const record = normalizeEdgeTarget((c as Record<string, unknown>).record);
        const passage = (c as Record<string, unknown>).passage;
        if (record === null) {
          out.push(`${where}: citation record must be a corpus-relative .md path`);
          continue;
        }
        if (!allPaths.has(record)) {
          out.push(`${where}: citation record ${record} does not exist in the corpus`);
          continue;
        }
        if (typeof passage !== "string" || passage.trim().length === 0) {
          out.push(`${where}: citation for ${record} needs a non-empty exact passage`);
          continue;
        }
        const raw = corpusTexts.get(record) ?? "";
        if (!raw.includes(passage)) {
          out.push(`${where}: passage for ${record} is not an exact substring of the record (first 80 chars: ${JSON.stringify(passage.slice(0, 80))})`);
        }
      }
    }
  }
  return out;
}

// shared corpus state, loaded once
const knownRecords = loadCorpus();

function corpusTextMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of knownRecords) m.set(r.relPath, r.raw);
  return m;
}

describe("ISC-6 — gold lint: ≥40 questions, 5 categories, gold answer + citation each", () => {
  test("questions/gold.json parses as an array of ≥40 entries", () => {
    const gold = loadGold();
    expect(gold.length).toBeGreaterThanOrEqual(40);
  });

  test("all five categories are tagged with ≥8 questions each", () => {
    const gold = loadGold();
    for (const category of QUESTION_CATEGORIES) {
      const count = gold.filter((g) => g.category === category).length;
      expect(count, `category "${category}"`).toBeGreaterThanOrEqual(8);
    }
  });

  test("every entry has a well-formed gold answer + citations (absence entries verified evidence-free)", () => {
    const gold = loadGold();
    const violations = goldViolations(gold, corpusTextMap());
    if (violations.length > 0) throw new Error(formatViolations("gold lint", violations, 30));
    expect(violations).toEqual([]);
  });
});
