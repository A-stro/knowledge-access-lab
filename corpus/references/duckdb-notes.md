---
id: duckdb-notes
genre: references
title: "DuckDB for embedded analytics — reading notes"
created: 2026-03-25
provenance: hand-authored
tags: [analytics, reading-notes]
source: "reading notes, DuckDB documentation"
---

DuckDB runs embedded analytics straight over Parquet and CSV with no server
to operate — a good fit for a dashboard that queries a few million sensor
rows. A time-series server fits raw telemetry better, but an operations
wallboard needs SQL joins more than a retention engine.

Informed d-006.
