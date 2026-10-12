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
