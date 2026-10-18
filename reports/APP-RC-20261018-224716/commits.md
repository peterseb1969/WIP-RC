# Commits — APP-RC-20261018-224716

## cbc9779 — fix: document pages use the selected namespace's template
**Time:** 23:01
**Files:** 10 changed, +173/-41
**Tests:** 180 unit passed; E2E imports 3/3, same-named templates 3/3, relationships 3/3 against wip-local
**What:** New useRouteTemplate hook (?template_id= wins, a bare value resolves in the selected namespace). Form, table and import pages use it; the detail page uses the document's template_id. The list page's links carry template_id. Reference pickers resolve bare target values in the form's namespace (resolveTargetTemplate). The import refreshes cached document lists. The list page's namespace reset no longer wipes a ?template= or recall selection.
**Why:** Found while writing the E2E imports spec. On wip-local `GET /templates/by-value/CASE_RECORD` without a namespace returns kb's template, and 28 values exist in more than one namespace. "New document" from dev-proj-a's CASE_RECORD would have written into kb.
**Discovered:** @wip/react's useTemplateByValue has no namespace parameter, and its query key ignores namespace. Namespace-scoped by-value does not fall back to `wip` (404). The new namespaces spec fails on the old code (it loaded the twin namespace's template). The relationships spec does not discriminate the picker fix: the platform now stores a reference field's target_templates as the resolved template_id (verified with a probe in a throwaway namespace: bare "P" was stored as P's id), so the old by-id match already worked for new templates. The by-value path is hit only by older fields that still hold bare values, such as kb's edge types (AGENT_PARTICIPATED source_ref: ['FIRESIDE', 'CASE_RECORD', …]).

## 881d641 — test: E2E imports, relationships, reporting and same-named templates
**Time:** 23:03
**Files:** 12 changed, +488/-19
**Tests:** E2E 36 passed (36.2 s); unit 180 passed
**What:** Four new specs (imports, namespaces, relationships, reporting), a second disposable "<run>-twin" namespace in global setup/teardown, checked fixture helpers (createTemplate, createDocuments), view-editor label association, README/KNOWN_ISSUES/CHANGELOG.
**Why:** Completes E2E phase 1 (groups imports, reporting, relationships from the handover), plus a regression spec for cbc9779.
**PoNIF:** #4 bulk-first: template/document fixture POSTs answer 200 on per-item errors; the helpers check results[i].status.
**Discovered:** Document writes need template_id (template_value is rejected, 422). Documents keep the submitted term value ("Crimson") and record the resolution in term_references (matched_via: alias). The registered-views list is {namespace, views}. A terminology created from a CSV takes its label from the file name.

## 305860f — fix: template editor locks identity fields; version chips refresh
**Time:** 23:17
**Files:** 4 files changed, 111 insertions(+), 35 deletions(-)
**Tests:** unit 183 passed (3 new VersionWarnings tests; 2 of them fail on the old component); E2E versioning 4/4
**What:** The identity selector is locked in edit mode. VersionWarnings blocks any identity change (draft or active, any document count) with an accurate message pointing at Duplicate, checked before the draft early-return. Save as Draft respects blocking warnings. The template page's version list no longer has a 60 s staleTime.
**Why:** Probed in throwaway rc-e2e-probe namespaces: the platform rejects identity_fields changes on active AND draft templates ("immutable across versions … a fork"), yet RC said "safe". The version chips were missing after minting v2 (found by the versioning spec).
**PoNIF:** #2 confirmed live: a schema change gives v2 with v1 still active.

## 4b1b021 — test: E2E template versioning and access control
**Time:** 23:17
**Files:** 8 files changed, 198 insertions(+), 11 deletions(-)
**Tests:** E2E 44 passed (42.1 s)
**What:** versioning.spec.ts (4) and access.spec.ts (4); shared Dex login in support/login.ts; viewer settings in env.ts; docs.
**Why:** Peter's top two coverage gaps: versioning (PoNIF #2) and the ALLOWED_GROUPS fix 3461408, which until now was checked only by hand.
**Discovered:** Deactivating a template version navigates to the template list. In the dev container the SPA shell renders for the viewer (Vite serves it); the denial shows on the API and proxy calls and in page error states. Not verified that the access spec fails on pre-3461408 server code: reverting server/auth.ts would restart the dev server and drop the in-memory Anthropic key.

## 810ca72 — fix(docker): run tsx from the image, not via npx
**Time:** 23:44
**Files:** 3 files changed, 8 insertions(+), 36 deletions(-)
**Tests:** unit 183 passed; local production build started under --network none: /health ok in ~2 s, tsx v4.21.0
**What:** tsx moved from devDependencies to dependencies, pinned to 4.21.0. The Dockerfile CMD is ./node_modules/.bin/tsx instead of npx tsx.
**Why:** Seen while verifying the 20261018c roll on dev-test: the pod log showed npx installing tsx@4.23.15 at startup (the --omit=dev image had no tsx). Present since the Dockerfile was written; not from this session's changes.
**Discovered:** Lockfile change is only the dev flags on tsx/esbuild/get-tsconfig; no version changes. The wip-local dev container needs no restart (node_modules unchanged).

## f6c9bee — chore: adopt scaffold refresh — @wip/client 0.61.0, @wip/react 0.21.0
**Time:** 00:07
**Files:** 24 files changed, 413 insertions(+), 147 deletions(-)
**Tests:** typecheck clean; unit 183 passed
**What:** Ran create-app-project.sh in place from the WIP clone (develop a6fb80ec): versioned tarballs (git rm old, git add -f new), toolkit/archive wheels, docs, commands, wake script, lib READMEs, package.json + lockfile. Merged only the four general CLAUDE.md sections from CLAUDE.md.refresh (deleted it). Committed .claude/.settings-baseline.json (the scaffold's three-way-merge record).
**Why:** Peter: CASE-905 done, update what we can. CASE-898 also implemented (client 0.61.0).
**Discovered:** The refresh regenerated .mcp.json with this machine's paths (/Users/peter instead of /Users/sebbelp). Left uncommitted pending Peter's call; it would let the wip MCP server start on this machine.

## 2a23958 — feat: reporting parity and CSV export through the typed client; export errors shown
**Time:** 00:07
**Files:** 9 files changed, 149 insertions(+), 133 deletions(-)
**Tests:** E2E 48 passed (50.9 s); unit 183 passed
**What:** getParity / exportTableCsv / exportQueryCsv replace raw fetches; local parity types gone; export errors shown next to their buttons; single-template batch sync via useTriggerBatchSync; useRouteTemplate's by-value branch on useTemplateByValue({ namespace }). E2E: both exports, Parity card, forced scoped batch sync.
**Why:** CASE-898 and CASE-905 adoption.
**Discovered:** Export failures were only console-logged before (no user feedback). Playwright fill() on CodeMirror leaves the completion list open over the buttons below it; with real typing, clicking elsewhere closes it, so this is not a UI bug (verified with keyboard.type). The spec presses Escape. useTriggerBatchSyncAll's BatchSyncAllVars lacks namespace (comment CASE-905#3). wip-local reporting-sync already has the export fix (namespaced export 200; bad query 400). Commented CASE-898#3.

## 946cab0 — chore: stop tracking .mcp.json (machine-specific paths)
**Time:** 00:08
**Files:** 2 files changed, 5 insertions(+), 18 deletions(-)
**Tests:** not run (config only)
**What:** .mcp.json added to .gitignore and removed from the index; the local file (this machine's /Users/peter paths) stays.
**Why:** Peter approved. The tracked copy held /Users/sebbelp paths, so the wip MCP server failed to start on this machine (macmini) all session.
**Discovered:** Pulling this on the other machine deletes its .mcp.json; restore with git show 740a6a7:.mcp.json > .mcp.json, or re-run the scaffold refresh.

## b4deeec — fix: unknown API routes get a 404 JSON, not the SPA (CASE-888)
**Time:** 00:11
**Files:** 1 file changed, 13 insertions(+)
**Tests:** unit 183 passed; local production image (NODE_ENV=production, --network none, /apps/rc) curl matrix: missing API GET/POST/DELETE, bare /api, /auth, /server-api, POST /mcp → 404 JSON; deep links and /apiary → index.html; health/app-config/me unchanged
**What:** The scaffold's API_PREFIXES exclusion after express.static, ahead of the index.html fallback.
**Why:** CASE-888 umbrella; confirmed live on dev-test 20261018c (missing API GET → 200 text/html). Reported as CASE-888#3.
**Discovered:** /wip/api/<unknown service>/… returns 200 HTML through the proxy, from WIP itself; the exclusion can't reach it, since the proxy answers first. Noted on the case, origin not traced.
