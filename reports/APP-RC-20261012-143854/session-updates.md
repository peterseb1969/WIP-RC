# Session Updates — APP-RC-20261012-143854

## 2026-10-12 16:10 — BLOCKED: local clone is 37 commits behind origin/master; push rejected
After committing the scaffold refresh (0da7642), reports tracking (fd457ed), and a WIP_API_KEY_FILE fix (fffc417), `git push origin master` was rejected. origin/master holds 37 commits (2026-07-12 → 2026-08-20) never pulled into this clone: lib bumps to client 0.51/react 0.20/proxy 0.5.1, its own scaffold refresh + CLAUDE.md merge (643f7bb), and its own key-file fix (eceee5b; proxy 0.4.3 falls back to inline key when the file is missing, CASE-714). So 0da7642 and most of fffc417 duplicate origin. Remaining genuine gap on origin: server/nl/tools.ts still reads only WIP_API_KEY (NL tools send an empty key in host mode). origin has no reports/. The wip-react-console dev container mounts THIS clone, so the running dev app is also on July code. Awaiting Peter's call on reconciliation (proposed: reset to origin/master, re-apply reports + the nl/tools gap fix). Lesson: /wip-wake recovery must git fetch and compare against origin.

## 2026-10-12 16:20 — UNBLOCKED: reconciled with origin, pushed, container current
Reset master to origin/master per Peter, re-applied reports (1adaf2d) + NL-tools key fix (a29b286), pushed to b44ab1a. Pre-reset commits kept on `backup/local-pre-reset-20261012` (local only — delete once no longer needed). Host `npm ci` and a container restart (lockfile-hash-gated npm ci) brought both to client 0.51.0 / proxy 0.5.1; container healthy, proxy authenticated via the inline-key fallback (wipProxy warns that the host-only key file path is unreadable — expected in the container). Open for Peter's decision: (1) BE-YAC case for reporting-sync /query + /tables answering 200 with no credentials on wip-local; (2) fix the NL tools response-shape bug (`.terminologies`/`.templates`/`.id` vs `{items}`/`terminology_id`).

## 2026-10-17 15:20 — kb.internal endpoint repair: dry run only
Ran POST /api/template-store/maintenance/heal-endpoints with dry_run=true on kb.internal (deploy key ~/.wip-deploy/kb) for all three namespaces. wip: 0 templates. kb: 12 edge types scanned, 12 would change, 93 entries filled, 0 unresolvable. library: 1 edge type (SEE_ALSO), 2 entries, 0 unresolvable. Same counts as wip-local before its repair. Nothing written; the real run awaits Peter's go-ahead.

## 2026-10-18 12:38 — dev-test: RC 20261018a connects to authenticated NATS
Peter built react-console:20261018a from master 7edf6e2 (GitHub run 39119915381) and rolled dev-test's react-console to it (was 20261012a, which predates the NATS auth code and got Authorization Violation). Verified from inside pod wip-react-console-7d485cdcb-5x5pr (digest sha256:7b30293c…): status connected as react-console (NATS 2.15.1), streams lists WIP_EVENTS, consumers lists reporting-sync-durable. WIP_EVENTS on dev-test was created 2026-10-18T10:31 with 0 messages, consistent with the one-time move of the JetStream store onto the volume (CASE-891).

## 2026-10-18 12:43 — kb.internal endpoint repair run (CASE-858)
Peter took a backup first and approved the run. heal-endpoints dry_run=false: kb 12 templates / 93 entries, library 1 / 2, 0 unresolvable. A dry-run re-check found 0 left to change (93 and 2 already filled). Edge-type versions unchanged (all v1). The served templates now carry resolved on every endpoint.

## 2026-10-18 13:32 — NATS auth rollout complete on all installs
Peter rolled the new platform images plus react-console:20261018a to prod-test and kb.internal. Along the way the deployer fixed a bug: NATS passwords must start with a letter, so generated ones are now prefixed. RC needs no change, since it passes the value through. Verified from inside each RC pod: prod-test and kb both connect as react-console (NATS 2.15.1), and on kb streams/consumers list too. kb.internal's healed edge endpoints are still all resolved after the update (93 + 2).

## 2026-10-18 15:07 — CASE-892 responded (MongoDB auth for RC)
BE-YAC filed CASE-892: RC's MongoDB page must send MONGO_USER/MONGO_PASSWORD once installs are re-rendered with CASE-890 (WIP 97970506; RC manifest already holds read-all). Response #1 confirms it and adds three RC-side items: (1) with auth on, /databases answers 200 with four per-DB Unauthorized errors, so classify not_configured (13) vs rejected (18); (2) the cached client is set before connect() resolves, so cache the promise, reset on failure, and drop it on auth failure for rotation; (3) /docs passes filter_field straight through, so $where would run server-side JS under the read role; reject $-prefixed fields. Status responded; implementation awaits Peter. wip-local is not yet re-rendered (the RC container has no MONGO_USER).

## 2026-10-18 15:27 — dev-test: RC 20261018b verified with MongoDB + NATS auth
Peter rolled new platform images (CASE-890 MongoDB auth) plus react-console:20261018b (digest sha256:96038815…, includes cba65ae) to dev-test. From inside pod wip-react-console-7fd5fbdd84-g4zgv:
- MongoDB: /databases lists the 4 DBs as react-console; collections and docs work; a $where filter gets 400.
- NATS: connected as react-console; streams and consumers listed.
- Health: all services healthy; ingest-gateway is inactive (not deployed on dev-test).
- dev-test MongoDB refuses anonymous listCollections and an insertOne as react-console (13 Unauthorized).

## 2026-10-18 15:45 — prod-test: RC 20261018b verified with MongoDB + NATS auth
The first check found prod-test's per-app pin react-console=20261018a overriding the install tag 20261018b. The old image ignored MONGO_USER, so /databases returned 200 with four "requires authentication" errors and the other Mongo routes returned 502. NATS, health and Mongo enforcement were fine (anonymous and writes refused). Peter moved the pin with app-deploy. Re-check from pod wip-react-console-6f5fd74d47-8sl9q (20261018b, sha256:96038815…): Mongo databases/collections/docs 200 as react-console, $where 400, NATS connected (104 delivered), all 7 services healthy. kb.internal likely has the same stale react-console pin.
