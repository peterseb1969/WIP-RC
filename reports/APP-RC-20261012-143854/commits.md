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
