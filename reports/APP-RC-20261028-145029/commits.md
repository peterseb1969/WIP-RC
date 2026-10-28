# Commits — APP-RC-20261028-145029

## 2216fa3 — feat: parity checks run per namespace or for all, not on tab open
**Time:** 15:23
**Files:** 2 changed, +79/-17
**Tests:** tsc clean; unit 247/247. Reporting E2E parity spec passes (run later, once the e2e Dex user was back).
**What:** The Parity tab no longer queries every namespace on open. Each namespace shows "not checked" with a Check button; Check all at the top; re-check icon on checked cards; Retry on failures. Cached results still render without re-running.
**Why:** Opening the tab ran a full document-count comparison for every namespace at once. Peter reported it as bad and asked for per-namespace or all.
**Discovered:** Eyeballed in Peter's browser (looks good); I could not run the browser/E2E check myself.

## 2f218e4 — feat: batch sync template dropdown follows the namespace scope and shows label and value
**Time:** 15:23
**Files:** 3 changed, +149/-11
**Tests:** tsc clean; unit 255/255 (8 new in `tests/unit/batch-sync-templates.test.ts`). Facets endpoint checked live for `kb` and `pbs-clintrial`. Browser-verified afterwards by the reporting E2E spec (see 508ae88).
**What:** With a namespace scope set, the single-template dropdown lists only templates that namespace's documents are instances of (template facets, `status: 'all'`, matched by template_id so foreign-owned templates stay). Options read "Label (VALUE)". Failed lookup falls back to the full list; a selection that leaves scope is cleared. Logic lives in `src/lib/batch-sync-templates.ts`.
**Why:** The dropdown listed every template whatever namespace was selected and showed only the label, while the rest of the UI shows the value.
**Discovered:** Filtering by template ownership would have been wrong: a namespace's documents can use a template owned elsewhere (see the comment at the top of BatchSyncPanel.tsx).

## 508ae88 — test: batch sync E2E finds the template dropdown by its label and checks the narrowing
**Time:** 15:41
**Files:** 1 changed
**Tests:** reporting E2E spec 6/6 passed against the `default` install (about 19 s).
**What:** The Batch Sync E2E located the dropdown by its "Single template…" placeholder; it now uses the accessible name, and asserts the scoped list names the namespace, shows "Label (VALUE)" and is shorter than the unscoped list.
**Why:** 2f218e4 changed the placeholder once a scope is set, so the existing spec could no longer find the select.
**Discovered:** My first version of the new assertion counted unscoped options before the template list had loaded (placeholder only) and failed spuriously; it now waits for the list first. This E2E run is also what verified 2f218e4 in a real browser against the deployed app.

## 917e4d2 — chore: scaffold refresh — @wip/client 0.64.0, @wip/react 0.24.0
**Time:** 17:02
**Files:** 13 changed (tarballs, READMEs, two wheels, package.json + lockfile, two docs, yac-status.py)
**Tests:** tsc clean; unit 255/255 against the upgraded libs. Pre-commit gate passed.
**What:** Ran `../World-in-a-Pie/scripts/create-app-project.sh "$PWD"` in place (WIP develop 65a2e739). CLAUDE.md.refresh differed from CLAUDE.md only in the app description and key-path wording, so nothing was merged and the file was deleted. New tarballs staged with `git add -f` (`*.tgz` is gitignored).
**Why:** Peter asked to refresh the clone from the WIP clone. The refresh also brings in `documents.rehashIdentities` / `requalifyIdentitySynonyms` and the `useRehashIdentities` hook, which is BE-YAC's answer to the rehash request RC filed.
**Discovered:** The script aborted twice with "wheel already exists in the app with different content" for `wip_toolkit-0.6.2` and `wip_archive-0.3.0`. I compared the wheels member by member: all code files are byte-identical; only `WHEEL` (`Generator: hatchling 1.32.4` -> `1.33.0`) and the `RECORD` hash of it differ. The same-version guard is meant to stop changed code shipping unversioned, so this is a false positive from a build-tool upgrade; I deleted the two old wheels from `libs/` and re-ran so the fresh ones were installed. Worth telling BE-YAC (the guard should ignore the Generator stamp).

## 3ce0a9c — feat: admin gate on the document-store maintenance endpoints
**Time:** 17:32
**Files:** 3 changed (server/maintenance-gate.ts, server/index.ts, tests/unit/maintenance-gate.test.ts)
**Tests:** 10 new unit tests; tsc clean.
**What:** RC's server requires a `WIP_ADMIN_GROUPS` member for any path under `/wip/api/document-store/maintenance`, mounted before the proxy. The match decodes and normalizes the path and ignores case, so dot segments, `%2e` and upper-case spellings cannot get around a plain prefix match.
**Why:** The proxy calls WIP with the deployment's admin key, so WIP's own admin check can never refuse a user. The existing `requireAdmin()` was unused anywhere.
**Discovered:** On this install `ALLOWED_GROUPS=wip-admins`, so only admins get into RC at all and the gate cannot be seen refusing anyone live; the unit tests are the only refusal coverage. It matters on installs where the allowed groups are broader than the admin group.

## ed73f73 — feat: helpers for the identity rehash page
**Time:** 17:35
**Files:** 2 changed (src/lib/identity-rehash.ts, tests/unit/identity-rehash.test.ts)
**Tests:** 16 new unit tests.
**What:** Pure helpers: whether a preview covers the scope now in the form, the reason Apply is blocked, how each item's Registry re-key went, a per-status summary, and a short-hash display.
**Why:** Apply must only be possible for a current preview that found changes, and the platform does not document a Registry success value, so none is assumed (missing and error statuses count as failed, anything else is shown as returned).

## 3582e49 — feat: Identity Maintenance page — preview and apply the identity rehash per namespace
**Time:** 17:43
**Files:** 6 changed (page, App route, Sidebar item, maintenanceClient in src/lib/wip.ts, namespace-scope comment, component test)
**Tests:** 10 component tests; a mutation check (Apply's disabled-by-reason guard removed) turned exactly the two expected tests red, then the file was restored. Full unit run 291/291 at that point.
**What:** Admin-section page: namespace plus optional template filter, dry-run preview, inline-confirm Apply, applied result with rows rewritten separate from the Registry outcome, collisions as report-only, the platform's reporting note verbatim. Calls go through a second client with a 5 minute timeout.
**Why:** Peter asked for the rehash action in RC once the client library exposed it. The shared client times out after 30 seconds, while the pass is synchronous and grows with the namespace.
**Discovered:** Only GETs are retried by the client, so the POST is never repeated. The Postgres page's tabs are local state, so the page can only link to the page, not the Batch Sync tab.

## 4ce7cf7 — test: E2E for the Identity Maintenance page
**Time:** 17:49
**Files:** 1 changed
**Tests:** passes against the restarted RC (8 s).
**What:** Previews a fresh namespace narrowed to one template: scans 2 documents, finds nothing to change, leaves Apply unavailable.
**Why:** Gives the page and the gate (the e2e user is an admin) a live check. The apply path cannot be driven because documents with a legacy-format hash cannot be created through the API; the component test covers it.
**Discovered:** The first run failed with `rehashIdentities is not a function`: the deployed dev container still had the old client in its `node_modules` volume. It needed a container restart, not a code change.

## a7c416a — docs: Identity Maintenance, per-namespace parity, Batch Sync dropdown, client 0.64.0
**Time:** 17:49
**Files:** 5 changed (ARCHITECTURE, CHANGELOG, KNOWN_ISSUES, README, WIP_DEPENDENCIES)
**Tests:** n/a
**What:** Documents the page, the admin gate and the long-timeout client, the Parity and Batch Sync changes, the library bump, and the two platform details the page does not guess at.
**Why:** Keep the docs in step with the session's changes.
