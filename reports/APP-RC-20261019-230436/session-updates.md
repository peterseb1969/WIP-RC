# Session Updates — APP-RC-20261019-230436

Append-only running log. Distinct from session.md (overwritten at end) and report-<slug>.md (per-decision). Read by /wip-wake after session.md and commits.md.

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

## 2026-10-20 00:13 — Snapshot: three form items done, three cases filed; state and next
All pushed; master ae7b1c5, tree clean. Context at 37%.
- **Done this session:**
  - Term picker searches the whole terminology, including names (8137ccb).
  - Reference picker: every target template, server-side search, allowed namespaces only, the document's namespace in edit mode (f7334fd).
  - Nested template objects get sub-forms, with stable item keys and edits sent as a real merge patch (78fac0e).
  - Table Browser chip area capped (69b1251).
  - Tests: 74 E2E (2.7 min), 208 unit, all green. Every new spec was checked against the old code (details in commits.md).
- **Cases (all to BE-YAC):**
  - CASE-910#4: consumer check.
  - CASE-914: the term lookup's field form takes only the terminology's bare value.
  - CASE-915: nested term fields are neither validated nor resolved.
  - CASE-916: reporting schemas reappear after namespace delete; a late event re-creates the dropped schema, by inference.
- **Platform facts learned:**
  - array_template_ref_version is required on array-item template refs.
  - Term search limit max is 100 and needs namespace.
  - Reporting search per-type max is 100; its document hits carry only an id.
  - documents/query accepts "in" filters on template_id and document_id.
  - Cross-namespace document refs need allowed_external_refs (probed).
  - The document PATCH deep-merges objects (confirmed via E2E).
- **Dead ends:**
  - zsh: a bare $N:P expands as a path modifier (use ${N}), and `set -- $var` does not word-split; use Python for multi-arg loops.
  - getByLabel matches substrings ("n" hit "name" and "kind"), and mandatory labels carry "*"; use exact or an anchored regex.
  - Old-code checks need the label/aria fixes kept and new footer text neutralised, or the spec fails on the wrong step.
- **Open:**
  - **Unverified:** one unattributed reporting-spec failure on the Query Pad step (screenshot overwritten); DocumentTablePage's 500 mapping.
  - **Noticed, not acted on:** in create mode a document is created in its template's namespace, regardless of the selected global namespace.
  - **Backlog:** NL Query, Mongo aggregation, ontology graph, bundle size, E2E CI.
  - **Next:** Peter's call.
