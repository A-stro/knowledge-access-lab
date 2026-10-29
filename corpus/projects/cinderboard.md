---
id: cinderboard
genre: projects
title: "Cinderboard — load-monitoring wallboard for Ridgeway Power"
created: 2026-02-19
updated: 2026-06-09
status: paused
client: ridgeway-power
provenance: generated
tags: [utilities, monitoring, clickhouse]
related:
  - type: mentions
    to: orgs/ridgeway-power.md
  - type: mentions
    to: orgs/fathom-data-works.md
  - type: mentions
    to: decisions/d-107.md
  - type: mentions
    to: decisions/d-108.md
  - type: mentions
    to: sessions/s-111.md
  - type: mentions
    to: meetings/m-119.md
---

Cinderboard is a load-monitoring wallboard for Ridgeway Power: ingesting
feeder sensor feeds and Fathom Data Works weather-adjusted load forecasts
into ClickHouse (decision d-107) over MQTT 5.0 (decision d-108), queried for
the grid operations desk. Marta Quintana (data), Yusuf Adeyemi (systems),
and Pavel Sorokin (wallboard) built the ingestion spike (s-111).

Paused 2026-04-20 pending Ridgeway's data-sharing agreement; restart
planning with Nadia Moreau began in June (m-119).
