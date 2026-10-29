---
id: rill
genre: projects
title: "Rill — internal timesheet and invoicing service"
created: 2025-10-06
updated: 2026-06-27
status: active
provenance: generated
tags: [internal, billing]
related:
  - type: mentions
    to: decisions/d-101.md
  - type: mentions
    to: decisions/d-105.md
  - type: mentions
    to: sessions/s-101.md
  - type: mentions
    to: meetings/m-102.md
  - type: mentions
    to: meetings/m-104.md
  - type: mentions
    to: people/nils-aasen.md
---

Rill is Copperleaf Studio's internal timesheet and invoicing service — the
studio bills its clients through it. PostgreSQL-backed (decision d-101),
with hourly billing and per-project rates (decision d-105) after the billing
discussion in m-104; per-period rate cards followed in April (d-115), with
the schema migrated in s-133. Invoice CSV export landed in February (s-105).

Team: Yusuf Adeyemi (backend), Pavel Sorokin (interface), Nils Aasen (ops).
Billing runs monthly; Nils reconciles the hourly runs against bank deposits,
and Sofia keeps the backup rotation honest.
