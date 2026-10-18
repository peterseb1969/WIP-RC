# RC-Console — Changelog

## 2026-10-19 — Edit conflicts explained

- Fixed: saving a document that someone else had changed since it was opened showed only "Expected version 1, current is 2", with no explanation and no Reload button. RC recognised a conflict by looking for "conflict" or "concurrency" in the message text, which this message doesn't contain. It now uses the platform's `concurrency_conflict` error code, says the changes were not saved because the document changed, and offers Reload.
- Changed: the document form's error banner has `role="alert"`.
- Added E2E tests for form validation: missing mandatory field, a value the platform rejects, an edit conflict. 62 tests.

## 2026-10-19 — Registry synonyms resolve

- Fixed: synonyms added on the Registry page never resolved. The form sent singular entity types (`document`), but the registry's are plural (`documents`) and a lookup matches the type exactly, so a synonym stored as `document` was invisible to every lookup. The form now sends the plural type and starts from the entry's own namespace and type.
- Fixed: the synonym and merge forms' labels name their inputs.
- Added E2E tests for the registry: synonym add (checked by an actual key lookup), by-term search, remove, merge. 59 tests.

## 2026-10-19 — File fields accept wildcard types

- Fixed: a file field whose allowed types use a pattern (`text/*`, `image/*`) refused every file in the document form ("File type text/plain not allowed"): the form compared the type literally. It now matches exact types, families (`image/*`) and `*`, ignoring case and parameters, and leaves a type the browser could not detect to the server.
- Fixed: the Files page's upload form labels name their inputs.
- Added E2E tests for files: upload, download, a document's file field, references and delete. 52 tests.
- Changed: the new-key banner on the API Keys page says WIP may take up to 30 seconds to accept the key (observed ~14 s on wip-local); the create form's labels name their inputs.
- Added E2E tests for API keys: create a scoped write key, use it, revoke it. 55 tests.

## 2026-10-19 — @wip/client 0.61.0 and @wip/react 0.21.0

- Changed: the Parity tab, the Table Browser's CSV download and the Query Pad's CSV export use the typed client (`reporting.getParity`, `exportTableCsv`, `exportQueryCsv`); RC's own parity types and raw reporting-sync fetches are gone. A parity result whose counts were not compared (`counts_match: null`) is no longer shown as a mismatch.
- Fixed: a failed CSV export (bad query, missing table, refused request) showed nothing; it was only logged to the browser console. The error now appears next to the button that started the export.
- Changed: single-template Batch Sync goes through `useTriggerBatchSync`, which now forwards the namespace scope (required for a forced rebuild), and the namespace-scoped template lookup behind the document pages uses `useTemplateByValue` with a namespace.
- Added E2E tests for both CSV exports, the Parity tab and a forced Batch Sync. 48 tests.

## 2026-10-18 — Template editor: identity locked; versioning and access E2E

- Fixed: the template editor let identity fields be changed on an existing template and said it was safe when the template had no documents or only pinned ones. The platform rejects every identity change (a different identity is a different template). The identity selector is now locked when editing, and any identity change, including removing or renaming an identity field, blocks the save.
- Fixed: after a save created a new template version, or a version was deactivated, the template page's version list stayed stale for up to a minute.
- Added E2E specs: template versioning and access control (`ALLOWED_GROUPS` with a viewer login). 44 tests.

## 2026-10-18 — Document pages stay in the selected namespace; E2E phase 1 complete

- Fixed: the create form, table view, import wizard and document detail page looked up templates by value without a namespace. Where the same template value exists in several namespaces, they used whichever came first. "New document" could load another namespace's template and create the document there. In-app links now carry the template's id, a bare value resolves in the selected namespace, and the detail page uses the document's own template.
- Fixed: reference pickers resolve a bare target template value in the document's namespace, and `ns:VALUE` in the named one.
- Fixed: after a CSV import, the document list showed the pre-import (cached) list until a reload.
- Fixed: the document list lost its `?template=` and last-used selection when the template list came from cache.
- Fixed: the view editor's Namespace and Name labels name their inputs.
- Added E2E specs: imports, same-named templates across namespaces (with a second disposable namespace), relationships and reporting. 36 tests.

## 2026-10-18 — End-to-end tests (phase 1)

- Added: a Playwright E2E suite (`npm run test:e2e`) against wip-local through its router, with a dedicated `e2e@wip.local` user and a disposable namespace per run. Specs: smoke, the data lifecycle and infrastructure pages, 25 tests.
- Fixed (found by the suite):
  - the dev proxy served "Cannot GET" for `/api-keys` on reload;
  - document form inputs were not associated with their labels;
  - the field settings panel's close button had no accessible name;
  - error states now carry `role="alert"`.

## 2026-10-18 — ALLOWED_GROUPS behind the WIP gateway

- Fixed: `ALLOWED_GROUPS` was enforced only in OIDC mode. Behind the WIP auth gateway (the deployed default) every authenticated user got in, the viewer included, and, because RC calls WIP with the admin key, could write data. It is now also checked against the gateway's `X-WIP-Groups` header, and with it set, a request carrying no identity gets 401 instead of open dev mode. The RC manifest gets `ALLOWED_GROUPS=wip-admins` from BE-YAC.
- Verified: a temporary instance with `ALLOWED_GROUPS=wip-admins` on wip-local answered health 200, no identity 401, viewer 403 (also through the `/wip` proxy), and an admin 200.

## 2026-10-18 — NL data-model tool scoped by namespace

- Changed: `describe_data_model` returns an overview (template and terminology names per namespace) without arguments, and full detail (fields with types and terminologies, identity fields, usage, term counts, IDs) for up to 10 `namespaces`. On wip-local the overview is ~7k characters; the old all-in-one listing was ~45k and got cut mid-JSON at the 30k tool-result limit.
- Fixed: oversized tool results lose whole trailing items, with a `<key>_omitted` count, and stay valid JSON instead of being sliced mid-string.
- Verified live: "terminologies in library" took 1 tool call / 3.1 s (was 4 calls, 75k input tokens, 15.8 s).

## 2026-10-18 — Reporting inventory through the typed client

- Changed: the reporting inventory (`/tables`) comes from `client.reporting.listTables()`, and the Table Browser's column list from its detail mode, instead of a hand-written `information_schema` query. RC's own `ReportTable` / `ReportEntity` copies are gone in favour of the client's types, which mark `template_value` as nullable and `kind` as always present.

## 2026-10-18 — Anthropic SDK 0.131.0, NL prompt tidy-up

- Changed: `@anthropic-ai/sdk` 0.95.1 → 0.131.0, pinned exact. `fallbacks` is now typed, so the untyped workaround is gone. None of the changelog's breaking entries touch RC's surface.
- Changed: the NL system prompt replaces the 500-word cap with "Keep answers to the length the question needs" and folds the "What NOT to Do" list into positive rules (say so when data isn't there; names over internal IDs).

## 2026-10-18 — MongoDB query pad

- Added: a Query tab per collection on the MongoDB page, with filter, projection and sort as Extended JSON. It autocompletes field paths (sampled from the collection) and operators, lints JSON as you type, runs on Ctrl/Cmd+Enter, and offers Format, a limit (1–500), paging and the total match count.
- Safety: the server parses with the driver's EJSON parser (nothing is evaluated). It rejects `$where`, `$function`, `$accumulator` and code values anywhere, bounds limit and skip, and stops queries after 10 s. Rejected input returns its reason. The console's MongoDB user is read-only, so writes are refused by MongoDB itself.

## 2026-10-18 — Code editor for the SQL surfaces

- Added: the Query Pad and the registered-view editor use a CodeMirror 6 editor. It highlights the PostgreSQL dialect, matches brackets and autocompletes table and column names: every namespace's tables, plus the chosen namespace's tables and views with their columns. Ctrl/Cmd+Enter runs the query (in the view editor it runs Test), and Shift+Alt+F or the new Format button reformats it.
- Bundle: the editor loads as its own chunk (~404 kB, ~134 kB gzipped) on first use, and sql-formatter loads when you first format. The main bundle is unchanged.

## 2026-10-18 — NL Query on Claude Sonnet 5.5

- Changed: the NL Query agent defaults to `claude-sonnet-5-5` (was `claude-sonnet-4-6`), at effort `low` (`NL_QUERY_EFFORT` overrides). `max_tokens` 4096 → 16000, because thinking is on by default and counts toward it.
- Added: requests on current models carry the server-side refusal fallback (`fallbacks: "default"`). The answer reports the model that actually served it.
- Fixed: a refusal, a length cutoff or an oversized conversation now produce an explanatory answer instead of empty or silently cut-off text. Ten tool rounds without an answer say so. Failed tool calls are marked `is_error`.
- Changed: the admin key check looks up the configured model through the Models API instead of sending a message, so it generates no tokens.
- Verified live on wip-local: a namespace lookup, a SQL aggregation across four tool calls, and a follow-up turn using history, all served by `claude-sonnet-5-5` in 5–10 s.

## 2026-10-18 — MongoDB authentication

- Added: the MongoDB page logs in as its own MongoDB user: `MONGO_USER` with `MONGO_PASSWORD_FILE` / `MONGO_PASSWORD`, `authSource: admin`, passed as client options rather than in the URI. Optional: anonymous without a user.
- Added: the page tells apart "no credentials", "credentials rejected" and "no read access", and shows the identity it reads as. Before, a refusal showed up as four databases in an error state behind a 200.
- Fixed: concurrent first requests share one connect attempt; a failed attempt is no longer cached; a failed login discards the client so a rotated password is picked up on the next request.
- Security: `/api/infra/mongo/docs` rejects filter field paths with a `$` segment and non-string filter values. `$where` ran server-side JavaScript, and the read-only role does not prevent that.

## 2026-10-17 — NATS authentication

- Added: the NATS page's backend authenticates to NATS as its own user — `NATS_USER` with `NATS_PASSWORD_FILE` / `NATS_PASSWORD`, or `NATS_CREDS_FILE`. Credentials are optional (anonymous when unset), passed as connect options rather than in the URL, and re-read on every reconnect, so a rotated password needs no restart. The reply inbox follows the user name to match the deployer's per-user grant.
- Added: the NATS page tells apart "credentials not configured" and "credentials rejected", and shows which identity is connected.
- Changed: `server/secret.ts` holds the shared file-then-env secret resolution; the WIP key uses it too.
- Fixed: concurrent NATS requests share one connect attempt instead of each opening a connection.
- Platform: WIP added the read-only `nats-monitor` role and gave it to RC's manifest; the deployed console now connects as `react-console` (verified live on wip-local).
- Fixed: the NATS page names a missing `NATS_URL` instead of a bare `CONNECTION_REFUSED`, and its "not deployed" check now recognises the nats.js refusal code.
- Verified against a real nats-server with wip-local's rendered config plus a `react-console` user: the three read calls succeed, anonymous and wrong-password connections are refused, the user cannot read stream info, delete streams or consumers, or publish or subscribe on `wip.*`, and a live password rotation reconnects on the next request.

## 2026-10-12 (later) — Platform fixes adopted: client 0.54.0, endpoint heal

- Changed: adopted @wip/client 0.54.0. All reporting SQL (table columns, preview, paging, Query Pad, view tests and previews) now goes through `client.reporting.runQuery` instead of RC's own `/query` fetch — the client's row type now matches the wire (CASE-861). The column lookup uses query parameters instead of interpolated names.
- Removed: the view preview's one-shot retry for "cached statement plan is invalid" — reporting-sync now prepares each query explicitly (CASE-859).
- Removed: the Query Pad's execution-time display, which the server never populated.
- Ops: ran the new template-store endpoint heal (CASE-858) on wip-local for kb, library, dev-wip-song and restore-rerun — 99 edge endpoints now carry their resolved template id; no template versions changed.

## 2026-10-12 — Registered views, NL agent fixes, client 0.53.0

Session APP-RC-20261012-143854. The clone was 37 commits behind origin. It was reset onto origin, and only the genuinely new work was re-applied.

### Reporting
- Added: **Views** tab on the PostgreSQL page for registered reporting views. These are the named, read-only SQL views a namespace keeps in its reporting schema; they are not part of the `/tables` inventory. The tab lists views across all namespaces, filterable by namespace and by name/SQL. Selecting a view shows its definition, who registered it and when, and a row preview, with Open in Query Pad. You can create or replace a view, with a Test preview before saving, and delete one. Server validation errors are shown as returned. Views registered by an app carry a note that the app's bootstrap re-registers them.
- Added: the Query Pad can be opened pre-filled (namespace + SQL) from other tabs.
- Known issues: the first query after a column-changing view replace fails on the platform side (CASE-859). The view row preview retries that error once.

### NL query
- Added: `list_registered_views` tool, plus prompt guidance to prefer an existing view over re-deriving a complex query.
- Fixed: `query_by_template` sent a body the documents query endpoint rejects (422). It now sends `template_id` (the template value, resolved within `?namespace=`), `page`/`page_size` and `filters` as `[{field, operator, value}]`. `namespace` is now required, and `offset` became `page`.
- Fixed: `list_terms` by terminology value always reported "not found", and `describe_data_model` always described an empty model. Both read response keys that list endpoints don't return (`items` / `terminology_id` / `template_id`). List calls now pass `page_size`, since WIP ignores `limit` and silently returns 50. `describe_data_model` passes `latest_only=true`.
- Fixed: the NL tools read only `WIP_API_KEY`, so in host-mode dev (where `.env` carries `WIP_API_KEY_FILE`) every def-store/template-store/document-store call got 401. The file-first key resolver now lives in `server/wip-key.ts` and is shared.

### Templates
- Changed: adopted @wip/client 0.53.0. Edge-type `source_templates` / `target_templates` are served as `{lookup_value, resolved}` entries. The detail page had been rendering them as `[object Object]`, and edit/duplicate loaded objects into the endpoint pickers. Both now use `lookup_value`.
- Fixed: the edge-type endpoint pickers listed templates from every namespace, so a value present in several namespaces appeared and ticked once per namespace. They now list the edge type's own namespace only, which is the only place endpoints resolve. Reference-usage templates are now offered (only relationship templates are excluded). A selected endpoint with no template in the namespace is shown ticked with "not in <ns>" so it can be removed.
- Fixed: the template list feeding the field reference pickers was capped at 100 templates. It now uses 1000, the API maximum.

### Fixes found during the documentation pass
- Fixed: every other "all templates" list (document list selector, document import, reference field picker target resolution, template detail, batch sync, traversal, cross-namespace template resolution) was capped at 100 or 200; all now fetch 1000. On wip-local (155 templates) the reference picker could resolve no target and offer no candidates.
- Fixed: the term picker said "Showing first 100 terms" from 100 terms on, although it loads up to 1000.
- Fixed: terminology CSV import sent a non-numeric `sort_order` as `NaN`; blank or non-integer values are now omitted.
- Fixed: in standalone OIDC mode the container healthcheck (`/health`) redirected to Dex — the public-path list named `/api/health`. Both are public now. Added the deployable-app contract's `/api/health` alias and `/api/app-config` (`{"namespace": null}`).
- Changed: `.env.example` brought current (port 3011, `WIP_API_KEY_FILE`, optional auth/admin/model variables).

### Documentation
- README, ARCHITECTURE, WIP_DEPENDENCIES, KNOWN_ISSUES and this changelog caught up with everything since 2026-04-11; new IMPORT_FORMATS.md; JSDoc on every exported component, hook and helper.

## 2026-08-20 — Sorting, logout, parity and NATS robustness

- Added: server-side sorting (`sort_by`/`sort_order`, default `updated_at` desc) on the Templates, Terminologies, Documents and Files list pages. The choice persists per page. Adopted @wip/client 0.51.0 / @wip/react 0.20.0.
- Added: refresh buttons for NATS stream details and for the Parity check.
- Fixed: logout now returns to the app's base path instead of a 404 at the site root (`return_to` on `/auth/logout`).
- Fixed: the Parity panel crashed when the API returned `null` counts.
- Fixed: an unreachable NATS now renders as the inactive state instead of an error, which matters on cross-cluster k8s deployments.
- Fixed: the batch sync job summary shows the synced vs no-op breakdown.
- Fixed: the document-store health probe hits its health endpoint instead of running a document query.
- Changed: adopted @wip/client 0.49.0 / @wip/proxy 0.5.1 via scaffold refreshes.

## 2026-07-26 — PostgreSQL browser filters and full table view

- Added: filter bar on the reporting Table Browser: namespace chips, name search, kind (views/tables), and default-on toggles that hide per-version `doc_*__vN` tables and empty tables. Filter state lives in the URL.
- Added: the table detail panel is now a full server-paginated table (25/50/100 per page) with typed cell formatting and CSV export, matching the document Table View.

## 2026-07-18 → 2026-07-22 — Reporting layout, backup/restore surface, template versioning

### Reporting
- Added: entity-first Table Browser, with tables grouped by template entity and view/table/legacy badges, falling back to a flat list on older installs. Added a **Parity** tab showing per-template view, version and legacy-table state (CASE-710).
- Added: the template editor gained a cross-version view editor and a Field Renames section. The template detail page shows both read-only.
- Changed: batch sync can be scoped to a namespace (@wip/client 0.44.0).

### Backup & restore
- Added: the page now exposes the platform's whole backup/restore/validate surface, including restore modes, namespace mapping on fresh restore, a dry-run Preview restore, and namespace validation.
- Changed: restore uploads stream through @wip/proxy 0.5.0 instead of buffering, and the bespoke upload route was retired. Combined-archive filenames list their namespaces.
- Removed: the "Latest versions only" / include-inactive toggles, which the platform ignored.

### Templates & documents
- Added: after a save that creates a new template version, the impact is shown: schema diff, live documents per version, and the migration verdict (CASE-722). Undeterminable values read "could not be determined", never zero.
- Added: Version History rows open an inline inspector with a field-level diff against the current version.
- Fixed: Deactivate acts on the version being viewed, not the latest.
- Fixed: the Documents page offers templates owned by another namespace when the selected namespace has documents based on them.
- Fixed: the term Hierarchy tab renders non-`is_a` relations (e.g. `part_of`).
- Changed: integrity results branch on the platform's `result_kind` discriminator.

### Keys & libraries
- Added: API keys show runtime/config tier badges with guidance. Config keys resolve effective permissions from the registry's grants field.
- Fixed: server routes and the `/wip` proxy honour `WIP_API_KEY_FILE` (the live wip-deploy secrets file), falling back to the inline `WIP_API_KEY` (@wip/proxy 0.4.3).
- Changed: adopted @wip/client 0.34–0.47 (renamed ontology surfaces, typed grants, real template facets, force semantics).
- Added: Gitea Actions offline CI gate (tsc, vitest, production build).

## 2026-07-05 → 2026-07-12 — Grants, per-namespace reporting schemas, terminology import

- Added: namespace grants management. Each namespace row on the Namespaces page can list, add and revoke grants, and API keys show their effective per-namespace permissions. Console-created scoped keys previously had no way to receive write access.
- Added: terminologies and templates can be found by UUID in list-page search.
- Added: by-term search mode on the Registry page (CASE-572).
- Added: terminology import from a file, available both on the list page (with a naming step) and inside an existing terminology. OBO Graph JSON and plain-text `.obo` import terms *and* relations through the server's ontology importer. CSV and JSON arrays import terms in bulk with per-item failure reporting.
- Fixed: every raw-SQL reporting surface was adapted to one PostgreSQL schema per namespace (CASE-628). The table browser groups by namespace using server-provided qualified names, the Query Pad has a namespace selector, CSV export passes the namespace, and the NL agent forwards it.
- Changed: adopted @wip/client 0.30–0.31 and @wip/proxy 0.4.2. 0.4.1 crashed at mount under Express 5 (CASE-637) and was briefly rolled back.

## 2026-06-11 → 2026-06-29 — Backup fan-out, build provenance, deployability

- Added: backups across several namespaces at once, either one archive per namespace (in parallel, each with its own progress card) or one combined archive. Restore UX is safer.
- Added: the dashboard shows per-service build provenance (version, sha, build time, image tag) where services expose it.
- Added: an Anthropic key can be set at runtime from the API Keys page (in memory only, validated with a 1-token probe) as an alternative to `ANTHROPIC_API_KEY`.
- Added: pinned-version pickers for template-to-template references (extends, nested object/array refs). The platform no longer accepts an unpinned "latest".
- Added: Reactivate action for deactivated template versions.
- Added: build-stamp footer.
- Fixed: template versions are scoped to their namespace.
- Changed: @wip/* are pinned to versioned, immutable tarballs checked into `libs/`, so CI can build images from git alone. Added a GitHub workflow building dual-arch images for GHCR.

## 2026-05-31 → 2026-06-08 — Housekeeping

- Fixed: enabling full deletion on a namespace sends the required `confirm_enable_deletion`.
- Changed: backup archive filenames carry the namespace and a timestamp.
- Changed: slash commands were renamed with the `wip-` prefix, and gitea references moved to `gitea.internal`.

## 2026-04-28 → 2026-05-11 — Edge types, full-text search, header fields, brand theme

- Added: edge-type (relationship template) support end to end: a usage filter and badges on the template list and detail, edge-type creation in the template editor (with source/target endpoints and automatic `source_ref`/`target_ref` fields), edge-aware document list, form and detail, and Relationships and Traversal sections on document detail.
- Added: full-text search surfaces (CASE-150).
- Added: `header_fields` editor and display on templates. Relationship peers, relationship endpoint chips and document list rows render a compact header-fields summary, falling back to identity fields.
- Added: batch sync admin surface on the PostgreSQL page.
- Added: brand palette tokens, Inter font, and WIP footer attribution. Raw palette utilities were swept to tokens, and NL query uses prompt caching.
- Fixed: file uploads forward the namespace, and fresh uploads appear immediately.
- Fixed: the reporting tables count reads the database, not a runtime counter.

## 2026-04-12 → 2026-04-20 — Auth modes, k8s deployment, dev container

- Added: gateway auth via `X-WIP-User` headers alongside OIDC. A 401 redirects to the gateway login instead of showing stale UI.
- Added: inactive WIP modules (e.g. reporting-sync not deployed) are detected and shown as friendly banners rather than errors.
- Added: `Dockerfile.dev` and a Vite host/proxy setup for `wip-deploy --app-source`, with a hash-gated `npm ci` entrypoint.
- Added: health probes report HTTP status, content type and the probed path. File-Store was added to the service checks.
- Fixed: OIDC uses separate internal and external issuer URLs, the SPA fallback works under Express 5, file content streams through the Express proxy instead of presigned MinIO URLs, and the NL `search` tool was restored using POST.
- Changed: the sidebar is flat again (accordion sub-menus removed). The namespace selector is dimmed on cross-namespace infrastructure pages.

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
