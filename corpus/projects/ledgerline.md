---
id: ledgerline
genre: projects
title: "Ledgerline — internal timesheet and invoicing service"
created: 2026-02-14
updated: 2026-06-10
status: active
provenance: hand-authored
tags: [internal, billing]
related:
  - type: mentions
    to: decisions/d-001.md
  - type: mentions
    to: decisions/d-005.md
  - type: mentions
    to: sessions/s-001.md
  - type: mentions
    to: sessions/s-005.md
  - type: mentions
    to: meetings/m-002.md
  - type: mentions
    to: meetings/m-003.md
  - type: mentions
    to: people/lorna-vey.md
---

Ledgerline is Meridian Studio's internal timesheet and invoicing service —
the studio bills its clients through it. SQLite-backed (decision d-001), with
flat monthly billing per client adopted in March (decision d-005) after the
pricing discussion in m-003. Invoice PDF export landed in the March sprint
(s-005).

Team: Dev Okonkwo (backend), Noor Haddad (interface), Lorna Vey (ops).
Billing runs monthly; Lorna reconciles the runs against bank deposits.
