---
id: ocr-comparison
genre: references
title: "Local OCR vs remote OCR API — benchmark notes"
created: 2026-03-10
provenance: hand-authored
tags: [ocr, benchmark]
source: "internal benchmark notes, Q1 tooling review"
---

Comparing local OCR against a remote OCR API on sample scans: the remote API
sustained roughly four times the local throughput at a per-page cost the
studio could absorb, with better layout detection on old typefaces.
Assumption on record: throughput scales linearly with scan volume.

Informed d-004. The linearity assumption is what s-006 later challenged.
