# Session Updates — APP-RC-20261019-230436

## 2026-10-19 23:15 — Full E2E 63/63 on wip-local with CASE-910 registry code
wip-local is hot-wired (source-mounted), so CASE-910 (a9bbb840) was live without an image: `require_privileged_key` is present in /app/src/registry/services/auth.py in wip-registry, which had restarted ~2 min before the run. Full suite: 63 passed in 2.3 min, no retries or flakes, including the registry spec (synonym add/resolve) and the access spec. RC talks to the registry through the deploy admin key, which falls under the privileged exception, so the stricter checks do not affect RC — confirmed by this run.

## 2026-10-19 23:20 — CASE-910#4: consumer check posted
Peter approved. Comment 01a15609-bcd9-7bc5-aa6a-d7a65bfb7782: RC is unaffected on wip-local (63/63). The registry spec covers synonyms add/remove, merge, by-term search and lookup by-key/by-id, all through RC's admin-key proxy. RC's ALLOWED_GROUPS=wip-admins was verified in the container. Not covered: the deployed installs (they need a platform image), and the new refusals themselves (RC has no non-privileged Registry caller).

## 2026-10-19 23:45 — Filed CASE-914 (term lookup field form)
Peter approved. CASE-914 (01a15620-1474-733b-9d08-9af4b25595f2), target BE-YAC, annoying. GET /terms/{value}?terminology= resolves only a bare terminology value; the canonical id and ns:VALUE get a 404 "could not resolve", and the id still demands namespace (422). /terms/search accepts all three forms. RC works around it in 8137ccb.

## 2026-10-20 00:07 — Reporting schemas outlive deleted namespaces; Table Browser chips crowded out the list
The full run after the nested-objects spec failed one reporting test: in the Table Browser, the namespace chip area (one chip per PostgreSQL schema) had grown to 44 chips and filled the panel, so the sticky filter header covered the table button. Fixed in PostgresPage (chip area capped at max-h-24 with its own scroll); the reporting spec then passed 6/6. Cause of the growth: 34 of the 47 reporting schemas on wip-local have no registry namespace (aa-e2e-*, aa-it-*, rc-e2e-* from 10-18 and earlier 10-19, BE probes, and my rc-e2e-probe-a). The pattern is inconsistent: rc-e2e-probe-b and probe-n and the later RC runs left none. That points at something like a race between namespace delete and async sync, but this is not verified; candidate case for BE-YAC, pending Peter. One solo reporting run before the fix failed on the Query Pad step instead; its screenshot was overwritten, unattributed.

## 2026-10-20 00:12 — Filed CASE-915 and CASE-916
Peter approved both. CASE-915 (01a15639-55d3-7d9c-b611-369e5324d157): term fields inside nested template objects are neither validated nor resolved (probe table in the case). CASE-916 (01a15639-5e07-7c81-b295-5f300f82100b): reporting schemas reappear after namespace deletion. The leftover rc-e2e-probe-a schema holds only r3, the last document written right before the delete, while the earlier r1 in the same table is gone. That fits a late event re-creating the dropped schema; inferred from the end state, not from code. KNOWN_ISSUES carries both.
