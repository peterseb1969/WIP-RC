## 0da7642 — chore: adopt gene-pool scaffold refresh (commands, hooks, wake script, docs)
**Time:** 15:51
**Files:** 20 changed, +1375/-174
**Tests:** not run (docs/config only, no app code touched)
**What:** Committed the 2026-07-09 set-up-in-place refresh that sat uncommitted for three months: updated /wip-* commands, wake-rollover script, post-compact re-anchor hook, settings allowlist, bundled Vision.md + deployable-app contract, ROLE_PREFIX in .app-meta. CLAUDE.md hand-merged from CLAUDE.md.refresh (refresh replaces the app description with a TODO placeholder; RC's description restored).
**Why:** Clean working tree before resuming /wip-improve; the refreshed /wip-wake had already been relying on the untracked script.
**Discovered:** .env has carried only WIP_API_KEY_FILE since 2026-07-05, but server/index.ts and server/nl/tools.ts read only WIP_API_KEY — host-mode `npm run dev` sends an empty key. The container is unaffected (deployer injects WIP_API_KEY). Fix: resolve the key file at startup (@wip/proxy has an apiKeyFile option for the proxy mount).
## fd457ed — chore: track session reports in the repo
**Time:** 16:04
**Files:** 5 changed (session reports for the July session and this one)
**Tests:** not run (reports only)
**What:** reports/ is now tracked in git.
**Why:** Peter decided to commit session reports rather than gitignore them — they are the continuity trail /wip-wake reads, and before this they lived only in the working tree and the kb mirror.
## fffc417 — fix: resolve the WIP API key from WIP_API_KEY_FILE in host-mode dev
**Time:** 16:06
**Files:** 5 changed, +110/-14
**Tests:** 51 passed, 0 failed (4 new for key resolution; NL tool test now asserts the X-API-Key header); tsc clean
**What:** New server/wip-config.ts (lazy, memoized wipApiKey() delegating to @wip/proxy's resolveApiKey); all six server-side WIP callers route through it. Precedence: injected WIP_API_KEY first, WIP_API_KEY_FILE fallback.
**Why:** Host-mode `npm run dev` sent an empty key since .env moved to WIP_API_KEY_FILE (confirmed: empty key → 401). Live-verified both modes afterwards.
**Discovered:** First attempt used file-first precedence (matching @wip/proxy's apiKeyFile semantics and the refreshed CLAUDE.md guidance) and crashed the --app-source container at boot: the container mounts the repo, dotenv loads .env, and WIP_API_KEY_FILE is a host-only path → ENOENT. Any app following the scaffold's "resolve from the file" guidance literally will hit this under --app-source — gene-pool issue worth a case to BE-YAC. Also: the container's Express port is 3011 (PORT default), health route is /apps/rc/health, not /api/health.

> **Reset note (16:15):** the three commits above (0da7642, fd457ed, fffc417) were made on a clone 37 commits behind origin/master and were never pushed. Peter chose reset + re-apply: master reset to origin/master (8a1bbbb); the originals survive on branch `backup/local-pre-reset-20261012`. origin already had the scaffold refresh/CLAUDE.md merge (643f7bb) and a file-first key resolver (eceee5b + proxy 0.4.3 fallback). Re-applied below.

## 1adaf2d — chore: track session reports in the repo
**Time:** 16:15
**Files:** 6 added (reports for APP-RC-20260705-192840 and this session)
**Tests:** not run (reports only)
**What:** Re-application of fd457ed on top of origin/master.
**Why:** Peter decided to track session reports in git.

## a29b286 — fix: NL query tools honour WIP_API_KEY_FILE like the rest of the server
**Time:** 16:16
**Files:** 4 changed, +70/-17
**Tests:** 98 passed, 0 failed (4 new for resolveWipApiKey); tsc clean (after host `npm ci` — host node_modules was still on July's libs)
**What:** origin's private resolveWipApiKey moved unchanged from index.ts to server/wip-key.ts; nl/tools.ts now uses it instead of reading only WIP_API_KEY.
**Why:** The one genuine gap left on origin: host-mode NL tools got 401 on every def-store/template-store/document-store call. Live-verified 401 → authenticated.
**Discovered:** (1) SECURITY — reporting-sync /api/reporting-sync/query and /tables answer 200 with NO credentials on wip-local (arbitrary SELECT across all namespaces' reporting schemas); def-store correctly 401s. Needs a BE-YAC case. (2) Pre-existing NL tools bug: list_terms-by-value and describe_data_model read `.terminologies`/`.templates`/`.id`, but WIP list responses are `{items:[…]}` with `terminology_id` — those tools always come back empty/"not found".

## 3766375 — fix: NL query tools speak WIP's actual list/query wire shapes
**Time:** 16:48
**Files:** 2 changed, +140/-30
**Tests:** 103 passed, 0 failed (5 new wire-shape tests); tsc clean
**What:** query_by_template now sends {template_id, filters:[{field,operator,value}], page, page_size} with ?namespace= (namespace now required, offset→page); list_terms-by-value and describe_data_model read `items` + `terminology_id`/`template_id`; all list calls use page_size (WIP ignores `limit`), describe_data_model passes latest_only=true.
**Why:** Three of seven NL agent tools never worked: query_by_template 422'd, list_terms-by-value always "not found", describe_data_model always empty — and the system prompt tells the agent to call describe_data_model first.
**Discovered:** WIP list endpoints silently ignore `limit` (default page of 50) — a quiet truncation for any caller using it. reporting-sync /search, by contrast, does honour `limit`. Peter says the unauthenticated reporting-sync finding is being addressed elsewhere.

## ff00599 — chore: adopt @wip/client 0.53.0 — two-half edge endpoints, registered views
**Time:** 17:09
**Files:** 7 changed (versioned tarball swap 0.51.0 → 0.53.0, README, pin + lockfile, 2 pages)
**Tests:** 103 passed, 0 failed; tsc clean; browser-verified on kb AGENT_PARTICIPATED (detail + Duplicate)
**What:** Client 0.53.0 vendored by fetch from the WIP clone (byte-identical to its upstream; react 0.20.0 / proxy 0.5.1 already current). Edge endpoints mapped to lookup_value in TemplateDetailPage and TemplateBuilderPage.
**Why:** Peter asked for the newest libs. 0.53.0 brings registerView/listViews/deleteView (CASE-856) — likely the basis for the "customized views" work Peter raised.
**Discovered:** The {lookup_value, resolved} endpoint wire change had already shipped server-side, so RC's edge-type detail/edit were broken at runtime before the bump — only the typed client exposed it. Also: served `resolved` is null on kb edge endpoints (e.g. AGENT_PARTICIPATED) even though the data-model resource says it's the server-resolved template_id — may be worth asking BE-YAC. Picker quirk (pre-existing): endpoint picker lists all namespaces' templates, so a value present in several namespaces appears and ticks multiple times.

## e19c61e — fix: edge-type endpoint picker lists the edge's own namespace only
**Time:** 17:14
**Files:** 1 changed
**Tests:** 103 passed, 0 failed; tsc clean; browser-verified (duplicate kb AGENT_PARTICIPATED)
**What:** Endpoint options from a namespace-scoped template query following the form's namespace; reference-usage templates allowed as endpoints (only relationship excluded); selected endpoints with no template in the namespace listed ticked with "not in <ns>"; shared template list page_size 100 → 1000.
**Why:** Peter: duplicate rows/ticks for values present in several namespaces. Edge endpoints must resolve in the edge's own namespace, so other namespaces were never valid choices.
**Discovered:** The "not in kb" flag caught a second bug on first run — AGENT_IDENTITY is usage=reference and was filtered out, yet counted as "1 selected". Template list was silently truncated at 100 of 155.

## f30d684 — feat: registered reporting views — list, create, edit, delete (Views tab)
**Time:** 17:45
**Files:** 6 changed (new panel, hooks, lib helpers + tests; PostgresPage tab + seedable Query Pad)
**Tests:** 112 passed, 0 failed (9 new); tsc clean; browser-verified end to end on wip-local
**What:** New Views tab on the PostgreSQL page over @wip/client 0.53.0 registerView/listViews/deleteView — cross-namespace listing (per-namespace fan-out), detail + row preview, create/replace with Test preview, delete, Open in Query Pad, ownership note for app-registered views.
**Why:** Peter wants support for registered views ("customized views").
**Discovered:** (1) Registered views are NOT in GET /tables — they need their own surface. (2) reporting-sync: first query after a column-changing replace fails "cached statement plan is invalid" (deterministic, 1 failure per replace) → CASE-859; RC retries exactly that once. (3) @wip/client runQuery types rows as unknown[][] but the server returns objects keyed by column — RC keeps using its own /query fetch. (4) Hot-reload can leave the views listing stale after a save; a clean page load does not reproduce it.

**Cases filed this session:** CASE-858 (pre-CASE-830 edge endpoints never get resolved; 99 entries null), CASE-859 (stale cached plan after view replace), CASE-861 (@wip/client ReportQueryResult rows typed unknown[][], wire is objects; empty result has no columns).

## 2f6a295 — feat: NL query agent can discover registered views
**Time:** 18:05
**Files:** 3 changed
**Tests:** 114 passed, 0 failed (3 new); tsc clean
**What:** New list_registered_views NL tool (one namespace or all live namespaces, failures reported) returning each view's SQL + quoted qualified_name; system prompt tells the agent to prefer a curated view; list_report_tables description points at it.
**Why:** /tables excludes registered views, so the agent could only use views the user named. Gap raised in my own "are you done?" review.
**Discovered:** wip-local has no Anthropic key configured (.env or container) — the agent itself can't be exercised end to end here; tool verified directly. Also browser-verified the endpoint picker's namespace-switch path (clone kb edge → library: all endpoints flagged "not in library", untick removes).

## f395ec5 — docs: catch documentation up with six months of changes
**Time:** 19:20
**Files:** 6 changed, +718/-285
**Tests:** n/a (docs); claims spot-checked (Vite port 5174, not 5173 as my brief said)
**What:** README/ARCHITECTURE/WIP_DEPENDENCIES/KNOWN_ISSUES/CHANGELOG rewritten against current code; new IMPORT_FORMATS.md. Done by four parallel forks, each owning separate files, verifying against code, no commits — reviewed and committed here.
**Why:** /wip-document; docs were last touched 2026-04-11 (~120 commits behind).

## 111a9b1 — docs: JSDoc on every exported component, hook and helper
**Time:** 19:20
**Files:** 64 changed, +318/-3
**Tests:** 114 passed; tsc clean; diff verified comment-lines-only
**What:** 95 exports annotated; FieldInput's stale header corrected.

## 5ea06d6 — fix: template pickers no longer truncate at 100/200; term cap notice; CSV sort_order
**Time:** 19:40
**Files:** 11 changed, +41/-16
**Tests:** 115 passed (1 new: parseSortOrder); tsc clean
**What:** All "all templates" lists → page_size 1000; TermFieldInput notice/cap one constant; CSV sort_order NaN → omitted.
**Why:** Found by the doc forks. Reference picker could resolve no target on wip-local (155 templates > 100).

## 4152278 — fix: public health probes, contract health/app-config routes, current .env.example
**Time:** 19:48
**Files:** 3 changed, +34/-11
**Tests:** 115 passed; container probes verified (/health, /api/health, /api/app-config all 200; no-store)
**What:** PUBLIC_PATHS fixed (/health was not public → OIDC-mode healthcheck redirected to Dex); /api/health alias + /api/app-config via @wip/proxy appConfigHandler; .env.example rewritten.
**Discovered:** NL_QUERY_MODEL default claude-sonnet-4-6 is still served; moving to sonnet-5-5/opus-5-5 is a migration (adaptive thinking on by default vs max_tokens 4096, no refusal handling, fallbacks recommended) — deliberately NOT done: untestable without an Anthropic key on wip-local. Raised with Peter.

## 18a1a76 — docs: reflect the fixes found during the documentation pass
**Time:** 19:52
**Files:** 5 changed, +19/-11
**What:** KNOWN_ISSUES/IMPORT_FORMATS/README/ARCHITECTURE/CHANGELOG updated for 5ea06d6 and 4152278.

## bc32c86 — chore: adopt @wip/client 0.54.0 — reporting SQL through the typed client
**Time:** 20:40
**Files:** 6 changed (tarball swap 0.53.0 → 0.54.0, README, pin + lockfile, use-reporting.ts, PostgresPage.tsx)
**Tests:** 115 passed; tsc clean; browser-verified (Table Browser columns/data, Query Pad, view replace with column change)
**What:** All reporting SQL via client.reporting.runQuery; parameterised information_schema lookup; CASE-859 retry removed; dead execution_time_ms display removed.
**Why:** CASE-859/861 implemented upstream (94238418, 4ffeb597).
**Discovered:** My own draft ARCHITECTURE line claimed the typed client can't serve /tables — false (client.reporting.listTables returns tables + entities). Corrected before commit; migrating /tables is a possible follow-up.

## 5c54b34 — docs: CASE-858/859/861 resolved — client 0.54.0, endpoint heal run on wip-local
**Time:** 20:42
**What:** Docs updated for the resolved cases.
**Ops (no commit):** Ran POST /api/template-store/maintenance/heal-endpoints (CASE-858, 45931c5e) on wip-local with Peter's approval — dry-run first per namespace, then real: kb 93, library 2, dev-wip-song 2, restore-rerun 2 entries healed, 0 unresolvable; second dry-run 0 changes; kb edge types still v1. Re-survey: every edge endpoint on wip-local now has resolved set. BE-YAC suggests a dry-run on kb.internal too (not done — different install).

## 3ca1a7c — docs: correct key-precedence note in .env.example and stale term-cap JSDoc
**Time:** 21:49
**Files:** 2 changed
**Tests:** tsc clean; unit tests not run (comment-only change)
**What:** .env.example now says the key file wins and WIP_API_KEY is only the fallback, matching server/wip-key.ts. The TermFieldInput JSDoc no longer mentions a 100-term cap; the cap is TERM_CAP (1000).
**Why:** Both comments contradicted the code. Found while re-checking after compaction.

## 3c989bd — feat: NATS page authenticates as its own NATS user
**Time:** 16:49
**Files:** 13 changed, +331/-25
**Tests:** 128 passed; tsc clean. Live: RC's router against a real nats-server running wip-local's rendered nats.conf plus a react-console user. All three routes 200; anonymous/wrong password refused; STREAM.INFO/DELETE, CONSUMER.DELETE, wip.* publish/subscribe all Permissions Violation; live password rotation reconnects on the next request.
**What:** NATS_USER + NATS_PASSWORD_FILE/NATS_PASSWORD or NATS_CREDS_FILE as connect options, re-read per connect; inbox _INBOX_<user>; auth-refusal classification on the NATS page; shared server/secret.ts; single shared connect attempt.
**Why:** NATS now requires authentication (WIP 334af17f, CASE-852).
**Discovered:** CASE-852 already landed on develop and wip-local today. Per BE-YAC's #2, Peter scoped RC's NATS access out ("dropped rather than given a monitor identity"), and RC's manifest lost NATS_URL. Apps share ComponentSpec, so RC can declare a nats_client; the ask is posted as CASE-852#3.

## 3c9a837 — fix: NATS page names a missing NATS_URL and recognises nats.js connection refusals
**Time:** 16:49
**Files:** 3 changed
**Tests:** 128 passed; browser-verified on wip-local (/apps/rc/nats shows "No NATS connection is configured for the console").
**What:** status carries url_configured; the "not deployed" regex now matches nats.js's CONNECTION_REFUSED.
**Why:** The deployed container has no NATS_URL, so the page showed a bare CONNECTION_REFUSED. The old regex only ever matched Node's ECONNREFUSED.

## eb4e59c — docs: RC holds the nats-monitor role — NATS page live again
**Time:** 17:21
**Files:** 5 changed (docs only)
**Tests:** not run (docs). Live: RC container has NATS_URL/NATS_USER=react-console/NATS_PASSWORD injected; status/streams/consumers all return data.
**What:** KNOWN_ISSUES entry moved to Resolved; WIP_DEPENDENCIES, ARCHITECTURE, .env.example and CHANGELOG name the nats-monitor role.
**Why:** BE-YAC answered CASE-852#3: raw subjects are refused in app manifests (74ad391e), so it added the nats-monitor role and gave it to RC (f0fc0a64). The case is now implemented.

## cba65ae — feat: MongoDB page logs in as its own read-only MongoDB user
**Time:** 15:18
**Files:** 11 changed, +352/-28
**Tests:** 140 passed (12 new); tsc clean. Live on wip-local (CASE-890 rendered): all routes 200 as react-console; $where/$gt filters 400; browser shows "Read-only as react-console". Throwaway mongo:7 --auth: anonymous → not_configured, wrong pw → rejected then recovered in-process after the file was fixed, no-role user → forbidden; insert/update/delete/drop refused (13).
**What:** mongo-auth.ts (MONGO_USER + MONGO_PASSWORD(_FILE), authSource admin, classification, filter-field guard); connector shares one connect attempt and drops the client on failed login; /databases reports one classified auth error; page notice and identity.
**Why:** CASE-892 (MongoDB requires auth, CASE-890).
**Discovered:** Without credentials MongoDB still accepts the connection and only refuses commands, so the old page got 200 with four per-DB errors. $where runs under the built-in read role (confirmed), so the old /docs filter let any console user run server-side JS. CASE-892 is now implemented (#2).
