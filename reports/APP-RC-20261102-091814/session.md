---
session_id: APP-RC-20261102-091814
role: APP-RC
started_at: 2026-11-02T09:18:14
status: active
continues_from: APP-RC-20261025-204933
---

# Session APP-RC-20261102-091814

Continues from APP-RC-20261025-204933 (via /wip-wake).

## Session Summary
**Duration:** 2026-11-02 09:18 – in progress (written 2026-11-04 21:09, at 53% context; to be overwritten at session end)
**Commits:** 18 by this session so far, plus 2 log commits from the other clone, pulled in by rebase
**Lines:** about +2,590/−330 in code, tests and docs
**Phase:** 4 (/wip-improve)

**What happened:**
- **Lockfile and Node 24:** finished the npm update (the Node 24 / npm audit request).
- **Console-issued keys that reserve namespaces** (CASE-1015). While building it, found that RC's key edit form set namespaces through PATCH, which changes scope without grants. All namespace edits now go through widen and narrow.
- **Refresh across the console:**
  - fixed the Dashboard and Namespaces counts, which Refresh never re-read;
  - every Refresh button now spins, takes no second click and dims the counts it refreshes;
  - opt-in Auto refresh on the documents list.
- **Slow documents list:** filed CASE-1039. BE-YAC fixed it on the WIP side: pbs-clintrial went from 6.5 s to 0.8 s.
- **wip-deploy keys, grants and reservations are read-only** (CASE-1037, after CASE-1033's contract gaps were settled).
- **Expanded namespace:** live and retired counts from the services that own the data, plus its own Refresh.
- **CASE-1058:** responded with a plan. Peter's decisions:
  - (a) no RC admin gate on system backup/restore for now;
  - (b) a typed confirmation for mirror apply;
  - (c) a "System" tab on Backup & Restore, "Orphaned grants" on API Keys, and an "Attachments" page under Admin.

**WIP interactions:**
- Filed CASE-1039.
- Responded to CASE-1015, 1037 and 1058; implemented 1015 and 1037.
- Commented on CASE-1006 and 1033.

**Dead ends / corrections:**
- **I proposed dropping latest_only for the active documents list,** relying on "at most one active version per document". BE-YAC showed it isn't a guarantee: a merge restore with `older_versions: keep` leaves several active versions. A code comment plus one install's data is not a contract.
- **I assumed a managed key's name collision "shadows" a Console key.** It is a takeover.
- **A rebase re-runs .githooks/post-commit,** which logs the commit under its new hash. Don't stash and restore the pre-rebase entry.
- **Per-template counts:** latest_only with status=inactive for templates returns superseded versions of live templates. Count retired templates from all versions, grouped.
- **E2E in the full suite:** the run namespace has many templates (a dropdown, not cards) and many documents. Select templates by URL and compare counts relatively.

**Unfinished:**
- CASE-1058 implementation: the client 0.77.0 refresh; the System tab; Orphaned grants; the Attachments page; E2E.
- Peter's step: rebuild RC's production image and pin it.
- Optional, not filed: an index case for namespace-wide document sorts (CASE-1039#1 §4); Dashboard totals still use the Registry's counts.

**For the next YAC:**
- The dev container uses ports 3011/5174. Restart it only with Peter's approval, after any lockfile change.
- The E2E suite has 87 tests, about 2.6 min.
- RC keeps the master key.
