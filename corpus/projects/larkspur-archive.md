---
id: larkspur-archive
genre: projects
title: "Larkspur Archive — digitized collections platform for Bellweather Books"
created: 2026-03-02
updated: 2026-06-15
status: active
client: bellweather-books
provenance: hand-authored
tags: [archive, ocr, iiif]
related:
  - type: mentions
    to: orgs/bellweather-books.md
  - type: mentions
    to: orgs/quill-and-marrow.md
  - type: mentions
    to: decisions/d-004.md
  - type: mentions
    to: decisions/d-011.md
  - type: mentions
    to: sessions/s-003.md
  - type: mentions
    to: sessions/s-006.md
  - type: mentions
    to: sessions/s-010.md
  - type: mentions
    to: meetings/m-007.md
---

The Larkspur Archive is a digitized-collection platform for Bellweather
Books: scanning, OCR, searchable metadata, and an online viewer. The OCR
pipeline uses a remote OCR API over local OCR (decision d-004, informed by
the ocr-comparison notes); a later latency benchmark (s-006) showed archival
page scans running far below the assumed throughput, which sent Dev and
Silas back to preprocessing. The viewer is IIIF-based (decision d-011),
prototyped in s-010.

Team: Silas Brandt (data), June Park (interface), Dev Okonkwo (OCR pipeline),
Odessa Klein (user research). Rowan Ellery is the client sponsor; Quill &
Marrow advised the metadata descriptions. Mid-project review with Bellweather
is m-007.

As of mid-June the project is active: OCR continues at the corrected rate and
the IIIF viewer is in integration.
