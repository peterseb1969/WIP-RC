# Commits — APP-RC-20261028-145029

## 2216fa3 — feat: parity checks run per namespace or for all, not on tab open
**Time:** 15:23
**Files:** 2 changed, +79/-17
**Tests:** tsc clean; unit 247/247. E2E parity spec updated but not run (no dex-password-e2e secret in the `default` deployment).
**What:** The Parity tab no longer queries every namespace on open. Each namespace shows "not checked" with a Check button; Check all at the top; re-check icon on checked cards; Retry on failures. Cached results still render without re-running.
**Why:** Opening the tab ran a full document-count comparison for every namespace at once. Peter reported it as bad and asked for per-namespace or all.
**Discovered:** Eyeballed in Peter's browser (looks good); I could not run the browser/E2E check myself.

## 2f218e4 — feat: batch sync template dropdown follows the namespace scope and shows label and value
**Time:** 15:23
**Files:** 3 changed, +149/-11
**Tests:** tsc clean; unit 255/255 (8 new in `tests/unit/batch-sync-templates.test.ts`). Facets endpoint checked live for `kb` and `pbs-clintrial`. Not checked in a browser; no E2E added.
**What:** With a namespace scope set, the single-template dropdown lists only templates that namespace's documents are instances of (template facets, `status: 'all'`, matched by template_id so foreign-owned templates stay). Options read "Label (VALUE)". Failed lookup falls back to the full list; a selection that leaves scope is cleared. Logic lives in `src/lib/batch-sync-templates.ts`.
**Why:** The dropdown listed every template whatever namespace was selected and showed only the label, while the rest of the UI shows the value.
**Discovered:** Filtering by template ownership would have been wrong: a namespace's documents can use a template owned elsewhere (see the comment at the top of BatchSyncPanel.tsx).
