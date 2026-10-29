# Gold set — Knowledge Access Lab

45 hand-verified questions in 5 categories, each with a gold answer and exact-passage citations over the shared corpus.

> **Human gate: passed — principal review completed 2026-10-26.** This gold set passed its one human gate before the first full suite run. The principal reviewed the questions, gold answers, and citations, spot-checked by blind-answer retrieval (grep the entity and content terms, then compare against the gold) and by an adversarial synonym sweep over the absence questions. Absence questions are verified evidence-free by the gold lint (their terms have zero corpus hits, and their citations are empty by design).

| Category | Count |
|---|---|
| point-lookup | 9 |
| multi-hop | 9 |
| synthesis | 9 |
| temporal | 9 |
| absence | 9 |
| **total** | **45** |

## point-lookup

### q-pl-01 — What datastore does the Ledgerline service use?

**Gold answer.** Ledgerline stores its data in SQLite, running in WAL mode as the sole datastore for v1; Postgres stays out of scope until a second-writer need appears.

**Citations.**

- `decisions/d-001.md`:
  > Decision: use SQLite in WAL mode as the sole datastore for Ledgerline v1;

### q-pl-02 — Who owns the Wayfare display fleet and the edge gateways?

**Gold answer.** Bram Oyelaran, Meridian Studio's infrastructure engineer, owns the Wayfare display fleet and, since the April architecture review, the edge gateways — one per pilot station — that flash firmware once per site and funnel telemetry home.

**Citations.**

- `people/bram-oyelaran.md`:
  > He owns the
  > Wayfare display fleet and, since the April architecture review, the edge
  > gateways — one per pilot station — that flash firmware once per site and
  > funnel telemetry home.

### q-pl-03 — What is the current status of the Beacon Grid project?

**Gold answer.** Beacon Grid is paused (since 2026-05-26) pending Greenline Utilities' data-access clarification; Noor Haddad moved to Wayfare's final stretch.

**Citations.**

- `projects/beacon-grid.md`:
  > Paused 2026-05-26 pending Greenline's data-access clarification; Noor moved
  > to Wayfare's final stretch.

### q-pl-04 — Which three pilot stations did the Wayfare program cover?

**Gold answer.** Ashport Central, Ferry Quay, and Millbrook Bridge — platform displays for three pilot stations fed by live vehicle-position data.

**Citations.**

- `projects/wayfare.md`:
  > platform displays for three pilot stations — Ashport Central, Ferry
  > Quay, Millbrook Bridge — fed by live vehicle-position data.

### q-pl-05 — What does Northpost Analytics supply, and who consumes it?

**Gold answer.** Northpost Analytics is a regional data vendor supplying load-forecast feeds; Beacon Grid consumes its CSV exports alongside Greenline's raw sensor data.

**Citations.**

- `orgs/northpost-analytics.md`:
  > Northpost Analytics is a regional data vendor supplying load-forecast feeds.
  > Beacon Grid consumes its CSV exports alongside Greenline's raw sensor data.

### q-pl-06 — Who signed off Wayfare's ship, and on what date?

**Gold answer.** Katrin Ilic, Meridian Studio's QA lead, signed off Wayfare's ship on 2026-06-12.

**Citations.**

- `people/katrin-ilic.md`:
  > client portfolio and signed off Wayfare's ship on 2026-06-12. Her QA signoff

### q-pl-07 — What source is recorded for the IIIF overview reading notes?

**Gold answer.** The IIIF overview notes record their source as reading notes on the IIIF Image and Presentation APIs.

**Citations.**

- `references/iiif-overview.md`:
  > source: "reading notes, IIIF Image and Presentation APIs"

### q-pl-08 — How many contacts were exported when the Kestrel prototype was torn down?

**Gold answer.** Sixty-one contacts were exported from the Kestrel trial data into Ledgerline notes before the prototype was torn down.

**Citations.**

- `sessions/s-009.md`:
  > Two weeks of trial, sixty-one contacts, no regrets.

### q-pl-09 — What is Quill & Marrow's role on the Larkspur Archive?

**Gold answer.** Quill & Marrow is a content-strategy partner of the studio; it advised the metadata descriptions for the Larkspur Archive's digitized items, drafting the house style on top of Dublin Core fields.

**Citations.**

- `orgs/quill-and-marrow.md`:
  > It advised the
  > metadata descriptions for the Larkspur Archive's digitized items, drafting the
  > house style on top of Dublin Core fields.

## multi-hop

### q-mh-01 — Which decision superseded Wayfare's per-display autonomy, and what field findings justified the change?

**Gold answer.** Decision d-008 (each pilot station gets an edge gateway hub) superseded d-003. The field findings in s-004 justified it: three firmware versions across three stations, a board that lost power would not recover its clock, and reflashing took roughly ninety minutes per display carried to the platform.

**Citations.**

- `decisions/d-008.md`:
  >   - type: supersedes
  >     to: decisions/d-003.md
- `decisions/d-008.md`:
  > This supersedes d-003.
- `sessions/s-004.md`:
  > Reflashing takes roughly ninety minutes per display carried to the platform.

### q-mh-02 — Which reference note influenced both a Wayfare transport decision and a Beacon Grid ingest decision, and which decisions were they?

**Gold answer.** The MQTT 3.1.1 reading notes (mqtt-311-notes) informed both d-002 (Wayfare displays speak MQTT) and d-007 (Beacon Grid ingests over MQTT rather than REST polling); d-007 reuses the same protocol notes that shaped Wayfare's transport.

**Citations.**

- `references/mqtt-311-notes.md`:
  > Informed Wayfare's transport decision (d-002) and Beacon Grid's ingest
  > decision (d-007).
- `decisions/d-007.md`:
  > Decision: Beacon Grid ingests via MQTT subscriptions, reusing the same
  > protocol notes that shaped Wayfare's transport (mqtt-311-notes, also behind
  > d-002).

### q-mh-03 — What evidence contradicted the Larkspur OCR decision, and what did it find?

**Gold answer.** Session s-006's OCR latency benchmark contradicted d-004: on real archival page scans — foxed paper, old typefaces — throughput ran at roughly forty percent of the assumed rate once image preprocessing landed, so the linearity assumption behind d-004 does not hold for archival material; batching and preprocessing now set the schedule, not API capacity.

**Citations.**

- `sessions/s-006.md`:
  >   - type: contradicts
  >     to: decisions/d-004.md
- `sessions/s-006.md`:
  > The linearity assumption behind d-004 does not hold for archival material;
  > batching and preprocessing now set the schedule, not API capacity.
- `decisions/d-004.md`:
  > Later contradicted by the latency benchmark in
  > s-006, which found archival page scans far below the assumed rate.

### q-mh-04 — Which meeting reviewed the field findings behind the Wayfare edge-gateway decision?

**Gold answer.** Meeting m-005 (the Wayfare architecture review, 2026-04-08) reviewed the field findings from s-004 — three firmware versions across three stations, ninety-minute reflashes per display — and d-008 landed the same day. Session s-004 and meeting m-005 are both recorded as influencing d-008.

**Citations.**

- `meetings/m-005.md`:
  > Architecture review on the field findings (s-004): three firmware versions
  > across three stations, ninety-minute reflashes per display.
- `decisions/d-008.md`:
  >   - type: influenced_by
  >     to: sessions/s-004.md
  >   - type: influenced_by
  >     to: meetings/m-005.md

### q-mh-05 — Trace the influence chain behind Wayfare's green-and-amber palette decision.

**Gold answer.** Decision d-009 was influenced by session s-008 — Odessa's contrast testing with June at Ashport Central's sunlit platform, where the original blue-on-dark palette washed out by mid-morning while green-on-dark and amber-on-dark stayed readable — and by the WCAG contrast reading notes, which record that green-on-dark and amber-on-dark both test well in daylight.

**Citations.**

- `decisions/d-009.md`:
  > Decision: Wayfare's displays render in green-and-amber — green for live
  > departures, amber for alerts and delays — both testing well above the
  > contrast floor in daylight.
- `sessions/s-008.md`:
  > Odessa ran contrast testing at Ashport Central's sunlit platform with June:
- `references/wcag-contrast-notes.md`:
  > Informed the Wayfare palette decision (d-009).

### q-mh-06 — What influenced the cancellation of the Kestrel CRM experiment?

**Gold answer.** The go/no-go meeting m-006 influenced d-010: after the two-week trial, Theo's prototype worked, but the ops load fell on Lorna alone and no one could own the tool going forward — the studio's client count did not justify the maintenance surface. No-go was called, d-010 cancelled the experiment the next day, and export plus teardown happened in s-009.

**Citations.**

- `decisions/d-010.md`:
  > Decision: cancel the Kestrel CRM experiment, agreed at the go/no-go (m-006)
  > — the studio's client count does not justify the maintenance surface. Export
  > the trial data and tear down (s-009).
- `meetings/m-006.md`:
  > Go/no-go on Kestrel after the two-week trial: Theo's prototype works, but
  > the ops load fell on Lorna alone and no one can own the tool going forward —

### q-mh-07 — How does the fleet-provisioning ops note connect the Wayfare field pain to the edge-gateway decision?

**Gold answer.** The fleet-provisioning ops note lays out two provisioning topologies — point-wise flashing scales linearly and fails quietly, while a gateway-hub topology flashes once per site and funnels telemetry home — and was written after the Wayfare field pain (s-004); its hub topology is the direction d-008 adopted.

**Citations.**

- `references/fleet-provisioning-notes.md`:
  > Provisioning a fleet of small boards two ways: point-wise flashing scales
  > linearly with board count and fails quietly; a gateway-hub topology flashes
  > once per site and funnels telemetry home.
- `references/fleet-provisioning-notes.md`:
  > Written after the Wayfare field pain (s-004); the hub topology is the
  > direction d-008 adopted.
- `decisions/d-008.md`:
  > Decision: each pilot station gets an edge gateway hub — firmware flashes once
  > per station, displays pull from the gateway, telemetry funnels through it.

### q-mh-08 — How did the Ledgerline pricing discussion lead to its billing decision?

**Gold answer.** Meeting m-003 weighed hourly billing assembled from raw timesheets against flat monthly billing per client; flat monthly won — one predictable number per client, timesheets kept internal for capacity planning — and d-005 landed three days later: Ledgerline moves to flat monthly billing per client.

**Citations.**

- `meetings/m-003.md`:
  > with timesheets kept internal for capacity planning. Flat monthly won, and
  > d-005 landed three days later.
- `decisions/d-005.md`:
  > Decision: Ledgerline moves to flat monthly billing per client, agreed in the
  > pricing discussion (m-003) — clients see one predictable number; timesheets
  > stay internal for capacity planning.

### q-mh-09 — The IIIF viewer decision drew on which reference note, and how does that note connect to the earlier metadata work?

**Gold answer.** Decision d-011 (Larkspur ships an IIIF viewer) was influenced by the iiif-overview reading notes, which argue IIIF keeps a client's scans portable across viewer implementations; those notes relate to the archive-metadata notes, which record that Quill & Marrow drafted the Larkspur house style on top of fifteen Dublin Core elements.

**Citations.**

- `references/iiif-overview.md`:
  > IIIF gives archival viewers standardized deep-zoom image serving plus
  > manifests that carry page order and metadata; adopting it means a client's
  > scans stay portable across viewer implementations instead of locked to a
  > custom gallery.
- `references/iiif-overview.md`:
  >   - type: relates_to
  >     to: references/archive-metadata-notes.md
- `references/archive-metadata-notes.md`:
  > Fifteen Dublin Core elements cover the descriptive fields the archive needs
  > — title, creator, date, subject, rights — without a bespoke schema; Quill &
  > Marrow drafted the house style on top of them for the Larkspur metadata.

## synthesis

### q-sy-01 — Summarize the Wayfare program: client, scope, architecture arc, palette, and ship date.

**Gold answer.** Wayfare is Meridian Studio's realtime departure-display program for Halcyon Transit: platform displays for three pilot stations (Ashport Central, Ferry Quay, Millbrook Bridge) fed by live vehicle-position data, with sub-second perceived freshness, outdoor readability, and a June ship target set at the kickoff. The displays speak MQTT (d-002), went from per-display autonomy (d-003) to an edge-gateway hub per station (d-008) after field maintenance pain, and render green-and-amber for outdoor readability (d-009). It shipped 2026-06-12.

**Citations.**

- `projects/wayfare.md`:
  > Wayfare is Meridian Studio's realtime departure-display program for Halcyon
  > Transit: platform displays for three pilot stations — Ashport Central, Ferry
  > Quay, Millbrook Bridge — fed by live vehicle-position data.
- `projects/wayfare.md`:
  > edge-gateway hub (d-008) after field maintenance pain. The palette is
  > green-and-amber for outdoor readability (d-009).
- `projects/wayfare.md`:
  > Shipped 2026-06-12; ship retro in m-008.

### q-sy-02 — Who built Wayfare's display firmware and renderer, and what did each contribute?

**Gold answer.** Dev Okonkwo, the backend engineer, owns the Wayfare display firmware — he brought up the first Wayfare display on the bench and spent the April field day that surfaced the maintenance pain. Noor Haddad, the frontend engineer, built the Wayfare display renderer (she also built the Ledgerline interface and started the Beacon Grid dashboard).

**Citations.**

- `people/dev-okonkwo.md`:
  > He owns the Ledgerline
  > service, the Wayfare display firmware, and the Larkspur OCR pipeline.
- `people/noor-haddad.md`:
  > She built the Ledgerline
  > interface, the Wayfare display renderer, and started the Beacon Grid
  > dashboard.

### q-sy-03 — Compare the outcomes of the studio's two internal tools, Ledgerline and Kestrel.

**Gold answer.** Ledgerline is active: the internal timesheet and invoicing service the studio bills its clients through, SQLite-backed with flat monthly billing per client. Kestrel was cancelled 2026-04-21 (d-010): with the ops trial load falling on Lorna alone, no one could own it, and client tracking stayed in Ledgerline notes.

**Citations.**

- `projects/ledgerline.md`:
  > Ledgerline is Meridian Studio's internal timesheet and invoicing service —
  > the studio bills its clients through it.
- `projects/kestrel-crm.md`:
  > Cancelled 2026-04-21 (decision d-010): with the ops trial load falling on
  > Lorna alone, no one could own it. Data export and teardown happened in s-009.

### q-sy-04 — What did the March all-hands report about each of the studio's five client projects?

**Gold answer.** Per m-004 (2026-03-30): Ledgerline invoicing was live with flat monthly runs; Wayfare was in the field across the pilot stations; Larkspur Archive was scanning and OCR underway. New: Theo proposed the Kestrel CRM experiment and got a two-week trial window; the Beacon Grid engagement with Greenline Utilities would start the next week on the Northpost feeds.

**Citations.**

- `meetings/m-004.md`:
  > March all-hands. Status: Ledgerline invoicing live with flat monthly runs,
  > Wayfare in the field across the pilot stations, Larkspur Archive scanning
  > and OCR underway.
- `meetings/m-004.md`:
  > lightweight internal client tracker — and got a two-week trial window; the
  > Beacon Grid engagement with Greenline Utilities starts next week on the
  > Northpost feeds.

### q-sy-05 — How did the studio's approach to Wayfare display maintenance change between March and June, and what drove it?

**Gold answer.** In March each display ran its own single-board computer with local fallback rendering and no central station server (d-003). After six weeks in the field showed firmware drift and roughly ninety-minute manual reflashes per display (s-004, reviewed in m-005), each pilot station got an edge-gateway hub (d-008). By the June ship retro the reversal had collapsed the maintenance surface — flashing became a station visit, not a fleet archaeology dig.

**Citations.**

- `decisions/d-003.md`:
  > Decision: each Wayfare display runs its own single-board computer with local
  > fallback rendering and no central station server — autonomy per display,
- `decisions/d-008.md`:
  > Context: after six weeks in the field, per-display autonomy shows its cost —
  > firmware drift across boards and roughly ninety minutes of manual reflash per
  > display when updates land (documented in s-004, reviewed in m-005).
- `meetings/m-008.md`:
  > What worked: the edge-gateway
  > reversal (d-008) collapsed the maintenance surface — flashing is now a
  > station visit, not a fleet archaeology dig;

### q-sy-06 — Synthesize the Larkspur OCR story: original assumption, benchmark finding, and schedule consequence.

**Gold answer.** The ocr-comparison benchmark notes assumed a remote OCR API at roughly four times local throughput, with the assumption on record that throughput scales linearly with scan volume — that informed d-004. Session s-006 then found real archival scans (foxed paper, old typefaces) running at roughly forty percent of the assumed rate once preprocessing landed, so the linearity assumption does not hold for archival material. At the Bellweather review (m-007), the digitization schedule was stretched accordingly.

**Citations.**

- `references/ocr-comparison.md`:
  > Assumption on record: throughput scales linearly with scan volume.
- `sessions/s-006.md`:
  > Silas benchmarked the OCR pipeline against the ocr-comparison assumption: on
  > real archival page scans — foxed paper, old typefaces — throughput ran at
  > roughly forty percent of the assumed rate once image preprocessing landed.
- `meetings/m-007.md`:
  > archival scans run at roughly forty percent of
  > the assumed rate, so the digitization schedule stretches

### q-sy-07 — Which studio members worked on Beacon Grid, and in what roles?

**Gold answer.** Silas Brandt (data), Theo Kanda (systems), and Noor Haddad (dashboard) built the ingestion spike. Silas owns Beacon Grid's ingestion, where he spiked the DuckDB pipeline; Theo works the ingest; Noor started the dashboard before the project paused.

**Citations.**

- `projects/beacon-grid.md`:
  > Silas Brandt (data), Theo Kanda (systems), and Noor Haddad (dashboard) built
  > the ingestion spike (s-007).
- `people/silas-brandt.md`:
  > He owns the Larkspur OCR
  > data work — including the latency benchmark that overturned its throughput
  > assumption — and Beacon Grid's ingestion, where he spiked the DuckDB
  > pipeline.
- `people/theo-kanda.md`:
  > He proposed the edge-gateway hub that reversed Wayfare's display
  > architecture, works Beacon Grid's ingest, and championed the Kestrel CRM
  > experiment until its cancellation.

### q-sy-08 — What do the records say about June Park's contributions across the studio's projects?

**Gold answer.** June Park is the product designer: she designed the Wayfare display interface and owns its design tokens, designed the Larkspur Archive's reading experience, ran the platform contrast testing with Odessa, prototyped the IIIF viewer with Dev, and took the wallboard-style collection status page that Rowan asked for at the Bellweather review.

**Citations.**

- `people/june-park.md`:
  > She designed the Wayfare
  > display interface and owns its design tokens, and she designed the Larkspur
  > Archive's reading experience. She ran the platform contrast testing with
  > Odessa and prototyped the IIIF viewer with Dev.
- `meetings/m-007.md`:
  > Rowan asked for a
  > wallboard-style collection status page; June takes it.

### q-sy-09 — What happened to the Beacon Grid project between April and June?

**Gold answer.** In early April the ingestion spike landed: MQTT sensor topics into Parquet batches, DuckDB joining two weeks of sensor rows with Northpost forecast CSVs in under a second (s-007), with Noor to start the dashboard. Greenline later flagged access-approval processes and the project paused on 2026-05-26; Noor moved to Wayfare's final stretch, and the project remained paused through June.

**Citations.**

- `sessions/s-007.md`:
  > MQTT sensor topics
  > landing into Parquet batches, DuckDB joining two weeks of sensor rows with
  > Northpost forecast CSVs in under a second on a laptop.
- `projects/beacon-grid.md`:
  > Paused 2026-05-26 pending Greenline's data-access clarification; Noor moved
  > to Wayfare's final stretch.
- `decisions/d-006.md`:
  > Greenline later flagged access-approval processes, and the project paused
  > (2026-05-26).

## temporal

### q-te-01 — When did Wayfare ship, and when was its ship retro held?

**Gold answer.** Wayfare shipped 2026-06-12; the ship retro (m-008) was held 2026-06-16.

**Citations.**

- `projects/wayfare.md`:
  > Shipped 2026-06-12; ship retro in m-008.
- `meetings/m-008.md`:
  > Retro after shipping Wayfare on 2026-06-12.
- `meetings/m-008.md`:
  > created: 2026-06-16

### q-te-02 — Order the three Wayfare architecture-related decisions chronologically.

**Gold answer.** d-003 (per-display autonomy) on 2026-03-04, then d-008 (edge-gateway hub, which supersedes d-003) on 2026-04-08, then d-009 (green-and-amber palette) on 2026-04-15.

**Citations.**

- `decisions/d-003.md`:
  > created: 2026-03-04
- `decisions/d-008.md`:
  > created: 2026-04-08
- `decisions/d-009.md`:
  > created: 2026-04-15

### q-te-03 — How long did Wayfare run on per-display autonomy before the architecture changed?

**Gold answer.** About six weeks: the per-display decision (d-003) was recorded 2026-03-04, d-008 notes six weeks in the field before the edge-gateway reversal, and d-008 landed 2026-04-08.

**Citations.**

- `decisions/d-008.md`:
  > Context: after six weeks in the field, per-display autonomy shows its cost —
- `decisions/d-003.md`:
  > created: 2026-03-04
- `decisions/d-008.md`:
  > created: 2026-04-08

### q-te-04 — When was Beacon Grid paused, and when did its engagement begin?

**Gold answer.** Beacon Grid was paused 2026-05-26. The engagement began the week after the March all-hands (m-004, 2026-03-30, recorded as starting next week): the Greenline org record is dated 2026-04-01 and the Beacon Grid project record 2026-04-02.

**Citations.**

- `projects/beacon-grid.md`:
  > Paused 2026-05-26 pending Greenline's data-access clarification; Noor moved
  > to Wayfare's final stretch.
- `meetings/m-004.md`:
  > created: 2026-03-30
- `meetings/m-004.md`:
  > Beacon Grid engagement with Greenline Utilities starts next week on the
  > Northpost feeds.
- `orgs/greenline-utilities.md`:
  > created: 2026-04-01
- `projects/beacon-grid.md`:
  > created: 2026-04-02

### q-te-05 — What dates bracket the Kestrel experiment: announcement, start, cancellation, and teardown?

**Gold answer.** Announced at the March all-hands (m-004, 2026-03-30); started 2026-03-31, the day after the all-hands; cancelled 2026-04-21 (d-010); data export and teardown 2026-04-24 (s-009).

**Citations.**

- `meetings/m-004.md`:
  > created: 2026-03-30
- `projects/kestrel-crm.md`:
  > Kestrel started 2026-03-31, the day after the all-hands;
- `projects/kestrel-crm.md`:
  > Cancelled 2026-04-21 (decision d-010): with the ops trial load falling on
  > Lorna alone, no one could own it.
- `sessions/s-009.md`:
  > created: 2026-04-24

### q-te-06 — On what date did the Ledgerline billing decision land, relative to its pricing discussion?

**Gold answer.** The pricing discussion was recorded 2026-03-17 (m-003) and the flat-monthly decision d-005 landed 2026-03-20 — three days later.

**Citations.**

- `meetings/m-003.md`:
  > created: 2026-03-17
- `decisions/d-005.md`:
  > created: 2026-03-20
- `meetings/m-003.md`:
  > d-005 landed three days later.

### q-te-07 — Which Wayfare-related session is the earliest dated, and what did it achieve?

**Gold answer.** Session s-002 (2026-03-05, Wayfare display firmware first light): the first firmware boot on the bench — one single-board computer rendering the departure board, pulling MQTT retained messages, with local fallback rendering repainting the last-known board in under two seconds after a power cycle.

**Citations.**

- `sessions/s-002.md`:
  > created: 2026-03-05
- `sessions/s-002.md`:
  > First firmware boot on the bench: one single-board computer rendering the
  > departure board, pulling MQTT retained messages per d-002.
- `sessions/s-002.md`:
  > rendering works — power-cycle the board and it paints the last-known board in
  > under two seconds.

### q-te-08 — In what order were the Larkspur project's three major work sessions recorded?

**Gold answer.** The OCR pipeline wiring (s-003) on 2026-03-16, then the OCR latency benchmark (s-006) on 2026-04-18, then the IIIF viewer prototype (s-010) on 2026-05-10.

**Citations.**

- `sessions/s-003.md`:
  > created: 2026-03-16
- `sessions/s-006.md`:
  > created: 2026-04-18
- `sessions/s-010.md`:
  > created: 2026-05-10

### q-te-09 — When did the Larkspur engagement begin, relative to Wayfare's kickoff?

**Gold answer.** Wayfare's kickoff with Halcyon Transit was recorded 2026-02-20 (m-001). The Larkspur engagement followed in March: the Bellweather Books org record and the Larkspur Archive project record are both dated 2026-03-02.

**Citations.**

- `meetings/m-001.md`:
  > created: 2026-02-20
- `orgs/bellweather-books.md`:
  > created: 2026-03-02
- `projects/larkspur-archive.md`:
  > created: 2026-03-02

## absence

### q-ab-01 — Is there any record of blockchain or cryptocurrency work by the studio or its clients?

**Gold answer.** No evidence found — no corpus record mentions blockchain or cryptocurrency work.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `blockchain`, `cryptocurrency`

### q-ab-02 — Did the studio or any client ever deploy or evaluate delivery drones?

**Gold answer.** No evidence found — no corpus record mentions drones.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `drone`

### q-ab-03 — Has the studio ever run an internship or apprenticeship program?

**Gold answer.** No evidence found — no corpus record mentions an internship or apprenticeship program.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `internship`, `apprentice`

### q-ab-04 — Is any patent filing mentioned anywhere in the corpus?

**Gold answer.** No evidence found — no corpus record mentions a patent.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `patent`

### q-ab-05 — Does any record mention an insurance policy covering the display fleet or the studio?

**Gold answer.** No evidence found — no corpus record mentions insurance.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `insurance`

### q-ab-06 — Is any lawsuit or legal dispute mentioned in the corpus?

**Gold answer.** No evidence found — no corpus record mentions a lawsuit or legal dispute.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `lawsuit`, `litigation`

### q-ab-07 — Did anyone propose machine learning or neural networks for OCR or any other pipeline?

**Gold answer.** No evidence found — no corpus record mentions machine learning or neural networks.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `machine learning`, `neural network`

### q-ab-08 — Is there any virtual-reality exhibit or headset project anywhere in the corpus?

**Gold answer.** No evidence found — no corpus record mentions virtual reality or headsets.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `virtual reality`, `headset`

### q-ab-09 — Does the corpus mention 3D printing anywhere?

**Gold answer.** No evidence found — no corpus record mentions 3D printing.

**Citations.** None by design — the gold answer is that no supporting evidence exists.

**Absence terms (zero corpus hits, enforced by gold lint):** `3D printing`

