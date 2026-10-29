// build/copperleaf-world.ts — generated side-world data, part 1: entities.
//
// The Copperleaf series is a coherent parallel fictional story — Copperleaf
// Studio, its clients, its projects — authored as data for the deterministic
// corpus expander (build/expand-corpus.ts). It shares the corpus's vocabulary
// (departure displays, timesheets, billing runs, OCR, archives) for retrieval
// distractor density, but never mentions a hand-authored entity: the
// expander enforces story separation with a protected-term check, so every
// gold-set answer stays unambiguous while retrieval gets measurably harder.
//
// All people, organizations, places, and events here are fictional, with
// invented names. Nothing in this world asserts facts about the
// hand-authored core.

export type SpecGenre =
  | "decisions"
  | "meetings"
  | "orgs"
  | "people"
  | "projects"
  | "references"
  | "sessions";

export type Spec = {
  genre: SpecGenre;
  id: string;
  title: string;
  created: string;
  updated?: string;
  tags: string[];
  /** body paragraphs, rendered in order, hard-wrapped by the expander */
  body: string[];
  // genre-specific frontmatter
  status?: string; // decisions + projects
  client?: string; // projects: org id
  attendees?: string[]; // meetings: person ids
  kind?: string; // orgs
  role?: string; // people
  source?: string; // references
  // curated typed edges, by target record id (never extracted)
  supersedes?: string[];
  contradicts?: string[];
  influencedBy?: string[];
  relatesTo?: string[];
  mentions?: string[];
};

export const ORG_SPECS: Spec[] = [
  {
    genre: "orgs",
    id: "copperleaf-studio",
    title: "Copperleaf Studio",
    created: "2025-09-22",
    tags: ["studio", "home"],
    kind: "studio",
    mentions: ["perchboard", "rill"],
    body: [
      "Copperleaf Studio is an eleven-person software design studio in Vantage Bay, founded in 2019 by Ines Marchetti and Yusuf Adeyemi. It builds operational software for civic and cultural clients — transit, museums, publishers, utilities — plus a small line of internal tools it runs for itself. The studio works out of the Wharfworks Collective, a converted cannery on the waterfront.",
    ],
  },
  {
    genre: "orgs",
    id: "bayline-transit",
    title: "Bayline Transit",
    created: "2025-09-29",
    tags: ["client", "transit"],
    kind: "client",
    mentions: ["perchboard", "dara-whitlock"],
    body: [
      "Bayline Transit operates trams and ferries across the Vantage Bay waterfront. Its service-planning lead, Dara Whitlock, sponsors Copperleaf's Perchboard departure-display program.",
    ],
  },
  {
    genre: "orgs",
    id: "wharfworks-collective",
    title: "Wharfworks Collective",
    created: "2025-10-02",
    tags: ["partner", "coworking"],
    kind: "partner",
    mentions: ["copperleaf-studio"],
    body: [
      "Wharfworks Collective is the co-working space that houses Copperleaf Studio — a converted cannery on the Vantage Bay waterfront with shared meeting rooms and a loading dock. Copperleaf is its longest-tenured studio tenant.",
    ],
  },
  {
    genre: "orgs",
    id: "harrowgate-press",
    title: "Harrowgate Press",
    created: "2026-01-12",
    tags: ["client", "publishing"],
    kind: "client",
    mentions: ["foxglove-archive", "aurelio-finch"],
    body: [
      "Harrowgate Press is a regional publisher holding an archive of print material spanning a century. Aurelio Finch heads the archive and sponsors Copperleaf's Foxglove Archive digitization platform.",
    ],
  },
  {
    genre: "orgs",
    id: "millhaven-observatory",
    title: "Millhaven Observatory",
    created: "2026-01-20",
    tags: ["client", "museum"],
    kind: "client",
    mentions: ["cometline", "ida-kovacs"],
    body: [
      "Millhaven Observatory is a small science museum and observatory on Vantage Bay's north shore. Ida Kovacs curates its exhibits and sponsored Copperleaf's Cometline exhibit kiosk.",
    ],
  },
  {
    genre: "orgs",
    id: "saltmarsh-creative",
    title: "Saltmarsh Creative",
    created: "2026-01-30",
    tags: ["partner", "content"],
    kind: "partner",
    mentions: ["foxglove-archive"],
    body: [
      "Saltmarsh Creative is a content-strategy partner of the studio. It advised the descriptive metadata for the Foxglove Archive's digitized items, drafting the house style on top of the studio's field vocabulary.",
    ],
  },
  {
    genre: "orgs",
    id: "ridgeway-power",
    title: "Ridgeway Power",
    created: "2026-02-18",
    tags: ["client", "utilities"],
    kind: "client",
    mentions: ["cinderboard", "nadia-moreau"],
    body: [
      "Ridgeway Power is Vantage Bay's municipal power utility. Nadia Moreau runs its grid operations desk; Copperleaf's Cinderboard project builds a load-monitoring wallboard over its feeder data, paused since April pending a data-sharing agreement.",
    ],
  },
  {
    genre: "orgs",
    id: "fathom-data-works",
    title: "Fathom Data Works",
    created: "2026-02-24",
    tags: ["vendor", "forecasting"],
    kind: "vendor",
    mentions: ["cinderboard"],
    body: [
      "Fathom Data Works is a regional data vendor supplying weather-adjusted load forecasts. Cinderboard consumes its CSV exports alongside Ridgeway's raw feeder sensor data.",
    ],
  },
  {
    genre: "orgs",
    id: "juniper-field-services",
    title: "Juniper Field Services",
    created: "2026-03-09",
    tags: ["vendor", "installation"],
    kind: "vendor",
    mentions: ["perchboard", "teodor-blum"],
    body: [
      "Juniper Field Services is the field-installation vendor for the Perchboard program — enclosure mounts, conduit runs, and pier maintenance windows. Teodor Blum runs its crew schedule.",
    ],
  },
];

export const PEOPLE_SPECS: Spec[] = [
  {
    genre: "people",
    id: "ines-marchetti",
    title: "Ines Marchetti",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["leadership"],
    role: "studio director and product lead",
    mentions: ["copperleaf-studio", "perchboard"],
    body: [
      "Ines Marchetti co-founded Copperleaf Studio with Yusuf Adeyemi in 2019 and directs it. She runs client relationships and product calls, chairs the monthly all-hands, and led the Perchboard kickoff with Dara Whitlock. She called the go/no-go on the Curlew experiment and closed the Perchboard ship retro.",
    ],
  },
  {
    genre: "people",
    id: "yusuf-adeyemi",
    title: "Yusuf Adeyemi",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["systems"],
    role: "systems engineer",
    mentions: ["rill", "cinderboard"],
    body: [
      "Yusuf Adeyemi co-founded Copperleaf Studio with Ines Marchetti and is its systems engineer. He proposed the edge-relay reversal that changed Perchboard's display architecture, owns Cinderboard's ingest design, and championed the Curlew CRM experiment until its cancellation. He bootstrapped Rill's schema.",
    ],
  },
  {
    genre: "people",
    id: "gwen-torvald",
    title: "Gwen Torvald",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["design"],
    role: "product designer",
    mentions: ["perchboard", "foxglove-archive"],
    body: [
      "Gwen Torvald is Copperleaf Studio's product designer. She designed the Perchboard display interface and owns its design tokens, designed the Foxglove Archive's reading experience, and curated the Cometline exhibit loop. She ran the pier legibility testing with Elif.",
    ],
  },
  {
    genre: "people",
    id: "rashid-bello",
    title: "Rashid Bello",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["embedded"],
    role: "embedded engineer",
    mentions: ["perchboard"],
    body: [
      "Rashid Bello is Copperleaf Studio's embedded engineer. He owns Perchboard's display firmware, brought up the first board on the bench, and spent the February field day with Yusuf that surfaced the maintenance pain behind the architecture change.",
    ],
  },
  {
    genre: "people",
    id: "marta-quintana",
    title: "Marta Quintana",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["data"],
    role: "data engineer",
    mentions: ["foxglove-archive", "cinderboard"],
    body: [
      "Marta Quintana is Copperleaf Studio's data engineer. She owns the Foxglove OCR data work — including the throughput benchmark that confirmed its schedule — and spiked Cinderboard's ClickHouse ingestion.",
    ],
  },
  {
    genre: "people",
    id: "pavel-sorokin",
    title: "Pavel Sorokin",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["engineering"],
    role: "frontend engineer",
    mentions: ["rill", "cometline"],
    body: [
      "Pavel Sorokin is Copperleaf Studio's frontend engineer. He built Rill's interface, the Perchboard display renderer, and the Foxglove static gallery, and hardened the Cometline kiosk browser.",
    ],
  },
  {
    genre: "people",
    id: "amara-diallo",
    title: "Amara Diallo",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["qa"],
    role: "QA lead",
    mentions: ["perchboard"],
    body: [
      "Amara Diallo is Copperleaf Studio's QA lead — she owns release QA across the client portfolio and signed off Perchboard's ship on 2026-05-22. Her depot QA sweep checklist from the ship retro is now the studio default for client ships.",
    ],
  },
  {
    genre: "people",
    id: "elif-yilmaz",
    title: "Elif Yilmaz",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["research"],
    role: "user researcher",
    mentions: ["perchboard", "foxglove-archive"],
    body: [
      "Elif Yilmaz is Copperleaf Studio's user researcher. She ran rider research at Granite Pier for Perchboard — watching how passengers read departure boards — drove the palette legibility testing with Gwen Torvald, and runs archive-user interviews for Foxglove.",
    ],
  },
  {
    genre: "people",
    id: "nils-aasen",
    title: "Nils Aasen",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["operations"],
    role: "operations coordinator",
    mentions: ["rill", "curlew-crm"],
    body: [
      "Nils Aasen is Copperleaf Studio's operations coordinator. He runs billing and scheduling, reconciles Rill's hourly invoice runs against bank deposits, and carried the Curlew CRM's ops trial — the load that tipped its go/no-go toward cancellation.",
    ],
  },
  {
    genre: "people",
    id: "sofia-reyes",
    title: "Sofia Reyes",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["infrastructure"],
    role: "infrastructure engineer",
    mentions: ["perchboard", "rill"],
    body: [
      "Sofia Reyes is Copperleaf Studio's infrastructure engineer. She owns the Perchboard fleet and, since the February architecture review, its edge relays — one per pilot station — that flash firmware once per site and funnel telemetry home. She set up Rill's backup rotation.",
    ],
  },
  {
    genre: "people",
    id: "tomas-berg",
    title: "Tomas Berg",
    created: "2025-09-22",
    updated: "2026-06-27",
    tags: ["docs"],
    role: "technical writer",
    mentions: ["juniper-field-services"],
    body: [
      "Tomas Berg is Copperleaf Studio's technical writer. He writes client runbooks and ship checklists, maintains the studio binder, and drafted the Perchboard provisioning guide Juniper's crews install from.",
    ],
  },
  {
    genre: "people",
    id: "dara-whitlock",
    title: "Dara Whitlock",
    created: "2025-09-29",
    updated: "2026-06-27",
    tags: ["client", "transit"],
    role: "service planning lead at Bayline Transit",
    mentions: ["bayline-transit", "perchboard"],
    body: [
      "Dara Whitlock is Bayline Transit's service planning lead and the client-side sponsor of the Perchboard program. She set the pilot scope at the kickoff — three stations, live vehicle positions, outdoor readability, a May ship — and stayed the client voice through the edge-relay change and the ship.",
    ],
  },
  {
    genre: "people",
    id: "aurelio-finch",
    title: "Aurelio Finch",
    created: "2026-01-12",
    updated: "2026-06-27",
    tags: ["client", "archive"],
    role: "head archivist at Harrowgate Press",
    mentions: ["harrowgate-press", "foxglove-archive"],
    body: [
      "Aurelio Finch is Harrowgate Press's head archivist and the client-side sponsor of the Foxglove Archive platform. He walked the mid-project review through his team's scanning concerns and welcomed the static-gallery direction.",
    ],
  },
  {
    genre: "people",
    id: "ida-kovacs",
    title: "Ida Kovacs",
    created: "2026-01-20",
    updated: "2026-06-27",
    tags: ["client", "museum"],
    role: "curator of exhibits at Millhaven Observatory",
    mentions: ["millhaven-observatory", "cometline"],
    body: [
      "Ida Kovacs curates exhibits at Millhaven Observatory and sponsored the Cometline kiosk. She curated the Night Sky over Vantage Bay loop the kiosk plays and asked for a second loop for the school-visit season.",
    ],
  },
  {
    genre: "people",
    id: "nadia-moreau",
    title: "Nadia Moreau",
    created: "2026-02-18",
    updated: "2026-06-27",
    tags: ["client", "utilities"],
    role: "grid operations manager at Ridgeway Power",
    mentions: ["ridgeway-power", "cinderboard"],
    body: [
      "Nadia Moreau runs Ridgeway Power's grid operations desk and is the client-side sponsor of the Cinderboard wallboard. She paused the feeder feeds in April pending a data-sharing agreement and led the June restart planning.",
    ],
  },
  {
    genre: "people",
    id: "teodor-blum",
    title: "Teodor Blum",
    created: "2026-03-09",
    updated: "2026-06-27",
    tags: ["vendor", "installation"],
    role: "installation crew lead at Juniper Field Services",
    mentions: ["juniper-field-services", "perchboard"],
    body: [
      "Teodor Blum leads Juniper Field Services' installation crew — enclosure mounts and maintenance windows for the Perchboard fleet — and coordinates pier schedules with Sofia Reyes.",
    ],
  },
];

export const PROJECT_SPECS: Spec[] = [
  {
    genre: "projects",
    id: "perchboard",
    title: "Perchboard — realtime departure displays for Bayline Transit",
    created: "2025-10-03",
    updated: "2026-06-04",
    status: "shipped",
    client: "bayline-transit",
    tags: ["transit", "displays", "mqtt"],
    mentions: ["bayline-transit", "d-102", "d-103", "d-109", "d-112", "m-101", "m-116"],
    body: [
      "Perchboard is Copperleaf Studio's realtime departure-display program for Bayline Transit: platform displays for three pilot stations — Granite Pier, Tram Junction, Lighthouse Point — fed by live vehicle-position data.",
      "Scope agreed at the kickoff (2025-09-29) with Dara Whitlock: sub-second perceived freshness, outdoor readability, and a May ship date. The displays speak MQTT 5.0 (decision d-102) and went from per-display autonomy (d-103) to an edge relay per station (d-109) after field maintenance pain. The palette is high-contrast white-on-black (d-112), with fleet clocks kept honest by chrony (d-110).",
      "Team: Rashid Bello (firmware), Pavel Sorokin (renderer), Gwen Torvald (design), Sofia Reyes (fleet), Amara Diallo (QA), Yusuf Adeyemi (systems). Enclosures installed with Juniper Field Services. Shipped 2026-05-22; ship retro in m-116.",
    ],
  },
  {
    genre: "projects",
    id: "rill",
    title: "Rill — internal timesheet and invoicing service",
    created: "2025-10-06",
    updated: "2026-06-27",
    status: "active",
    tags: ["internal", "billing"],
    mentions: ["d-101", "d-105", "s-101", "m-102", "m-104", "nils-aasen"],
    body: [
      "Rill is Copperleaf Studio's internal timesheet and invoicing service — the studio bills its clients through it. PostgreSQL-backed (decision d-101), with hourly billing and per-project rates (decision d-105) after the billing discussion in m-104; per-period rate cards followed in April (d-115), with the schema migrated in s-133. Invoice CSV export landed in February (s-105).",
      "Team: Yusuf Adeyemi (backend), Pavel Sorokin (interface), Nils Aasen (ops). Billing runs monthly; Nils reconciles the hourly runs against bank deposits, and Sofia keeps the backup rotation honest.",
    ],
  },
  {
    genre: "projects",
    id: "foxglove-archive",
    title: "Foxglove Archive — digitized collections platform for Harrowgate Press",
    created: "2026-01-12",
    updated: "2026-06-02",
    status: "active",
    client: "harrowgate-press",
    tags: ["archive", "ocr", "gallery"],
    mentions: ["harrowgate-press", "saltmarsh-creative", "d-104", "d-113", "d-118", "s-113", "m-103", "m-112"],
    body: [
      "The Foxglove Archive is a digitized-collection platform for Harrowgate Press: scanning, OCR, searchable metadata, and an online gallery. The OCR pipeline runs on a local GPU cluster rather than a remote API (decision d-104); the throughput benchmark (s-113) showed modern scans running above the assumed rate, which kept the digitization schedule. The viewer is a static-file gallery (decision d-113), prototyped in s-122, with page-level anchor URLs added in June (d-118).",
      "Team: Marta Quintana (data), Gwen Torvald (interface), Yusuf Adeyemi (OCR pipeline), Elif Yilmaz (user research). Aurelio Finch is the client sponsor; Saltmarsh Creative advised the metadata descriptions. Mid-project review with Harrowgate is m-112.",
      "As of late June the project is active: the modern collection is scanned, the annex queue is staged for summer, and the gallery is in integration.",
    ],
  },
  {
    genre: "projects",
    id: "curlew-crm",
    title: "Curlew CRM — cancelled internal client-tracker experiment",
    created: "2026-02-09",
    updated: "2026-03-20",
    status: "cancelled",
    tags: ["internal", "experiment"],
    mentions: ["m-105", "m-109", "d-111", "s-115", "yusuf-adeyemi", "nils-aasen"],
    body: [
      "Curlew was Yusuf Adeyemi's proposal for an internal CRM experiment — a lightweight tracker for studio client relationships — announced at the February all-hands (m-105). Curlew started 2026-02-09, the week after the all-hands; Yusuf prototyped contact pages and Nils Aasen ran a four-week ops trial.",
      "Cancelled 2026-03-17 (decision d-111): with the ops trial load falling on Nils alone, no one could own it. Data export and teardown happened in s-115.",
    ],
  },
  {
    genre: "projects",
    id: "cinderboard",
    title: "Cinderboard — load-monitoring wallboard for Ridgeway Power",
    created: "2026-02-19",
    updated: "2026-06-09",
    status: "paused",
    client: "ridgeway-power",
    tags: ["utilities", "monitoring", "clickhouse"],
    mentions: ["ridgeway-power", "fathom-data-works", "d-107", "d-108", "s-111", "m-119"],
    body: [
      "Cinderboard is a load-monitoring wallboard for Ridgeway Power: ingesting feeder sensor feeds and Fathom Data Works weather-adjusted load forecasts into ClickHouse (decision d-107) over MQTT 5.0 (decision d-108), queried for the grid operations desk. Marta Quintana (data), Yusuf Adeyemi (systems), and Pavel Sorokin (wallboard) built the ingestion spike (s-111).",
      "Paused 2026-04-20 pending Ridgeway's data-sharing agreement; restart planning with Nadia Moreau began in June (m-119).",
    ],
  },
  {
    genre: "projects",
    id: "cometline",
    title: "Cometline — exhibit kiosk for Millhaven Observatory",
    created: "2026-01-22",
    updated: "2026-05-18",
    status: "shipped",
    client: "millhaven-observatory",
    tags: ["museum", "kiosk"],
    mentions: ["millhaven-observatory", "d-106", "s-129", "m-115"],
    body: [
      "Cometline is an exhibit kiosk for Millhaven Observatory: an offline-capable kiosk browser (decision d-106) playing the Night Sky over Vantage Bay exhibit loop with captions, wall-mounted at the observatory entrance. It survived a 48-hour offline soak during hardening (s-129) and opened to visitors 2026-05-02; the opening review with Ida Kovacs is m-115.",
      "Team: Pavel Sorokin (kiosk), Gwen Torvald (exhibit design), Amara Diallo (QA).",
    ],
  },
  {
    genre: "projects",
    id: "driftline",
    title: "Driftline — ferry-schedule print service for Bayline Transit",
    created: "2026-05-06",
    updated: "2026-05-25",
    status: "shipped",
    client: "bayline-transit",
    tags: ["transit", "printing"],
    mentions: ["bayline-transit", "d-116", "s-139", "s-140", "thermal-printer-notes"],
    body: [
      "Driftline is a small ferry-schedule print service for Bayline Transit: the day's timetables rendered to thermal printers at three ticket counters (decision d-116: print from Bayline's timetable feed, not a local copy). Built in a two-week gap by Pavel Sorokin and Nils Aasen between the Perchboard ship and the Ridgeway restart; wired in s-139 and shipped 2026-05-25 after Amara's checklist run (s-140).",
    ],
  },
];

export const REFERENCE_SPECS: Spec[] = [
  {
    genre: "references",
    id: "postgres-operations-notes",
    title: "PostgreSQL operations — reading notes",
    created: "2025-09-28",
    tags: ["storage", "reading-notes"],
    source: "reading notes, PostgreSQL operations documentation",
    body: [
      "PostgreSQL gives concurrent writers real transactional isolation, read replicas, and honest failure modes — the cost is one server to operate: upgrades, connection limits, and vacuum land on a runbook. It fits a service with an ops owner and multi-writer billing.",
      "Informed d-101.",
    ],
  },
  {
    genre: "references",
    id: "mqtt-5-notes",
    title: "MQTT 5.0 — reading notes",
    created: "2025-10-10",
    tags: ["messaging", "reading-notes"],
    source: "reading notes, MQTT 5.0 specification overview",
    body: [
      "MQTT 5.0 keeps retained messages — a display recovers its last-known state after reconnect — and adds shared subscriptions that fan one topic across several consumers, plus session expiry and reason codes that make reconnects observable. Broker overhead is the cost; for small realtime payloads it still beats HTTP polling on freshness and battery.",
      "Informed Perchboard's transport decision (d-102) and Cinderboard's ingest decision (d-108).",
    ],
  },
  {
    genre: "references",
    id: "signage-panel-notes",
    title: "Signage panels for platform displays — field research summary",
    created: "2025-10-24",
    tags: ["embedded", "field-research"],
    source: "internal field research summary",
    body: [
      "High-brightness signage panels promise sunlight readability on paper; field experience says viewing angle and heat are the real costs, and one board per display keeps wiring simple until firmware updates land. Expect manual reflash cycles and clock sets when boards run unattended.",
      "Informed the original Perchboard per-display architecture (d-103).",
    ],
  },
  {
    genre: "references",
    id: "hocr-notes",
    title: "hOCR for OCR output — reading notes",
    created: "2026-01-13",
    tags: ["ocr", "reading-notes"],
    source: "reading notes, hOCR format documentation",
    relatesTo: ["ocr-job-queue-notes"],
    body: [
      "hOCR carries word bounding boxes and page structure alongside OCR text, so a gallery can highlight what the engine read without a bespoke layout format. Emitting it from the start keeps the pipeline's output portable.",
      "Informed the Foxglove OCR pipeline wiring (s-104).",
    ],
  },
  {
    genre: "references",
    id: "archival-handling-notes",
    title: "Handling a century of print — ops note",
    created: "2026-01-22",
    tags: ["archive", "ops-note"],
    source: "internal ops note",
    relatesTo: ["scan-resolution-notes"],
    body: [
      "Handling a century of print: gloves and flatbed passes for fragile bindings, modern stock tolerates the sheet-fed scanner, and foxed pages preprocess clean at the bench. Box-and-leaf naming keeps scan order recoverable without titles.",
      "Informed Foxglove's intake and d-114.",
    ],
  },
  {
    genre: "references",
    id: "double-entry-notes",
    title: "Double-entry bookkeeping — reading notes",
    created: "2025-11-18",
    tags: ["billing", "reading-notes"],
    source: "reading notes, double-entry bookkeeping primer",
    body: [
      "Every invoice line pairs with a ledger entry, so a deposit mismatch surfaces the day it lands instead of at month-end. Reconciliation becomes a query, not an archaeology dig.",
      "Informed Rill's ledger model and the monthly reconciliation reports.",
    ],
  },
  {
    genre: "references",
    id: "clickhouse-notes",
    title: "ClickHouse for embedded analytics — reading notes",
    created: "2026-02-19",
    tags: ["analytics", "reading-notes"],
    source: "reading notes, ClickHouse documentation",
    body: [
      "ClickHouse runs column scans over MergeTree partitions straight from Parquet and CSV with no separate server process to babysit — a good fit for a wallboard aggregating millions of feeder rows. A time-series server fits raw telemetry better, but an operations wallboard needs aggregate scans more than a retention engine.",
      "Informed d-107.",
    ],
  },
  {
    genre: "references",
    id: "kiosk-browser-notes",
    title: "Kiosk-mode browsers — reading notes",
    created: "2026-01-27",
    tags: ["kiosk", "reading-notes"],
    source: "reading notes, kiosk-mode browser guides",
    body: [
      "A kiosk-mode browser with the full exhibit loop cached offline, a watchdog restart, and an idle attract cycle survives dead routers and unattended power cuts; the cost is scheduled refresh windows instead of live updates.",
      "Informed d-106.",
    ],
  },
  {
    genre: "references",
    id: "static-site-gallery-notes",
    title: "Static galleries for collections — reading notes",
    created: "2026-03-31",
    tags: ["gallery", "reading-notes"],
    source: "reading notes, static site generators and image galleries",
    body: [
      "A static gallery is files to any host — no server to operate, deep links by anchor, and portability across hosts by construction; the trade-off is no server-side deep zoom. For a collection that must outlive any one platform, portable beats fancy.",
      "Informed d-113.",
    ],
  },
  {
    genre: "references",
    id: "backup-rotation-notes",
    title: "Backup rotation — ops note",
    created: "2025-11-05",
    tags: ["ops", "ops-note"],
    source: "internal ops note",
    body: [
      "Nightly dumps, weekly offsite copies, monthly restore rehearsals — a backup untested is a hope, not a backup. The rotation fits on one page and one checklist.",
      "Informed Rill's backup setup (s-102).",
    ],
  },
  {
    genre: "references",
    id: "chrony-notes",
    title: "chrony for field-device clocks — reading notes",
    created: "2026-02-27",
    tags: ["infrastructure", "reading-notes"],
    source: "reading notes, chrony and NTP documentation",
    body: [
      "chrony keeps field devices honest: boards sync to a local source — a station relay — instead of trusting their clocks after power cuts, and drift alarms catch boards that fall off.",
      "Informed d-110.",
    ],
  },
  {
    genre: "references",
    id: "enclosure-install-notes",
    title: "Enclosure installs on piers — ops note",
    created: "2026-03-16",
    tags: ["infrastructure", "ops-note"],
    source: "internal ops note",
    body: [
      "Marine-rated gaskets, conduit runs dressed away from rails, torque values in the runbook: pier salt air eats consumer seals, and maintenance windows are for inspection, not seal hunts.",
      "Informed the Perchboard provisioning sessions (s-124, s-127, s-131) and d-117.",
    ],
  },
  {
    genre: "references",
    id: "thermal-printer-notes",
    title: "Thermal printers for counter schedules — reading notes",
    created: "2026-05-05",
    tags: ["printing", "reading-notes"],
    source: "reading notes, thermal printer service manuals",
    body: [
      "Thermal paper fades in sunlight, jams on humidity, and reads best at arm's length — a print service is a scheduled job plus a paper drill and a runbook line for both.",
      "Informed Driftline (d-116).",
    ],
  },
  {
    genre: "references",
    id: "signage-legibility-notes",
    title: "Outdoor legibility for signage — reading notes",
    created: "2026-03-20",
    tags: ["design", "reading-notes"],
    source: "reading notes, signage legibility research",
    relatesTo: ["signage-panel-notes"],
    body: [
      "Viewing distance sets type size; luminance beats hue for legibility; white-on-black and cyan-on-black read at distance in daylight while teal-on-slate washes out by mid-morning.",
      "Informed d-112.",
    ],
  },
  {
    genre: "references",
    id: "ocr-job-queue-notes",
    title: "Job queues for OCR batches — reading notes",
    created: "2026-02-09",
    tags: ["ocr", "reading-notes"],
    source: "reading notes, job-queue patterns",
    body: [
      "OCR batches want a job queue with per-page idempotency and retry passes for faint pages; throughput telemetry belongs in the runbook next to the batch counts.",
      "Informed the Foxglove OCR batch sessions.",
    ],
  },
  {
    genre: "references",
    id: "ferry-timetable-notes",
    title: "Timetable feeds — reading notes",
    created: "2026-05-08",
    tags: ["transit", "reading-notes"],
    source: "reading notes, timetable feed formats",
    body: [
      "Timetable feeds put route schedules, service calendars, and holiday exceptions in one queryable place — printing from the feed means counters never trust a stale local copy.",
      "Informed d-116.",
    ],
  },
  {
    genre: "references",
    id: "filestore-naming-notes",
    title: "Filestore naming conventions — ops note",
    created: "2026-03-28",
    tags: ["ops", "ops-note"],
    source: "internal ops note",
    body: [
      "Naming conventions drift without a lint pass: one canonical tree, dated copies for runbooks, and a naming rule that sorts by date.",
      "Informed the studio tooling review (m-111).",
    ],
  },
  {
    genre: "references",
    id: "visitor-dwell-notes",
    title: "Kiosk dwell observations — field note",
    created: "2026-05-16",
    tags: ["research", "field-note"],
    source: "internal field note, kiosk observations",
    body: [
      "Dwell at the observatory kiosk averaged four minutes on opening weekend; captions beat audio in the dim hallway, and children tap for the next panel of the loop.",
      "Informed the Cometline opening review (m-115).",
    ],
  },
  {
    genre: "references",
    id: "rate-card-notes",
    title: "Rate-card design — reading notes",
    created: "2026-01-18",
    tags: ["billing", "reading-notes"],
    source: "reading notes, rate-card design",
    relatesTo: ["double-entry-notes"],
    body: [
      "A rate card with effective periods, expiry, and one source of truth keeps hourly billing honest — every invoice line cites the card in force on its date, and retroactive edits disappear.",
      "Informed Rill's billing model (d-105) and the May schema migration (s-133).",
    ],
  },
  {
    genre: "references",
    id: "mqtt-broker-ops-notes",
    title: "Broker operations — ops note",
    created: "2026-02-25",
    tags: ["messaging", "ops-note"],
    source: "internal ops note",
    body: [
      "One broker, retained-message snapshots for recovery drills, ACLs per topic, and shared-subscription balancing on by default — the operational cost of MQTT that the reading notes leave as an exercise.",
      "Informed the Perchboard and Cinderboard broker setup.",
    ],
  },
  {
    genre: "references",
    id: "scan-resolution-notes",
    title: "Scan resolution for archives — reading notes",
    created: "2026-01-23",
    tags: ["archive", "reading-notes"],
    source: "reading notes, imaging standards for archives",
    body: [
      "Master scans at 400 ppi, grayscale masters where color adds nothing, derivatives for the gallery — resolution decisions at intake decide everything downstream.",
      "Informed Foxglove's scan intake.",
    ],
  },
  {
    genre: "references",
    id: "gpu-cluster-notes",
    title: "The two-GPU bench — bench note",
    created: "2026-01-09",
    tags: ["ocr", "bench-note"],
    source: "internal bench note",
    body: [
      "Two desktop-class GPUs clear an evening batch of a few hundred pages; queue depth caps at memory; past hour six the boxes thermal-throttle and throughput dips.",
      "Informed d-104.",
    ],
  },
  {
    genre: "references",
    id: "schema-migration-notes",
    title: "Database migrations — reading notes",
    created: "2026-04-27",
    tags: ["rill", "reading-notes"],
    source: "reading notes, database migration patterns",
    body: [
      "Transactional migrations with a rollback rehearsal, expand-and-contract for changing shapes in place: the rehearsal is the cheap part and the whole game.",
      "Informed the Rill rate-card migration (s-133).",
    ],
  },
  {
    genre: "references",
    id: "runbook-notes",
    title: "Runbooks that survive — ops note",
    created: "2026-06-11",
    tags: ["docs", "ops-note"],
    source: "internal ops note",
    body: [
      "Runbooks live next to the tool they describe, a printed copy survives a filestore outage, and a naming lint keeps the copies findable.",
      "Informed the studio runbook refresh (s-146).",
    ],
  },
];
