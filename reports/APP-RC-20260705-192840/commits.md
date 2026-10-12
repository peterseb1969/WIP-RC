## 1168700 — fix: adapt reporting surfaces to per-namespace PG schemas (CASE-628/CASE-632)
**Time:** 00:51
**Files:** 5 changed, +166/-74
**Tests:** 37 passed, 0 failed (2 new: namespace forwarding in run_report_query)
**What:** Adapted all raw-SQL reporting surfaces to CASE-628's schema-per-namespace move: table browser groups by namespace and uses server-provided qualified_name, columns query gains table_schema filter, Query Pad gains namespace selector (forwarded to query + CSV export + history), CSV downloads pass the now-required namespace param, NL agent tool accepts/forwards namespace with updated prompt guidance.
**Why:** CASE-632 impact notice; wip-local is already post-c1d30795, so the PostgreSQL page and NL SQL answers were broken live, not prospectively.
**Discovered:** GET /export/csv?table= now hard-requires namespace (422 without) — not in the original advisory; flagged in CASE-632#8 and BE-YAC amended the case body. Verified end-to-end in the browser via the --app-source mount (app path is /apps/rc/, not /apps/react-console/).
## 97d25cc — chore: adopt @wip/client 0.30.0, @wip/react 0.17.0, @wip/proxy 0.4.1
**Time:** 01:12
**Files:** 11 changed, +106/-363
**Tests:** 37 passed, 0 failed
**What:** Gene-pool lib refresh via create-app-project.sh set-up-in-place: new versioned tarballs + README updates + pin/lockfile sync. Client 0.30.0/react 0.17.0 bring the CASE-633 namespace option on reporting runQuery/useReportQuery.
**Why:** Peter asked for the latest libs; the CASE-632 thread announced the versions. RC has zero runQuery call sites, so pins-only, no code change.
**Discovered:** The previous refresh (proxy 0.4.0) had been left uncommitted in the working tree — its tarball was never git-added; this commit jumps 0.3.0 → 0.4.1 directly.
## e175180 — fix: roll @wip/proxy back to 0.3.0 — 0.4.1 crashes at mount under Express 5 (CASE-637)
**Time:** 01:36
**Files:** 4 changed
**Tests:** 37 passed, 0 failed (tsc clean)
**What:** Reverted the proxy pin from 0.4.1 to 0.3.0 (tarball restored from git history); client 0.30.0 / react 0.17.0 stay.
**Why:** 0.4.1 switched express from bundled dep to peer, so wipProxy's Express-4-only wildcard pattern ('$prefix/*') hit RC's express@5.2.1 / path-to-regexp 8 and threw at mount — server dead before bind, every route 500 via Vite proxy. Filed CASE-637 with root cause, lockfile evidence, and three fix options.
**Discovered:** The 0.3.0→0.4.1 breakage was invisible to tsc and vitest (mount-time crash, only runtime); container smoke after lib bumps is load-bearing. RC is likely the first Express 5 consumer of proxy 0.4.x.
## 7cf1a4e — chore: adopt @wip/proxy 0.4.2 — CASE-637 fix release
**Time:** 01:59
**Files:** 4 changed
**Tests:** 37 passed, 0 failed (tsc clean)
**What:** Dropped the 0.3.0 pin-back; vendored 0.4.2 from WIP ed2a4953. Lockfile confirms the proxy now resolves the app's express@5.2.1 (no nested express 4).
**Why:** BE-YAC shipped the CASE-637 fix (anchored-regex prefix mount, dual-major test matrix 54/54, consumer-shape smoke incl. express 5); Peter confirmed the commit landed.
## 7cfb01b — chore: adopt @wip/client 0.31.0 — CASE-640 canonical index key
**Time:** 19:57
**Files:** 4 changed
**Tests:** 37 passed, 0 failed (tsc clean)
**What:** Vendored client 0.31.0 (WIP a87650a7). CASE-640 flagged RC by name for an input_index audit: zero reads in app code; registry surfaces are listEntries + searchEntries (hits/total only). Types-only exposure, adopted for type-honesty.
**Why:** Registry bulk families renamed input_index → canonical index platform-wide; 0.30.0's RegistryLookupResponse type would lie against the new wire.
## bb18690 — feat: full ontology + bulk terminology import (CASE-672, CASE-674)
**Time:** 19:37
**Files:** 3 changed, +452/-94
**Tests:** 47 passed, 0 failed (12 new for the OBO parser / CSV mapper / bulk summarizer)
**What:** ImportPanel rewrite — OBO Graph JSON + plain-text .obo route through the server's importOntology (terms AND relations, idempotent); CSV/JSON-array use createTerms bulk; per-item failure reporting. Parsing logic extracted to src/lib/terminology-import.ts.
**Why:** CASE-672 (ontology edges silently dropped, .obo crashed) and CASE-674 (per-row HTTP calls) — both implemented and closed as implemented.
**Discovered:** Server ontology importer requires nodes with type CLASS (silent filter otherwise). @wip/client 0.31.0 importOntology return type says 'relationships' but wire says 'relations' — crashed first live import; filed CASE-677 (BE-YAC), RC reads both keys defensively. Unit test caught a real quote-handling bug in the first parser version.
## 37e37da — feat: import terminology from file on the list page (CASE-673)
**Time:** 19:57
**Files:** 3 changed, +431/-254
**Tests:** 47 passed, 0 failed (tsc clean)
**What:** ImportPanel extracted to a shared component (into-existing / create-new modes); Terminologies list page gains an Import button with a naming pre-step; navigation to the created vocabulary on success.
**Why:** CASE-673 — closes the discoverability gap Peter hit (import was only findable inside an existing terminology) and completes the import arc with 672/674.
**Discovered:** The exists-check pre-step proposed in the response was unnecessary — both importTerminology and importOntology upsert the terminology (create-or-reuse), matching the idempotent-bootstrap convention.
