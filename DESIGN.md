# RC-Console — Design & Implementation Plan

## What This App Is

RC-Console is the **React replacement for WIP's Vue 3 admin console** (`World-in-a-Pie/ui/wip-console/`). It is NOT a domain app that stores data in WIP — it inspects and manages WIP itself. There is no data model to design (Phases 2-3 are skipped).

The existing Vue console (PrimeVue + Pinia + Vue Router) has 24 views covering namespaces, terminologies, templates, documents, files, registry, and audit. RC-Console must match or exceed that, plus add infrastructure visibility (PostgreSQL, MongoDB, NATS) and a natural language query interface.

## Identity

- **App name:** `rc-console`
- **Gateway path:** `/apps/rc-console`
- **Internal port:** 3010
- **Git remote:** `http://gitea.local:3000/peter/WIP-APP-RC.git`
- **Dev namespace:** `dev-wip-reactconsole` (exists, empty — not used for data modeling since this app doesn't store domain data)

## Tech Stack

| Concern | Choice |
|---------|--------|
| UI Framework | React 18+ with TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Component library | shadcn/ui (Radix primitives) |
| Icons | Lucide React |
| Data fetching | TanStack Query v5 |
| Routing | React Router v6+ |
| Charts | Recharts |
| WIP client | @wip/client, @wip/react, @wip/proxy (from libs/*.tgz) |
| Backend | Express (TypeScript via tsx) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (React SPA)                            │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ WIP     │ │ Infra    │ │ NL Query Chat    │ │
│  │ Entity  │ │ Views    │ │ (sends questions │ │
│  │ Views   │ │ (PG/Mongo│ │  to Express)     │ │
│  │         │ │  /NATS)  │ │                  │ │
│  └────┬────┘ └────┬─────┘ └───────┬──────────┘ │
│       │           │               │             │
└───────┼───────────┼───────────────┼─────────────┘
        │           │               │
   Vite dev proxy (all → Express backend)
        │           │               │
┌───────┴───────────┴───────────────┴─────────────┐
│  Express Backend (port 3010)                     │
│                                                  │
│  ┌────────────┐  ┌────────────────────────────┐ │
│  │ @wip/proxy │  │ Custom routes:             │ │
│  │ /wip/*     │  │  POST /api/infra/pg/query  │ │
│  │ (proxies   │  │  GET  /api/infra/pg/tables │ │
│  │  to Caddy  │  │  GET  /api/infra/mongo/dbs │ │
│  │  at :8443) │  │  GET  /api/infra/mongo/    │ │
│  │            │  │       collections/:db      │ │
│  │            │  │  GET  /api/infra/mongo/    │ │
│  │            │  │       docs/:db/:coll       │ │
│  │            │  │  GET  /api/infra/nats/     │ │
│  │            │  │       streams              │ │
│  │            │  │  GET  /api/infra/nats/     │ │
│  │            │  │       consumers            │ │
│  │            │  │  POST /api/nl/query        │ │
│  │            │  │  GET  /health              │ │
│  └────────────┘  └────────────────────────────┘ │
│                                                  │
│  Direct connections:                             │
│  - MongoDB:    mongodb://localhost:27017/         │
│  - NATS:       nats://localhost:4222             │
│  - PostgreSQL: via reporting-sync REST API       │
│    (POST /api/reporting-sync/query — already     │
│     exists, no direct PG connection needed)      │
│                                                  │
│  NL Query: calls Claude API with                 │
│  query-assistant-prompt + WIP tool calls         │
└──────────────────────────────────────────────────┘
```

### Why this architecture

1. **@wip/proxy handles all WIP API calls** — terminologies, templates, documents, registry, reporting. The React frontend uses `@wip/client` with `baseUrl: '/wip'` and `auth: { type: 'none' }` (proxy injects the API key server-side).

2. **Custom Express routes for infrastructure** — MongoDB and NATS have no existing REST endpoints in WIP. The Express backend connects directly (read-only) and exposes them as JSON APIs.

3. **PostgreSQL inspection uses the existing reporting-sync endpoint** — `POST /api/reporting-sync/query` already accepts SQL (SELECT only) and returns results. No direct PG connection needed. The proxy forwards these calls like any other WIP API call.

4. **NL Query** — the Express backend receives natural language questions, calls the Claude API with the query-assistant system prompt, and uses WIP's REST APIs as "tools" to answer. Returns formatted responses to the frontend.

## Authentication

Two modes, same as the existing Vue console:

1. **OIDC (Dex)** — primary. Browser redirect flow via `oidc-client-ts`. The Express backend receives the Bearer token and forwards it to WIP services.
2. **API Key** — fallback for development. Configured in `.env`, injected by `@wip/proxy`.

For the admin console, the API key should be in the `wip-admins` group (full access to all namespaces).

### Auth gotchas (from BE-YAC CASE-09 response)
- OIDC issuer URL must match in exactly 3 places (see `docs/network-configuration.md` in WIP repo)
- Non-privileged API keys MUST have a `namespaces` field or get 403
- CORS: add `http://localhost:5173` (Vite dev) to WIP's `CORS_ORIGINS` env var
- TLS: `NODE_TLS_REJECT_UNAUTHORIZED=0` in dev Express script only

## Pages & Routes

### Sidebar Navigation

```
OVERVIEW
  Dashboard          /

DATA
  Namespaces         /namespaces
  Terminologies      /terminologies
  Templates          /templates
  Documents          /documents
  Files              /files
  Registry           /registry

INFRASTRUCTURE
  PostgreSQL         /postgres
  MongoDB            /mongodb
  NATS               /nats

HEALTH
  Integrity          /integrity
  Activity           /activity

TOOLS
  NL Query           /query
```

### Page Specifications

#### 1. Dashboard (`/`)
**Purpose:** At-a-glance system health and data overview.
**Layout:** Grid of cards.
**Content:**
- **Service health cards** (6): registry, def-store, template-store, document-store, reporting-sync, ingest-gateway. Each shows: status (healthy/unhealthy), response time. Data source: `GET /api/{service}/health` for each.
- **Namespace summary cards**: For each non-ptest namespace, show entity counts (terminologies, templates, documents). Data source: `@wip/react` `useNamespaces()` + per-namespace stats.
- **Recent activity feed**: Last 20 actions across all namespaces. Data source: `useActivity()`.
- **System info**: MongoDB connection status, NATS stream count, PostgreSQL table count.

#### 2. Namespaces (`/namespaces`)
**Purpose:** Create, browse, configure namespaces.
**Layout:** Table with expandable rows.
**Content:**
- Table columns: prefix, description, isolation mode, entity counts, created date
- Actions: create namespace, edit description/isolation mode, view stats, archive
- Expandable row shows: ID generation config, permission grants, allowed external refs
- Data source: `useNamespaces()`, `client.registry.getNamespaceStats()`

#### 3. Terminologies (`/terminologies`)
**Purpose:** Browse and manage controlled vocabularies.
**Layout:** Master-detail (list left, detail right or routed).
**Sub-routes:**
- `/terminologies` — list view (filterable by namespace, status, search)
- `/terminologies/:id` — detail view (terminology metadata + terms list)
- `/terminologies/:id/terms/:termId` — term detail
- `/terminologies/:id/ontology` — ontology relationship browser (graph viz)
- `/terminologies/import` — bulk import (JSON/CSV)
- `/terminologies/validate` — term value validator

**Content:**
- List: value, label, namespace, term count, status. Filterable/searchable.
- Detail: metadata, term list with search/pagination, create/edit terms, import/export.
- Ontology: Cytoscape.js or similar graph visualization for term relationships.
- Data source: `useTerminologies()`, `useTerms()`, `useTerm()`, etc.

#### 4. Templates (`/templates`)
**Purpose:** Browse and manage document schemas.
**Sub-routes:**
- `/templates` — list (filterable by namespace, status)
- `/templates/:id` — detail (field definitions, identity fields, validation rules, versions)

**Content:**
- List: value, label, namespace, version, field count, status.
- Detail: field table (name, type, mandatory, terminology ref), identity fields highlighted, validation rules, version history, dependency graph (what terminologies/templates this references), preview with sample data.
- Data source: `useTemplates()`, `useTemplate()`, `useTemplateByValue()`

#### 5. Documents (`/documents`)
**Purpose:** Browse, query, create documents.
**Sub-routes:**
- `/documents` — template selector, then document list
- `/documents/:templateValue` — filtered document list for a template
- `/documents/:templateValue/:id` — document detail with version history
- `/documents/:templateValue/table` — spreadsheet-like table view with CSV export
- `/documents/:templateValue/import` — bulk import (CSV/XLSX)

**Content:**
- Template selector: cards or dropdown showing all templates with doc counts.
- Document list: filterable table showing identity fields + key data fields.
- Document detail: all fields rendered, version history, references.
- Table view: uses `getTableView()`, columns from template fields, CSV export via `exportTableCsv()`.
- Data source: `useDocuments()`, `useDocument()`, `useQueryDocuments()`, `useDocumentVersions()`

#### 6. Files (`/files`)
**Purpose:** File storage management.
**Sub-routes:**
- `/files` — file list
- `/files/:id` — file detail
- `/files/upload` — upload new file
- `/files/orphans` — orphaned file detection

**Content:**
- List: filename, content type, size, status, upload date, reference count.
- Detail: metadata, download link, which documents reference this file.
- Orphans: files not referenced by any document, with age filter.
- Data source: `useFiles()`, `useFile()`, `useUploadFile()`

#### 7. Registry (`/registry`)
**Purpose:** ID management, synonyms, merge.
**Sub-routes:**
- `/registry` — entry browser with search
- `/registry/:id` — entry detail (synonyms, composite key, references)

**Content:**
- Search: by ID, composite key, or text.
- Entry detail: canonical ID, all synonyms, entity type, namespace, status.
- Actions: add synonym, merge entries, deactivate.
- Data source: `useRegistrySearch()`, `client.registry.getEntry()`

#### 8. PostgreSQL (`/postgres`)
**Purpose:** Reporting layer inspection and ad-hoc queries.
**Layout:** Two panels — table browser (left) and query pad (right).
**Content:**
- **Table browser**: List all `doc_*` tables from reporting-sync. Click a table to see columns (name, type), row count, sample data (first 10 rows).
- **Query pad**: Text editor (Monaco or CodeMirror) for SQL. Execute button. Results rendered as a table. Query history (localStorage). Only SELECT allowed.
- **Sync status**: reporting-sync health, event lag, pending events.
- Data sources:
  - Tables: `GET /api/reporting-sync/tables` (via proxy)
  - Query: `POST /api/reporting-sync/query` (via proxy)
  - Sync status: `GET /api/reporting-sync/status` (via proxy)

#### 9. MongoDB (`/mongodb`)
**Purpose:** Direct MongoDB inspection (read-only).
**Layout:** Tree navigation (database → collection → documents).
**Content:**
- **Database list**: wip_registry, wip_def_store, wip_template_store, wip_document_store. Show collection count, total size.
- **Collection browser**: For each DB, list collections with doc count, avg doc size, index count.
- **Document inspector**: Browse documents in a collection (paginated, 20 per page). JSON viewer with syntax highlighting. Search/filter by field.
- **Index info**: List indexes for each collection (name, keys, unique flag, size).
- Data source: Express backend routes (`/api/infra/mongo/*`) connecting directly via `mongodb` npm package.

#### 10. NATS (`/nats`)
**Purpose:** Event stream monitoring.
**Layout:** Dashboard-style with stream cards.
**Content:**
- **Stream list**: All JetStream streams. Show: name, subject filter, message count, consumer count, bytes stored.
- **Stream detail**: Click a stream to see subjects, consumers, config, recent messages (last 10).
- **Consumer info**: For each consumer, show: name, pending count, ack floor, deliver policy.
- Data source: Express backend routes (`/api/infra/nats/*`) connecting via `nats` npm package.

#### 11. Integrity (`/integrity`)
**Purpose:** Cross-service referential integrity checks.
**Content:**
- **Run check** button: triggers `GET /api/reporting-sync/health/integrity`.
- **Results**: Status badge (healthy/warning/error), issue list with drill-down.
- **Issue types**: broken term references, missing templates, orphaned documents, inactive references.
- **Drill-down**: Click an issue to see the affected entity, field, expected value.
- Also: template-store and document-store individual integrity checks.
- Data source: `useIntegrityCheck()`, plus direct calls to `/api/template-store/health/integrity` and `/api/document-store/health/integrity`.

#### 12. Activity (`/activity`)
**Purpose:** Audit trail explorer.
**Content:**
- **Timeline**: Recent actions (create, update, delete, deprecate) across all entity types.
- **Filters**: by entity type, action, namespace, time range.
- **Detail**: Click an activity to see full entity details.
- Data source: `useActivity()`

#### 13. NL Query (`/query`)
**Purpose:** Natural language data exploration.
**Layout:** Chat-style interface.
**Content:**
- **Chat input**: Text box at bottom. User types questions in plain English.
- **Responses**: Formatted markdown (tables, lists, bold stats). Rendered above the input.
- **Conversation history**: Scrollable, persisted in session (not localStorage — sensitive data).
- **Examples**: Sidebar or header with sample queries ("How many documents per template?", "Show all active terminologies in the aa namespace", "What clinical trials are in phase 3?").
- **How it works**: Express backend receives the question, calls Claude API with the `wip://query-assistant-prompt` system prompt. The LLM uses WIP's REST APIs (search, query_by_template, run_report_query, describe_data_model, list_report_tables, get_document) as tools. Returns a formatted answer.
- **LLM provider**: Claude API (Anthropic). API key in `.env` as `ANTHROPIC_API_KEY`. Model: `claude-sonnet-4-6` (fast, cost-effective for queries). TBD: could also support local LLM or other providers.

## Folder Structure

```
rc-console/
├── app-manifest.json
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── .env.example
├── Dockerfile
├── Caddyfile
├── server/
│   ├── index.ts              # Express entry point
│   ├── infra/
│   │   ├── mongo.ts          # MongoDB connection + routes
│   │   ├── nats.ts           # NATS connection + routes
│   │   └── health.ts         # Aggregated health check
│   └── nl/
│       ├── query.ts          # NL query endpoint
│       └── tools.ts          # WIP tool definitions for LLM
├── src/
│   ├── main.tsx              # React entry
│   ├── App.tsx               # Root: providers + router
│   ├── lib/
│   │   ├── config.ts         # Runtime config
│   │   └── wip-client.ts     # WIP client singleton
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx       # Shell: sidebar + topbar + content
│   │   │   ├── Sidebar.tsx         # Collapsible sidebar
│   │   │   ├── TopBar.tsx          # App name, namespace selector, user
│   │   │   └── NamespaceSelector.tsx
│   │   ├── common/
│   │   │   ├── DataTable.tsx       # Reusable sortable/filterable table
│   │   │   ├── StatusBadge.tsx     # Health status indicator
│   │   │   ├── JsonViewer.tsx      # Syntax-highlighted JSON
│   │   │   ├── SearchInput.tsx     # Search with debounce
│   │   │   ├── Pagination.tsx      # Page navigation
│   │   │   ├── LoadingState.tsx    # Skeleton/spinner
│   │   │   ├── ErrorState.tsx      # Error display with retry
│   │   │   └── EmptyState.tsx      # No data placeholder
│   │   ├── terminologies/          # Terminology-specific components
│   │   ├── templates/              # Template-specific components
│   │   ├── documents/              # Document-specific components
│   │   ├── registry/               # Registry-specific components
│   │   ├── infra/                  # Infrastructure-specific components
│   │   │   ├── SqlEditor.tsx       # SQL query editor (CodeMirror)
│   │   │   ├── QueryResults.tsx    # SQL result table
│   │   │   ├── CollectionBrowser.tsx
│   │   │   ├── StreamCard.tsx
│   │   │   └── IndexTable.tsx
│   │   └── nl/
│   │       ├── ChatInterface.tsx   # NL query chat UI
│   │       ├── ChatMessage.tsx     # Single message bubble
│   │       └── ExampleQueries.tsx  # Suggested queries
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── NamespacesPage.tsx
│   │   ├── TerminologyListPage.tsx
│   │   ├── TerminologyDetailPage.tsx
│   │   ├── TemplateListPage.tsx
│   │   ├── TemplateDetailPage.tsx
│   │   ├── DocumentListPage.tsx
│   │   ├── DocumentDetailPage.tsx
│   │   ├── DocumentTablePage.tsx
│   │   ├── FileListPage.tsx
│   │   ├── FileDetailPage.tsx
│   │   ├── RegistryPage.tsx
│   │   ├── PostgresPage.tsx
│   │   ├── MongoPage.tsx
│   │   ├── NatsPage.tsx
│   │   ├── IntegrityPage.tsx
│   │   ├── ActivityPage.tsx
│   │   └── NLQueryPage.tsx
│   ├── hooks/
│   │   ├── use-infra.ts           # Custom hooks for infra endpoints
│   │   ├── use-namespace-context.ts # Current namespace state
│   │   └── use-nl-query.ts        # NL query mutation hook
│   └── types/
│       ├── infra.ts               # MongoDB/NATS/PG response types
│       └── nl.ts                  # NL query types
├── tests/
│   ├── unit/
│   └── e2e/
├── DESIGN.md                      # This file
└── README.md
```

## Environment Variables

```bash
# WIP connection (used by @wip/proxy in Express backend)
WIP_BASE_URL=https://localhost:8443
WIP_API_KEY=dev_master_key_for_testing

# MongoDB (direct connection for infra views)
MONGO_URI=mongodb://localhost:27017/

# NATS (direct connection for infra views)
NATS_URL=nats://localhost:4222

# NL Query (Claude API)
ANTHROPIC_API_KEY=sk-ant-...

# App
PORT=3010
VITE_BASE_PATH=/apps/rc-console

# Auth
VITE_AUTH_MODE=api-key
VITE_OIDC_AUTHORITY=https://localhost:8443/dex
VITE_OIDC_CLIENT_ID=rc-console
```

## Implementation Order

Build incrementally. Commit after each step. Each step should be independently functional.

### Step 1: Scaffold (commit 1)
- Initialize project: `npm create vite@latest . -- --template react-ts`
- Install dependencies: @wip/client, @wip/react, @wip/proxy, @tanstack/react-query, react-router-dom, tailwindcss, @shadcn/ui, lucide-react
- Set up Tailwind with WIP design tokens
- Set up Express backend with @wip/proxy
- Set up Vite proxy to Express
- Create App.tsx with providers (QueryClient, WipProvider, Router)
- Create AppLayout with sidebar skeleton + top bar
- Create placeholder pages for all routes
- Verify: app loads at localhost:5173, sidebar navigation works, proxy forwards to WIP

### Step 2: Dashboard (commit 2)
- Service health cards (6 services)
- Namespace summary with entity counts
- Recent activity feed
- This proves the WIP client connection works end-to-end

### Step 3: PostgreSQL page (commit 3)
- Table browser (list reporting tables)
- SQL query pad (textarea or basic editor, not Monaco yet)
- Query results as table
- Sync status display
- This is the first gap to close vs the existing console

### Step 4: MongoDB page (commit 4)
- Express backend: MongoDB connection + routes
- Database list with collection counts
- Collection browser with doc counts and indexes
- Document inspector (JSON viewer, paginated)
- Second gap closed

### Step 5: NATS page (commit 5)
- Express backend: NATS connection + routes
- Stream list with message counts
- Consumer info
- Third gap closed

### Step 6: Namespaces page (commit 6)
- Namespace list with stats
- Create/edit namespace
- Matching existing console functionality

### Step 7: Terminologies pages (commit 7-8)
- List with filtering
- Detail with term management
- Import/export
- Ontology browser (may be deferred — complex viz)

### Step 8: Templates pages (commit 9)
- List with filtering
- Detail with field inspector
- Version history

### Step 9: Documents pages (commit 10-11)
- Template selector → document list
- Document detail with version history
- Table view with CSV export
- Query builder with filters

### Step 10: Files, Registry, Integrity, Activity pages (commit 12-14)
- These follow established patterns from the existing console
- Lower priority — can be deferred to `/improve` phase

### Step 11: NL Query page (commit 15)
- Express backend: Claude API integration
- Tool definitions mapping to WIP REST API calls
- Chat UI with markdown rendering
- Example queries

### Step 12: Auth integration (commit 16)
- OIDC flow with Dex
- API key fallback
- Namespace-scoped permissions in UI

### Step 13: Tests & Dockerfile (commit 17-18)
- Unit tests for key components
- E2E test for at least one flow
- Multi-stage Dockerfile
- Health endpoint

## Key Dependencies (package.json)

```json
{
  "dependencies": {
    "@wip/client": "file:./libs/wip-client",
    "@wip/react": "file:./libs/wip-react",
    "@wip/proxy": "file:./libs/wip-proxy",
    "@tanstack/react-query": "^5",
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "express": "^4",
    "mongodb": "^6",
    "nats": "^2",
    "@anthropic-ai/sdk": "^0.30",
    "lucide-react": "^0.400",
    "react-markdown": "^9",
    "remark-gfm": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10",
    "tsx": "^4",
    "vitest": "^1",
    "@testing-library/react": "^14"
  }
}
```

## Existing Vue Console Reference

The Vue console at `World-in-a-Pie/ui/wip-console/` has:
- **24 views** across 6 sections
- **29 reusable components**
- **6 API service clients** in a single `client.ts` (1500+ lines)
- **8 Pinia stores** for state management
- **Cytoscape.js** for ontology graph visualization
- **PrimeVue DataTable** for all tabular data

Key architectural differences in rc-console:
- @wip/client replaces the hand-written API clients
- @wip/react hooks replace Pinia stores for WIP data
- TanStack Query replaces manual cache management
- shadcn/ui + Tailwind replaces PrimeVue
- Express backend with direct infra connections replaces pure-proxy architecture

## What Does NOT Exist in WIP APIs (Requires Direct Connection)

From BE-YAC's response (CASE-09):
- MongoDB: collection stats, index info, document counts by collection, document browsing
- NATS: stream/subject monitoring, consumer lag, message inspection
- PostgreSQL: connection pool stats, active queries (but query execution EXISTS via reporting-sync)
- MinIO: bucket stats

For these, the Express backend connects directly. All reads are read-only.

## What DOES Exist (Use Via @wip/proxy)

- All entity CRUD (terminologies, terms, templates, documents, files, registry)
- Health endpoints on every service
- `POST /api/reporting-sync/query` — SQL execution (SELECT only)
- `GET /api/reporting-sync/tables` — list PostgreSQL tables and columns
- `GET /api/reporting-sync/status` — sync lag, pending events
- Integrity checks on template-store, document-store, reporting-sync
- Cross-service search
- Recent activity feed
- Entity reference tracking

## NL Query Design

### System Prompt
The complete system prompt is available at `wip://query-assistant-prompt` MCP resource. It includes:
- The full data model (all templates, fields, terminologies)
- Query strategy (when to use search vs query_by_template vs SQL)
- Response formatting rules
- Available "tools" the LLM can call

### Implementation
The Express backend:
1. Receives question from frontend: `POST /api/nl/query { question: "...", history: [...] }`
2. Calls Claude API (`claude-sonnet-4-6`) with the query-assistant system prompt
3. The LLM response may include tool calls — the backend executes them against WIP's REST API
4. Returns the formatted answer to the frontend

### LLM Tools Available
These map to WIP REST API calls made by the Express backend:
- `search(query, types)` → `GET /api/reporting-sync/search`
- `query_by_template(template_value, filters)` → `POST /api/document-store/documents/query`
- `run_report_query(sql)` → `POST /api/reporting-sync/query`
- `describe_data_model()` → pre-loaded from the system prompt
- `list_report_tables()` → `GET /api/reporting-sync/tables`
- `get_document(id)` → `GET /api/document-store/documents/:id`
- `list_terms(terminology_id)` → `GET /api/def-store/terminologies/:id/terms`

## Template Builder — Design Spec

*Agreed with Peter 2026-04-06. This covers the create/edit UI for templates — the most complex CRUD in the console.*

### Design Principles

1. **No wizard.** Admins dislike forced workflows. Single page with collapsible sections. User fills in what they want, in any order.
2. **Slide-out field editor.** Right panel (60% width) for editing a single field's full configuration. Left side shows the condensed field list so the user retains context while editing.
3. **Quick-add for rapid field creation.** Inline row at the bottom of the field table: type name, pick type, toggle mandatory, hit Enter. Covers the 80% case (simple string/number fields). Open slide-out only for fields needing terminology refs, validation, file config, etc.
4. **Advanced toggles.** Hide power-user properties behind expandable sections to keep the common case clean.
5. **Always warn about versioning.** Pre-save validation with contextual warnings based on namespace config and document usage.
6. **Template cloning.** Clone button on detail page pre-fills the create form. Preserves `extends` relationship by default, with option to flatten (resolve inheritance into concrete fields).

### Page Structure

The template builder is a single page at `/templates/new` (create) or integrated into `/templates/:id` (edit). Sections:

```
┌─────────────────────────────────────────────────────────────┐
│ Template Metadata                                           │
│ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────────┐ │
│ │ value * │ │ label * │ │namespace*│ │ extends (parent) │ │
│ └─────────┘ └─────────┘ └──────────┘ └──────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ description                                              ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ▸ Advanced: metadata (domain, category, tags), reporting    │
│   config (sync_enabled, strategy, table_name, flatten)      │
├─────────────────────────────────────────────────────────────┤
│ Fields                                        [+ Quick Add] │
│ ┌───────────────────────────────────┬───────────────────────┤
│ │ Field List (drag-reorderable)     │ Field Slide-Out (60%) │
│ │                                   │                       │
│ │ ☰ name     [string]  ● mandatory │ Name: [         ]     │
│ │ ☰ amount   [number]  ● mandatory │ Label: [        ]     │
│ │ ☰ category [term]    ○ optional  │ Type: [dropdown ]     │
│ │ ☰ receipt  [file]    ○ optional  │ Mandatory: [toggle]   │
│ │                                   │ Default: [       ]    │
│ │ ┌─────────────────────────────┐  │                       │
│ │ │ name [type ▾] [●] Enter    │  │ ▸ Advanced            │
│ │ └─────────────────────────────┘  │   Semantic type       │
│ │  (quick add row)                 │   Validation (pattern,│
│ │                                   │     min/max)          │
│ │                                   │   File config         │
│ │                                   │   Array config        │
│ │                                   │                       │
│ │                                   │ ▸ References          │
│ │                                   │   Terminology ref     │
│ │                                   │   Template ref        │
│ │                                   │   Target templates    │
│ │                                   │   Version strategy    │
│ │                                   │                       │
│ │                                   │ [Delete Field]        │
│ └───────────────────────────────────┴───────────────────────┤
│ Identity Fields                                             │
│ ☑ name  ☐ amount  ☑ category  ☐ receipt                    │
│ (checkboxes from field list — order matters for hash)       │
├─────────────────────────────────────────────────────────────┤
│ Validation Rules                               [+ Add Rule] │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Rule editor (per rule):                                  ││
│ │ Type: [conditional_required ▾]                           ││
│ │ Conditions: [field] [operator ▾] [value]  [+ condition]  ││
│ │ Target field(s): [multi-select from field list]          ││
│ │ Constraints: required/allowed_values/pattern/min/max     ││
│ │ Error message: [                                     ]   ││
│ └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Validate] [Save as Draft] [Save & Activate]     [Cancel]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Field Slide-Out Detail

The slide-out panel adapts based on field type:

| Field Type | Additional Config Shown |
|---|---|
| `string` | validation (pattern, min/max length), semantic_type, enum |
| `number` / `integer` | validation (min/max value), semantic_type |
| `boolean` | default_value toggle |
| `date` / `datetime` | default_value, validation (min/max) |
| `term` | terminology_ref picker (searchable dropdown of terminologies), include_subtypes toggle |
| `reference` | reference_type, template_ref / target_templates picker, version_strategy |
| `file` | file_config panel: allowed_types (chips), max_size_mb, multiple toggle, max_files |
| `array` | array_item_type picker, then recursive config matching the item type |
| `object` | (nested fields — deferred, show raw JSON editor for v1) |

**Default visible** (all types): name, label, type, mandatory, default_value

**Advanced section** (collapsed by default): semantic_type, validation, metadata

**References section** (shown only for term/reference types): terminology_ref, template_ref, target_templates, version_strategy

### Versioning Warnings (Pre-Save)

Before committing an update to an active template, the builder runs `validateTemplate()` and `activateTemplate(id, { dry_run: true })` and shows contextual warnings:

| Situation | Warning Level | Message |
|---|---|---|
| Template is draft | None | Just save |
| Active, no documents | Info | "This will create version N+1. No documents are affected." |
| Active, documents use pinned versions | Info | "X documents use pinned versions (unaffected). New documents will use v(N+1)." |
| Active, documents use `latest` | Warning | "X documents reference this template as 'latest'. They will resolve to v(N+1) after cache refresh (~5s)." |
| Identity fields changed, docs use `latest` | **Blocking** | "Changing identity fields while X documents use 'latest' will cause inconsistent identity hashing. Either: (a) pin existing documents to the current version first, or (b) create a new template." |
| Identity fields changed, docs use pinned versions | Info | "Identity fields changed. X existing documents use pinned v(N) (unaffected). New documents on v(N+1) will use the new identity scheme." |
| Namespace `isolation_mode: strict` | Error (if violated) | "This namespace is strict-isolated. References to [template/terminology] in namespace [X] are not allowed." |
| `will_also_activate` non-empty | Info | "Activating this template will also activate: [list]. These are dependencies." |

### Template Diff View

When editing an active template, a "Review Changes" step before save shows:

- **Added fields:** highlighted green
- **Removed fields:** highlighted red (with warning if any documents populate these fields)
- **Changed fields:** show old → new for each modified property
- **Identity field changes:** prominently highlighted with the versioning warning above
- **Rule changes:** added/removed/modified rules

This uses a client-side diff between the current template (from `useTemplate()`) and the form state. No backend endpoint needed.

### Inheritance

When a template `extends` a parent:

- Inherited fields shown in the field list with a subtle badge ("inherited from PARENT_VALUE") and dimmed styling
- Inherited fields are **read-only** in the field list — click opens the parent template detail instead
- User can add new fields (appended after inherited fields) or override inherited fields (creates a local copy)
- Parent version can be pinned (`extends_version`) or track latest
- "Flatten" option on clone: resolves all inherited fields into concrete fields, removes the `extends` relationship

### Field Reordering

Drag-and-drop on the field list (grip handle on the left of each row). Updates the `fields` array order. Nice-to-have for admin convenience — field order affects form generation and table display order.

### Components to Build

```
src/components/templates/
├── TemplateBuilder.tsx         # Main builder page (create/edit)
├── FieldList.tsx               # Drag-reorderable field list with quick-add
├── FieldSlideOut.tsx           # Right panel for single field editing
├── FieldQuickAdd.tsx           # Inline row for rapid field creation
├── IdentityFieldPicker.tsx     # Checkbox grid for identity fields
├── RuleEditor.tsx              # Single validation rule form
├── RuleList.tsx                # List of rules with add/remove
├── TemplateDiffView.tsx        # Side-by-side diff before save
├── VersionWarnings.tsx         # Pre-save validation warning panel
├── ReportingConfigPanel.tsx    # Reporting config (advanced section)
└── MetadataPanel.tsx           # Template metadata (advanced section)
```

### API Calls Used

| Action | Method |
|---|---|
| Create template | `client.templateStore.createTemplate(data)` |
| Update template | `client.templateStore.updateTemplate(id, data)` |
| Validate before activate | `client.templateStore.validateTemplate(id, { check_terminologies: true, check_templates: true })` |
| Dry-run activation | `client.templateStore.activateTemplate(id, { namespace, dry_run: true })` |
| Activate | `client.templateStore.activateTemplate(id, { namespace })` |
| Check children (cascade) | `client.templateStore.getChildren(id)` |
| Clone source | `client.templateStore.getTemplate(id)` or `getTemplateRaw(id)` (raw = without inheritance resolution, for preserving extends) |
| Version history | `client.templateStore.getTemplateVersions(value)` |
| Document count (for warnings) | `client.documentStore.listDocuments({ template_value, page_size: 1 })` → use `total` |

### Implementation Order

1. **FieldList + FieldSlideOut** — the core interaction. Get this right first.
2. **TemplateBuilder** — metadata form + field list + save flow.
3. **Quick-add row** — speed enhancement for field creation.
4. **VersionWarnings** — pre-save validation with contextual warnings.
5. **RuleEditor/RuleList** — validation rule builder.
6. **TemplateDiffView** — review changes before save.
7. **IdentityFieldPicker** — checkbox selection from field list.
8. **Drag-and-drop reordering** — nice-to-have, add last.

## Term Detail Page & Ontology UI — Design Spec

**Status:** Planned (2026-04-07). Approved by Peter. Not yet implemented.

### Goal

Add a dedicated Term Detail page that exposes WIP's full ontology layer: relationships (typed, directed, cross-terminology), hierarchy traversal (ancestors/descendants via `is_a` or any other type), and CRUD on relationships. This is the missing piece of the schema-layer CRUD roadmap.

### Decisions agreed with Peter

| # | Question | Decision |
|---|---|---|
| 1 | Inline expansion vs dedicated page | **Dedicated `TermDetailPage`** at `/terminologies/:tid/terms/:termId`. Terms get their own URL like every other entity. |
| 2 | Hierarchy visualization style | **Expandable nested rows.** Indented text rows with chevrons; click to lazy-load children/parents one level at a time. No graph viz. |
| 3 | Cross-terminology target picker | **Invest in a search-across-all-terminologies picker.** Simpler "pick terminology, then term" was rejected — Peter wants the ergonomics. |
| 4 | Relationship type source | **Runtime** — fetch from `_ONTOLOGY_RELATIONSHIP_TYPES` system terminology. Fall back to a hardcoded list if the call fails. |
| 5 | Scope of first build | All of Phase 1 below (Overview + Relationships + Hierarchy in one go). |

### Routes

```
/terminologies/:tid                                    # Existing — terminology detail
/terminologies/:tid/terms/:termId                      # NEW — term detail (defaults to Overview tab)
/terminologies/:tid/terms/:termId?tab=relationships    # NEW — relationships tab
/terminologies/:tid/terms/:termId?tab=hierarchy        # NEW — hierarchy tab
/terminologies/:tid/terms/:termId?tab=raw              # NEW — raw JSON
```

The current `TerminologyDetailPage` term name (an inline row, not a link) gets converted to a `<Link>` to the new route. The "edit term" inline behaviour stays put — clicking the name opens the detail page; clicking the pencil opens the existing inline edit form.

### Data model recap

WIP entities involved:

- **Term** — `term.term_id`, `term.value`, `term.label`, `term.parent_term_id` (legacy single-parent), aliases, translations, metadata, status, `replaced_by_term_id`
- **Relationship** (`@wip/client`'s `Relationship` type from `types/ontology.ts`) — fields: `namespace`, `source_term_id`, `target_term_id`, `relationship_type`, `relationship_value`, denormalized `source/target_term_value`, `source/target_term_label`, `source/target_terminology_id`, `metadata`, `status`, `created_at`, `created_by`
- **`_ONTOLOGY_RELATIONSHIP_TYPES`** system terminology — drives the type dropdown. Built-in types: `is_a`/`has_subtype`, `part_of`/`has_part`, `maps_to`/`mapped_from`, `related_to`, `finding_site`, `causative_agent`. OBO imports add more (`regulates`, `capable_of`, etc.)

### Available client methods (already in `@wip/client` 0.9.0)

- `defStore.listRelationships({ term_id, direction: 'outgoing' | 'incoming' | 'both', relationship_type?, limit?, offset? })`
- `defStore.listAllRelationships({ namespace, relationship_type?, limit?, offset? })`
- `defStore.createRelationships(items: CreateRelationshipRequest[], namespace)` — bulk
- `defStore.deleteRelationships(items: DeleteRelationshipRequest[], namespace)` — bulk
- `defStore.getAncestors(termId, { relationship_type?, max_depth? })` — BFS, max_depth defaults 10
- `defStore.getDescendants(termId, { relationship_type?, max_depth? })`
- `defStore.getParents(termId, namespace)` — direct only
- `defStore.getChildren(termId, namespace)` — direct only

`@wip/react` only ships `useCreateRelationships` and `useDeleteRelationships` as hooks. Everything else uses `useQuery` + `useWipClient()` directly (same pattern as `APIKeysPage.tsx`).

### Page layout

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back to <terminology label>                                       │
│                                                                     │
│ <Term icon> term.label  [code: term.value]   [status badge]         │
│ <description text muted>                                            │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ [Overview] [Relationships (12)] [Hierarchy] [Raw JSON]          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ <tab content>                                                       │
└────────────────────────────────────────────────────────────────────┘
```

The relationship count badge on the tab uses `listRelationships({ term_id, direction: 'both', limit: 1 })` for the count only.

### Tab 1: Overview

Pure read/edit of the existing Term fields. Reuse the form helpers from `TerminologyDetailPage`'s inline edit form. Sections:

- **Identity** — value (read-only after create), label, description
- **Aliases** — chip list, add/remove
- **Translations** — language → label table
- **Hierarchy (legacy)** — `parent_term_id` (deprecate-friendly: show as a link to the parent term, with a note "Use Relationships tab for multi-parent / typed parents")
- **Status** — active / deprecated / replaced-by picker
- **Metadata** — JSON editor (collapsed by default)
- **Audit** — created_at, created_by, updated_at, updated_by

Buttons: Edit, Save, Cancel, Deprecate, Delete (matching the inline TermRow patterns).

### Tab 2: Relationships

Two collapsible sections, both default-expanded:

```
┌─ Outgoing ──────────────────────────────────────────────[+ Add]──┐
│  is_a (3)                                                         │
│   • <target.label> [target.value]  →  <target_terminology>   [×]  │
│   • <target.label> [target.value]  →  <target_terminology>   [×]  │
│   • <target.label> [target.value]                            [×]  │
│  part_of (1)                                                      │
│   • <target.label> [target.value]                            [×]  │
│  ...                                                              │
└───────────────────────────────────────────────────────────────────┘

┌─ Incoming ──────────────────────────────────────────────────────┐
│  has_subtype (5)                                                 │
│   • <source.label> [source.value]                                │
│   • ...                                                          │
└─────────────────────────────────────────────────────────────────┘
```

- Group rows by `relationship_type` with type label as a sub-header
- Each row: target term (link to its detail page if same namespace), terminology badge if different from current term's terminology, delete button
- Cross-terminology rows get a small distinguishing icon/label
- Pagination: 50 per type initially, "Load more" button per group (use offset)
- Incoming section is read-only — incoming relationships are added by editing the *source* term

**Add Relationship form** (slide-out panel from the right, 40% width — pattern from FieldSlideOut):

```
Add Relationship

Direction: ( ) Outgoing  ( ) Incoming  [defaults to Outgoing]

Relationship type: [is_a ▼]   ← from _ONTOLOGY_RELATIONSHIP_TYPES,
                                   shows label not value, fallback list
                                   if fetch fails

Target term: [search... ]    ← cross-terminology picker (see below)

[ Add ] [ Cancel ]
```

Implementation:
- Direction toggle: outgoing creates `{source: this, target: picked}`, incoming creates `{source: picked, target: this}`
- Type dropdown options derived from `useTerms({ terminology_id: '_ONTOLOGY_RELATIONSHIP_TYPES' })` with hardcoded fallback
- After successful add, invalidate the relationship query and close the panel

### Tab 3: Hierarchy

Two stacked panels, both lazy-loading via the `parents`/`children` (or `ancestors`/`descendants`) endpoints.

```
Type: [is_a ▼]                ← any relationship type from runtime list

▼ Ancestors
   ▼ Pneumonia
      ▼ Lung Disease
         • Disease
   ▼ Viral respiratory infection
      • Viral disease

▼ This term: Viral pneumonia

▼ Descendants
   ▼ COVID-19 pneumonia
      • Severe COVID-19 pneumonia
   • SARS pneumonia
```

- Each row: chevron to expand/collapse, term label, term value
- Click the term itself navigates to that term's detail page
- Initial render fetches direct parents (`getParents`) and direct children (`getChildren`)
- Expanding a row fetches *its* parents/children (one query per expansion)
- This avoids the BFS endpoints' large payloads — we lazy-load instead
- Polyhierarchy support: a term can appear under multiple parents — that's fine, just render it multiple times
- Cycle protection: track expanded ancestors in a `Set` to prevent infinite loops on cyclic ontologies (rare but real)
- Empty states: "No parents (root term)" / "No children (leaf term)"

**Type selector:** lets the user switch between `is_a`, `part_of`, etc. Each switch resets the trees.

### Cross-terminology term search picker (the investment)

This is a reusable component, not just for this page. It will likely be reused for document creation later.

```
Component: <TermSearchPicker
  onSelect={(term) => ...}
  excludeTermId={currentTermId}      // don't allow self-relationships
  excludeNamespace?: string
  placeholder?: string
/>
```

**Behaviour:**
- Debounced text input (300ms)
- Searches against the WIP **search** endpoint (`client.search({ q, types: ['term'] })`) — global, cross-terminology, cross-namespace
- Results dropdown shows:
  - Term label + value (monospace)
  - Terminology label + value (small, muted)
  - Namespace badge if different from current
- Keyboard nav: ↑/↓ to highlight, Enter to select, Esc to close
- Empty query: show "Type to search across all terminologies"
- No results: "No matching terms"
- Loading: subtle spinner

**Why this needs a real investment:** A "pick terminology then term" cascading dropdown is much simpler but forces users to know which terminology a concept lives in. Real ontology work crosses vocabularies constantly. A search-first picker also doubles as the foundation for document field auto-complete later.

**Verify before building:** confirm that `client.search()` exists and returns terms with terminology context. If not, fall back to `listTerms({ search })` per terminology — but check the search endpoint first.

### Implementation order

1. **`TermSearchPicker` component** (`src/components/ontology/TermSearchPicker.tsx`) — reusable, no dependencies on other new code. Test by mounting in a temporary route.
2. **`TermDetailPage` skeleton** with route, header, tab nav, Overview tab read-only.
3. **Overview tab edit mode** — port the existing inline TermRow edit logic.
4. **Relationships tab** — list outgoing/incoming, group by type, paginated. Fetch via direct `client.defStore.listRelationships`.
5. **Add Relationship slide-out panel** — uses `TermSearchPicker` and the runtime type dropdown.
6. **Delete Relationship** — bulk-delete with confirmation.
7. **Hierarchy tab** — direct parents/children first, then lazy expansion, with type selector.
8. **Linkify TerminologyDetailPage** — make term names link to the new detail page.
9. **Sidebar / breadcrumbs polish.**

Each step is its own commit. Steps 1-5 are the MVP — the page is useful at that point. Steps 6-9 are completion.

### Open considerations

- **`@wip/react` hooks for ontology queries:** None exist (only the two mutations). We use `useQuery` + `client.defStore.*` directly. If we end up writing more than ~5 queries, consider filing a CASE asking BE-YAC for `useRelationships`, `useChildren`, `useParents` hooks.
- **Reporting sync events:** Relationship CRUD fires `RELATIONSHIP_CREATED`/`RELATIONSHIP_DELETED` events. The Postgres `term_relationships` table is kept in sync. Useful if we ever want a "graph stats" widget.
- **Performance:** The largest verified ontology (GO) has 75k relationships. The lazy-expansion design avoids ever fetching all of them. Outgoing per-term lists are typically small (single-digit to low hundreds).
- **Search endpoint check:** before implementing the picker, verify `client.search` is namespace-aware and returns terminology context. If not, build a wrapper that joins `listTerms` results with their terminology metadata.
- **Inline expansion preview on `TerminologyDetailPage`:** deferred. The new detail page is enough for v1. Could be added later as a tiny relationship-count badge on each term row.

### Out of scope (deferred)

- **Standalone Ontology Browser page** (Option C from the design discussion). Could be added later as a paginated relationship table per namespace, but no force-directed graph viz. Skip until there's a clear analyst use case.
- **OBO import UI.** The OBO import is already supported via API and CLI. A console upload UI could be added but is not part of this work.
- **OWL/SKOS import.** Out of scope per the platform docs.
- **Bulk relationship CRUD UI.** Single-relationship CRUD is enough for v1 — bulk is for OBO imports.

## Open Questions for Peter

1. **NL Query LLM**: Plan assumes Claude API via `@anthropic-ai/sdk`. Is that right, or do you want local LLM support too?
2. **Ontology browser**: The existing console uses Cytoscape.js for graph visualization. Should rc-console match this, or is a simpler tree view sufficient for v1?
3. **Monaco Editor**: For the SQL query pad — full Monaco editor or simple CodeMirror/textarea for v1?
4. **CORS setup**: Need to add `http://localhost:5173` to WIP's `CORS_ORIGINS`. Should the next YAC do this, or will you handle it?
5. **API key**: Need a `wip-admins` scoped key for rc-console. Should the next YAC create one, or do you have one ready?
