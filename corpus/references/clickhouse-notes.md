---
id: clickhouse-notes
genre: references
title: "ClickHouse for embedded analytics — reading notes"
created: 2026-02-19
provenance: generated
tags: [analytics, reading-notes]
source: "reading notes, ClickHouse documentation"
---

ClickHouse runs column scans over MergeTree partitions straight from Parquet
and CSV with no separate server process to babysit — a good fit for a
wallboard aggregating millions of feeder rows. A time-series server fits raw
telemetry better, but an operations wallboard needs aggregate scans more
than a retention engine.

Informed d-107.
