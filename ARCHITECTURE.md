# RC-Console — Architecture

## Overview

RC-Console is a single-page app with an Express backend. The React SPA never talks to WIP services directly: everything goes through Express, which holds the WIP key. The backend has four jobs: WIP API proxy, streaming helper for large or binary payloads, infrastructure connector (MongoDB, NATS), and NL query orchestrator.

```
Browser (React SPA)
    ↓
Vite dev server :5174 (dev, proxies to Express) / Express static (prod)
    ↓
Express backend :3011 — every route mounted under APP_BASE_PATH (e.g. /apps/rc)
    ├── /health, /api/health         → liveness, public, no WIP dependency
    ├── /api/app-config              → runtime client config ({namespace: null})
    ├── /auth/callback, /auth/logout → standalone OIDC flow (server/auth.ts)
    ├── /wip/*                       → @wip/proxy → WIP gateway (key injected)
    ├── /api/me                      → identity: gateway headers → OIDC session → anonymous
    ├── /api/infra/health            → per-service probes + build provenance
    ├── /api/infra/mongo/*           → direct MongoDB (server/infra/mongo.ts)
    ├── /api/infra/nats/*            → direct NATS JetStream (server/infra/nats.ts)
    ├── /api/file-content/:fileId    → streams file bytes from document-store
    ├── /api/backup-download/:jobId  → streams backup archives, rewrites the filename
    └── /api/nl/*                    → Claude agent loop with read-only WIP tools
```

In local dev, `APP_BASE_PATH` is unset and everything lives at `/`.

## Route structure

All routes are children of `AppLayout` in `src/App.tsx`. `BrowserRouter` gets `basename` from Vite's `BASE_URL`.

| Path | Page | Purpose |
|------|------|---------|
| `/` | DashboardPage | Service health + build provenance, namespace summary, activity, recent items, data quality, infra status |
| `/namespaces` | NamespacesPage | Namespace CRUD, ID config, deletion mode, per-namespace grants (GrantsPanel) |
| `/terminologies` | TerminologyListPage | Sortable list, search by value/label/UUID, import-to-new-terminology |
| `/terminologies/:id` | TerminologyDetailPage | Terms CRUD, validate, export, import-into-existing |
| `/terminologies/:tid/terms/:termId` | TermDetailPage | Overview / Relationships / Hierarchy / Raw tabs (`?tab=`) |
| `/templates` | TemplateListPage | Sortable list with usage filter (entity / reference / edge type) |
| `/templates/new` | TemplateBuilderPage | Create; `?from=<id>` duplicates an existing template |
| `/templates/:id` | TemplateDetailPage | Field inspector for one version (`?v=`), edge contract, deactivate/reactivate |
| `/templates/:id/edit` | TemplateBuilderPage | Edit (mints a new version) |
| `/documents` | DocumentListPage | Template selector incl. templates from other namespaces, header-field rows, all-templates view |
| `/documents/import` | DocumentImportPage | CSV import wizard with column mapping |
| `/documents/:templateValue/table` | DocumentTablePage | Flat table view with CSV export |
| `/documents/:templateValue/new` | DocumentFormPage (`mode="create"`) | Auto-generated form |
| `/documents/:templateValue/:id/edit` | DocumentFormPage (`mode="edit"`) | PATCH-based edit with concurrency control |
| `/documents/:templateValue/:id` | DocumentDetailPage | Hydrated references, version inspector, relationships + traversal |
| `/files` | FileListPage | Sortable file browser with orphan badges |
| `/files/:id` | FileDetailPage | Metadata + inline preview |
| `/registry` | RegistryPage | Search, browse, by-term search, entry detail |
| `/postgres` | PostgresPage | Table Browser, Views, Query Pad, Batch Sync, Parity tabs |
| `/mongodb` | MongoPage | Database → collection → document drill-down |
| `/nats` | NatsPage | Streams, consumers, ingest-gateway status |
| `/integrity` | IntegrityPage | On-demand referential integrity checks |
| `/audit-explorer` | AuditExplorerPage | Full-text entity search + reverse references |
| `/activity` | ActivityPage | Activity feed + audit log |
| `/query` | NLQueryPage | Chat-style NL query |
| `/api-keys` | APIKeysPage | API key CRUD, tiers, effective permissions, Anthropic key override |
| `/backup` | BackupRestorePage | Backup / Restore / Validate tabs |

## Component hierarchy

```
App
└── QueryClientProvider (TanStack Query)
    └── WipProvider (@wip/react, wipClient from src/lib/wip.ts)
        └── NamespaceFilterProvider (global namespace, localStorage + URL sync)
            └── BrowserRouter (basename = BASE_URL)
                └── AppLayout
                    ├── Sidebar      (flat sections: Overview/Data/Infrastructure/Health/Admin/Tools)
                    ├── TopBar       (namespace selector — disabled on /postgres, /mongodb, /nats; auth state, logout)
                    ├── Breadcrumbs  (route patterns + entity-label resolution)
                    ├── <Outlet>     (pages)
                    └── WipFooter    (@wip/react; build stamp from VITE_BUILD_STAMP / VITE_BUILD_SHA)
```

The sidebar used to be an accordion with sub-menus. It was flattened because the sub-entries either re-linked to their parent or duplicated list-page actions (+ New, Import), so every Data item now takes one click instead of two.

### Component directories

**`src/components/common/`** — shared primitives: `DataTable` (sortable, row click), `JsonViewer`, `StatusBadge`, `SearchInput` (debounced), `Pagination`, `SortSelect` (per-page sort choice, persisted in localStorage), `LoadingState` / `ErrorState` / `EmptyState`, and `FormInputs` (`TextInput`, `NumberInput`, `SelectInput`, `Toggle`, `Label`, `Section`), which the Template Builder and Document Form share.

**`src/components/layout/`** — `AppLayout`, `Sidebar`, `TopBar`, `Breadcrumbs`.

**`src/components/templates/`** — builder internals.
- Field editing: `FieldList` (draggable), `FieldSlideOut` (per-field editor), `FieldQuickAdd`.
- `RuleEditor` / `RuleList` — validation rules.
- `TemplateVersionPicker` — pinned-version choice for template references.
- `TemplateDiffView` — version diff.
- `VersionWarnings` — breaking-change warnings before save.
- `VersionImpactPanel` — after a save that mints a version: how many live documents the new version affects and whether migration is possible. Informational; it never blocks the save.

The edge-type endpoint picker (`EndpointPicker`) lives inside `TemplateBuilderPage.tsx`.

**`src/components/documents/`** — the document form: `DocumentForm` → `FieldInput` dispatcher → `TermFieldInput`, `ReferenceFieldInput`, `FileFieldInput`, `DateTimeInput`, `ArrayFieldInput`, `ObjectFieldInput`. The relationship graph: `RelationshipsPanel` (incoming/outgoing edges by edge type, via `useDocumentRelationships`), `TraversalPanel` (BFS from a seed, via `useTraverseDocuments`; the server caps depth at 10 and nodes at 1000) and `PeerHeader` (renders a peer document through its template's `header_fields`).

**`src/components/ontology/`** — `TermSearchPicker` (cross-terminology term search), `AddRelationshipSlideOut`, `HierarchyTab` (lazy trees for every relation type, not only `is_a`).

**`src/components/terminologies/`** — `ImportPanel`, shared by the list page (create-new mode) and the detail page (into-existing mode). Parsing lives in `src/lib/terminology-import.ts`. Formats: IMPORT_FORMATS.md.

**`src/components/reporting/`** — PostgreSQL page panels:
- `BatchSyncPanel` — namespace-scoped batch sync, force rebuild, live job list.
- `ParityPanel` — per-namespace documents-vs-reporting parity.
- `RegisteredViewsPanel` — the Views tab: list, detail with row preview, create/replace editor with Test, delete, "Open in Query Pad".

**`src/components/grants/`** — `GrantsPanel` (namespace grants, on NamespacesPage) and `KeyEffectivePermissions` (on APIKeysPage).

**`src/components/settings/`** — `AnthropicKeyCard`: view, set and clear the in-memory Anthropic key override.

The PostgreSQL page itself (`src/pages/PostgresPage.tsx`) contains `TableBrowser` (entity-first inventory, filters in the URL: `ns`, `find`, `vers`, `empty`, `kind`), `TableDetail` (columns + paginated rows + CSV) and `QueryPad`. `PostgresPage` holds a "pad seed" so other tabs can open the Query Pad pre-filled. The Views tab does this. The seed's id remounts the pad.

`BackupRestorePage` has three tabs.
- **Backup:** single namespace, multi-namespace fan-out, or one combined archive.
- **Restore:** reads the archive's `manifest.json` in the browser (`src/lib/archive-version.ts`) without loading the whole zip, previews, then runs restore / fresh / merge. Fresh restores take a namespace map.
- **Validate:** namespace integrity.

A shared `JobsList` polls async jobs.

## Data flow

### WIP entity data — @wip/react hooks

Most data flows hook → client → Express proxy → WIP:

```
useTerminologies()  →  wipClient.defStore.listTerminologies()
                    →  fetch(`${BASE_URL}wip/api/def-store/terminologies`)
                    →  Express @wip/proxy (injects X-API-Key)
                    →  WIP gateway
```

`src/lib/wip.ts` builds the client with `baseUrl: ${basePath}/wip` and no auth; the proxy adds the key. `apiUrl()` prefixes the base path for every non-client `fetch`.

### Direct typed-client calls

Where @wip/react has no hook yet, or its hook drops a newer option, components call `useWipClient()` and wrap the call in their own `useQuery` / `useMutation`. Examples:
- `BatchSyncPanel`: the 0.19-era trigger hooks dropped the `namespace` option.
- `ImportPanel`: `importTerminology` / `importOntology` / `createTerms`.
- `use-registered-views.ts`: `registerView` / `listViews` / `deleteView`. There is no instance-wide listing, so it fans out one `listViews` per live namespace with `useQueries` and shows any namespace that fails.
- `use-external-templates.ts`: template facets.

### Reporting reads

All SQL in `src/hooks/use-reporting.ts` (table columns/preview/paging, the Query Pad, view tests and previews) goes through the typed `client.reporting.runQuery` (`runReportQuery` helper). Rows come back as objects keyed by column, and `columns` is populated even for an empty result (@wip/client 0.54.0 / CASE-861). The column lookup passes schema and table names as query parameters rather than interpolating them. `/tables` and `/parity` are still read with plain `fetch` (`fetchJson`). `/parity` has no typed client method; `/tables` could move to `client.reporting.listTables()` (which returns the same `tables` + `entities` shape) — not done yet, RC's local `ReportTable`/`ReportEntity` types would need reconciling with the client's.

### Document CRUD

- **Create:** `useCreateDocument()` → POST. Identity fields decide create vs new version (upsert).
- **Edit:** `useUpdateDocument()` → PATCH with an RFC 7396 merge patch and `ifMatch` = loaded version. Identity fields are read-only in the form, because the server rejects their change.
- **Archive:** `useArchiveDocument()`. Soft delete.

The detail page hydrates term and document references through parallel `useQueries`. Its version inspector loads historical versions (`useDocumentVersions`) and diffs them against the current one.

### Infrastructure data

MongoDB and NATS have no WIP REST surface, so Express connects directly and read-only:

```
useMongoDatabases()  →  fetch(apiUrl('/api/infra/mongo/databases'))  →  mongoRouter  →  MongoClient
useNatsStreams()     →  fetch(apiUrl('/api/infra/nats/streams'))     →  natsRouter   →  JetStream
```

`/api/infra/health` probes each WIP service through the gateway and reads the `build` block from services that expose one. `useIsServiceInactive(slug)` turns a missing module into a "not deployed" banner (PostgreSQL, Dashboard); NATS detects its own connection failure.

### Files and backups

Two Express routes exist because the proxy can't do these jobs:
- `/api/file-content/:fileId` streams from document-store's `/content`, because presigned MinIO URLs name a host the browser can't reach.
- `/api/backup-download/:jobId` streams the archive and rewrites `Content-Disposition` to `<namespace>_<timestamp>.zip`, which the browser's `download` attribute can't override.

Restore uploads go through @wip/proxy, which streams since 0.5.0.

### NL query

```
NLQueryPage → POST /api/nl/query
  → Claude (model NL_QUERY_MODEL, default claude-sonnet-4-6) with 8 read-only tools (server/nl/tools.ts)
  → tool_use → Express runs the tool against WIP REST → tool_result → …
  → stops at a text answer or after 10 tool rounds
  → answer + tool-call log back to the page
```

Tools:
- `search`
- `query_by_template`
- `run_report_query` (SELECT/WITH only)
- `list_report_tables`
- `list_registered_views`
- `get_document`
- `list_terms`
- `describe_data_model`

They talk to WIP's actual wire shapes, which lack test coverage elsewhere, so `tests/unit/nl-tools.test.ts` pins them:
- List endpoints return `{items}` with `terminology_id` / `template_id`, paginate with `page_size` (WIP silently ignores `limit`), and `describe_data_model` passes `latest_only=true`.
- `/documents/query` takes `template_id` (a value resolves within `?namespace=`), `page`/`page_size`, and `filters: [{field: 'data.<name>', operator, value}]`. That's why `query_by_template` requires `namespace`.
- `list_registered_views` fans out across namespaces when none is given, because `/tables` does not include views.

The Anthropic key resolves from the in-memory override (set via the admin-only `POST /api/nl/anthropic-key`), then `ANTHROPIC_API_KEY` (`server/nl/anthropic-key.ts`). Status endpoints return only configured/source/last-4, never the key.

## State management

| State type | Location | Why |
|-----------|----------|-----|
| WIP entity data | TanStack Query cache | Caching, stale-while-revalidate, invalidation after mutations |
| Infra + reporting data | TanStack Query cache | Custom hooks wrap `fetch` |
| Registered views | TanStack Query, one query per namespace | Saving or deleting invalidates that namespace's listing and all cached row previews, because a replaced view keeps its name |
| Document / template form state | Component `useState` | No form library; the builder established the pattern |
| Document dirty tracking | Ref compared to initial | Save button + navigation guard |
| NL chat history | Component state (`useNLQuery`) | Session-only; answers may be sensitive |
| Global namespace filter | Context + localStorage (`rc-console:namespace-filter`), synced from URL | Survives reloads |
| List sort choice | localStorage per page (`SortSelect`) | Server-side sorting; remembered per list |
| Last-used document template | localStorage (`rc-console:last-template`, keyed by namespace) | Auto-recall |
| SQL query history | localStorage (`rc-console:pg-query-history`) | Non-sensitive, persistent |
| Dashboard health collapsed | localStorage | UI preference |
| Table Browser filters | URL params (`ns`, `find`, `vers`, `empty`, `kind`) | Shareable, survives reload |
| Term detail tab / template version | URL params (`?tab=`, `?v=`) | Deep-linkable |
| Auth | Gateway headers or Express session; `useAuth` reads `/api/me` | Server owns identity |
| Anthropic key override | Server process memory | Never persisted; lost on restart by design |

## Key decisions

### Why @wip/proxy instead of client-side WIP calls
The WIP key must never reach the browser. @wip/proxy runs in Express and injects it on every `/wip/*` request; the client is created without auth. Body parsing is skipped for `/wip`, because the proxy forwards request bodies as raw streams (since 0.5.0), so `express.json()` must not drain them first (`server/index.ts`).

### Why one key resolver
The proxy and the direct callers (infra health, file and backup streaming, NL tools) must agree on which key they send. `server/wip-key.ts` mirrors @wip/proxy's precedence: the readable `WIP_API_KEY_FILE` first, then `WIP_API_KEY`. The fallback matters because `--app-source` mounts the repo, so `dotenv` loads the host `.env` inside the container, where the key-file path doesn't exist. The deployer injects `WIP_API_KEY` there instead.

### Why direct MongoDB/NATS connections
WIP has no REST endpoints for collection stats, indexes or stream monitoring. Express connects directly, read-only.

### Why a single Express server
One container, one port. In dev, Vite proxies to Express; in production, Express serves `dist/` with an SPA fallback.

### Why APP_BASE_PATH (path prefix not stripped)
Behind the WIP router at `/apps/rc`, the prefix is not stripped. Express mounts every route under `APP_BASE_PATH`, Vite's `base` comes from `VITE_BASE_PATH || APP_BASE_PATH`, and the client and every `fetch` use `BASE_URL`. Cookies, OIDC redirects, logout's `return_to` and client routing then agree without path rewriting.

### Why per-namespace reporting schemas show up everywhere
Since CASE-628, each namespace has its own PostgreSQL schema, and the same table name can exist in several. The Table Browser groups by namespace and uses the server's `qualified_name`. Column lookups filter on `table_schema`. The Query Pad and CSV export pass `namespace`. The NL prompt tells the agent to either pass `namespace` or schema-qualify.

### Why registered views get their own tab
Registered views are not in `GET /tables`, and the list API is per namespace only. A separate panel lists them by fanning out across namespaces. Views registered by something other than this console show an ownership note: apps re-register their views on every bootstrap, so edits made here would be overwritten. Saves stamp `registered_by` as `rc-console:<user>`.

### Why edge endpoints are read via `lookup_value`
Since CASE-830, an edge type's `source_templates` / `target_templates` are `{lookup_value, resolved}` entries. RC displays and edits the `lookup_value` half, which is the anchor as submitted and also a valid write input. `resolved` is still null on edge types created before that change (CASE-858). The builder's endpoint picker lists only the edge type's own namespace, entity and reference templates alike, because an edge's endpoints must resolve there. Selected endpoints that don't match are shown ticked with a "not in <ns>" note rather than silently counted.

### Why documents list templates from other namespaces
A document's namespace is independent of its template's. `GET /templates?namespace=A` misses templates owned elsewhere, so `use-external-templates.ts` asks the template-facets endpoint which templates this namespace's documents actually use.

### Why versioned, immutable lib tarballs
`package.json` pins `file:libs/wip-<lib>-<version>.tgz`, and the tarballs are committed. The same filename always means the same bytes, so lockfile integrity hashes stay valid and CI can build images from git alone. On a refresh, `git rm` the old tarball and `git add -f` the new one. Container smoke after a lib bump is load-bearing. Proxy 0.4.1 crashed at mount under Express 5 (CASE-637), and neither tsc nor vitest could see it.

### Why PATCH for document editing
RFC 7396 merge patch matches "user changed some fields": smaller payloads, a cleaner audit trail, optimistic concurrency via `ifMatch`. POST/upsert is only used for creation.

### Why shared FormInputs and plain useState
The builder and the document form use the same primitives, so they look the same by construction. A form library would break the established `useState` pattern without paying for itself.

### Why react-markdown for NL Query
Claude answers in markdown; react-markdown + remark-gfm render tables, lists and code without a custom renderer.

### Why Vite port 5174
5173 is taken by other constellation apps' dev servers (the deployable-app contract lists KB on 5173). RC stays on 5174, which the WIP manifest declares as its `dev` port.

## Server directory structure

```
server/
├── index.ts          # Express entry: session, auth gate, /wip proxy, infra health,
│                     #   file + backup streaming, /api/me, static/SPA, APP_BASE_PATH mount
├── auth.ts           # Standalone OIDC (openid-client), group gate, requireAdmin
├── wip-key.ts        # Shared WIP key resolution (file first, inline fallback)
├── infra/
│   ├── mongo.ts      # Read-only MongoDB routes
│   └── nats.ts       # Read-only NATS JetStream routes
└── nl/
    ├── query.ts      # /api/nl: agent loop, system prompt, key status/override endpoints
    ├── tools.ts      # 8 read-only WIP tool definitions + execution
    └── anthropic-key.ts  # Override → env key resolution, masked status
```

## Frontend directory structure

```
src/
├── App.tsx                 # Providers + routes
├── lib/
│   ├── wip.ts              # WipClient singleton, basePath, apiUrl()
│   ├── cn.ts               # Tailwind class merge
│   ├── terminology-import.ts  # OBO text parser, CSV → terms, bulk summaries
│   ├── archive-version.ts  # In-browser archive manifest reader
│   ├── reporting-types.ts  # cross_version_view editor helpers
│   └── registered-views.ts # View SQL helpers, ownership, filtering
├── hooks/                  # use-auth, use-namespace-filter, use-reporting,
│                           # use-registered-views, use-external-templates,
│                           # use-template-versions, use-service-health,
│                           # use-namespace-stats, use-mongo, use-nats, use-nl-query
├── components/             # common, layout, templates, documents, ontology,
│                           # terminologies, reporting, grants, settings
└── pages/                  # 25 page components
```
