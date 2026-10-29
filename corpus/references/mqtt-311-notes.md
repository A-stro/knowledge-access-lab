---
id: mqtt-311-notes
genre: references
title: "MQTT 3.1.1 — reading notes"
created: 2026-02-21
provenance: hand-authored
tags: [messaging, reading-notes]
source: "reading notes, MQTT 3.1.1 specification"
related:
  - type: relates_to
    to: references/latency-budget-notes.md
---

QoS 0/1/2 semantics; retained messages let a display recover its last-known
state after reconnect; keepalive covers dead links. Broker overhead is the
cost — for small realtime payloads it beats HTTP polling on both freshness
and battery.

Informed Wayfare's transport decision (d-002) and Beacon Grid's ingest
decision (d-007).
