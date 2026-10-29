---
id: foxglove-archive
genre: projects
title: "Foxglove Archive — digitized collections platform for Harrowgate Press"
created: 2026-01-12
updated: 2026-06-02
status: active
client: harrowgate-press
provenance: generated
tags: [archive, ocr, gallery]
related:
  - type: mentions
    to: orgs/harrowgate-press.md
  - type: mentions
    to: orgs/saltmarsh-creative.md
  - type: mentions
    to: decisions/d-104.md
  - type: mentions
    to: decisions/d-113.md
  - type: mentions
    to: decisions/d-118.md
  - type: mentions
    to: sessions/s-113.md
  - type: mentions
    to: meetings/m-103.md
  - type: mentions
    to: meetings/m-112.md
---

The Foxglove Archive is a digitized-collection platform for Harrowgate
Press: scanning, OCR, searchable metadata, and an online gallery. The OCR
pipeline runs on a local GPU cluster rather than a remote API (decision
d-104); the throughput benchmark (s-113) showed modern scans running above
the assumed rate, which kept the digitization schedule. The viewer is a
static-file gallery (decision d-113), prototyped in s-122, with page-level
anchor URLs added in June (d-118).

Team: Marta Quintana (data), Gwen Torvald (interface), Yusuf Adeyemi (OCR
pipeline), Elif Yilmaz (user research). Aurelio Finch is the client sponsor;
Saltmarsh Creative advised the metadata descriptions. Mid-project review
with Harrowgate is m-112.

As of late June the project is active: the modern collection is scanned, the
annex queue is staged for summer, and the gallery is in integration.
