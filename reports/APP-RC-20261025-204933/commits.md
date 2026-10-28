## ec915ce — chore: scaffold refresh — @wip/client 0.62.0, @wip/react 0.22.0, wip-toolkit 0.6.2
**Time:** 20:51
**Files:** 16 changed, +398/-35
**Tests:** tsc --noEmit clean; test suites not run
**What:** Committed the pending scaffold refresh: bumped lib tarballs and wheels, refreshed docs and settings, and merged the upstream CLAUDE.md changes (bootstrap resume-blocked rule, MCP tool count, toolkit + wip-archive install). Deleted CLAUDE.md.refresh.
**Why:** The contract requires committing package.json + package-lock.json after every refresh.
**Discovered:** *.tgz is gitignored but the bundled tarballs are tracked, so new tarballs have to be force-added (git add -f) on every refresh.

## 10a46c6 — feat: namespace selector disabled wherever it has no effect
**Time:** 22:15
**Files:** 3 changed, +117/-8
**Tests:** unit 219/219 (incl. 30 new namespace-scope cases); E2E not run (no spec covers it)
**What:** The TopBar selector now uses an allowlist (src/lib/namespace-scope.ts): live on lists and on the create flows it scopes, disabled with a per-kind reason elsewhere (infrastructure / single entity / generic).
**Why:** CASE-917 step 1. The selector looked active on 13 routes that never read it.

## 29a15b7 — fix: namespace selector disabled on Backup & Restore
**Time:** 22:23
**Files:** 2 changed
**Tests:** unit namespace-scope 30/30
**What:** Removed /backup from the selector allowlist.
**Why:** Peter spotted it: the page reads the selection only as the initial value of its own pickers (useState initializers), so the selector has no effect there after load. My table had misclassified it as "F (preselect)".

## a51208b — test: E2E targets the default install by default
**Time:** 22:23
**Files:** 3 changed
**Tests:** n/a (config)
**What:** E2E_DEPLOYMENT now defaults to 'default' (env.ts, playwright.config comment, README).
**Why:** wip-local no longer exists, so global setup failed on a missing secrets file.

## 944dfc6 — feat: ?ns= stays in the URL, in step with the namespace selector
**Time:** 22:42
**Files:** 9 changed, +137/-26
**Tests:** unit 224/224 (5 new hook cases under StrictMode); E2E 60 passed / 3 failed. The failures are unrelated: 2 access-spec cases (gateway now enforces allowed_groups) and the /nats smoke (no ingest-gateway on the restarted install, so its status fetch 404s). All ?ns=-navigating specs pass.
**What:** useNamespaceInUrl keeps ?ns= and the selector in step both ways; the Dashboard reads ?ns=; dead ?ns= on links to detail pages removed.
**Why:** CASE-917 step 3. Lists were not linkable, and following a link silently changed the namespace everywhere.
**Discovered:** My first version tracked the URL's previous value. Under StrictMode's double-run effect it would have let the saved filter overwrite a link's ?ns=. Tracking the filter's previous value is idempotent.

## fe68591 — feat: target namespace shown before writes; detail pages flag a mismatch
**Time:** 23:02
**Files:** 12 changed, +122/-11
**Tests:** unit 228/228 (4 new badge cases); E2E 61 passed / 2 failed (the known access-spec drift)
**What:** "Will be created in X" on the document form, the import target in the import summary, duplicates start in the source's namespace, the builder warning points at its own picker, the selector is disabled on /templates/new, and an amber mismatch badge on 5 detail pages.
**Why:** CASE-917 step 2.
**Discovered:** /templates/new had the same read-once-on-load pattern as Backup & Restore, so the selector did nothing there. Also, I had told Peter that WIP requires a document to live in its template's namespace. That was unverified: only RC's own create path does this. Corrected in chat and in the code comment.

## 277fa85 — test: access spec accepts the gateway as the enforcer
**Time:** 23:03
**Files:** 1 changed
**Tests:** access.spec 4/4 (gateway path only; the RC-enforced branch is not exercised on default)
**What:** The spec detects the enforcer from api/health (403 forbidden → gateway, 200 → RC) and holds every refusal to that shape; the denial-page check matches the text, not role=alert.
**Why:** The default install enforces allowed_groups at the gateway, so the old expectations (public health, RC's JSON and alert) failed.

## Rebase onto origin/master (23:14)
This clone was 14 commits behind origin/master (last fetch Oct 20) and never had the previous session's Oct 19–20 work. Rebased the 7 local commits onto bb9911a. The trial merge was clean, tsc is clean, and unit tests pass 247/247. New hashes: ec915ce→cedc821, 10a46c6→fa27cdc, 29a15b7→0c2f1b2, a51208b→a71500a, 944dfc6→910a827, fe68591→5e72988, 277fa85→1afef39.

## 799a7eb — feat: document Archive replaced by soft Delete
**Time:** 22:29
**Files:** 5 changed
**Tests:** E2E 74/74 on the old platform (before re-vendor) and 74/74 on the upgraded platform with the new libs; unit 247/247
**What:** Detail-page Archive → soft Delete (useDeleteDocument), list and table toggles → Active / Incl. deleted, relationship help text, E2E lifecycle step.
**Why:** CASE-952. The platform removed document archive (f14c4bf2).

## 1e17eec — chore: scaffold refresh — @wip/client 0.63.0, @wip/react 0.23.0, wip-archive 0.3.0
**Time:** 22:29
**Files:** 14 changed
**Tests:** tsc clean, unit 247/247, E2E 74/74 on the upgraded default install
**What:** Libs re-vendored; the pre-commit gate (.githooks) is shipped and enabled; .claude/kb.json untracked (kb.json.example added). CLAUDE.md.refresh differed only in app lines, so nothing to merge.
**Why:** CASE-952 re-vendor step. CASE-952#1 records it as implemented.

## b3d6bd5 — fix: Identity Maintenance flags a Registry conflict or not_found as a failed re-key
**Time:** 20:49
**Files:** 3 changed
**Tests:** unit 293/293 (the new page test fails on the old code); E2E identity-maintenance spec 1/1; full suite 75/75 just before (the spec doesn't reach the apply path)
**What:** registryOutcome is now a success allowlist (rekeyed, unchanged), and every other status counts as failed.
**Why:** The Registry's rekey endpoint also returns conflict and not_found; the page showed those as neutral, with no failure alert.
