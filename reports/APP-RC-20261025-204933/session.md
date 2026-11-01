---
session_id: APP-RC-20261025-204933
role: APP-RC
started_at: 2026-10-25T20:49:33
status: closed
ended_at: 2026-11-01T23:38:34
---

# Session APP-RC-20261025-204933

Phase 4 (/wip-improve), one context window from 2026-10-25 to 2026-11-01.

## Session Summary
**Duration:** 2026-10-25 20:49 – 2026-11-01 23:37
**Commits:** 42 (about two thirds code, tests or docs; the rest scaffold refreshes and report logs). All pushed except one uncommitted change, see Unfinished.
**Lines:** +2757/-585 in code, tests and docs (lockfiles, lib tarballs and reports/ excluded)
**Phase:** 4 — /wip-improve (cases from the KB, platform follow-ups, three scaffold refreshes)

**What happened:**
- **Namespace selector review, implemented.** The top-bar selector is now an allowlist (`src/lib/namespace-scope.ts`): live only where it filters or scopes a create, disabled with a reason elsewhere. Peter caught Backup & Restore wrongly live; the Template Builder had the same read-once flaw. `?ns=` stays in the URL, two-way (`useNamespaceInUrl`, StrictMode-safe). Create forms show the target namespace, detail pages flag a namespace mismatch, and duplicates start in the source's namespace. Dropdown grouping by namespace kind was closed won't-fix (Peter: group by prefix if needed).
- **Platform follow-ups, each verified against the WIP source before the UI changed:**
  - document archive removed: Archive became soft Delete, and the toggles read Active / Incl. deleted;
  - merge-restore option for the target's older versions;
  - Identity Maintenance, pulled from another clone: re-key outcome as a success allowlist, read from the Registry's code; later adapted to client 0.69, where a re-run retries failed re-keys and applied counts only successful re-keys;
  - template dropdowns sorted by the text shown, each value once;
  - Settings tab reads its session in the same statement as the settings (verified live that pooled requests hit different backends);
  - document lists use latest_only, so superseded versions no longer show as documents (the "memories on v1" report);
  - template-version filter on the documents list, plus "Documents on vN" on the template page.
- **Robustness:**
  - OIDC discovery runs in the background with retry, with a 503 gate keyed on the configured mode (a naive "listen first" would have trusted forged X-WIP-User headers; proven by test);
  - @wip/proxy onMissingKey 'unavailable': a missing key costs /wip, not the server;
  - Node 20 → 24 in all images; the entrypoint's install check also covers node -v and libc.
- **Infrastructure:**
  - three scaffold refreshes (libraries now client 0.69.0, react 0.24.0, proxy 0.6.0);
  - E2E retargeted to the default install, and the access spec accepts the gateway as enforcer;
  - this clone was 14 commits behind origin at session start (it had missed the 2026-10-19/20 work) and was rebased; the git remote moved to SSH.

**WIP interactions:**
- **Filed:**
  - the deployer silently drops optional from_secret env vars (BE-YAC since fixed it with supplied_by: operator);
  - the version-filter record, closed as implemented the same day.
- **Responded:**
  - the redeploy startup crash in the MCP apps (RC unaffected; the dev crash persists because tsx watch keeps the container alive);
  - the merge older-versions request;
  - the document-list version-row report.
- **Commented:** the Node 20 end-of-life case, where RC did its part.
- **Platform facts verified in passing:**
  - the document list endpoint returns every stored version without latest_only;
  - the query endpoint returns active rows with no status, and superseded history rows for status=inactive;
  - the table-view endpoint defaults status to active;
  - a fresh install restarted KB case numbering, hence Peter's rule: no case numbers in git.

**Dead ends / corrections (so nobody repeats them):**
- **Unverified advice:**
  - I told Peter the Anthropic key would reach the container through the deploy secret file; the deployer never injected optional from_secret vars. Read the implementing code, not the declaring manifest.
  - I handed him the contract's generic `wip-deploy install` command; the real one is `wip-deploy add-app react-console --app-source ~/Development/WIP-RC --name default` (in memory).
  - I claimed WIP requires a document to live in its template's namespace; only RC's own create path does that.
- **Probes:**
  - `wget localhost:5174` inside the container is a false negative: Vite binds IPv4. Use 127.0.0.1.
  - Restarts timed before a lockfile change leave the container on old libraries; check the entrypoint's hash marker against the lockfile.
- **Dev container behaviour:**
  - a rebase or refresh rewriting many files can crash the live Vite; its health check doesn't notice;
  - Peter's `! command` lines with a leading space arrive as plain text.
- **Commit trailers:** they must be in the final paragraph, directly above Co-Authored-By, or the post-commit hook records "not recorded" (in memory).

**Downstream impact:**
- RC's production image needs a rebuild and a manifest pin for the Node 24, libc, proxy and lockfile changes to reach image-based installs (kb.internal, dev-test, prod-test). That's Peter's step.
- The KB console 404s Peter saw were APP-KB's corpus probe; APP-KB is fixing them.

**Unfinished:**
1. **Uncommitted:** `package-lock.json` from `npm update` within existing ranges (Node 20 end-of-life case, step 3: npm audit 26 advisories → 1 low). tsc, unit 336/336 and vite build pass. Still to do:
   - Peter must approve a dev container restart so it picks up the lockfile;
   - then a full E2E run, then commit (trailers in the final paragraph) and push;
   - then comment on the case in the KB: steps 1–2 done in 944aac9 (deployed, 76/76), step 3 this commit, step 4 is Peter's image build and pin.

   The remaining low advisory is esbuild's Windows dev-server file read (GHSA-g7r4-m6w7-qqqr), unreachable in RC; the only automatic fix downgrades esbuild. A tsx bump to 4.23.x (esbuild ~0.28) is the proper route, for another day.
2. **Backlog** (`KNOWN_ISSUES.md`):
   - adopt the coming `GET /api/reporting-sync/parity/status` once it ships;
   - the Identity Maintenance reporting follow-up is still unsettled (replay or forced batch sync).
3. **Bundle-size warning:** still there on build.

**For the next YAC:**
- **Start:** `/wip-wake`, then `git fetch` and compare origin/master. Another clone also pushes to this repo; this one was once 14 behind.
- **Memory in this clone:**
  - push over SSH;
  - no case numbers in git (code comments follow CLAUDE.md's provenance prefix);
  - never run wip-deploy, and ask before touching containers;
  - the exact RC redeploy command;
  - commit trailers for the log hook.
- **Tests:**
  - `npm test`: 336 unit tests.
  - `npm run test:e2e`: 77 tests, about 2.3 min, against the default install. Run it in the background, after `nc -z localhost 8443` and a Vite check on 127.0.0.1:5174 inside `wip-react-console`.
  - The dev container uses ports 3011 (Express) and 5174 (Vite).
- **Commit log:** `commits.md` is now written by `.githooks/post-commit` from the commit message. Put Tests:/Discovered: in the last paragraph, and don't hand-write entries.
- **RC keeps the install's master key** (manifest `privileged_key: true`). The per-app key model in CLAUDE.md doesn't apply to it.
