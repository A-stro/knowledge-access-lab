---
id: latency-budget-notes
genre: references
title: "Display latency budget — engineering note"
created: 2026-03-08
provenance: hand-authored
tags: [latency, engineering-note]
source: "internal engineering note"
related:
  - type: relates_to
    to: references/mqtt-311-notes.md
---

For platform displays, perceived freshness needs end-to-end latency under a
second; MQTT retained messages cover reconnect gaps at QoS 1, accepting
occasional duplicates as the price.
