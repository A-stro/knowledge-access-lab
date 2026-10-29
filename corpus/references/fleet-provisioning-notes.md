---
id: fleet-provisioning-notes
genre: references
title: "Provisioning device fleets — ops note"
created: 2026-04-06
provenance: hand-authored
tags: [infrastructure, ops-note]
source: "internal ops note"
related:
  - type: relates_to
    to: references/embedded-single-board-notes.md
---

Provisioning a fleet of small boards two ways: point-wise flashing scales
linearly with board count and fails quietly; a gateway-hub topology flashes
once per site and funnels telemetry home. The hub costs one more box per
station but collapses the maintenance surface.

Written after the Wayfare field pain (s-004); the hub topology is the
direction d-008 adopted.
