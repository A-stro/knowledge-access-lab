---
id: wayfare
genre: projects
title: "Wayfare — realtime departure displays for Halcyon Transit"
created: 2026-02-26
updated: 2026-06-16
status: shipped
client: halcyon-transit
provenance: hand-authored
tags: [transit, displays, mqtt]
related:
  - type: mentions
    to: orgs/halcyon-transit.md
  - type: mentions
    to: meetings/m-001.md
  - type: mentions
    to: decisions/d-002.md
  - type: mentions
    to: decisions/d-003.md
  - type: mentions
    to: decisions/d-008.md
  - type: mentions
    to: decisions/d-009.md
  - type: mentions
    to: meetings/m-008.md
---

Wayfare is Meridian Studio's realtime departure-display program for Halcyon
Transit: platform displays for three pilot stations — Ashport Central, Ferry
Quay, Millbrook Bridge — fed by live vehicle-position data.

Scope agreed at the kickoff (2026-02-20) with Petra Lindqvist: sub-second
perceived freshness, outdoor readability, and a June ship date. The displays
speak MQTT (decision d-002) and went from per-display autonomy (d-003) to an
edge-gateway hub (d-008) after field maintenance pain. The palette is
green-and-amber for outdoor readability (d-009).

Team: Dev Okonkwo (firmware), Noor Haddad (renderer), June Park (design),
Bram Oyelaran (fleet), Katrin Ilic (QA), Theo Kanda (systems).
Shipped 2026-06-12; ship retro in m-008.
