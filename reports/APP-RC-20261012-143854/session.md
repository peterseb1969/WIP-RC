---
session_id: APP-RC-20261012-143854
role: APP-RC
started_at: 2026-10-12T14:38:54
status: active
continues_from: APP-RC-20260705-192840
---

# Session APP-RC-20261012-143854

Continues from APP-RC-20260705-192840 (via /wip-wake).

## Session Summary
**Duration:** 2026-10-12 14:38 – 2026-10-18 18:20
**Commits:** ~35 substantive (plus report-log commits), all pushed
**Lines:** +4700/-660 approx (8a1bbbb..HEAD)
**Phase:** 4 — /wip-improve + /wip-document
**What happened:** 10-12: reset onto origin after waking 37 commits behind, NL tool fixes, registered views, endpoint picker scoping, full doc pass, @wip/client 0.54.0 adoption, CASE-858 heal on wip-local. 10-17/18: the platform added NATS auth (CASE-852) and MongoDB auth (CASE-890). RC gained credential handling for both: file-then-env secrets, no credentials in URLs, re-read on reconnect, classified auth errors in the UI. It also closed a `$where` server-side-JS hole in the Mongo browse route. Peter rolled RC 20261018b to dev-test, prod-test and kb.internal; I verified each from inside the pod. The kb.internal endpoint heal ran (95 entries). NL Query moved to claude-sonnet-5-5 (effort low, refusal fallback, stop-reason handling), verified live with Peter's key. Then the approved editor plan: a shared CodeMirror 6 editor for the Query Pad and the view editor (schema autocomplete, format), and a read-only MongoDB query pad (Extended JSON, JS-operator ban, bounds).
**WIP interactions:** Filed CASE-858/859/861 (all resolved upstream). Commented on CASE-852 (#3, RC's NATS needs; BE-YAC added the nats-monitor role). Responded to and implemented CASE-892 (RC Mongo auth). WIP list endpoints ignore `limit` (use page_size).
**Unfinished:** nothing requested is open. Optional follow-ups: the MongoDB aggregate pipeline editor (KNOWN_ISSUES); the @anthropic-ai/sdk bump from 0.95.1 (typed `fallbacks`); describe_data_model output exceeds the NL tool-result cap on large installs; the /tables migration to client.reporting.listTables(); two optional NL system-prompt tweaks offered, not applied.
**For the next YAC:** `git fetch` and compare with origin before trusting local history. The --app-source container mounts this clone (Express 3011, Vite 5174, /apps/rc/). After dependency changes restart the container (lockfile-gated npm ci); the restart also drops the in-memory Anthropic key override. App deploys/image builds are Peter's (he declined the deployment agent and runs them himself); per-app tag_overrides in deployer-state can pin RC to an old tag and override the install tag — check them. In the browser tool, only use element refs returned by find, never guessed ones. When asked "do you remember X?" and it isn't in context, just say no.
