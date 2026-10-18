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
**Duration:** 2026-10-12 14:38 – 2026-10-18 22:38
**Commits:** ~45 substantive (plus report-log commits), all pushed
**Phase:** 4 — /wip-improve + /wip-document
**What happened:**
- **10-12:** reset onto origin after waking 37 commits behind; NL tool fixes; registered views; endpoint picker scoping; full doc pass; @wip/client 0.54.0; CASE-858 heal on wip-local.
- **10-17/18, platform security:** RC handles the platform's NATS auth (CASE-852) and MongoDB auth (CASE-892), with no credentials in URLs, re-read on reconnect and classified errors. It closed a \$where server-JS hole. Peter rolled 20261018b to all installs, and I verified each from inside the pod. kb.internal endpoint heal done.
- **NL and SDK:** NL Query moved to claude-sonnet-5-5 (effort low, refusal fallback, stop handling), with a tidied prompt, a namespace-scoped data-model tool and a structural result cut. SDK 0.131.0.
- **Editors:** a shared CodeMirror editor (SQL autocomplete/format) and a read-only MongoDB query pad.
- **Typed client:** the reporting inventory now goes through it (CASE-898 filed for parity/CSV).
- **Access:** ALLOWED_GROUPS is enforced behind the gateway (3461408). BE-YAC set ALLOWED_GROUPS=wip-admins in RC's manifest (WIP e9c775b5).
- **E2E phase 1** (local, Playwright, e2e@wip.local): smoke, lifecycle and infra, 25 tests. It found and fixed the /api-keys dev-proxy bug and missing form labels.

**WIP interactions:**
- Filed CASE-858/859/861 (resolved) and CASE-898 (open).
- Commented on CASE-852 (nats-monitor role added); responded to and implemented CASE-892.
- Noted that WIP list endpoints ignore `limit`.
- \`wip-deploy user add\` exists (CASE-842). I wrongly claimed otherwise from a truncated --help (memory: read-full-cli-help).

**Unfinished:**
- E2E spec groups: imports, reporting (Query Pad + registered views), relationships (KNOWN_ISSUES entry).
- Deployed RC images (20261018b) predate 3461408, the ALLOWED_GROUPS gateway fix. With the manifest now setting ALLOWED_GROUPS, installs need a new RC image to enforce it.
- Optional: Mongo aggregate editor; VersionWarnings TODO (needs a version_strategy filter in WIP).

**For the next YAC:**
- **Before trusting local history:** \`git fetch\` and compare with origin.
- **Dev container:** it mounts this clone (Express 3011, Vite 5174, /apps/rc/). Restart it after dependency changes (lockfile-gated npm ci). Restarts and server-code reloads drop the in-memory Anthropic key override.
- **Deploys:** app deploys and image builds are Peter's. Check deployer-state tag_overrides for stale RC pins.
- **In-container probes:** ALLOWED_GROUPS is live on wip-local, so probes need the X-WIP-User/X-WIP-Groups headers or they get 401.
- **E2E:** \`npm run test:e2e\`. Specs are serial in a disposable namespace; long runs go in the background (the Bash timeout is 60 s).
- **Browser tool:** use only refs returned by find, and set URL-synced filters through the URL.
- **Remember-questions:** when asked "do you remember X?" and it isn't in context, say no.
