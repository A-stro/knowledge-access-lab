# Suite rollup — per-lane × per-category results

> Framing (accepted for F5, 2026-10-27; extended for F6, 2026-10-28): the graph lanes (graph, graph-seed) return traversal-shaped evidence — paths, typed edges, and name→path metadata, never record text — so they score zero on passage fidelity by architecture. That zero is the measured difference this lab exists to report, not a bug. The rollup carries both axes — evidence fidelity and judged answers — so the graph lanes' answer quality stands on its own.

Gold set: 45 questions across 5 categories. Lanes: rag, wiki, graph, graph-seed, direct. Architecture is the variable; the model is the constant.

Settled cells: 224 of 225 (1 recorded non-settlement(s), listed at the end — their lanes' means are over settled cells only).

Agent-under-test (pinned): nvidia/nvidia/nemotron-3-ultra-550b-a55b. Blind judge (pinned, different family): nvidia/minimaxai/minimax-m3.1-flash. Harness: pi 1.4.0.

Evidence ratios are deterministic and re-derive from the committed traces; judge verdicts are receipts recorded at score time. Every aggregate below cross-checks against the per-question rows in [rollup.json](rollup.json).

## Judged answers — correct/partial/incorrect · correct ratio

| lane | point-lookup | multi-hop | synthesis | temporal | absence | all |
|---|---|---|---|---|---|---|
| rag | 9/0/0 · 1.00 | 7/2/0 · 0.78 | 5/4/0 · 0.56 | 6/2/1 · 0.67 | 9/0/0 · 1.00 | 36/8/1 · 0.80 |
| wiki | 9/0/0 · 1.00 | 8/1/0 · 0.89 | 4/5/0 · 0.44 | 7/2/0 · 0.78 | 6/3/0 · 0.67 | 34/11/0 · 0.76 |
| graph | 0/0/9 · 0.00 | 0/0/9 · 0.00 | 0/0/9 · 0.00 | 0/0/9 · 0.00 | 9/0/0 · 1.00 | 9/0/36 · 0.20 |
| graph-seed | 0/1/8 · 0.00 | 2/5/1 · 0.25 | 0/4/5 · 0.00 | 0/3/6 · 0.00 | 7/2/0 · 0.78 | 9/15/20 · 0.20 |
| direct | 9/0/0 · 1.00 | 7/2/0 · 0.78 | 7/1/1 · 0.78 | 7/1/1 · 0.78 | 4/5/0 · 0.44 | 34/9/2 · 0.76 |

## Evidence fidelity — passage-exact / record-found means (absence column: stated "no evidence found" count · ratio)

| lane | point-lookup | multi-hop | synthesis | temporal | absence | all |
|---|---|---|---|---|---|---|
| rag | 1.00 / 1.00 | 0.89 / 0.89 | 0.87 / 0.87 | 0.80 / 0.80 | stated 7/9 · 0.78 | 0.89 / 0.89 |
| wiki | 1.00 / 1.00 | 0.94 / 0.94 | 0.87 / 0.87 | 0.86 / 0.86 | stated 7/9 · 0.78 | 0.92 / 0.92 |
| graph | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | stated 9/9 · 1.00 | 0.00 / 0.00 |
| graph-seed | 0.00 / 1.00 | 0.00 / 0.94 | 0.00 / 1.00 | 0.00 / 0.93 | stated 7/9 · 0.78 | 0.00 / 0.97 |
| direct | 1.00 / 1.00 | 1.00 / 1.00 | 0.96 / 0.96 | 0.90 / 0.90 | stated 7/9 · 0.78 | 0.96 / 0.96 |

## Retrieval cost per lane

| lane | mean steps | mean result bytes | error steps |
|---|---|---|---|
| rag | 9.4 | 11934 | 95 |
| wiki | 13.6 | 19738 | 0 |
| graph | 20.1 | 1168 | 905 |
| graph-seed | 34.8 | 15397 | 4 |
| direct | 27.5 | 17203 | 139 |

## Recorded non-settlements — measured, not silent

| lane | question | attempts | attempt seconds | why it never settled |
|---|---|---|---|---|
| graph-seed | q-mh-08 | 5 | 1200, 1200, 2700, 4500, 10800 | Unbounded exploration under the seeded surface, diagnosed live (event-stream capture, ~4 min / 20 calls): the model resolves the cited records by name, then hunts for a way to read their TEXT — which no seeded tool returns (lookup gives paths + titles; neighbors/paths give edges). Calls repeat within 20 turns (m-003 ×2, d-005 ×2, projects/ledgerline.md ×2) and each turn slows as context grows, so longer leashes do not converge. Measured cost above: 5 attempts, ~5.7 h of agent time. This is the seeded lane's hard failure mode — it fails SLOW on questions whose answer needs record text, where the bare lane failed fast (cold-start lockout → honest refusal in 20 steps). The other 44 seeded cells settled, most inside the suite's 20-minute bound. |

Per-question receipts (every ratio, verdict, and byte count): [rollup.json](rollup.json).
