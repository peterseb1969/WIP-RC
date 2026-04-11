# RC-Console — Changelog

## 2026-04-09 — Tier features, backup/restore, production deployment

This update covers session APP-RC-20260409-1649 (~47 commits). Major feature additions across all entity types, a new backup/restore page, audit explorer, and production deployment fixes.

### Documents
- Added: Table view (`/documents/:tv/table`) with flat columns and CSV export
- Added: CSV import wizard (`/documents/import`) with column mapping via PapaParse
- Added: Validate button on document detail page

### Templates
- Added: Deactivate action on template detail page
- Added: Duplicate button (creates a copy as draft)
- Added: Version navigation via `?v=` URL parameter with Link pills (replaces dropdown)
- Fixed: Save + Save as Draft buttons, removed activation jargon for new templates
- Fixed: Template lifecycle bugs, breadcrumb 404s

### Dashboard
- Added: Quick actions panel
- Added: Data quality card
- Added: Recent items grid (replaces simple activity feed)

### Audit explorer
- Added: New page (`/audit-explorer`) with entity search and reverse reference inspection
- Added: Click-to-inspect references in place (no navigation away)

### Files
- Added: Preview support for video, audio, PDF (inline render), and text files
- Added: File orphan scanner (always visible above file list)

### Terminologies
- Added: CSV and OBO Graph JSON import alongside existing JSON import
- Added: CSV export alongside JSON export

### Backup & restore
- Added: Backup & restore page (`/backup`) with async job tracking
- Added: Streaming download proxy for large backup archives
- Fixed: Multiple restore workflow bugs (namespace handling, endpoint paths, job type display)

### Sidebar
- Changed: Hierarchical sub-menus for the Data section

### Namespaces
- Added: Per-entity-type ID configuration on namespace create and edit

### Production deployment (CASE-38)
- Added: `APP_BASE_PATH` support (Option 2) — app mounts all routes under the configured prefix
- Added: OIDC state parameter for OAuth security
- Added: Trust proxy + session cookie path fixes
- Added: Dockerfile `VITE_BASE_PATH` build arg
- Changed: Default Express port from 3010 to 3011

### Bug fixes
- Fixed: Express 5 catch-all route compatibility (CASE-37)
- Fixed: Registry browse API uses plural entity_type
- Fixed: `page_size` cap raised to 1000

## 2026-04-08 — Document CRUD, Ontology UI, API Keys, Template Builder

This is a major update covering four sessions (APP-RC-20260408-*) and several sessions prior. RC-Console is now feature-complete for v1: full CRUD for all entity types, ontology browsing, and auto-generated document forms.

### Document CRUD (sessions APP-RC-20260408-1734, -2321)

- Added: `DocumentFormPage` — auto-generated forms scaffolded from template field definitions
- Added: Create mode (`/documents/:templateValue/new`) with `useCreateDocument`
- Added: Edit mode (`/documents/:templateValue/:id/edit`) using RFC 7396 PATCH via `useUpdateDocument` with `ifMatch` optimistic concurrency
- Added: Archive action on `DocumentDetailPage` header via `useArchiveDocument`
- Added: "+ New document" button on `DocumentListPage` (next to Refresh)
- Added: Active/All archive toggle on document list
- Added: All-templates view (browse documents across all templates in a namespace)
- Added: 8 field-type input components: `TermFieldInput`, `ReferenceFieldInput`, `FileFieldInput`, `DateTimeInput`, `ArrayFieldInput`, `ObjectFieldInput` + scalar inputs via shared `FormInputs`
- Added: Identity fields render read-only in edit mode (server rejects PATCH on identity fields)
- Added: Concurrency conflict handling — banner with reload option when `ifMatch` fails
- Changed: Extracted `TextInput`, `NumberInput`, `SelectInput`, `Toggle`, `Label`, `Section` from `FieldSlideOut.tsx` to shared `FormInputs.tsx` — used by both Template Builder and Document Form
- Known issues: term picker capped at 100, nested-object arrays read-only, file orphans on abandon, reference picker first-target-only, object fields as JSON textarea

### Ontology UI (session APP-RC-20260408-0811)

- Added: `TermDetailPage` at `/terminologies/:tid/terms/:termId` — Overview, Relationships, Hierarchy, Raw tabs
- Added: Overview tab with inline edit (label, description, aliases, sort_order), deprecate, and delete actions
- Added: Relationships tab — grouped by type, both directions, cross-terminology badge, count badge
- Added: Add Relationship slide-out — direction toggle, type dropdown from `_ONTOLOGY_RELATIONSHIP_TYPES`, cross-terminology `TermSearchPicker`
- Added: Delete relationship with inline confirm on each row
- Added: Hierarchy tab — lazy-expanding ancestor/descendant trees via `getParents`/`getChildren` with per-term hydration
- Added: Breadcrumbs component below TopBar with entity-label resolution
- Added: `TermSearchPicker` — reusable cross-terminology/namespace term search with hydration
- Fixed: `page_size` cap at 100 for relationship and term list endpoints (filed CASE-27)
- Changed: Term names in `TerminologyDetailPage` now link to `TermDetailPage`

### Document Detail hydration (session APP-RC-20260408-0811)

- Fixed: Term references on `DocumentDetailPage` now resolve via `getTerm` and link to `TermDetailPage` with real labels
- Fixed: Document references hydrate via `getDocument` with friendly labels (name/label/title/display_name/value, fallback to short identity hash)
- Fixed: Removed duplicate "Template v1" indicator from metadata row — version now inline in header template link

### Dependencies

- Changed: @wip/client 0.9.0 → 0.11.0 (RFC 7396 PATCH, `updateDocument`, `updateDocuments`, optimistic concurrency)
- Changed: @wip/react 0.5.4 → 0.6.0 (`useUpdateDocument`, `useUpdateDocuments`, `useArchiveDocument`)
- Removed: `_DevTermPickerPage` and `/_dev/term-picker` route (picker is now used in production via Add Relationship slide-out)

### Earlier in April (sessions before APP-RC-20260408)

- Added: API Keys management page (`APIKeysPage`) with full CRUD
- Added: Template Builder (`TemplateBuilderPage`) — create/edit with field editor, drag-and-drop reordering, validation rules, diff view, versioning warnings, activation flow
- Added: Namespace CRUD with two-stage delete protection
- Added: Terminology CRUD with term management
- Changed: Global namespace selector moved to TopBar with localStorage persistence
- Fixed: Various field display, routing, and TypeScript issues across detail pages

## 2026-04-05 — CSV export, global namespace selector, bug fixes

### Session APP-RC-20260405-0119
- Added: Streaming CSV export buttons in PostgreSQL page — hover icon per table, button in detail header, Export CSV in query pad (CASE-12)
- Added: Global namespace selector in TopBar with localStorage persistence, replacing per-page dropdowns
- Fixed: Dashboard health checks — moved from client-side `/health` (404) to server-side probing via Express backend
- Fixed: TerminologyListPage duplicate React keys when same terminology_id appears across namespaces
- Fixed: Dashboard namespace stats reading `entity_counts` wrapper correctly
- Fixed: Files page namespace requirement — workaround removed after BE-YAC deployed CASE-08 fix making `namespace` optional (CASE-13)

## 2026-04-05 — Initial build complete (Steps 1-13)

### Session APP-RC-20260404-2358
- Added: Full project scaffold — Express backend with @wip/proxy, collapsible dark sidebar, 13 routes, TanStack Query + WipProvider setup
- Added: Dashboard with 6 service health cards, namespace stats grid, infrastructure quick-links, recent activity feed
- Added: PostgreSQL page — table browser, SQL query pad (dark theme, Cmd+Enter), query history, CSV export, sync status
- Added: MongoDB page — database list, collection browser, index inspector, paginated document browser with JSON viewer
- Added: NATS page — connection status, expandable stream cards, consumer detail with lag highlighting
- Added: Namespaces page — expandable rows with stats, create form
- Added: Terminologies pages — searchable list with filters, detail view with term management and pagination
- Added: Templates pages — list with namespace filter, detail with field table, type badges, cross-links
- Added: Documents pages — template card selector, paginated table, document detail with field display, JSON viewer, version history
- Added: Files page — paginated list with filtering
- Added: Registry page — search with split-pane results + JSON viewer
- Added: Integrity page — on-demand checks, status banner, issue list
- Added: Activity page — audit trail timeline

### Session APP-RC-20260405-0040
- Added: NL Query page — Claude API integration with 7 WIP tools in an agentic loop, chat UI with markdown rendering, tool call inspector, 6 example queries
- Added: Auth integration — TopBar shows user info when OIDC is active, "dev mode" badge otherwise
- Added: Test suite — 35 tests (UI components + NL query tool validation)
- Added: Dockerfile — multi-stage build, health check, production static serving
- Added: Documentation — README, ARCHITECTURE, WIP_DEPENDENCIES, KNOWN_ISSUES, CHANGELOG

### Libraries
- @wip/client@0.5.1, @wip/react@0.5.0, @wip/proxy@0.2.0
- @anthropic-ai/sdk@0.39, react-markdown@9, remark-gfm@4
- Total: ~14,000 lines added across 11 commits
