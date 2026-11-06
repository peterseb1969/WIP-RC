---
session_id: APP-RC-20261102-091814
role: APP-RC
started_at: 2026-11-02T09:18:14
status: closed
ended_at: 2026-11-06T22:29:33
continues_from: APP-RC-20261025-204933
---

# Session APP-RC-20261102-091814

Continues from APP-RC-20261025-204933 (via /wip-wake).

## Session Summary
**Duration:** 2026-11-02 09:18 – 2026-11-06 22:29
**Commits:** 31 by this session (plus 2 log commits from the other clone, taken in by rebase), all pushed
**Lines:** +4,262/−343 in code, tests and docs (lockfiles, lib tarballs and reports/ excluded)
**Phase:** 4 (/wip-improve)

**What happened:**
- **Housekeeping:** finished the Node 24 npm update. Five scaffold refreshes, ending at `@wip/client` 0.83.0, `@wip/react` 0.26.0 and `@wip/proxy` 0.7.0.
- **Keys, grants and reservations:**
  - Console keys can reserve namespaces (CASE-1015). The edit form's PATCH path dropped grants, so all namespace edits now go through widen and narrow. Reserve is a visible checkbox on edit too (2ca89a1).
  - wip-deploy's keys, grants and reservations are read-only (CASE-1037).
- **Refresh across the console:** every Refresh button spins, takes no second click and dims the counts it refreshes. Opt-in Auto refresh on the documents list. The Dashboard and Namespaces counts actually refresh now. An expanded namespace shows live and retired contents, from the services rather than the Registry's counts, which include deleted entities.
- **Slow documents list:** filed CASE-1039. BE-YAC fixed it on the WIP side: pbs-clintrial went from 6.5 s to 0.8 s.
- **CASE-1058:**
  - a System backup/restore tab: dry run first, Apply pinned to the reviewed plan, typed confirmation for mirror;
  - an Orphaned grants section;
  - an Attachments page.
- **App origins** (CASE-1061/1104): RC works when each app has its own origin. A 401 reloads RC's own URL instead of going to /auth/login. The attachment links follow the mode. The E2E login is origin-aware, and the suite's defaults now target `wip.localhost`.
- **Verification:** the full suite passed on the default install at `wip.localhost`, subdomain mode (92/92), and on dev-test in k8s subdomain mode (92/92, user e2e).

**WIP interactions:**
- **Cases:**
  - filed CASE-1039;
  - responded to CASE-1015, 1037 and 1058;
  - implemented CASE-1015, 1037 and 1058;
  - commented on CASE-1006 and 1033.
- **Platform gaps found and settled by BE-YAC:**
  - duplicate listing rows and the order of refusals for managed records (CASE-1033 #4);
  - no reservation ever activates an orphaned grant (CASE-1053).
- **dev-test:** its first "new images" (`20261106a`) had a gateway without the app-origin module. A pod check caught it before Peter switched.
- **kbc:** repointed to `https://kb.kb.internal` in `.claude/kb.json` (untracked); client 4.11.0.

**Dead ends / corrections:**
- **I proposed dropping latest_only for active lists,** relying on "at most one active version". That isn't a guarantee: a merge restore with `older_versions: keep` leaves several active versions. A code comment plus one install's data is not a contract.
- **Managed keys:** a Console key whose name a managed key takes is taken over, not shadowed.
- **A rebase re-runs .githooks/post-commit,** which logs the commit under its new hash. Drop the stashed pre-rebase log entry.
- **Retired templates:** latest_only with status=inactive returns superseded versions of live templates. Count retired templates from all versions, grouped.
- **E2E in the full suite:** the run namespace shows a template dropdown, not cards, and holds many documents. Select templates by URL and compare counts relatively.
- **Peter asked whether it was OK to switch, not for adaptation:** answer the question asked, and probe only when asked.
- **Reinstalling `default` dropped the e2e Dex user.** Re-created in wip-editors, it can't enter RC; it needs wip-admins (set-groups).

**Downstream impact:**
- **RC's images:** dev-test runs RC `20261106a`. That has the app-origin fix, but not 2ca89a1 (the Reserve checkbox on key edit). prod-test and kb.internal need new RC images.
- **Scaffold docs:** they still name `localhost:8443` (BE-YAC's to change, if wanted).

**Unfinished:**
1. **The CASE-1104 comment for react-console is not posted.** Peter wants it posted once prod-test and kb.internal are checked. Content:
   - commit 4042527 (plus refresh 30b3556);
   - `@wip/react` 0.26.0 through WipProvider;
   - checked on localhost (wip.localhost) and dev-test, 92/92 each;
   - non-browser client repointed: kbc through kb.json;
   - nothing failed.
2. **Untested live:**
   - a system restore apply (needs a throwaway stack);
   - Activate on a real orphaned grant (no install has one).
3. **Backlog:**
   - an optional index case for namespace-wide document sorts (CASE-1039 #1 §4);
   - the Dashboard totals still use the Registry's counts, deleted included;
   - `KNOWN_ISSUES.md` items (parity status endpoint, Identity Maintenance reporting follow-up, bundle-size warning, the esbuild low advisory).

**For the next YAC:**
- **Start:** `/wip-wake`, then `git fetch`. Another clone also pushes, mostly reports.
- **Installs:**
  - `default` is `wip.localhost:8443` in subdomain mode, so RC is at `https://rc.wip.localhost:8443/apps/rc/`;
  - the dev container is `wip-react-console`, on ports 3011/5174. Restart it only with Peter's approval, after a lockfile change.
- **E2E:** 92 tests, about 2.7 min. The defaults target `wip.localhost`. For dev-test, set `E2E_DEPLOYMENT=dev-test E2E_BASE_URL=https://rc.dev-test.internal/apps/rc/ E2E_WIP_URL=https://dev-test.internal`. The e2e user must be in wip-admins.
- **Before an install switches to app origins,** check that its gateway pod has `auth_gateway.app_origins`.
- **Peter's rules:**
  - never run wip-deploy; hand him the commands, after checking the CLI;
  - no case numbers in git;
  - commit trailers go in the final paragraph.
- **RC keeps the master key** (privileged_key).
