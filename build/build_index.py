#!/usr/bin/env python3
"""build/build_index.py — committed embedding index builder (F2, ISC-9/ISC-10).

Builds the retrieval index the RAG lane serves from:
  input:  corpus/<genre>/*.md — one chunk per body paragraph, embedded with
          its record title as context (input = "title\\nparagraph"; the stored
          passage is the paragraph alone, byte-exact for citation grading)
          plus every gold question (questions/gold.json), embedded by text
  output: build/index/index.json   — chunks + question vectors (committed)
          build/index/manifest.json — model pin, corpus/question counts,
                                      sha256(index.json) (committed)

Model pin (build-time only):
  base model:        unsloth/Qwen3-Embedding-0.6B
  JANG quantization: profile JANG_3M, quality max (jang-importance,
                     mx.quantize affine, group_size 64, per-layer bits 3/8)
  serving copy:      fp16 export per build/export-jang-fp16.py — the vMLX
                     embeddings route serves it; vMLX's chat loader reads
                     the JANG quant directly but its embeddings route runs
                     stock mlx-embeddings (fp16 only)
  endpoint:          OpenAI-compatible /v1/embeddings, default
                     http://127.0.0.1:8022/v1 (EMBED_ENDPOINT to override)

Determinism (ISC-10):
  - vectors are rounded to 6 decimals and serialized canonically
    (sorted keys, compact separators), so a rebuild on the same pinned
    stack is byte-identical; `--check` re-embeds everything and verifies
    the on-disk index byte-for-byte
  - a pin probe re-embeds a fixed string and must match the recorded
    reference vector, so a drifted/changed model aborts the build loudly
    instead of silently producing a different index
  - no timestamps: index and manifest carry only stable content

The committed index is what makes the model a build-time-only dependency:
a fresh clone runs lanes and the suite with no model stack installed.

Usage:
  EMBED_MODEL=/path/to/Qwen3emb-0.6B-JANG-3M-max-fp16 python3 build/build_index.py
  EMBED_MODEL=... python3 build/build_index.py --check
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CORPUS_DIR = REPO_ROOT / "corpus"
QUESTIONS_FILE = REPO_ROOT / "questions" / "gold.json"
INDEX_DIR = REPO_ROOT / "build" / "index"

DEFAULT_ENDPOINT = "http://127.0.0.1:8022/v1"
DIMS = 1024
# RAG lane result count. The lane's query surface is one-shot (question vectors
# are committed; there is no runtime re-embedding), so a slightly generous k
# is the compensating config: measured cited-record recall on the gold set is
# 86% at k=5, 94% at k=10, 100% at k=20. k=10 keeps semantic ranking
# meaningful while leaving only a couple of questions to agent iteration.
TOP_K = 10

PIN_PROBE_INPUT = "knowledge-access-lab pin probe"
# sha256 of the canonical JSON of the FULL rounded pin-probe vector (all 1024
# dims) — the whole-vector fingerprint the build, the manifest, and --check
# verify against. Comparing 8 of 1024 dims would be a fingerprint, not the
# documented guarantee.
PIN_PROBE_SHA256 = "d6671b9cd1e30ed3aaa3a9ab54a92a75b70566b25c01f4a4b7687e5eb1cc2559"

MODEL_PIN = {
    "base": "unsloth/Qwen3-Embedding-0.6B",
    "jang_quantization": {
        "method": "jang-importance",
        "profile": "JANG_3M",
        "quality": "max",
        "backend": "mx.quantize",
        "mode": "affine",
        "group_size": 64,
        "per_layer_bits": {"3": 85, "8": 112},
    },
    "serving_copy": "fp16 export (build/export-jang-fp16.py)",
    "dims": DIMS,
}

FRONTMATTER_RE = re.compile(r"^---\n([\s\S]*?)\n---\n?([\s\S]*)$")
TITLE_RE = re.compile(r'^title: "(.*)"$', re.MULTILINE)
PROVENANCE_RE = re.compile(r"^provenance: (hand-authored|generated)$", re.MULTILINE)
GENRES = ("decisions", "meetings", "orgs", "people", "projects", "references", "sessions")


def fail(msg: str) -> None:
    print(f"[build:index] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def embed(endpoint: str, model: str, text: str) -> list[float]:
    """One embedding request; single-input for deterministic inference."""
    payload = json.dumps({"input": text, "model": model}).encode()
    last_err: Exception | None = None
    for _ in range(2):
        try:
            req = urllib.request.Request(
                f"{endpoint.rstrip('/')}/embeddings",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                body = json.load(r)
            return body["data"][0]["embedding"]
        except (urllib.error.URLError, KeyError, ValueError) as e:
            last_err = e
    fail(f"embedding request failed: {last_err}")
    raise AssertionError  # unreachable


def round_vector(vec: list[float]) -> list[float]:
    out = []
    for x in vec:
        if x != x or x in (float("inf"), float("-inf")):
            fail(f"non-finite vector component: {x}")
        out.append(round(x, 6))
    return out


def load_records() -> list[dict]:
    """One entry per corpus record: path, title, provenance, paragraphs."""
    records = []
    for genre in GENRES:
        genre_dir = CORPUS_DIR / genre
        for md in sorted(genre_dir.glob("*.md")):
            raw = md.read_bytes().decode("utf-8")  # strict bytes — no newline translation, no locale
            if "\r" in raw:
                fail(f"{md}: CR bytes in corpus file — the corpus is LF-only by contract")
            m = FRONTMATTER_RE.match(raw)
            if not m:
                fail(f"{md}: missing frontmatter block")
            fm_text, body = m.group(1), m.group(2)
            titles = TITLE_RE.findall(fm_text)
            if len(titles) != 1:
                fail(f"{md}: expected exactly one quoted title in frontmatter, found {len(titles)}")
            provenances = PROVENANCE_RE.findall(fm_text)
            if len(provenances) != 1:
                fail(f"{md}: expected exactly one provenance mark, found {len(provenances)}")
            paragraphs = [p for p in body.strip("\n").split("\n\n") if p.strip()]
            if not paragraphs:
                fail(f"{md}: empty body")
            records.append({
                "path": f"{genre}/{md.name}",
                "title": titles[0],
                "provenance": provenances[0],
                "paragraphs": paragraphs,
            })
    return records


def canonical_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def main() -> int:
    check_mode = "--check" in sys.argv
    model = os.environ.get("EMBED_MODEL")
    endpoint = os.environ.get("EMBED_ENDPOINT", DEFAULT_ENDPOINT)
    if not model:
        fail("EMBED_MODEL env var is required (the fp16 serving copy path)")

    # 1. pin probe — abort loudly on model drift (full-vector fingerprint)
    probe = round_vector(embed(endpoint, model, PIN_PROBE_INPUT))
    probe_sha = hashlib.sha256(canonical_json(probe).encode()).hexdigest()
    if len(probe) != DIMS or probe_sha != PIN_PROBE_SHA256:
        fail(
            "pin probe mismatch — the serving model differs from the pinned "
            f"stack (dims {len(probe)}, vector sha256 {probe_sha}, expected "
            f"{PIN_PROBE_SHA256}; first8 {probe[:8]}); refusing to build a "
            "silently different index"
        )
    print(f"[build:index] pin probe OK ({DIMS} dims, full-vector sha256 matches)")

    # 2. corpus chunks: one per paragraph, title as embed context
    records = load_records()
    chunks: list[dict] = []
    for rec in records:
        for i, para in enumerate(rec["paragraphs"]):
            vec = round_vector(embed(endpoint, model, f"{rec['title']}\n{para}"))
            chunks.append({
                "path": rec["path"],
                "title": rec["title"],
                "para": i,
                "text": para,
                "vector": vec,
            })
    print(f"[build:index] embedded {len(chunks)} passages across {len(records)} records")

    # 3. gold questions, embedded by text
    questions = json.loads(QUESTIONS_FILE.read_text())
    q_entries = []
    for q in sorted(questions, key=lambda e: e["id"]):
        vec = round_vector(embed(endpoint, model, q["question"]))
        q_entries.append({"id": q["id"], "text": q["question"], "vector": vec})
    print(f"[build:index] embedded {len(q_entries)} gold questions")

    # 4. assemble + write (byte-identical by construction)
    chunks.sort(key=lambda c: (c["path"], c["para"]))
    index = {
        "schema": "knowledge-access-lab/index@1",
        # endpoint deliberately NOT committed: it is request routing (env), not
        # model identity — recording it would break --check byte-identity across
        # URL spellings of the same server (127.0.0.1 vs localhost)
        "model": dict(MODEL_PIN, top_k=TOP_K),
        "questions": q_entries,
        "chunks": chunks,
    }
    index_bytes = canonical_json(index).encode()

    hand = sum(1 for r in records if r["provenance"] == "hand-authored")
    gen = sum(1 for r in records if r["provenance"] == "generated")
    if hand + gen != len(records):
        fail("unmarked provenance in corpus")
    manifest = {
        "schema": "knowledge-access-lab/index-manifest@1",
        "generator": "build/build_index.py",
        "model": dict(MODEL_PIN, top_k=TOP_K),
        "pin_probe": {
            "input": PIN_PROBE_INPUT,
            "sha256": probe_sha,  # derived from the live full vector; compared against PIN_PROBE_SHA256 above
            "first8": probe[:8],  # display aid
        },
        "corpus": {"records": len(records), "hand_authored": hand, "generated": gen, "passages": len(chunks)},
        "questions": len(q_entries),
        "index_sha256": hashlib.sha256(index_bytes).hexdigest(),
        "rebuild": "EMBED_MODEL=<fp16 copy> python3 build/build_index.py --check (requires the local pinned endpoint; the committed index keeps the model build-time-only)",
    }
    manifest_bytes = canonical_json(manifest).encode()

    if check_mode:
        ok = True
        for name, built in (("index.json", index_bytes), ("manifest.json", manifest_bytes)):
            disk = INDEX_DIR / name
            if not disk.exists():
                print(f"[build:index] check FAILED — {name} missing on disk", file=sys.stderr)
                ok = False
            elif disk.read_bytes() != built:
                print(f"[build:index] check FAILED — {name} differs from a fresh build", file=sys.stderr)
                ok = False
        if not ok:
            sys.exit(1)
        print("[build:index] check passed — on-disk index and manifest are byte-identical to a fresh build")
        return 0

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    (INDEX_DIR / "index.json").write_bytes(index_bytes)
    (INDEX_DIR / "manifest.json").write_bytes(manifest_bytes)
    print(f"[build:index] wrote build/index/index.json ({len(index_bytes)/1e6:.1f} MB)")
    print(f"[build:index] sha256: {manifest['index_sha256']}")
    print(f"[build:index] corpus: {len(records)} records ({hand} hand-authored + {gen} generated), {len(chunks)} passages; questions: {len(q_entries)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
