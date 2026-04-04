# RC-Console — Architecture

## Overview

RC-Console is a single-page app with an Express backend. The frontend is a React SPA that communicates with WIP exclusively through the Express backend (never directly to WIP services). The backend serves three roles: WIP API proxy, infrastructure connector, and NL query orchestrator.

```
Browser (React SPA)
    ↓
Vite dev proxy (dev) / Express static (prod)
    ↓
Express Backend (port 3010)
    ├── /wip/*        → @wip/proxy → WIP Caddy (:8443)
    ├── /api/infra/*  → Direct MongoDB/NATS connections
    ├── /api/nl/*     → Claude API with WIP tool calls
    ├── /api/me       → User info from session
    ├── /health       → Health check
    └── /auth/*       → OIDC flow with Dex
```

## Route structure

| Path | Page | Purpose |
|------|------|---------|
| `/` | DashboardPage | Service health, namespace stats, activity feed |
| `/namespaces` | NamespacesPage | Namespace CRUD with stats |
| `/terminologies` | TerminologyListPage | Browse/filter terminologies |
| `/terminologies/:id` | TerminologyDetailPage | Term management, search, pagination |
| `/templates` | TemplateListPage | Browse/filter templates |
| `/templates/:id` | TemplateDetailPage | Field inspector, cross-links |
| `/documents` | DocumentListPage | Template selector → document table |
| `/documents/:templateValue/:id` | DocumentDetailPage | Field display, JSON viewer, versions |
| `/files` | FileListPage | Paginated file browser |
| `/registry` | RegistryPage | Search + entry detail JSON viewer |
| `/postgres` | PostgresPage | Table browser + SQL query pad |
| `/mongodb` | MongoPage | Database → collection → document drill-down |
| `/nats` | NatsPage | Stream cards with consumer details |
| `/integrity` | IntegrityPage | On-demand integrity checks |
| `/activity` | ActivityPage | Audit trail timeline |
| `/query` | NLQueryPage | Chat-style NL query interface |

## Component hierarchy

```
App
├── QueryClientProvider (TanStack Query)
│   └── WipProvider (@wip/react)
│       └── BrowserRouter
│           └── AppLayout
│               ├── Sidebar (collapsible, dark, 5 nav sections)
│               ├── TopBar (home link, user info, auth state)
│               └── <Outlet> (page content)
│                   └── [Page components]
```

### Common components (src/components/common/)

- **DataTable** — Sortable table with column-click sorting (asc/desc/none), truncation, row click handler
- **JsonViewer** — Collapsible JSON tree with syntax highlighting, copy-to-clipboard, depth-based auto-collapse
- **StatusBadge** — Status dot + label (healthy/error/warning/active/inactive)
- **SearchInput** — Debounced text input with clear button
- **Pagination** — Prev/next with page count display
- **LoadingState** — Spinner with label
- **ErrorState** — Error message with retry button
- **EmptyState** — Placeholder with icon and message

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
| NL chat history | Component state (useNLQuery hook) | Session-only, not persisted (sensitive data) |
| Sidebar collapsed | Component state | UI-only, resets on reload |
| Auth state | Express session + useAuth hook | Server-side session, frontend polls /api/me |
| SQL query history | localStorage | Persists across sessions (non-sensitive) |

## Key decisions

### Why @wip/proxy instead of direct client-side WIP calls
The API key must not be in the browser. @wip/proxy runs Express-side and injects the key on every request. The frontend uses `auth: { type: 'none' }` and lets the proxy handle it.

### Why direct MongoDB/NATS connections
WIP has no REST endpoints for collection stats, index info, or stream monitoring. The Express backend connects directly (read-only) for infrastructure visibility.

### Why a single Express server (not separate API + static)
Simpler deployment. One container, one port. In dev, Vite proxies to Express. In prod, Express serves both the API and the built frontend.

### Why no shadcn/ui
The original DESIGN.md specified shadcn/ui, but Tailwind utility classes proved sufficient for all components. The components are simple enough that a UI library would be overhead. Can be added later if forms get complex.

### Why react-markdown for NL Query
The Claude API returns markdown-formatted responses. react-markdown + remark-gfm handles tables, code blocks, bold text, and lists without a custom renderer.

## Server directory structure

```
server/
├── index.ts          # Express entry, routes, static serving
├── auth.ts           # OIDC middleware (Dex, PKCE, sessions)
├── infra/
│   ├── mongo.ts      # Direct MongoDB routes (4 WIP databases)
│   └── nats.ts       # Direct NATS JetStream routes
└── nl/
    ├── query.ts      # NL query endpoint (Claude API orchestration)
    └── tools.ts      # 7 WIP tool definitions + execution
```
