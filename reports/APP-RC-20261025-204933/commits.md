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

## 36b7326 — fix: template dropdowns sorted by the text shown, each template once
**Time:** 20:55
**Files:** 2 changed
**Tests:** unit 296/296 (3 new); E2E reporting + identity-maintenance 7/7
**What:** syncTemplateOptions sorts by the displayed "Label (VALUE)" text with a numeric, case-insensitive collator, and dedupes by template value.
**Why:** Peter: the Batch Sync template order "is not even alphanumeric". It was sorted by the value, and also listed one identical line per namespace.
**Discovered:** The old unit test's fixtures sorted the same way by label and by value, so it could not catch this.

## 60ae92c — feat: merge restore asks whether the target's older versions retire
**Time:** 22:16
**Files:** 2 changed, +~100
**Tests:** unit 299/299 (3 new); /backup smoke 1/1
**What:** Retire / Keep older versions choice under the merge clash policy, shown only for Overwrite and Newer wins; older_versions is sent only then (olderVersionsField).
**Why:** The platform's merge restore gained an older_versions option (WIP c6a81ab4, default retire); RC never sent it, so every RC merge silently retired them.

## c04bbc9 — chore: scaffold refresh — @wip/client 0.65.0, wip-toolkit 0.7.1
**Time:** 22:16
**Files:** 6 changed
**Tests:** tsc clean, unit 299/299, full E2E 75/75 after the container restart
**What:** The client is re-vendored; the restore page imports OlderVersionsPolicy from it. @wip/react stays at 0.24.0. CLAUDE.md.refresh had only app lines and was deleted.
**Why:** It types the new restore option.
**Discovered:** Peter restarted the container a minute after I had (his first ! line arrived as text), which cut into an E2E run; it was stopped and re-run cleanly. No merge restore with older_versions has been run end to end.

## 50aa6de — fix: Settings tab reads the session in the same statement as the settings
**Time:** 23:48
**Files:** 4 changed
**Tests:** unit 328/328; E2E reporting spec 7/7 (incl. the Settings tab); the new SQL was checked live: 342 rows, one session start time across all of them
**What:** DB_SETTINGS_SQL carries session_role, session_database, session_version and session_started via a one-row CROSS JOIN; the separate session query was removed; toSession reads the session_* columns.
**Why:** Three parallel requests to the pooled endpoint hit three connections, so the session line could describe a connection opened a day earlier than the one that read the values.

## 2d379fc — fix: OIDC sign-in setup no longer blocks server start-up
**Time:** 22:55
**Files:** 3 changed
**Tests:** unit 331/331 (3 new); full E2E 73 passed, 1 failed (Settings tab spec, unrelated: see 3e55eff), 2 not run (same serial spec); live gateway-mode health shows auth "off"
**What:** startAuth() runs OIDC discovery in the background after listen, with backoff retries; requireAuth and the login callback answer 503 + Retry-After until it succeeds; health reports auth status.
**Why:** Peter: "implement the dex fix". In OIDC mode, start-up exited if Dex was not up, and in dev nothing restarted it.
**Discovered:** A plain "listen first" would have opened a hole: requireAuth chose its mode by oidcConfig, so a pending OIDC server would have applied the gateway rules and trusted a forged X-WIP-User header. With the gate removed, the test's forged request got 200. Also: openid-client's PKCE helpers fail under jsdom (Uint8Array lacks toBase64 there), so the test runs under @vitest-environment node.

## 3e55eff — test: Settings tab spec checks the reporting role's own default row; resolve the OIDC start-up entry
**Time:** 22:55
**Files:** 2 changed
**Tests:** E2E reporting spec 7/7 (with the full run above, all 76 pass)
**What:** The spec scopes the default_transaction_read_only check to the wip_reporting_read row; KNOWN_ISSUES entry moved to resolved.
**Why:** The platform now has more reporting roles (wip_reporting_roles, a scoped wip_scope_<hash> role) carrying the same defaults, which made the single-match lookup ambiguous.

## 944aac9 — chore: move RC's images to Node 24; dev install also follows Node and libc
**Time:** 12:04
**Files:** 3 changed, +15/-7
**Tests:** in node:24-alpine: npm ci, tsc, unit 331/331, vite build. Prod image offline (--network none, dummy key): health, app-config, SPA, API 404s, healthcheck command. Entrypoint gate on one volume: install (24) → skip (24) → reinstall (20) → skip (20). Not deployed.
**What:** node:20-alpine → node:24-alpine in Dockerfile (both stages) and Dockerfile.dev. The entrypoint install hash covers lockfile + node -v + musl/glibc.
**Why:** Node 20 is end-of-life (2026-04-30). The lockfile-only hash would keep an old-Node volume after a base-image bump.
**Discovered:** The prod image refuses to start without WIP_API_KEY/WIP_API_KEY_FILE (by design; the deployer injects it). podman build's default OCI format drops HEALTHCHECK, so the healthcheck command was run by hand. The redeploy is Peter's.

## 8892153 — fix: document lists show each document once, not every stored version
**Time:** 12:48
**Files:** 5 changed, +26/-24
**Tests:** unit 331/331; full E2E 76/76; the strengthened lifecycle check fails without the fix (Expected 1, Received 2)
**What:** The documents list sends latest_only; the table view's no-op toggle is removed and it sends status active; Dashboard recent/total and the VersionWarnings count send status active.
**Why:** APP-KB reported YAC_MEMORY documents shown on template v1 although every current one is on v3. The list endpoint with no status returns every stored version (verified: 1,448 rows for 229 documents, up to 14 rows each).
**Discovered:** The table-view endpoint defaults status to active, so RC's table toggle had never worked. The "Incl. deleted" label (from the archive-removal change) was wrong until this fix, because the toggle also pulled in superseded versions. The /apps/kb console 404s Peter saw were KB's corpus probe, not RC; APP-KB is fixing it.

## 73cb459 — feat: filter the documents list by template version
**Time:** 13:08
**Files:** 5 changed
**Tests:** unit 336/336 (5 new); full E2E 77/77 (new versioning test: v2 link → 1, v1 → 2, all → 3); Peter checked it on localhost
**What:** A Template version filter in the documents list (?version=N, cleared on template switch) and a "Documents on vN" link on the template page; filtered lists use POST /documents/query with a template_version filter and status active.
**Why:** Peter: with no version filter there was no way to see a template version's documents. Filed for the record in the KB and set to implemented at his request.
**Discovered:** The query endpoint returns active rows when no status is given and superseded history rows for status inactive, so a version-filtered list can only honestly show live documents; the deleted toggle is disabled there.

## 4356ebe — chore: scaffold refresh — @wip/client 0.69.0, @wip/proxy 0.6.0; Identity Maintenance follows the re-key changes
**Time:** 2026-10-31 14:12
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 41 changed, +1147/-299
**Tests:** tsc clean; unit 336/336; full E2E 77/77 after the dev container restart onto 0.69.0 / 0.6.0
**Why:** The refresh brings @wip/client 0.69.0, @wip/proxy 0.6.0 and wip-archive
0.6.0, refreshed docs and commands, docs/cards/, and a post-commit hook
(.githooks/post-commit with .claude/scripts/log-commit.py) that writes
each commit to the session's commits.md from git and the message's
trailers. CLAUDE.md takes the fresh render, keeping RC's description and
a generic key-file path, and adds that RC keeps the master key: its
manifest declares privileged_key: true, so the new per-app key does not
apply to it.

@wip/client 0.69.0 follows a platform change to the identity rehash:
re-running an apply now retries Registry re-keys that an earlier run
left behind, applied counts only documents whose re-key succeeded, and
items gain an unchanged status. The Identity Maintenance page no longer
says a re-run does not retry, its result counts read as re-keyed
documents, and unchanged items get a style.
**Discovered:** The dev container restart came 3.5 min before the refresh rewrote the lockfile, so it ran on old libs until a second restart. The platform now documents rekeyed and unchanged as the Registry re-key successes, which confirms the allowlist RC already uses.

## 508be92 — feat: a missing WIP key costs /wip, not the server
**Time:** 2026-10-31 14:12
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 1 changed, +20/-11
**Tests:** tsc clean; unit 336/336; full E2E 77/77; throwaway production image offline: with no key the container keeps running, health 200 with wip_proxy unavailable, SPA served, /wip 503 and one startup warning; with a key wip_proxy is available
**Why:** wipProxy was built while the server module loaded, and with no usable
key (no readable WIP_API_KEY_FILE, no WIP_API_KEY) it threw, so the
process exited before listen() and the health endpoint went with it.

RC now builds the proxy with @wip/proxy 0.6.0's onMissingKey:
'unavailable'. Without a key, /wip answers 503 with the reason (which key
file failed, that no inline key is set), the reason is logged once at
startup, and the rest of the app serves. Health and /api/app-config
report wip_proxy as available or unavailable; health keeps its 200, so
the probe never depends on a key being configured. An unset WIP_API_KEY
is now passed as undefined rather than '', since an empty string is no
key.
**Discovered:** Before this, a production image started without a key exited at startup (seen in the Node 24 offline check), taking the health probe down with it.
