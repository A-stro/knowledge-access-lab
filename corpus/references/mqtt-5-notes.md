---
id: mqtt-5-notes
genre: references
title: "MQTT 5.0 — reading notes"
created: 2025-10-10
provenance: generated
tags: [messaging, reading-notes]
source: "reading notes, MQTT 5.0 specification overview"
---

MQTT 5.0 keeps retained messages — a display recovers its last-known state
after reconnect — and adds shared subscriptions that fan one topic across
several consumers, plus session expiry and reason codes that make reconnects
observable. Broker overhead is the cost; for small realtime payloads it
still beats HTTP polling on freshness and battery.

Informed Perchboard's transport decision (d-102) and Cinderboard's ingest
decision (d-108).
