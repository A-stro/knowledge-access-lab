---
id: beacon-grid
genre: projects
title: "Beacon Grid — load-monitoring dashboard for Greenline Utilities"
created: 2026-04-02
updated: 2026-05-26
status: paused
client: greenline-utilities
provenance: hand-authored
tags: [utilities, monitoring, duckdb]
related:
  - type: mentions
    to: orgs/greenline-utilities.md
  - type: mentions
    to: orgs/northpost-analytics.md
  - type: mentions
    to: decisions/d-006.md
  - type: mentions
    to: decisions/d-007.md
  - type: mentions
    to: sessions/s-007.md
---

Beacon Grid is a load-monitoring dashboard for Greenline Utilities: ingesting
sensor feeds and Northpost Analytics load forecasts into DuckDB (decision
d-006) over MQTT (decision d-007), queried for the operations wallboard.
Silas Brandt (data), Theo Kanda (systems), and Noor Haddad (dashboard) built
the ingestion spike (s-007).

Paused 2026-05-26 pending Greenline's data-access clarification; Noor moved
to Wayfare's final stretch.
