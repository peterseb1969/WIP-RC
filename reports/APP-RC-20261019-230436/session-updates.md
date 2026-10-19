# Session Updates — APP-RC-20261019-230436

## 2026-10-19 23:15 — Full E2E 63/63 on wip-local with CASE-910 registry code
wip-local is hot-wired (source-mounted), so CASE-910 (a9bbb840) was live without an image: `require_privileged_key` is present in /app/src/registry/services/auth.py in wip-registry, which had restarted ~2 min before the run. Full suite: 63 passed in 2.3 min, no retries or flakes, including the registry spec (synonym add/resolve) and the access spec. RC talks to the registry through the deploy admin key, which falls under the privileged exception, so the stricter checks do not affect RC — confirmed by this run.

## 2026-10-19 23:20 — CASE-910#4: consumer check posted
Peter approved. Comment 01a15609-bcd9-7bc5-aa6a-d7a65bfb7782: RC is unaffected on wip-local (63/63). The registry spec covers synonyms add/remove, merge, by-term search and lookup by-key/by-id, all through RC's admin-key proxy. RC's ALLOWED_GROUPS=wip-admins was verified in the container. Not covered: the deployed installs (they need a platform image), and the new refusals themselves (RC has no non-privileged Registry caller).

## 2026-10-19 23:45 — Filed CASE-914 (term lookup field form)
Peter approved. CASE-914 (01a15620-1474-733b-9d08-9af4b25595f2), target BE-YAC, annoying. GET /terms/{value}?terminology= resolves only a bare terminology value; the canonical id and ns:VALUE get a 404 "could not resolve", and the id still demands namespace (422). /terms/search accepts all three forms. RC works around it in 8137ccb.
