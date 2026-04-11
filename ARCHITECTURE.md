# RC-Console — Architecture

## Overview

RC-Console is a single-page app with an Express backend. The frontend is a React SPA that communicates with WIP exclusively through the Express backend (never directly to WIP services). The backend serves three roles: WIP API proxy, infrastructure connector, and NL query orchestrator.

```
Browser (React SPA)
    ↓
Vite dev proxy (dev) / Express static (prod)
    ↓
Express Backend (port 3011)
    ├── /wip/*        → @wip/proxy → WIP Caddy (:8443)
    ├── /api/infra/*  → Direct MongoDB/NATS connections
    ├── /api/nl/*     → Claude API with WIP tool calls
    ├── /api/backup/* → Streaming download proxy for large backup archives
    ├── /api/me       → User info from session
    ├── /health       → Health check
    └── /auth/*       → OIDC flow with Dex

All routes mount under APP_BASE_PATH when set (e.g. `/apps/rc`). In local dev, APP_BASE_PATH defaults to `/`.
```

## Route structure

| Path | Page | Purpose |
|------|------|---------|
| `/` | DashboardPage | Service health, namespace stats, activity feed |
| `/namespaces` | NamespacesPage | Namespace CRUD with stats |
| `/terminologies` | TerminologyListPage | Browse/filter terminologies |
| `/terminologies/:id` | TerminologyDetailPage | Term management, search, pagination |
| `/terminologies/:tid/terms/:termId` | TermDetailPage | Term detail with Overview/Relationships/Hierarchy/Raw tabs |
| `/templates` | TemplateListPage | Browse/filter templates |
| `/templates/new` | TemplateBuilderPage | Create new template |
| `/templates/:id` | TemplateDetailPage | Field inspector, cross-links |
| `/templates/:id/edit` | TemplateBuilderPage | Edit existing template |
| `/documents` | DocumentListPage | Template selector → document table, all-templates view |
| `/documents/import` | DocumentImportPage | CSV import wizard with column mapping |
| `/documents/:templateValue/table` | DocumentTablePage | Flat table view with CSV export |
| `/documents/:templateValue/new` | DocumentFormPage | Create document (auto-generated form from template) |
| `/documents/:templateValue/:id` | DocumentDetailPage | Document detail with hydrated references, validate button |
| `/documents/:templateValue/:id/edit` | DocumentFormPage | Edit document (PATCH-based with concurrency control) |
| `/files` | FileListPage | Paginated file browser |
| `/files/:id` | FileDetailPage | File metadata + download |
| `/registry` | RegistryPage | Search + entry detail JSON viewer |
| `/postgres` | PostgresPage | Table browser + SQL query pad |
| `/mongodb` | MongoPage | Database → collection → document drill-down |
| `/nats` | NatsPage | Stream cards with consumer details |
| `/integrity` | IntegrityPage | On-demand integrity checks |
| `/audit-explorer` | AuditExplorerPage | Entity search with reverse reference inspection |
| `/activity` | ActivityPage | Audit trail timeline |
| `/query` | NLQueryPage | Chat-style NL query interface |
| `/api-keys` | APIKeysPage | API key management (create, revoke, view grants) |
| `/backup` | BackupRestorePage | Namespace backup/restore with async job tracking |

## Component hierarchy

```
App
├── QueryClientProvider (TanStack Query)
│   └── WipProvider (@wip/react)
│       └── NamespaceFilterProvider
│           └── BrowserRouter
│               └── AppLayout
│                   ├── Sidebar (collapsible, dark, hierarchical sub-menus)
│                   ├── TopBar (home link, namespace selector, auth state)
│                   ├── Breadcrumbs (pattern-matched, entity-label-resolving)
│                   └── <Outlet> (page content)
│                       └── [Page components]
```

### Component directories

**`src/components/common/`** — shared UI primitives
- **DataTable** — sortable columns, truncation, row click
- **JsonViewer** — collapsible JSON tree with syntax highlighting
- **StatusBadge** — status dot + label
- **SearchInput** — debounced text input with clear button
- **Pagination** — prev/next with page count
- **LoadingState** / **ErrorState** / **EmptyState** — standard states
- **FormInputs** — shared form primitives (`TextInput`, `NumberInput`, `SelectInput`, `Toggle`, `Label`, `Section`). Used by both the Template Builder and Document Form for visual consistency.

**`src/components/layout/`** — app shell
- **AppLayout** — sidebar + topbar + breadcrumbs + outlet
- **Sidebar** — collapsible dark nav with hierarchical sub-menus
- **TopBar** — home link, global namespace selector (localStorage-persisted), auth state
- **Breadcrumbs** — pattern-matched route crumbs with entity-label resolution via `useTerminology`, `useTerm`, `useTemplate` hooks

**`src/components/templates/`** — template builder internals
- **FieldSlideOut** — field editor panel (type, validation, config)
- **FieldList** — draggable field list with selection
- **FieldQuickAdd** — quick add field button
- **RuleEditor** / **RuleList** — validation rule editing
- **TemplateDiffView** — side-by-side version diff
- **VersionWarnings** — activation/breaking-change warnings

**`src/components/ontology/`** — term detail internals
- **TermSearchPicker** — cross-terminology/namespace term search with hydration. Used by Add Relationship slide-out and TermFieldInput.
- **AddRelationshipSlideOut** — right-side panel for adding relationships (direction toggle, type dropdown, term picker)
- **HierarchyTab** — lazy-expanding ancestor/descendant trees via `getParents`/`getChildren` with per-term hydration

**`src/components/documents/`** — document form internals
- **DocumentForm** — renders template fields as a form, dispatches to per-type inputs
- **FieldInput** — dispatcher component, selects the right widget per `field.type`
- **TermFieldInput** — searchable combobox scoped to a terminology (`useTerms`)
- **ReferenceFieldInput** — polymorphic picker for document/term/terminology/template references
- **FileFieldInput** — drag-drop zone + `useUploadFile`, stores `file_id`
- **DateTimeInput** — wraps `<input type="date">` / `<input type="datetime-local">`
- **ArrayFieldInput** — add/remove + recursive `FieldInput` per item
- **ObjectFieldInput** — textarea + JSON.parse validation

## Data flow

### WIP entity data
All WIP data flows through @wip/react hooks → @wip/client → Express proxy → WIP Caddy:

```
useTerminologies()  →  wipClient.defStore.listTerminologies()
                    →  fetch('/wip/api/def-store/terminologies')
                    →  Express @wip/proxy
                    →  WIP Caddy :8443
```

The frontend never talks directly to WIP. The proxy injects the API key server-side.

### Document CRUD data flow

**Create:** `useCreateDocument()` → `client.documents.createDocument(data)` → POST to WIP. Template identity fields determine whether this creates a new document or a new version of an existing one (identity upsert).

**Edit:** `useUpdateDocument()` → `client.documents.updateDocument(id, patch, { ifMatch })` → PATCH to WIP. RFC 7396 JSON Merge Patch applied to the document's `data` field. Optimistic concurrency via `ifMatch` (loaded version number). Identity fields are immutable via PATCH — the form renders them read-only.

**Archive:** `useArchiveDocument()` → `client.documents.archiveDocument(id)` → sets `status: 'inactive'`. Soft delete — the record remains in the database.

### Reference hydration
Term references and document references in DocumentDetailPage are hydrated via parallel `useQueries` calls (`client.defStore.getTerm` / `client.documents.getDocument`). Each reference resolves to a clickable link with a human-readable label. Same pattern used in the ontology Hierarchy tab.

### Infrastructure data
MongoDB and NATS have no WIP REST endpoints. Express connects directly:

```
useMongoDatabases()  →  fetch('/api/infra/mongo/databases')
                     →  Express mongoRouter
                     →  MongoClient (mongodb npm)
```

PostgreSQL goes through WIP's reporting-sync:

```
useRunQuery()  →  fetch('/wip/api/reporting-sync/query')
               →  Express @wip/proxy
               →  WIP reporting-sync service
```

### NL Query data
The NL query is a multi-round agentic loop:

```
Frontend (question)
  → POST /api/nl/query
  → Express calls Claude API with tools
  → Claude returns tool_use → Express executes tool against WIP REST API
  → Loop until Claude returns text answer
  → Response to frontend (answer + tool call log)
```

## State management

| State type | Location | Why |
|-----------|----------|-----|
| WIP entity data | TanStack Query cache | Automatic caching, stale-while-revalidate, refetch |
| Infrastructure data | TanStack Query cache | Same — custom hooks wrap fetch calls |
| Document form state | Component state (useState) | Matches Template Builder pattern; no form library |
| Document dirty tracking | Ref-based (compare to initial) | Enables save button + nav guard |
| NL chat history | Component state (useNLQuery hook) | Session-only, not persisted (sensitive data) |
| Sidebar collapsed | Component state | UI-only, resets on reload |
| Global namespace filter | Context + localStorage | Persists across sessions, synced from URL params |
| Auth state | Express session + useAuth hook | Server-side session, frontend polls /api/me |
| SQL query history | localStorage | Persists across sessions (non-sensitive) |
| Last-used template (documents) | localStorage (keyed by namespace) | Auto-recall on revisit |
| Tab state (term detail) | URL search params (`?tab=`) | Deep-linkable |

## Key decisions

### Why @wip/proxy instead of direct client-side WIP calls
The API key must not be in the browser. @wip/proxy runs Express-side and injects the key on every request. The frontend uses `auth: { type: 'none' }` and lets the proxy handle it.

### Why direct MongoDB/NATS connections
WIP has no REST endpoints for collection stats, index info, or stream monitoring. The Express backend connects directly (read-only) for infrastructure visibility.

### Why a single Express server (not separate API + static)
Simpler deployment. One container, one port. In dev, Vite proxies to Express. In prod, Express serves both the API and the built frontend.

### Why no shadcn/ui
The original DESIGN.md specified shadcn/ui, but Tailwind utility classes proved sufficient for all components. Shared form primitives live in `FormInputs.tsx` and are reused by both the Template Builder and Document Form, ensuring visual consistency without a UI library.

### Why PATCH for document editing (not POST/upsert)
WIP 0.11.0 added RFC 7396 JSON Merge Patch for documents. PATCH is semantically correct for "user changes some fields": smaller payloads, cleaner audit trail, optimistic concurrency via `ifMatch`. Identity fields are immutable via PATCH — server enforces this with `identity_field_change` error. POST/upsert is used only for document creation.

### Why shared FormInputs instead of per-page primitives
`TextInput`, `NumberInput`, `SelectInput`, `Toggle`, `Label`, and `Section` were originally defined locally in `FieldSlideOut.tsx` (Template Builder). Extracting them to `FormInputs.tsx` ensures the Document Form uses identical primitives — same fonts, spacing, borders, focus rings. This makes "feels like the Template Builder" a structural guarantee, not a styling coincidence.

### Why useState for document forms (not react-hook-form)
The Template Builder uses plain `useState` for form state. Introducing a form library just for documents would break the pattern and add a dependency. The form complexity is manageable with useState + a dirty-tracking ref.

### Why react-markdown for NL Query
The Claude API returns markdown-formatted responses. react-markdown + remark-gfm handles tables, code blocks, bold text, and lists without a custom renderer.

### Why APP_BASE_PATH (Option 2 for reverse proxy)
When deployed behind Caddy at a sub-path (e.g. `/apps/rc`), the proxy does NOT strip the prefix. Instead, the app mounts all Express routes and Vite's `base` under `APP_BASE_PATH`. This keeps cookies, OIDC redirects, and client-side routing aligned without path rewriting. The Dockerfile accepts `VITE_BASE_PATH` as a build arg for the frontend base.

### Why Vite port 5174
Port 5173 is taken by WIP-AA (the existing Vue console). RC-Console uses 5174 to avoid conflicts during development.

## Server directory structure

```
server/
├── index.ts          # Express entry, routes, static serving, backup streaming proxy, APP_BASE_PATH
├── auth.ts           # OIDC middleware (Dex, PKCE, sessions, state param)
├── infra/
│   ├── mongo.ts      # Direct MongoDB routes (4 WIP databases)
│   └── nats.ts       # Direct NATS JetStream routes
└── nl/
    ├── query.ts      # NL query endpoint (Claude API orchestration)
    └── tools.ts      # 7 WIP tool definitions + execution
```

## Frontend directory structure

```
src/
├── App.tsx                    # Routes + providers
├── lib/
│   ├── cn.ts                  # Tailwind class merge utility
│   └── wip.ts                 # WipClient singleton
├── hooks/
│   └── use-namespace-filter.ts  # Global namespace context + sync
├── components/
│   ├── common/                # Shared UI primitives (8 components)
│   ├── layout/                # App shell (4 components)
│   ├── templates/             # Template builder internals (6 components)
│   ├── ontology/              # Term detail internals (3 components)
│   └── documents/             # Document form internals (8 components)
└── pages/                     # 25 page components
```
