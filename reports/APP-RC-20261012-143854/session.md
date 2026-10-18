---
session_id: APP-RC-20261012-143854
role: APP-RC
started_at: 2026-10-12T14:38:54
status: closed
continues_from: APP-RC-20260705-192840
ended_at: 2026-10-18T22:45:29
---

# Session APP-RC-20261012-143854

Continues from APP-RC-20260705-192840 (via /wip-wake).

## Session Summary
**Duration:** 2026-10-12 14:38 – 2026-10-18 22:45 (one context window across several days)
**Commits:** 63 total (35 substantive, the rest report logs), all pushed; working tree clean
**Lines:** +5520/-683 across 127 files (8a1bbbb..HEAD)
**Phase:** 4 — /wip-improve + /wip-document

**What happened:**
- **10-12, recovery and cleanup.** I woke into a clone 37 commits behind origin. Peter chose reset + re-apply. Then:
  - Fixed the NL tools.
  - Built the registered views tab and NL tool.
  - Scoped the edge-endpoint picker to its namespace.
  - Did a full /wip-document pass.
  - Adopted @wip/client 0.54.0.
  - Filed and verified CASE-858/859/861.
  - Ran the CASE-858 endpoint heal on wip-local.
- **10-17/18, platform hardening.** The platform added NATS auth (CASE-852) and MongoDB auth (CASE-890).
  - RC gained credential handling for both: file-then-env via server/secret.ts, credentials as connect options and never in URLs, re-read on reconnect, classified auth errors in the UI.
  - Closed a `$where` server-side-JS hole in the Mongo browse route.
  - Peter rolled RC 20261018b to dev-test, prod-test and kb.internal; I verified each from inside the pod.
  - The kb.internal endpoint heal ran: 95 entries, after Peter took a backup.
- **NL Query.** Moved from claude-sonnet-4-6 to claude-sonnet-5-5 (effort low, max_tokens 16000, server-side refusal fallback, stop-reason handling) and verified live with Peter's key. Followed by:
  - Anthropic SDK 0.131.0.
  - A prompt tidy.
  - A namespace-scoped describe_data_model. A library question went from 4 calls / 75k tokens to 1 call / 3 s.
  - A structural tool-result cut.
- **Editors and typed client.**
  - A shared CodeMirror 6 editor for the Query Pad and the view editor (PostgreSQL autocomplete, Format).
  - A read-only MongoDB query pad (Extended JSON, JS-operator ban, bounds).
  - The reporting inventory moved onto client.reporting.listTables(). CASE-898 is filed for the missing parity/CSV methods.
- **Access control.** ALLOWED_GROUPS is now enforced behind the WIP gateway (3461408). BE-YAC set ALLOWED_GROUPS=wip-admins in RC's manifest (WIP e9c775b5); it is live on wip-local.
- **E2E phase 1** (local only, Peter's call). Playwright against wip-local as e2e@wip.local (wip-admins, created with `wip-deploy user add`), in a disposable namespace per run.
  - Groups done: smoke, data lifecycle, infrastructure. 25 tests in ~30 s.
  - The suite found and fixed the /api-keys dev-proxy bug and missing document-form labels.

**WIP interactions:**
- **Filed:** CASE-858, CASE-859, CASE-861 (all resolved upstream) and CASE-898 (open: client methods for /parity and both reporting /export/csv forms).
- **CASE-852:** commented with #3; BE-YAC answered with the `nats-monitor` role.
- **CASE-892:** responded (#1) and implemented (#2).
- **Platform quirks:**
  - WIP list endpoints ignore `limit` (use page_size ≤ 1000).
  - Template-store namespace filter works with `?namespace=`.
  - Reporting /tables detail mode is `?table_name=&namespace=`; it does not cover registered views.

**Dead ends / corrections:**
- **"No command to add a Dex user" was wrong.** I said it from a head-truncated `wip-deploy --help`; `wip-deploy user add` exists (CASE-842). Lesson in memory: read-full-cli-help.
- **Wrong tab IDs and element refs.** In browser automation I twice used refs or tab IDs that tools hadn't returned. Only use refs from find, and tab IDs from tabs_context.
- **Automated typing is not a bug signal.** Typing into URL-synced inputs (Table Browser filter) drops characters under automation; Peter confirmed it works by hand. Set such filters via the URL in tests.
- **The proposed NATS manifest change was rejected.** It listed raw subjects; app manifests may only request roles. BE-YAC added nats-monitor instead.

**Downstream impact:**
- **Deployed images lag:** dev-test, prod-test and kb.internal run RC 20261018b, which predates 3461408. With ALLOWED_GROUPS now in the manifest, those installs need a newer RC image to enforce it.
- **Dev container restarts:** dependency changes (CodeMirror, SDK, Playwright) need an RC dev-container restart on wip-local (lockfile-gated npm ci).

**Unfinished:**
- **E2E groups (3)** — imports (terminology CSV, small document CSV), reporting (eventually() for reporting-sync, Query Pad run, registered view create/test/delete), relationships (edge type + edge, relationships panel). KNOWN_ISSUES "E2E suite" entry.
- **New RC image + roll** to the three k8s installs, for 3461408 and everything since 20261018b. That is Peter's step.
- **Optional:**
  - Mongo aggregate pipeline editor (KNOWN_ISSUES).
  - VersionWarnings.tsx:143 TODO (needs a version_strategy filter in WIP).
  - CASE-898 follow-up once the client methods ship.
  - Permission route guards (old roadmap).

**For the next YAC — handover:**
1. **Start:** `/wip-wake`, then `git fetch` and compare with origin/master. Read commits.md and session-updates.md; the E2E plan and gotchas are in session-updates "E2E in progress".
2. **Run the tests:**
   - `npm test` (175 unit tests, no WIP needed).
   - `npm run test:e2e` (needs wip-local up, user e2e@wip.local, secrets in ~/.wip-deploy/wip-local/secrets/). Run it in the background (`run_in_background`), because the Bash timeout is 60 s.
   - Specs are serial, in run().namespace. Use eventually() for reporting-sync.
3. **E2E selector gotchas:**
   - Forms on list pages use placeholders (labels aren't associated).
   - The Template Builder ignores ?ns= and has its own namespace <select>.
   - Field quick-add is the <form> with the "Add" button.
   - Close the field slide-out ("Close field settings").
   - The document form fields are labelled.
   - After archive the page returns to an active-only list.
   - CodeMirror editors: fill() works; press('ControlOrMeta+Enter') did not trigger run — click the button.
4. **Container:** the --app-source dev container mounts this clone (Express 3011, Vite 5174, /apps/rc/). Restart it after dependency changes. Restarts and server-code edits (tsx watch) drop the in-memory Anthropic key; ask Peter to re-set it before NL live tests.
5. **Access:** ALLOWED_GROUPS=wip-admins is live on wip-local. In-container probes must send X-WIP-User/X-WIP-Groups (e.g. wip-admins) or get 401; /health stays public.
6. **Deploys:** Peter runs image builds (`gh workflow run build.yaml --repo peterseb1969/WIP-RC --ref master -f tag=YYYYMMDDx`) and app-deploy himself. Check `tag_overrides.react-console` in deployer-state: a stale per-app pin overrode the install tag on prod-test.
7. **Conventions:**
   - Pin new npm deps exact, to releases ≥ 2 weeks old.
   - Log every commit in commits.md.
   - No case tokens in user-facing text.
   - "Do you remember X?" with nothing in context → just say no.
