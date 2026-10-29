---
id: hocr-notes
genre: references
title: "hOCR for OCR output — reading notes"
created: 2026-01-13
provenance: generated
tags: [ocr, reading-notes]
source: "reading notes, hOCR format documentation"
related:
  - type: relates_to
    to: references/ocr-job-queue-notes.md
---

hOCR carries word bounding boxes and page structure alongside OCR text, so a
gallery can highlight what the engine read without a bespoke layout format.
Emitting it from the start keeps the pipeline's output portable.

Informed the Foxglove OCR pipeline wiring (s-104).
