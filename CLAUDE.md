# WIP ReactConsole

## What This App Does

RC-Console is a React + TypeScript replacement for WIP's existing Vue 3 admin console. It visualizes and manages all WIP data (namespaces, terminologies, templates, documents, files, registry) across all namespaces, provides direct infrastructure inspection (PostgreSQL, MongoDB, NATS), referential integrity checks, and a natural language query interface for data exploration. See DESIGN.md for the full implementation plan.

## The Golden Rule

> **Never modify WIP. Build on top of it.**

WIP is the backend. This app is a frontend that maps a domain onto WIP's primitives (terminologies, templates, documents) and presents them to users.

## Dev Namespace

Your development namespace is `dev-wip-reactconsole`. Use it for all data modeling during development.

**Why:** Terminologies and templates are hard to delete cleanly once documents reference them. A dev namespace lets you iterate freely — create, modify, delete, start over — without polluting production data.

**Workflow:**
1. Use `dev-wip-reactconsole` for all `/design-model` and `/implement` work
2. Create terminologies, templates, and test documents in this namespace
3. Iterate until the data model is stable
4. When ready for production, create a new namespace (e.g., `wip-reactconsole`) and recreate the finalized model there
5. Clean up the dev namespace with `dev-delete.py`:
   ```bash
   python tools/dev-delete.py --namespace dev-wip-reactconsole --force
   ```

**Important:** All MCP tool calls that accept a `namespace` parameter should use `dev-wip-reactconsole` during development.

## API Key

The MCP server uses a privileged admin key (from WIP's `.env`). This is fine for data modeling via MCP tools.

**For your app's runtime API calls**, you should use a namespace-scoped key instead of the admin key. Non-privileged API keys MUST have an explicit `namespaces` field — keys without namespace scoping get no access.

```json
{
  "name": "wip-reactconsole",
  "key": "generate_a_real_key",
  "owner": "dev@wip.local",
  "groups": [],
  "namespaces": ["dev-wip-reactconsole"],
  "description": "WIP ReactConsole — scoped to dev namespace"
}
```

Add this to WIP's `config/api-keys.dev.json` and use the key value in your app's `.env`:
```bash
WIP_API_KEY=generate_a_real_key
```

See WIP's `docs/migration-unscoped-api-keys.md` for details on privileged vs scoped keys.

## Process

Follow the 4-phase development process. Start with:

```
/explore
```

**Core phases** (in order):
1. `/explore` — Read MCP resources, discover existing data model, understand the domain
2. `/design-model` — Map the domain to WIP primitives (user must approve before proceeding)
3. `/implement` — Create terminologies and templates in WIP, verify with test documents
4. `/build-app` — Scaffold and build the React/TypeScript application

**After Phase 4:**
- `/improve` — Iterate (add features, fix bugs, refine UI)
- `/document` — Generate README, ARCHITECTURE, etc.

**Available at any time:**
- `/wip-status` — Check WIP service health and data state
- `/export-model` — Save data model to git as seed files
- `/bootstrap` — Recreate data model from seed files
- `/add-app` — Add a second app that cross-references the first
- `/resume` — Recover context after compaction or at start of a new session
- `/report` — Capture fireside chat or trigger session summary

**Context management:** When context reaches ~70-80%, the human should tell you to run `/resume` or save state (DESIGN.md, memory files) before compaction hits.

## Reference Documentation

Read these before starting:
- `docs/AI-Assisted-Development.md` — 4-phase process, data model design guide, PoNIFs quick reference. (DOC-YAC's CASE-108 has flagged this for update; treat as background, prefer `wip://development-guide` for current truth.)
- `docs/WIP_PoNIFs.md` — Narrative guide to WIP's PoNIFs. (DOC-YAC's CASE-66 has flagged this for update; covers 6 of 8 PoNIFs. **Prefer `wip://ponifs` for the canonical 8-entry list including #7 Edge Types and #8 `versioned: false`.**)
- `docs/WIP_DevGuardrails.md` — UI stack, app skeleton, testing conventions
- `docs/ontology-support.md` — Term relationships, polyhierarchy, typed relationships, traversal queries
- `docs/dev-delete.md` — Hard-delete entities during development (modes, backends, remote usage)

## MCP

WIP is accessed exclusively via MCP tools (88 tools, 5 resources — `create_edge_type` and full-text search tools landed during the v2 rollout). Before starting:
- Read `wip://conventions` — bulk-first API, identity hashing, versioning
- Read `wip://data-model` — terminologies, templates, documents, fields, relationships
- Read `wip://ponifs` — 8 behaviours that trip up every new developer (PoNIFs #7 Edge Types and #8 `versioned: false` added Day 42)

`wip://development-guide` provides the full 4-phase workflow reference if needed.
`wip://query-assistant-prompt` provides a complete system prompt for NL query agents (used by --preset query apps).

## Client Libraries

For Phase 4 (app building), use @wip/client, @wip/react, and @wip/proxy:
- `libs/wip-client-README.md` — TypeScript client (6 services, error hierarchy, bulk abstraction)
- `libs/wip-react-README.md` — React hooks (TanStack Query, 30+ hooks)
- `libs/wip-proxy-README.md` — Express middleware for WIP API proxying with auth injection

Install from tarballs in `libs/`:
```bash
npm install ./libs/wip-client-*.tgz ./libs/wip-react-*.tgz ./libs/wip-proxy-*.tgz
```

## Dev Setup Gotchas

**TLS:** WIP uses a self-signed cert on `https://localhost:8443`. Node.js `fetch()` rejects self-signed certs. Add `NODE_TLS_REJECT_UNAUTHORIZED=0` to your `dev:server` script (NOT `start`/production). Production with proper certs needs no workaround.

**@wip/client baseUrl:** In browser apps behind a Vite proxy, use `baseUrl: '/wip'` (resolved to `window.location.origin + '/wip'`). Do NOT use a bare relative path without the client resolving it — `new URL('/wip/...')` throws without a protocol.

**@wip/react providers:** Hooks require BOTH `QueryClientProvider` (from `@tanstack/react-query`) AND `WipProvider` (from `@wip/react`). Missing either causes silent failure — hooks mount but never fetch, no errors.

## WIP Toolkit

`wip-toolkit` is a CLI for backup, export, import, and data migration. Install from the wheel in `libs/`:

```bash
pip install libs/wip_toolkit-*.whl
```

Key commands:
- `wip-toolkit export <namespace> <output.zip>` — Export namespace to archive
- `wip-toolkit import <archive.zip> --mode fresh` — Import with new IDs (cross-namespace)
- `wip-toolkit import <archive.zip> --mode restore` — Restore with original IDs (disaster recovery)

Remote WIP instances:
```bash
wip-toolkit --host pi-poe-8gb.local --proxy export wip /tmp/backup.zip
```

## Dev Delete

`tools/dev-delete.py` hard-deletes entities during iterative development. See `docs/dev-delete.md` for full usage.

```bash
# Dry run (default)
python tools/dev-delete.py --namespace myapp

# Actually delete
python tools/dev-delete.py --namespace myapp --force

# Remote MongoDB
python tools/dev-delete.py --mongo-uri mongodb://remote-host:27017/ --namespace myapp --force
```

Requires `pymongo`. For file/reporting cleanup also install `boto3` and `psycopg2-binary`.

## Session Awareness

You will be replaced. This session — including everything you learn, every correction Peter makes, every insight you gain — ends when your context fills or the task completes. The next agent starts from scratch with no memory of this conversation.

**Consequence:** Anything worth knowing must be encoded into a durable artifact before this session ends. If Peter corrects your approach, consider whether the correction belongs in:
- A `/lesson` entry (quick, structured, for future gene pool review)
- A session report "Dead Ends" section (for the next YAC continuing this work)
- A CLAUDE.md update (if Peter agrees it's universal)

Do not say "got it, won't happen again" unless you have written the lesson down. The next agent will make the same mistake unless you leave a trace.

## Scope Budget

Most tasks should complete within a predictable number of commits. If you find yourself significantly exceeding expectations, something is wrong — a misunderstanding, a rabbit hole, or a task that needs decomposition.

**Commit heuristics:**
- A bug fix: 1-3 commits. If you're past 5, stop and report what's blocking you.
- A feature addition: 3-7 commits. If you're past 10, stop and reassess scope with Peter.
- A refactor: 2-5 commits. If you're past 8, you're probably changing too much at once.

**Context window awareness:** You can check your own context usage:
```bash
cat .claude-context-pct
```
This file is written to your project directory by the status line. Check it periodically — especially before starting a new subtask.
- **Past 50%:** Ensure your session report and dead ends section are written. You are halfway to replacement.
- **Past 75%:** Stop working and write your session summary. Do not push through hoping to finish — the next YAC picks up faster from a clean summary than from a half-finished sprawl.

When stopping for any reason, write a clear status report: what's done, what's left, what's blocking, and what didn't work (dead ends).

## YAC Reporting

You are a YAC (Yet Another Claude). You report your work to the Field Reporter by writing files to a shared directory. This reporting is also useful for the *next* YAC — your session reports are input for future agents resuming your work.

**Getting the current time:** Always use `date '+%Y-%m-%d %H:%M'` for timestamps. Do not guess.

**Off the record:** If Peter says "off the record" or "don't report this," skip reporting for that segment. Resume when told.

### Session Identity

At the start of every session, run `date '+%Y%m%d-%H%M'` and assign yourself a session ID using your app prefix:

| App | Prefix |
|-----|--------|
| Statement Manager | `APP-SM` |
| Receipt Scanner | `APP-RS` |
| D&D Compendium | `APP-DND` |
| ClinTrial Explorer | `APP-CT` |
| New apps | `APP-<SHORT>` (pick a 2-4 letter code, tell the user) |

Format: `<PREFIX>-YYYYMMDD-HHMM`. Example: `APP-CT-20260331-2015`.

### Report Directory

Create your report directory at the start of every session:

```bash
mkdir -p /Users/peter/Development/FR-YAC/reports/<PREFIX>-YYYYMMDD-HHMM/
```

### Resuming — Check Previous Sessions

At session start (and when running `/resume`), check for recent sessions with your prefix:

```bash
ls -d /Users/peter/Development/FR-YAC/reports/<PREFIX>-* 2>/dev/null | tail -1
```

If a previous session exists, read its `session.md` to recover context from the previous agent's work. This is faster and richer than reconstructing from git alone.

If you are continuing work from that session (e.g., after context compaction), add this to your
`session.md` frontmatter:

```
continues: <PREVIOUS-SESSION-ID>
```

### Session Start

Create `session.md` immediately when starting work:

```markdown
---
session: <PREFIX>-YYYYMMDD-HHMM
type: app
app: <app name>
repo: <repo directory name>
started: YYYY-MM-DD HH:MM
phase: <explore | design-model | implement | build-app | improve | other>
tasks:
  - <initial task from user>
---
```

### After Every Commit

Before appending, read `commits.md` first. If the commit hash is already listed, skip it (prevents duplicates after context compaction).

Append to `commits.md` in your report directory:

```markdown
## <short-hash> — <commit message>
**Time:** <run `date '+%H:%M'`>
**Files:** <count> changed, +<added>/-<removed>
**Tests:** <X passed, Y failed — or "not run">
**What:** <1-2 sentences — what changed>
**Why:** <1-2 sentences — what motivated this change>
**PoNIF:** <if you encountered a PoNIF — which one and whether it caused issues. Omit if none.>
**Discovered:** <anything surprising, bugs found, or gaps identified — omit if nothing>
```

If you encountered a PoNIF and handled it correctly, note which one. If you hit a PoNIF and it caused a bug, definitely note it — the Field Reporter tracks these patterns.

### Session Summary

Write the session summary to `session.md` when:
- Peter runs `/report session-end`
- You detect context is running low (~70-80%)
- The session is naturally ending

Update (overwrite) the summary section — don't append multiple summaries.

```markdown
## Session Summary
**Duration:** <start time> – <run `date '+%H:%M'`>
**Commits:** <count>
**Lines:** +<added>/-<removed>
**Phase:** <which phase(s) you worked in>
**What happened:** <3-5 sentences covering the session's arc — not a commit list, but the narrative>
**WIP interactions:** <any platform bugs, missing MCP tools, or upstream issues discovered — omit if none>
**Unfinished:** <what's left, if anything>
**For the next YAC:** <context the next agent needs to pick up where you left off>
```

### Fireside Chats

When Peter initiates a design discussion, architecture debate, or scope conversation, use the `/report` slash command to capture it. These are the high-value narrative moments — not just what was decided, but why, what alternatives were considered, and what Peter said.
