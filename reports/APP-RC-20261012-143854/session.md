---
session_id: APP-RC-20261012-143854
role: APP-RC
started_at: 2026-10-12T14:38:54
status: active
continues_from: APP-RC-20260705-192840
---

# Session APP-RC-20261012-143854

Continues from APP-RC-20260705-192840 (via /wip-wake).

## Session Summary
**Duration:** 14:38 – 19:56
**Commits:** 19 substantive (plus report-log commits), all pushed
**Lines:** +2409/-399 across 95 files (8a1bbbb..HEAD)
**Phase:** 4 — /wip-improve + /wip-document
**What happened:** Woke into a clone 37 commits behind origin; the first three commits duplicated origin's work and the push was rejected — reset onto origin (Peter's call) and re-applied only the genuinely new pieces. Then: fixed the NL agent (host-mode key, and three of seven tools that had never worked against WIP's wire shapes); adopted @wip/client 0.53.0, which exposed the two-half edge-endpoint shape already breaking the template detail/builder; scoped the edge endpoint picker to the edge's namespace; built the registered-views Views tab plus an NL tool for views. Peter's "are you done?" prompted an honest gap list → NL views tool, browser check of the picker namespace switch, and a six-month documentation catch-up via four parallel forks, whose verification surfaced a further batch of real bugs (template-list truncation, term cap notice, CSV NaN, OIDC-mode healthcheck, missing contract routes) — all fixed.
**WIP interactions:** Filed CASE-858 (pre-CASE-830 edge endpoints never get `resolved`; 99 entries), CASE-859 (first query after a column-changing view replace fails "cached statement plan is invalid"), CASE-861 (@wip/client ReportQueryResult rows typed unknown[][], wire is objects; empty result has columns: []). reporting-sync /query and /tables answer without credentials on wip-local — Peter says this is handled elsewhere. WIP list endpoints silently ignore `limit` (default page 50).
**Unfinished:** NL_QUERY_MODEL default is still claude-sonnet-4-6 — upgrading to a 5.5 model needs a small migration (max_tokens vs default-on adaptive thinking, refusal handling + fallbacks) and an Anthropic key to test; awaiting Peter. (The CASE-859 retry removal and the switch to client.reporting.runQuery are done: bc32c86.)
**For the next YAC:** `git fetch` and compare with origin before trusting local history (memory: feedback_fetch_origin_on_wake). The --app-source container mounts this clone (Express 3011, Vite 5174, app path /apps/rc/). After any lib bump, restart the container (lockfile-hash-gated npm ci) and smoke it — tsc/vitest don't catch runtime breakage. When asked "do you remember X?" and it isn't in context, just say no.

