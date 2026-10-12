# RC-Console

A React + TypeScript admin console for WIP (World In a Pie). It replaces WIP's Vue 3 console. It manages every WIP entity type across all namespaces, inspects the infrastructure directly (PostgreSQL reporting, MongoDB, NATS), runs referential-integrity checks, covers backup/restore end to end, and offers a natural-language query interface powered by Claude.

## What the user sees

The sidebar is flat, grouped into Overview / Data / Infrastructure / Health / Admin / Tools (`src/components/layout/Sidebar.tsx`). A global namespace selector sits in the top bar and is disabled on the cross-namespace infra pages (`/postgres`, `/mongodb`, `/nats`).

- **Dashboard** — service health cards with per-service build provenance (version, sha, image tag where the service exposes it), namespace summary, recent activity, recent items, data-quality card, infra quick status, quick actions.
- **Namespaces** — create/edit (isolation mode, deletion mode with the `confirm_enable_deletion` guard, ID algorithm config), stats, and a **grants** panel per namespace (read/write/admin grants for users, groups and API keys).
- **Terminologies** — list with server-side sorting and search (by value, label, or UUID); detail with term management, validate, export (JSON/CSV), and **import** from file (CSV/TSV, JSON array, OBO Graph JSON, plain-text `.obo`). Ontology files bring their term relations along. Import is available from the list page (creates the terminology) and from a terminology's detail page (imports into it). Formats: see IMPORT_FORMATS.md.
- **Term detail** — Overview (edit/deprecate/delete), Relationships (add/delete typed relations), Hierarchy (lazy ancestor/descendant trees for every relation type, not only `is_a`), Raw JSON. Tabs are deep-linkable (`?tab=`).
- **Templates** — list with usage filter (entity / reference / edge type) and server-side sorting. Detail per version (`?v=`) with field inspector, edge contract for edge types, header fields, deactivate/reactivate a specific version, duplicate. Builder with a field editor, validation rules, `header_fields`, reporting config including cross-version views, field renames, pinned-version pickers for template references, and edge-type creation (source/target endpoint pickers scoped to the edge type's own namespace). After a save that mints a version, the builder shows a version-impact panel (how many live documents the new version affects, and whether migration is possible) before you continue.
- **Documents** — template selector (it also lists templates owned by another namespace that this namespace has documents for), rows summarised via the template's `header_fields`, server-side sorting, and an all-templates view. Auto-generated create/edit forms covering every field type; edit uses RFC 7396 JSON Merge Patch with optimistic concurrency. Table view with CSV export, CSV import wizard, validate, archive. Detail shows hydrated references, a version inspector (historical snapshot + diff vs current), and for edge types and their endpoints, relationship and traversal panels.
- **Files** — paginated browser, preview (image/video/audio/PDF/text, streamed through the backend), orphan badges for unreferenced files.
- **Registry** — entry search and browse, by-term search mode, entry detail with synonyms.
- **PostgreSQL** — five tabs:
  - **Table Browser**: an entity-first inventory grouped by namespace, with filters in the URL. Selecting a table shows its columns and a paginated data view with CSV export.
  - **Views**: list, create, edit, delete and preview **registered reporting views** in every namespace.
  - **Query Pad**: SQL scoped to a namespace, with history and CSV export.
  - **Batch Sync**: namespace-scopable sync with an optional force rebuild.
  - **Parity**: per-namespace documents-vs-reporting checks.
- **MongoDB** — database → collection → document drill-down with indexes.
- **NATS** — stream cards with consumer details; friendly banner when NATS isn't deployed.
- **Integrity** — on-demand cross-service referential integrity checks.
- **Audit Explorer** — full-text entity search with reverse-reference inspection.
- **Activity** — activity feed and audit log.
- **API Keys** — runtime key management: create (plaintext shown once), revoke, edit. Each key shows its tier and effective per-namespace permissions. Also holds the **Anthropic key card**, which sets an in-memory override for the NL Query key.
- **Backup & Restore** — three tabs:
  - **Backup**: single namespace, several namespaces fanned out as separate jobs, or one combined archive.
  - **Restore**: upload, manifest pre-read, preview, then restore (original IDs), fresh (new IDs, with a namespace map) or merge.
  - **Validate**: namespace integrity.

  Jobs are tracked asynchronously, and large archives download through a streaming route.
- **NL Query** — chat interface. Claude answers questions using read-only WIP tools (see ARCHITECTURE.md → NL query).

## How to run

### Local (host)

```bash
# Install dependencies (@wip/* libs are versioned tarballs in libs/)
npm install

# Configure environment
cp .env.example .env
# Edit .env — at minimum WIP_BASE_URL and a WIP key source (see below)

# Express (tsx watch) + Vite concurrently
npm run dev

open http://localhost:5174
```

Express listens on `PORT` (default **3011**, `server/index.ts`). Vite serves the SPA on **5174** (`vite.config.ts`) and proxies `/wip`, `/api`, `/health` and `/auth` to `http://localhost:3011`. `dev:server` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` because WIP's local cert is self-signed.

### Under wip-deploy (`--app-source`)

```bash
wip-deploy install --target dev --app react-console \
  --app-source react-console=~/Development/WIP-ReactConsole
open https://localhost:8443/apps/rc/
```

The deployer builds `Dockerfile.dev`, which bind-mounts the repo and runs `npm run dev` through `docker-entrypoint-dev.sh`. That entrypoint re-runs `npm ci` into a named `node_modules` volume only when `package-lock.json` changes, so restart the container after a lockfile change. Caddy routes `/apps/rc/*` to Vite on 5174. Express runs on 3011 inside the container, with `APP_BASE_PATH=/apps/rc`. The app's route is **`/apps/rc/`**, not `/apps/react-console/`. The manifest lives in the WIP repo at `apps/react-console/wip-app.yaml`.

Note: `--app-source` mounts the repo, so `dotenv` loads this `.env` inside the container too. Any path in `.env` must therefore tolerate not existing there (see `WIP_API_KEY_FILE` below).

### Production

```bash
npm run build         # Vite build → dist/
npm start             # Express serves dist/ + API (NODE_ENV=production)
```

Or with Docker (multi-stage `Dockerfile`):

```bash
docker build --build-arg VITE_BASE_PATH=/apps/rc/ -t rc-console .
docker run -p 3011:3011 --env-file .env rc-console
```

The image's healthcheck hits `${APP_BASE_PATH}/health`. CI: `.gitea/workflows/test.yaml` runs tsc, the test suite and a production build. `.github/workflows/build.yaml` builds and pushes a dual-arch image to GHCR on manual trigger.

## Environment variables

Server-side (`process.env`, loaded from `.env` by `dotenv`):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WIP_BASE_URL` | No (default `https://localhost:8443`) | WIP gateway URL | `https://localhost:8443` |
| `WIP_API_KEY_FILE` | One key source required | Path to a file holding the WIP key, typically the live wip-deploy secrets file. Read at startup, so key rotation is picked up on restart. Takes precedence over `WIP_API_KEY` when the file is readable and non-empty. | `~/.wip-deploy/wip-local/secrets/api-key` |
| `WIP_API_KEY` | One key source required | Literal WIP key. Fallback when the key file is unset or unreadable; this is what the deployer injects into containers, where a host path from `.env` doesn't exist. | — |
| `MONGO_URI` | No | MongoDB connection string for the MongoDB page | `mongodb://localhost:27017/` |
| `NATS_URL` | No | NATS URL for the NATS page | `nats://localhost:4222` |
| `ANTHROPIC_API_KEY` | No | Claude key for NL Query. An admin can set an in-memory override on the API Keys page; it wins until cleared or the server restarts. | `sk-ant-...` |
| `NL_QUERY_MODEL` | No | Claude model for NL Query (default `claude-sonnet-4-6`) | — |
| `PORT` | No | Express port (default 3011) | `3011` |
| `APP_BASE_PATH` | No | Path prefix when served behind a router that does not strip it | `/apps/rc` |
| `NODE_ENV` | No | `production` serves `dist/` with an SPA fallback and secure cookies | `production` |
| `SESSION_SECRET` | No | Express session secret (OIDC mode) | random string |
| `OIDC_ISSUER` | No | Public OIDC issuer; setting it enables standalone OIDC login | `https://localhost:8443/dex` |
| `OIDC_INTERNAL_ISSUER` | No | Issuer URL for server-to-server discovery (defaults to `OIDC_ISSUER`) | `http://wip-dex:5556/dex` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | No | OIDC client (defaults `wip-apps` / `wip-apps-secret`) | — |
| `ALLOWED_GROUPS` | No | Comma-separated groups allowed into the app (OIDC mode); empty = any authenticated user | `wip-admins` |
| `WIP_ADMIN_GROUPS` | No | Groups treated as admins for admin-only server routes (e.g. setting the Anthropic key). Default `wip-admins`. | `wip-admins` |

Key resolution lives in one place: `server/wip-key.ts` serves the direct callers (infra health, file and backup streaming, NL tools). `@wip/proxy` uses the same precedence for `/wip`: `apiKeyFile`, then the inline key.

**Auth modes.**
- **Gateway mode** (deployed): `wip-auth-gateway` injects `X-WIP-User` / `X-WIP-Groups`, and `/api/me` reads them.
- **Standalone OIDC**: set `OIDC_ISSUER`.
- **Neither set**: open dev mode, where `/api/me` answers `anonymous`.

Build-time (Vite): `VITE_BASE_PATH` (falls back to `APP_BASE_PATH`, then `/`), and `VITE_BUILD_STAMP` / `VITE_BUILD_SHA`, which feed the footer build stamp. All three are Dockerfile build args.

## WIP prerequisites

RC-Console is a cross-namespace administration console. It owns no data model: no terminologies, templates or namespace of its own. It works with whatever exists in the connected WIP instance. It needs a key that can see every namespace, which the wip-deploy admin/proxy key provides.

The system terminology `_ONTOLOGY_RELATIONSHIP_TYPES` populates the relationship-type dropdown in the ontology browser. A hardcoded fallback list is used if it is missing.

Optional platform modules are detected at runtime. If reporting-sync, NATS or MongoDB is absent, its page shows a "not deployed" banner instead of failing.

## Tech stack

| Concern | Choice |
|---------|--------|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 3 with the WIP palette tokens (`tailwind.config.js`), Inter |
| Icons | Lucide React |
| Data fetching | TanStack Query v5, @wip/react 0.20.0 hooks |
| WIP client | @wip/client 0.53.0 |
| Routing | React Router v7 |
| Backend | Express 5, @wip/proxy 0.5.1, tsx |
| Auth | openid-client (standalone OIDC), gateway headers otherwise |
| Infra connections | mongodb, nats (npm) |
| NL Query | @anthropic-ai/sdk |
| CSV parsing | PapaParse |
| Markdown | react-markdown, remark-gfm |
| Testing | Vitest, Testing Library (jsdom) |

The @wip/* libs are pinned to versioned, immutable tarballs (`file:libs/wip-<lib>-<version>.tgz`) checked into git. On a lib refresh, `git rm` the old tarball and `git add -f` the new one.

## Tests

```bash
npm test            # Run once
npm run test:watch  # Watch mode
npx tsc --noEmit -p tsconfig.json   # Type-check (also run by CI)
```

114 tests across 10 files in `tests/unit/`. They cover UI components, NL query tools (definitions, SQL guard, wire shapes, key handling), terminology import parsing, archive manifest/filename helpers, PostgreSQL browser filters, external-template discovery, the version-impact panel, and registered-view helpers.
