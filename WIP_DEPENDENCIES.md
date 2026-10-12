# RC-Console — WIP Dependencies

## Overview

RC-Console is a WIP admin console. It **inspects and manages WIP itself** rather than storing domain data of its own: it owns no terminologies, templates, or documents, and reads and manages whatever exists across **all namespaces** of the connected instance. Its contract with WIP is therefore the platform's API surface, listed below, not a data model.

## Client libraries

Pinned as versioned, immutable tarballs in `libs/` (see `package.json`):

| Library | Version | Role |
|---------|---------|------|
| `@wip/client` | 0.53.0 | Typed service clients (`client.registry`, `client.defStore`, `client.templates`, `client.documents`, `client.files`, `client.reporting`). |
| `@wip/react` | 0.20.0 | TanStack Query hooks over the client (`useTemplates`, `useTerms`, `useDocuments`, `useNamespaces`, mutations, …) and `useWipClient()` for direct typed calls. |
| `@wip/proxy` | 0.5.1 | Express middleware mounted at `/wip` that forwards to WIP and injects the API key. Streams request and response bodies both ways. |

Three ways RC reaches WIP, in order of preference:

1. **@wip/react hooks.** These cover most reads and the common mutations on terminologies, terms, term relations, templates, documents, files, namespaces, registry synonyms, batch sync, and API keys.
2. **The typed client via `useWipClient()`.** Used where no hook exists or the hook lags the client. Examples: registered views (`registerView` / `listViews` / `deleteView`), namespace-scoped batch sync, `importOntology`, `importTerminology`, `createTerms`, `importDocuments`, grants, audit logs, table view / CSV export, template facets, entity references.
3. **Raw `fetch` through the proxy** (`apiUrl('/wip/api/...')`). Used for:
   - endpoints the client doesn't wrap;
   - responses whose client type is wrong (see "Wire-shape assumptions" below);
   - backup archive uploads, which are multipart.

## WIP endpoint families used

Unless noted, every call goes through the `/wip` proxy.

| Service | Endpoints (representative) | Used for |
|---------|---------------------------|----------|
| registry | `/api/registry/namespaces`, entries (list / search / by-term / get), synonyms, merge, deactivate, API keys, namespace grants | Namespaces page, Registry page, API Keys page, grants panel |
| def-store | terminologies, terms, term relations, hierarchy (parents / children), import (terminology bundle and ontology), export, audit log, validate | Terminology and term pages, ontology tabs, import panel, Audit Explorer |
| template-store | templates (list / get / by value / versions), create, update, activate, deactivate, reactivate, delete | Template list, detail and builder |
| document-store | documents (list / query / get / versions / create / PATCH / archive / validate), relationships and traverse, table view, CSV export and import, template facets, files (list / upload / metadata / orphans / by checksum / content), backup jobs (`/backup/namespaces/{ns}/backup`, `/validate`, `/backup/namespaces/_/restore`, `/backup/jobs[/{id}[/download]]`) | Documents, Files and Backup & Restore pages |
| reporting-sync | `/tables`, `/query`, `/export/csv`, `/parity`, `/status`, `/health/integrity`, `/search`, batch sync jobs, entity references, **registered views `/namespace/{ns}/views[/{name}]`** | PostgreSQL page (Table Browser, Views, Query Pad, Batch Sync, Parity), Integrity, Dashboard, search surfaces |
| ingest-gateway | `/health`, `/status` | Dashboard service health; NATS page |

Registered views are **not** part of the `/tables` inventory. RC lists them per namespace by calling `listViews` once for each namespace.

## Server-side direct WIP callers

The Express server calls WIP itself in a few places. Each resolves the key via `server/wip-key.ts`: `WIP_API_KEY_FILE` first (the live wip-deploy secrets file), falling back to `WIP_API_KEY` (which the deployer injects into the container).

| Route / module | Calls | Why server-side |
|----------------|-------|-----------------|
| `/wip/*` (`@wip/proxy`) | everything the SPA sends | Key injection; the browser never sees the key |
| `GET /api/infra/health` | each service's probe path and root `build` block | Dashboard health and build provenance |
| `GET /api/file-content/:fileId` | `/api/document-store/files/{id}/content` | Stream file content; MinIO presigned URLs aren't reachable from the browser |
| `GET /api/backup-download/:jobId` | `/api/document-store/backup/jobs/{id}/download` | Streams the archive and rewrites `Content-Disposition` to `<namespace>_<timestamp>.zip` (the browser's `download` attribute can't override a same-origin header) |
| `/api/nl/*` (`server/nl/tools.ts`) | registry, def-store, template-store, document-store query, reporting-sync search / query / tables / views | NL query agent tools (all read-only) |

## Direct infrastructure connections

These bypass WIP's API because WIP doesn't expose infrastructure internals over REST. Both are read-only.

| System | Connection (env, default) | Purpose |
|--------|---------------------------|---------|
| MongoDB | `MONGO_URI`, default `mongodb://localhost:27017/` | Collection stats, indexes, paged document browsing over `wip_registry`, `wip_def_store`, `wip_template_store`, `wip_document_store` |
| NATS | `NATS_URL`, default `nats://localhost:4222` | JetStream streams and consumers |

## Wire-shape assumptions and open platform cases

RC depends on these behaviours. Each has an open case; when one closes, revisit the RC code listed.

| Case | Behaviour | What RC does |
|------|-----------|--------------|
| CASE-858 | Edge-type `source_templates` / `target_templates` are served as `{lookup_value, resolved}` entries. `resolved` is `null` on endpoints written before the two-half shape existed (all of kb's, for example). | Reads `lookup_value` everywhere: `TemplateDetailPage` (display) and `TemplateBuilderPage` (pickers). `lookup_value` is also a valid write input. |
| CASE-859 | The first `POST /query` after a registered view is replaced with a different column set fails with "cached statement plan is invalid"; the next one succeeds. | The view row preview (`useQueryRows` in `src/hooks/use-reporting.ts`) retries that exact error once. Other readers, including the Query Pad, will see the error. |
| CASE-861 | `@wip/client`'s `ReportQueryResult` declares `rows: unknown[][]`, but the server returns objects keyed by column. A result with no rows also comes back with `columns: []`. | RC never uses `client.reporting.runQuery`. `use-reporting.ts` posts to `/query` itself, typed as `Record<string, unknown>[]`. |

## System terminologies used

| Terminology | Purpose | Fallback |
|-------------|---------|----------|
| `_ONTOLOGY_RELATIONSHIP_TYPES` | Relation type options in the Add Relationship slide-out and the Hierarchy tab | Hardcoded list (`is_a`, `has_subtype`, `part_of`, `has_part`, `maps_to`, `mapped_from`, `related_to`, `finding_site`, `causative_agent`) |

## Terminologies and templates

RC owns none. It reads and manages all active terminologies and templates across namespaces. The document form, table view, and import wizard build themselves at runtime from whichever template is selected. The template builder edits every declarative slot the platform exposes, including edge-type endpoints, header fields, the cross-version reporting view, and field renames.

The dev namespace `dev-wip-reactconsole` holds only disposable test vocabularies (`TEST_OBO_IMPORT`, `SHAPES_ONTOLOGY`) used to verify the import paths.

## Seed files

None. RC has no data model to seed, so there is no `data-model/` directory and no bootstrap.

## External data sources

| Source | Purpose | Configuration |
|--------|---------|---------------|
| Anthropic API (Claude) | NL Query: the agent answers questions using the read-only WIP tools in `server/nl/tools.ts` | `ANTHROPIC_API_KEY`, or an in-memory override set from the API Keys page. Model from `NL_QUERY_MODEL` (default `claude-sonnet-4-6`). |

## Cross-app references

RC is namespace-agnostic, so every app's terminologies, templates, documents, and registered views are visible and manageable through it. Views registered by an app's bootstrap are flagged in the Views tab, because that app re-registers them on every start and would replace edits made in RC.
