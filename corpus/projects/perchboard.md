---
id: perchboard
genre: projects
title: "Perchboard — realtime departure displays for Bayline Transit"
created: 2025-10-03
updated: 2026-06-04
status: shipped
client: bayline-transit
provenance: generated
tags: [transit, displays, mqtt]
related:
  - type: mentions
    to: orgs/bayline-transit.md
  - type: mentions
    to: decisions/d-102.md
  - type: mentions
    to: decisions/d-103.md
  - type: mentions
    to: decisions/d-109.md
  - type: mentions
    to: decisions/d-112.md
  - type: mentions
    to: meetings/m-101.md
  - type: mentions
    to: meetings/m-116.md
---

Perchboard is Copperleaf Studio's realtime departure-display program for
Bayline Transit: platform displays for three pilot stations — Granite Pier,
Tram Junction, Lighthouse Point — fed by live vehicle-position data.

Scope agreed at the kickoff (2025-09-29) with Dara Whitlock: sub-second
perceived freshness, outdoor readability, and a May ship date. The displays
speak MQTT 5.0 (decision d-102) and went from per-display autonomy (d-103)
to an edge relay per station (d-109) after field maintenance pain. The
palette is high-contrast white-on-black (d-112), with fleet clocks kept
honest by chrony (d-110).

Team: Rashid Bello (firmware), Pavel Sorokin (renderer), Gwen Torvald
(design), Sofia Reyes (fleet), Amara Diallo (QA), Yusuf Adeyemi (systems).
Enclosures installed with Juniper Field Services. Shipped 2026-05-22; ship
retro in m-116.
